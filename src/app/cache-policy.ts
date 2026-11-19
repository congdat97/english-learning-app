export const APP_CACHE_VERSION = '2026-11-19-v5';
export const CACHE_MAX_AGE_MS = 60_000;

const CACHE_PREFIXES = ['api-cache:', 'http_cache_', 'elf-data.'];

export function clearAppCaches(): boolean {
  try {
    if (localStorage.getItem('elf-app-version') === APP_CACHE_VERSION) return false;

    Object.keys(localStorage)
      .filter(key => CACHE_PREFIXES.some(prefix => key.startsWith(prefix)))
      .forEach(key => localStorage.removeItem(key));

    localStorage.setItem('elf-app-version', APP_CACHE_VERSION);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations()
        .then(registrations => registrations.forEach(registration => registration.unregister()))
        .catch(() => {});
    }

    return true;
  } catch {
    return false;
  }
}
