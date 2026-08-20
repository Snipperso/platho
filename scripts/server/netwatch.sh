#!/bin/bash
# Platho flight recorder.
#
# WHY THIS EXISTS. Twice on 2026-08-20 both Njalla boxes fell off the network while the machines themselves kept
# running: 13:52-13:55 UTC one could reach neither platho.app nor api.telegram.org, the kernel logged nothing
# (journalctl -k is EMPTY on this host — it is an LXC container, we have no kernel of our own), and by the time
# anyone could log back in there was nothing left to read. Njalla asked, reasonably: "do you not have anything in
# the servers own logs about why it failed?" We did not.
#
# So this writes one line every few seconds and FSYNCS IT, because a sample still sitting in the page cache when
# the machine vanishes never existed. After the next event, the last lines say which layer broke:
#
#   gw=FAIL  net=FAIL          -> the provider's edge is gone. Not ours. This is the line to send Njalla.
#   gw=OK    net=FAIL          -> the edge answers but the world does not: upstream routing.
#   net=OK   dns=FAIL          -> only name resolution died. The site was FINE for users; the alert was false.
#   link=DOWN or route=GONE    -> the virtual NIC or our route went away; in a container the host did that.
#   rx_drop/tx_err climbing    -> the host's vNIC is dropping our traffic.
#   GAP                        -> nobody ran for N seconds: the machine was frozen, paused or migrated.
#
# The GAP line matters most. A container that is live-migrated or stalled by its host shows NO network fault at
# all — it simply misses time — and that is invisible to every monitor that only asks "does the site answer".
set -u
LOG=${1:-/var/log/platho-netwatch.log}
DETAIL=${LOG%.log}-detail.log
INTERVAL=${2:-5}
CANARY=${3:-1.1.1.1}
OWN_NAME=${4:-platho.app}
MAX_BYTES=$((20 * 1024 * 1024))
WORST_PROBE=15                                   # ceiling of one round of probes when every one of them hangs
GAP_THRESHOLD=$(( INTERVAL * 3 + WORST_PROBE ))
EPOCH_FILE="${LOG%.log}.epoch"

note()   { printf '%s\n' "$*" >> "$LOG" || logger -t netwatch "CANNOT WRITE $LOG"; sync -d "$LOG" 2>/dev/null; }
detail() { printf '\n===== %s : %s =====\n' "$(date -u +%FT%TZ)" "$1" >> "$DETAIL"; shift; "$@" >> "$DETAIL" 2>&1; }

# Dump everything that explains a fault, but only WHEN one happens: at 5s cadence these would otherwise be the
# busiest thing on an idle box. Rotated like the main log — an unbounded detail file on a flapping link fills the
# disk in a day, and a full disk silently kills the recorder during the event it exists for.
dump_detail() {
  if [ "$(stat -c %s "$DETAIL" 2>/dev/null || echo 0)" -gt "$MAX_BYTES" ]; then mv -f "$DETAIL" "$DETAIL.1"; fi
  detail "$1" ip -s link
  detail "neighbours" ip neigh
  detail "routes" ip route show
  detail "sockets" ss -s
  detail "listen queues" ss -ltn
  if command -v dmesg >/dev/null; then
    printf '\n===== kernel tail =====\n' >> "$DETAIL"
    dmesg -T 2>/dev/null | tail -50 >> "$DETAIL" 2>&1
  fi
  sync -d "$DETAIL" 2>/dev/null
}

# THE INTERFACE IS RESOLVED ONCE, HERE.
# It used to be read from the default route on every pass, so the moment the route disappeared — the exact fault
# under investigation — iface became "none" and every counter printed "-". The header promised link=DOWN and
# "rx_drop climbing" as diagnoses, and both became unreachable precisely when they mattered. A reader would then
# conclude "counters clean, NIC fine" from dashes that only mean "did not look".
IFACE=$(ip -o link show up 2>/dev/null | awk -F': ' '$2 != "lo" {print $2; exit}')
# Strip the veth peer suffix. In a container `ip link` prints "eth0@if91", which is not a name under
# /sys/class/net — so the first run of this fix reported link=? and every counter as "-", reintroducing the
# blindness it was written to remove. Caught only because the header now prints the interface it chose.
IFACE=${IFACE%%@*}
IFACE=${IFACE:-eth0}
ST="/sys/class/net/$IFACE/statistics"

# SELF-TEST, so the recorder cannot fabricate the very evidence we would send a provider. If ICMP is unavailable
# or forbidden in this container, every line would read gw=FAIL net=FAIL forever, and someone would open a ticket
# on the strength of a constant.
have() { if command -v "$1" >/dev/null 2>&1; then echo yes; else echo NO; fi; }
icmp_ok=NO
if [ "$(have ping)" = yes ] && ping -c1 -W2 -n 127.0.0.1 >/dev/null 2>&1; then icmp_ok=yes; fi
note "# netwatch started $(date -u +%FT%TZ) iface=$IFACE interval=${INTERVAL}s canary=${CANARY} name=${OWN_NAME}"
note "# tools: ping=$(have ping) icmp=$icmp_ok getent=$(have getent) ss=$(have ss) virt=$(systemd-detect-virt 2>/dev/null || echo ?)"
if [ "$icmp_ok" != yes ]; then
  note "# WARNING: ICMP unusable here — gw= and net_icmp= carry no information; trust net_tcp= only"
fi

# Monotonic seconds. Wall clock is NOT usable for this: in a container the clock belongs to the host, and a step
# forward invents gaps that never happened while a step backward hides real ones.
mono() { awk '{print int($1)}' /proc/uptime; }

# A restart must not erase the gap that caused it. If the process was killed by the freeze, a fresh start would
# reset the baseline to "now" and the event would go unrecorded — the detector failing at its one job.
last=$(cat "$EPOCH_FILE" 2>/dev/null || true)
now=$(mono)
if [ -n "${last:-}" ] && [ "$last" -gt 0 ] 2>/dev/null && [ $(( now - last )) -gt "$GAP_THRESHOLD" ]; then
  note "$(date -u +%FT%TZ) GAP across restart: nothing ran for $(( now - last ))s"
fi
last_mono=$now
down_votes=0
up_votes=0
was_down=0

while :; do
  now=$(mono)
  drift=$(( now - last_mono ))
  if [ "$drift" -gt "$GAP_THRESHOLD" ]; then
    note "$(date -u +%FT%TZ) GAP nothing ran for ${drift}s (budget ${GAP_THRESHOLD}s) — machine frozen, paused or migrated"
    dump_detail "after a ${drift}s gap"
  fi
  last_mono=$now
  echo "$now" > "$EPOCH_FILE" 2>/dev/null

  gw=$(ip -4 route show default 2>/dev/null | awk '{print $3; exit}')
  route=OK
  if [ -z "${gw:-}" ]; then route=GONE; gw=none; fi
  link=$(cat "/sys/class/net/$IFACE/operstate" 2>/dev/null || echo "?")
  rxe=$(cat "$ST/rx_errors" 2>/dev/null || echo -)
  txe=$(cat "$ST/tx_errors" 2>/dev/null || echo -)
  rxd=$(cat "$ST/rx_dropped" 2>/dev/null || echo -)
  txd=$(cat "$ST/tx_dropped" 2>/dev/null || echo -)

  # Layer 2/3 to the edge, then past it, BY TWO INDEPENDENT MEANS. ICMP alone is a single point of misdiagnosis:
  # plenty of routers drop it as policy. When net_icmp and net_tcp disagree, the disagreement is the finding.
  if [ "$route" = OK ] && ping -c2 -W1 -i0.3 -n "$gw" >/dev/null 2>&1; then gwok=OK; else gwok=FAIL; fi
  if ping -c3 -W2 -i0.3 -n "$CANARY" >/dev/null 2>&1; then icmpok=OK; else icmpok=FAIL; fi
  if timeout 2 bash -c "exec 3<>/dev/tcp/$CANARY/443" 2>/dev/null; then tcpok=OK; else tcpok=FAIL; fi
  arp=$(ip neigh show "$gw" 2>/dev/null | awk '{print $NF}' | head -1)
  arp=${arp:-NONE}

  # OUR OWN NAME, not somebody else's. The first version asked api.telegram.org, which resolves perfectly at the
  # exact moment platho.app returns SERVFAIL from this box's single resolver — so the recorder would have printed
  # dns=OK straight through the failure and handed that line to the provider as proof of their fault.
  if timeout 3 getent hosts "$OWN_NAME" >/dev/null 2>&1; then dnsok=OK; else dnsok=FAIL; fi

  tcp=$(awk '/^TCP:/{print $3}' /proc/net/sockstat 2>/dev/null || echo -)
  mem=$(awk '/MemAvailable/{printf "%d", $2/1024}' /proc/meminfo)
  load=$(cut -d' ' -f1 /proc/loadavg)
  # Recv-Q on the TLS listener: 4097 against a backlog of 4096 was how the previous incident actually presented.
  q443=$(ss -ltn 2>/dev/null | awk '$4 ~ /:443$/ {print $2"/"$3; exit}')
  q443=${q443:--}

  note "$(date -u +%FT%TZ) link=$link route=$route gw=$gw:$gwok($arp) net_icmp=$icmpok net_tcp=$tcpok dns=$dnsok tcp=$tcp q443=$q443 rx_err=$rxe tx_err=$txe rx_drop=$rxd tx_drop=$txd mem=${mem}M load=$load"

  # HYSTERESIS. A single lost packet used to flip the state and fire a full dump; on a path with ~20% loss that
  # is thousands of "network went away / RECOVERED" pairs a day, burying a genuine three-minute outage in noise
  # and filling the disk with dumps. Two agreeing rounds are required before anything is declared.
  if [ "$tcpok" = FAIL ] && [ "$icmpok" = FAIL ]; then
    down_votes=$((down_votes+1)); up_votes=0
  else
    up_votes=$((up_votes+1)); down_votes=0
  fi
  if [ "$down_votes" -ge 2 ] && [ "$was_down" = 0 ]; then
    was_down=1
    dump_detail "network went away (gw=$gwok icmp=$icmpok tcp=$tcpok dns=$dnsok)"
  fi
  if [ "$up_votes" -ge 2 ] && [ "$was_down" = 1 ]; then
    was_down=0
    note "$(date -u +%FT%TZ) RECOVERED"
    dump_detail "network came back"
  fi

  if [ "$(stat -c %s "$LOG" 2>/dev/null || echo 0)" -gt "$MAX_BYTES" ]; then mv -f "$LOG" "$LOG.1"; sync 2>/dev/null; fi
  sleep "$INTERVAL"
done
