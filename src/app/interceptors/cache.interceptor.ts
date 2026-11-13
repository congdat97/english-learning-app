import { HttpInterceptorFn } from '@angular/common/http';
import { of } from 'rxjs';
import { tap } from 'rxjs/operators';

const TTL = 5 * 60 * 1000;
const PREFIX = 'http_cache_';

function readCache(key: string): unknown | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.expiry < Date.now()) {
      localStorage.removeItem(PREFIX + key);
      return null;
    }
    return parsed.body;
  } catch {
    return null;
  }
}

function writeCache(key: string, body: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ expiry: Date.now() + TTL, body }));
  } catch {
    // ignore quota errors
  }
}

export const cacheInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method !== 'GET') return next(req);
  const key = req.urlWithParams;
  const cached = readCache(key);
  if (cached !== null) {
    return of(cached as any);
  }
  return next(req).pipe(
    tap((event: any) => {
      if (event?.type === 4) {
        writeCache(key, event.body);
      }
    })
  );
};
