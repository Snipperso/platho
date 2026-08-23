// Plain-script boot watchdog. Loaded before the module graph on purpose and
// written in ES5 so it runs on any browser the app itself cannot: when the
// module graph fails to parse or execute (old Safari, blocked resources),
// the page would otherwise stay a silent dark shell. This shows what went
// wrong instead. CSP note: styles go through CSSOM property assignments
// because style-src 'self' forbids inline style attributes.
//
// It measures the app's EXECUTION, not its DOWNLOAD: on a cold load (a hard
// reload that bypasses the service-worker cache, or a brand-new visitor) the
// whole module graph plus crypto vendor downloads over the network, which can
// take many seconds and must NOT trip the guard. After 'load' (every script
// downloaded AND executed; a healthy app is already 'ready') it allows a short
// grace, then decides. BEFORE 'load' it is STALL-driven: it fires only once
// downloads have genuinely STOPPED arriving (no subresource finished for
// STALL_MS) - a slow-but-progressing cold load keeps resetting that and is
// never mistaken for a stuck page - with an absolute backstop for a request
// that hangs forever so 'load' never arrives.
//
// User-facing copy is English-only on purpose: this screen is served to every
// visitor regardless of locale, so any other language hardcoded here would
// leak the team's origin. Keep it English-only and ASCII (OPSEC invariant,
// enforced by tests/web-no-locale-leak.test.ts).
(function () {
  'use strict';

  // Apply the user's forced theme BEFORE first paint (this script loads in <head>, ahead of <body>), so a
  // light-theme user never sees a dark flash. Unset key = follow the system (prefers-color-scheme).
  try {
    var plathoTheme = localStorage.getItem('platho.theme.v1');
    if (plathoTheme === 'light' || plathoTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', plathoTheme);
    }
  } catch (e) { /* storage unavailable -- system theme applies */ }

  // Post-load grace for the app to reach 'ready'. Small on purpose: 'ready' is set at the
  // end of the module's top-level execution, which completes before 'load' fires, so a
  // healthy boot is already 'ready' here; the grace only covers minor async settling.
  var GRACE_MS = Number(document.documentElement.getAttribute('data-platho-boot-guard-timeout-ms')) || 6000;
  // The pre-load guard is STALL-driven, not a fixed timer: it fires as soon as downloads have genuinely STOPPED
  // (no subresource finished for STALL_MS) after a short floor -- NOT after some big fixed wait. The old fixed 45s
  // fired MID-DOWNLOAD on a cold cache (boot-critical ~2.5MB of the ~4MB precache), showing the scary "did not
  // load" screen while files were still arriving (Retry then loaded instantly because the cache had just warmed).
  // A healthy-but-slow load keeps resources arriving, so the stall never trips; a genuinely hung request stops
  // arriving and surfaces in ~STALL_MS. HARD_CAP_MS is only the ultimate backstop for a pathological slow dribble
  // that never fully stalls yet never finishes.
  var STALL_MS = 12000;      // no subresource finished for this long means stuck, not slow.
  var MIN_WAIT_MS = 10000;   // never fire before this (a brief early stall while the first bytes arrive is normal).
  var HARD_CAP_MS = 60000;   // ultimate backstop (a dribble that never stalls for STALL_MS yet never reaches ready).
  var bootErrors = [];
  var guardFired = false;
  var lastProgressAt = Date.now();
  // Each finished subresource (a module/vendor arriving) is DOWNLOAD PROGRESS. A slow-but-steady cold load keeps
  // resetting this, so the cap check reschedules instead of misfiring. (buffered:true replays entries that landed
  // before this observer attached.)
  if (typeof PerformanceObserver !== 'undefined') {
    try {
      var progressObserver = new PerformanceObserver(function (list) {
        if (list.getEntries && list.getEntries().length) lastProgressAt = Date.now();
      });
      progressObserver.observe({ type: 'resource', buffered: true });
    } catch (observerError) { /* PerformanceObserver unavailable: the absolute cap still applies */ }
  }

  function rememberBootError(text) {
    if (!text) return;
    if (bootErrors.length >= 4) return;
    bootErrors.push(String(text).slice(0, 300));
  }

  window.addEventListener('error', function (event) {
    if (event && event.message) {
      var where = '';
      if (event.filename) {
        var parts = String(event.filename).split('/');
        where = ' @ ' + parts[parts.length - 1] + ':' + (event.lineno || 0);
      }
      rememberBootError(event.message + where);
      return;
    }
    var target = event && event.target;
    var src = target && (target.src || target.href);
    if (src) {
      var srcParts = String(src).split('/');
      rememberBootError('resource failed: ' + srcParts[srcParts.length - 1]);
    }
  }, true);

  window.addEventListener('unhandledrejection', function (event) {
    var reason = event && event.reason;
    rememberBootError('rejection: ' + (reason && reason.message ? reason.message : reason));
  });

  function styled(tag, styles) {
    var node = document.createElement(tag);
    for (var key in styles) {
      if (Object.prototype.hasOwnProperty.call(styles, key)) node.style[key] = styles[key];
    }
    return node;
  }

  function showGuard() {
    if (guardFired) return;
    var state = document.documentElement.getAttribute('data-platho-app-js');
    // 'ready' is the terminal healthy marker set at the very end of the app
    // module, after every handler is wired; the app's own error hooks never
    // downgrade it. A missing marker means the module graph never ran;
    // 'started'/'error' without 'ready' means the boot died in the middle -
    // the page may render but stays partially or fully inert.
    if (state === 'ready') return;
    if (!document.body) return;
    guardFired = true;

    var overlay = styled('div', {
      position: 'fixed',
      top: '0',
      left: '0',
      right: '0',
      bottom: '0',
      zIndex: '2147483000',
      background: '#0b0d0f',
      color: '#e8edf2',
      fontFamily: '-apple-system, system-ui, "Segoe UI", Roboto, sans-serif',
      fontSize: '15px',
      lineHeight: '1.5',
      padding: '32px 20px',
      overflow: 'auto',
      WebkitOverflowScrolling: 'touch',
      boxSizing: 'border-box',
    });
    overlay.id = 'plathoBootGuard';

    var midBoot = state === 'started' || state === 'error';
    var title = styled('div', { fontSize: '18px', fontWeight: '600', marginBottom: '12px' });
    title.textContent = midBoot
      ? 'Platho boot did not finish'
      : 'Platho did not finish loading';
    overlay.appendChild(title);

    // A missing marker almost always means a file did not finish downloading (a transient
    // network hiccup), which a reload fixes - NOT necessarily an old or in-app browser. Lead
    // with the reload; demote the browser / in-app hints to a secondary "if it persists" note
    // so this screen never misattributes a network failure to the user's browser.
    var hint = styled('div', { marginBottom: midBoot ? '16px' : '8px', color: '#b7c0c9' });
    hint.textContent = midBoot
      ? 'Parts of the app may not respond. Please share a screenshot of this screen.'
      : 'A file did not finish downloading. Tap Reload to try again - this usually fixes it.';
    overlay.appendChild(hint);

    if (!midBoot) {
      var hint2 = styled('div', { marginBottom: '16px', color: '#7d8893', fontSize: '13px' });
      hint2.textContent = 'Still stuck after a few tries? Check your connection, update your browser, or open platho.app directly if you opened this inside another app.';
      overlay.appendChild(hint2);
    }

    var appError = document.documentElement.getAttribute('data-platho-app-error');
    if (appError) rememberBootError('app: ' + appError);

    if (bootErrors.length > 0) {
      var errorsTitle = styled('div', { fontWeight: '600', marginBottom: '6px' });
      errorsTitle.textContent = 'Details:';
      overlay.appendChild(errorsTitle);
      for (var i = 0; i < bootErrors.length; i += 1) {
        var line = styled('div', {
          fontFamily: 'ui-monospace, Menlo, monospace',
          fontSize: '12px',
          color: '#ff9d9d',
          marginBottom: '4px',
          wordBreak: 'break-word',
        });
        line.textContent = bootErrors[i];
        overlay.appendChild(line);
      }
    }

    var meta = styled('div', { fontSize: '12px', color: '#7d8893', margin: '14px 0 18px' });
    meta.textContent = navigator.userAgent;
    overlay.appendChild(meta);

    var reload = styled('button', {
      background: '#2a6df4',
      color: '#ffffff',
      border: 'none',
      borderRadius: '10px',
      padding: '12px 18px',
      fontSize: '15px',
      fontWeight: '600',
      marginRight: '10px',
    });
    reload.type = 'button';
    reload.textContent = 'Reload';
    reload.addEventListener('click', function () {
      window.location.reload();
    });
    overlay.appendChild(reload);

    var dismiss = styled('button', {
      background: 'transparent',
      color: '#b7c0c9',
      border: '1px solid #2a3138',
      borderRadius: '10px',
      padding: '12px 18px',
      fontSize: '15px',
      fontWeight: '600',
    });
    dismiss.type = 'button';
    dismiss.textContent = 'Continue';
    dismiss.addEventListener('click', function () {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    });
    overlay.appendChild(dismiss);

    document.body.appendChild(overlay);
  }

  // Pre-load watchdog: the module graph is still downloading/executing ('load' has not fired). Reach the cap
  // ONLY on a genuine stall -- while resources keep arriving (lastProgressAt fresh), reschedule so a slow cold
  // download is never mistaken for a hung page. 'ready' (set at the app module's top-level end) stops it; once
  // 'load' fires, afterLoad's short grace owns the decision instead.
  var startedAt = Date.now();
  function hardCapCheck() {
    if (guardFired) return;
    if (document.documentElement.getAttribute('data-platho-app-js') === 'ready') return;
    if (document.readyState === 'complete') return; // 'load' fired -> afterLoad grace path
    var now = Date.now();
    var elapsed = now - startedAt;
    var stalled = (now - lastProgressAt) >= STALL_MS;
    // Fire on a genuine STALL (past the floor) or, failing that, the ultimate backstop.
    if ((elapsed >= MIN_WAIT_MS && stalled) || elapsed >= HARD_CAP_MS) {
      showGuard();
      return;
    }
    setTimeout(hardCapCheck, 2000);
  }
  setTimeout(hardCapCheck, 2000);

  function afterLoad() {
    setTimeout(showGuard, GRACE_MS);
  }

  if (document.readyState === 'complete') {
    afterLoad();
  } else {
    window.addEventListener('load', afterLoad);
  }
})();
