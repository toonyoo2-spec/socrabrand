// Keep a Google connection only for this browser tab and its token lifetime.
// Never persist credentials to localStorage or include them in request text.
export function createGoogleSession(key, storage = () => globalThis.sessionStorage, now = () => Date.now()) {
  const remove = () => { try { storage().removeItem(key); } catch {} };
  return {
    read(clientId) {
      try {
        const value = JSON.parse(storage().getItem(key) || 'null');
        if (value?.clientId === clientId && typeof value.token === 'string' && value.token && Number.isFinite(value.expiresAt) && value.expiresAt > now()) return value;
      } catch {}
      remove();
      return null;
    },
    save(clientId, token, expiresAt) {
      if (!clientId || !token || !Number.isFinite(expiresAt) || expiresAt <= now()) { remove(); return; }
      try { storage().setItem(key, JSON.stringify({clientId, token, expiresAt})); } catch {}
    },
    clear: remove
  };
}
