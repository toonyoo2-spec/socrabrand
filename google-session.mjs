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

// Both LX tools share the same Google client/scopes within this browser tab.
export const SHARED_GOOGLE_SESSION_KEY='socra_lx_google_drive';
const LEGACY_GOOGLE_KEYS=['socra_notes_google','socra_editing_google'];
export function createSharedGoogleSession(storage=()=>globalThis.sessionStorage,now=()=>Date.now()){
 const shared=createGoogleSession(SHARED_GOOGLE_SESSION_KEY,storage,now);
 const removeLegacy=()=>{try{for(const key of LEGACY_GOOGLE_KEYS)storage().removeItem(key);}catch{}};
 const notify=()=>{if(typeof window!=='undefined'&&typeof window.dispatchEvent==='function')window.dispatchEvent(new Event('socra:google-sessionchange'));};
 return {read(clientId){const value=shared.read(clientId);if(value)return value;for(const key of LEGACY_GOOGLE_KEYS){const legacy=createGoogleSession(key,storage,now).read(clientId);if(legacy){shared.save(clientId,legacy.token,legacy.expiresAt);removeLegacy();return legacy;}}return null;},save(clientId,token,expiresAt){shared.save(clientId,token,expiresAt);removeLegacy();notify();},clear(){shared.clear();removeLegacy();notify();}};
}
export function watchGoogleSession(callback){if(typeof window==='undefined'||!window.addEventListener)return ()=>{};const storage=e=>{if(e.key===SHARED_GOOGLE_SESSION_KEY||e.key===null)callback();};window.addEventListener('storage',storage);window.addEventListener('socra:google-sessionchange',callback);window.addEventListener('focus',callback);return ()=>{window.removeEventListener('storage',storage);window.removeEventListener('socra:google-sessionchange',callback);window.removeEventListener('focus',callback);};}
