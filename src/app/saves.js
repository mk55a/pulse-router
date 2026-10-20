// Versioned save slots in localStorage: key `<gameId>_game_<slot>`, value { version, data }.
// Bad or missing data falls back to the slot's defaults; older versions go through `migrate`;
// a save from a newer version of the game is left untouched. Storage failures (private mode,
// full disk) never break the game: the slot keeps working in memory for the session.
export function createSaves(gameId, storage = globalThis.localStorage) {
  const opened = new Set();
  return {
    open(name, { version, defaults, validate, migrate = () => defaults() }) {
      if (opened.has(name)) throw new Error(`Save slot "${name}" is already open`);
      opened.add(name);
      const key = `${gameId}_game_${name}`;
      const copy = v => JSON.parse(JSON.stringify(v));
      let value = defaults(), readOnly = false;
      try {
        const raw = storage.getItem(key);
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved.version > version) readOnly = true;
          else {
            const data = saved.version === version ? saved.data : migrate(saved.data, saved.version);
            if (validate(data)) value = data;
          }
        }
      } catch {}
      return {
        read: () => copy(value),
        write(next) {
          if (readOnly || !validate(next)) return false;
          value = copy(next);
          try { storage.setItem(key, JSON.stringify({ version, data: value })); return true; } catch { return false; }
        },
        reset() { return this.write(defaults()); }
      };
    }
  };
}

// Small JSON values (preferences, current level) in their own keys.
export function readJSON(key, fallback, storage = globalThis.localStorage) {
  try { const raw = storage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}
export function writeJSON(key, value, storage = globalThis.localStorage) {
  try { storage.setItem(key, JSON.stringify(value)); } catch {}
}
