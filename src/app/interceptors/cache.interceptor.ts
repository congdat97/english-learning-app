import { HttpInterceptorFn } from '@angular/common/http';
import { of } from 'rxjs';
import { tap } from 'rxjs/operators';

const cache = new Map<string, { expiry: number; body: unknown }>();
const TTL = 60_000;

export const cacheInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method !== 'GET') return next(req);
  const key = req.urlWithParams;
  const cached = cache.get(key);
  if (cached && cached.expiry > Date.now()) {
    return of(cached.body as any);
  }
  return next(req).pipe(
    tap((event) => {
      if (event.type === 4) {
        cache.set(key, { expiry: Date.now() + TTL, body: event.body });
      }
    })
  );
};
