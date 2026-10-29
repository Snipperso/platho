export const lockManager = () => {
  const queues = new Map<string, Array<() => void>>();
  const held = new Map<string, { stolen: boolean, reject: (error: any) => void }>();
  const next = (name: string) => { const grant = queues.get(name)?.shift(); if (grant) grant(); };
  return {
    holding: (name: string) => held.has(name),
    request(name: string, optionsOrCallback: any, maybeCallback?: (lock: any) => any) {
      const options = typeof optionsOrCallback === 'function' ? {} : optionsOrCallback;
      const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback!;
      return new Promise((resolve, reject) => {
        const grant = () => {
          const holder = { stolen: false, reject };
          held.set(name, holder);
          Promise.resolve(callback({ name })).then(
            (value) => { if (holder.stolen) return; held.delete(name); next(name); resolve(value); },
            (error) => { if (holder.stolen) return; held.delete(name); next(name); reject(error); },
          );
        };
        if (options?.steal) {
          const current = held.get(name);
          if (current) {
            current.stolen = true;
            current.reject(Object.assign(new Error('the lock was stolen'), { name: 'AbortError' }));
          }
          grant();
          return;
        }
        if (!held.has(name) && !(queues.get(name)?.length)) { grant(); return; }
        if (options?.ifAvailable) { Promise.resolve(callback(null)).then(resolve, reject); return; }
        const queue = queues.get(name) ?? [];
        queues.set(name, queue);
        queue.push(grant);
        options?.signal?.addEventListener('abort', () => {
          const at = queue.indexOf(grant);
          if (at >= 0) { queue.splice(at, 1); reject(Object.assign(new Error('aborted'), { name: 'AbortError' })); }
        });
      });
    },
  };
};

export const broadcastHub = () => {
  const open = new Set<any>();
  const frozen = new Map<any, any[]>();
  class Channel {
    name: string;
    onmessage: ((event: any) => void) | null = null;
    constructor(name: string) { this.name = name; open.add(this); }
    postMessage(data: any) {
      for (const other of open) {
        if (other === this || other.name !== this.name) continue;
        const deliver = () => other.onmessage?.({ data: JSON.parse(JSON.stringify(data)) });
        if (frozen.has(other)) frozen.get(other)!.push(deliver); else setTimeout(deliver, 0);
      }
    }
    close() { open.delete(this); }
  }
  return {
    Channel,
    channels: () => [...open],
    freeze: (channel: any) => { if (!frozen.has(channel)) frozen.set(channel, []); },
    thaw: (channel: any) => { const queued = frozen.get(channel) ?? []; frozen.delete(channel); for (const deliver of queued) deliver(); },
  };
};
