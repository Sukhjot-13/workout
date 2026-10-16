// Serialize writes for each date/day. A slow older request must finish before
// the newer snapshot is sent, and may never announce that newer work is saved.
export function createSaveQueue({ send, onStatus, delay = 500 }) {
  const pending = new Map();
  const running = new Map();
  const timers = new Map();
  const versions = new Map();

  function queue(key, payload) {
    const version = (versions.get(key) || 0) + 1;
    versions.set(key, version);
    pending.set(key, { payload, version });
    clearTimeout(timers.get(key));
    timers.set(key, setTimeout(() => flush(key), delay));
    onStatus(key, "saving");
  }

  async function flush(key, keepalive = false) {
    clearTimeout(timers.get(key));
    timers.delete(key);
    if (running.has(key)) return running.get(key);
    const entry = pending.get(key);
    if (!entry) return;
    pending.delete(key);
    const request = (async () => {
      try {
        const result = await Promise.resolve().then(() => send(entry.payload, keepalive));
        if (versions.get(key) === entry.version) onStatus(key, result);
      } catch (error) {
        if (versions.get(key) === entry.version) onStatus(key, "error");
        console.warn("Workout cloud save failed:", error);
      } finally {
        running.delete(key);
        if (pending.has(key)) await flush(key, keepalive);
      }
    })();
    running.set(key, request);
    return request;
  }

  function flushAll(keepalive = false) {
    return Promise.all([...pending.keys()].map((key) => flush(key, keepalive)));
  }

  return { queue, flush, flushAll };
}
