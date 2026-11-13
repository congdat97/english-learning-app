import {
  HttpEvent,
  HttpInterceptorFn,
  HttpResponse
} from '@angular/common/http';

import { of } from 'rxjs';

import { tap } from 'rxjs/operators';

/**
 * CACHE-FIRST + STALE-WHILE-REVALIDATE
 *
 * GET:
 *  - Có cache -> dùng ngay từ localStorage + tự gọi nền để làm mới cache
 *    (dữ liệu ít thay đổi nên hiển thị tức thì là ưu tiên).
 *  - Chưa có cache -> gọi API, thành công thì lưu vào localStorage.
 *  - API lỗi mà còn cache -> vẫn trả cache cũ (dùng offline được).
 *
 * Ghi (POST/PUT/DELETE) thành công -> xóa cache cùng nhóm tài nguyên
 * để lần GET sau lấy dữ liệu mới.
 */

const PREFIX = 'http_cache_';

interface CacheEntry {
  body: unknown;
}

function readEntry(key: string): CacheEntry | null {

  try {

    const raw =
      localStorage.getItem(PREFIX + key);

    if (!raw) {
      return null;
    }

    const parsed =
      JSON.parse(raw) as CacheEntry;

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      parsed.body === undefined ||
      parsed.body === null
    ) {
      localStorage.removeItem(PREFIX + key);
      return null;
    }

    return parsed;

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
      JSON.stringify({ body })
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

/** Gọi nền để làm mới cache cũ (người dùng không phải chờ). */
function revalidate(
  req: Parameters<HttpInterceptorFn>[0],
  next: Parameters<HttpInterceptorFn>[1],
  key: string
): void {

  next(req)
    .pipe(
      tap((event: HttpEvent<unknown>) => {

        if (
          event instanceof HttpResponse &&
          event.ok &&
          (event.body as { success?: boolean } | null)?.success !== false
        ) {
          writeEntry(key, event.body);
        }

      })
    )
    .subscribe({
      error: () => {
        // API lỗi: giữ nguyên cache cũ, không làm gì thêm
      }
    });

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

  const key = req.urlWithParams;

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

  const entry = readEntry(key);

  // 1) Có cache: dùng ngay + làm mới nền
  if (entry) {
    revalidate(req, next, key);
    return of(toResponse(req, entry.body));
  }

  // 2) Chưa có cache: gọi API và lưu lại
  return next(req).pipe(
    tap((event: HttpEvent<unknown>) => {

      if (
        event instanceof HttpResponse &&
        event.ok &&
        (event.body as { success?: boolean } | null)?.success !== false
      ) {
        writeEntry(key, event.body);
      }

    })
  );

};
