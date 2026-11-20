import {
  HttpEvent,
  HttpInterceptorFn,
  HttpResponse
} from '@angular/common/http';

import { inject } from '@angular/core';

import { catchError, of, throwError } from 'rxjs';

import { tap } from 'rxjs/operators';

import { CACHE_MAX_AGE_MS } from '../cache-policy';

import { AuthService } from '../services/auth.service';

/**
 * Cache API ngắn hạn để giảm tải Render:
 * - Còn hạn -> phát ngay từ localStorage.
 * - Hết hạn -> gọi API, lưu cache mới; nếu API lỗi thì dùng cache cũ.
 * - force refresh -> luôn gọi API.
 *
 * Ghi (POST/PUT/DELETE) thành công -> xóa cache cùng nhóm tài nguyên.
 */

const PREFIX = 'http_cache_';

interface CacheEntry {
  ts: number;
  body: unknown;
}

function readEntry(
  key: string,
  allowStale = false
): CacheEntry | null {

  try {

    const raw =
      localStorage.getItem(PREFIX + key);

    if (!raw) {
      return null;
    }

    const parsed =
      JSON.parse(raw) as Partial<CacheEntry>;

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      parsed.body === undefined ||
      parsed.body === null
    ) {
      localStorage.removeItem(PREFIX + key);
      return null;
    }

    const ts =
      typeof parsed.ts === 'number'
        ? parsed.ts
        : Date.now();

    if (!allowStale && Date.now() - ts > CACHE_MAX_AGE_MS) {
      return null;
    }

    return { ts, body: parsed.body };

  } catch {
    return null;
  }

}

function writeEntry(
  key: string,
  body: unknown
): void {

  try {

    // Không cache dữ liệu quá lớn (tránh tràn localStorage)
    if (
      JSON.stringify(body ?? {}).length >
      1_500_000
    ) {
      return;
    }

    localStorage.setItem(
      PREFIX + key,
      JSON.stringify({ ts: Date.now(), body })
    );

  } catch {
    // ignore quota errors
  }

}

/**
 * Xóa cache cùng "nhóm tài nguyên" sau khi ghi thành công.
 * VD: POST /api/lessons/1/progress -> xóa mọi cache có '/lessons'
 *     POST /api/vocabulary/2/bookmark -> xóa mọi cache có '/vocabulary'
 */
function invalidateFamily(url: string): void {

  try {

    const path =
      url.replace(/^https?:\/\/[^/]+/, '');

    const match =
      path.match(/\/api\/([^/?#]+)/);

    const family =
      match ? match[1] : null;

    if (!family) {
      return;
    }

    const marker = `/${family}`;

    const keys: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {

      const storageKey =
        localStorage.key(i);

      if (
        storageKey &&
        storageKey.startsWith(PREFIX) &&
        storageKey.includes(marker)
      ) {
        keys.push(storageKey);
      }

    }

    for (const storageKey of keys) {
      localStorage.removeItem(storageKey);
    }

  } catch {
    // ignore
  }

}

function toResponse(
  req: Parameters<HttpInterceptorFn>[0],
  body: unknown
): HttpResponse<unknown> {

  return new HttpResponse({
    body,
    url: req.urlWithParams,
    status: 200
  });

}

export const cacheInterceptor: HttpInterceptorFn = (req, next) => {

  // Cache phân theo user đăng nhập để không lẫn dữ liệu giữa các tài khoản
  const auth = inject(AuthService);

  const uid = auth.currentUser()?.id;

  const key = (uid ? uid + ':' : '') + req.urlWithParams;

  // ===== GHI: không cache, chỉ xóa cache cùng nhóm khi thành công =====
  if (req.method !== 'GET') {

    return next(req).pipe(
      tap((event: HttpEvent<unknown>) => {

        if (
          event instanceof HttpResponse &&
          event.ok
        ) {
          invalidateFamily(req.url);
        }

      })
    );

  }

  // ===== GET =====

  const forceRefresh = req.headers.get('X-Force-Refresh') === '1';
  const noCache = req.headers.get('X-No-Cache') === '1';
  if (noCache) {
    try { localStorage.removeItem(PREFIX + key); } catch {}
  }

  if (!forceRefresh && !noCache) {
    const entry = readEntry(key);
    if (entry) {
      return of(toResponse(req, entry.body));
    }
  }

  let outgoing = req;
  if (noCache) outgoing = outgoing.clone({ headers: outgoing.headers.delete('X-No-Cache') });

  return next(outgoing).pipe(
    tap((event: HttpEvent<unknown>) => {

      if (
        !noCache &&
        event instanceof HttpResponse &&
        event.ok &&
        (event.body as { success?: boolean } | null)?.success !== false
      ) {
        writeEntry(key, event.body);
      }

    }),
    catchError(err => {
      const stale = forceRefresh || noCache ? null : readEntry(key, true);
      return stale
        ? of(toResponse(req, stale.body))
        : throwError(() => err);
    })
  );

};
