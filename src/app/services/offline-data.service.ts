import { Injectable, inject } from '@angular/core';

import { AuthService } from './auth.service';

import {
  catchError,
  forkJoin,
  map,
  merge,
  of,
  switchMap,
  timer
} from 'rxjs';

import { LearningService } from './learning.service';

import { Course, UserProgress, Vocabulary } from '../models/learning.model';

export type OfflineDataKey = 'courses' | 'bookmarks' | 'progress' | 'lessons';

export interface OfflineDataMeta {
  syncedAt: string | null;
  counts: Partial<Record<OfflineDataKey, number>>;
}

export interface SyncResult {
  courses: Course[];
  bookmarks: Vocabulary[];
}

// Prefix riêng cho app tiếng Anh
const PREFIX = 'elf-data.';

@Injectable({ providedIn: 'root' })
export class OfflineDataService {

  private readonly learning = inject(LearningService);
  private readonly auth = inject(AuthService);

  // =====================================================
  // STORAGE (phân theo user — user A không đụng dữ liệu offline của user B)
  // =====================================================

  private uidPart(): string {
    const uid = this.auth.currentUser()?.id;
    return uid ? `${uid}.` : 'guest.';
  }

  private storageKey(key: OfflineDataKey): string {
    return `${PREFIX}${this.uidPart()}${key}`;
  }

  private staleKey(key: OfflineDataKey): string {
    return `${PREFIX}${this.uidPart()}${key}:stale`;
  }

  private metaKey(): string {
    return `${PREFIX}${this.uidPart()}meta`;
  }

  get<T>(key: OfflineDataKey): T | null {

    try {

      const raw =
        localStorage.getItem(this.storageKey(key));

      if (!raw) {
        return null;
      }

      return JSON.parse(raw) as T;

    } catch {

      return null;

    }

  }

  set<T>(key: OfflineDataKey, data: T): void {

    try {

      localStorage.setItem(
        this.storageKey(key),
        JSON.stringify(data)
      );

      // Có bản mới => xoá bản stale cũ
      localStorage.removeItem(this.staleKey(key));

    } catch (error) {

      console.warn('Không thể lưu dữ liệu offline:', error);

    }

  }

  getStale<T>(key: OfflineDataKey): T | null {

    try {

      const raw =
        localStorage.getItem(this.staleKey(key));

      if (!raw) {
        return null;
      }

      return JSON.parse(raw) as T;

    } catch {

      return null;

    }

  }

  /**
   * Vô hiệu hoá cache khi có thao tác ghi.
   * Giữ bản stale để khi API ngủ
   * vẫn còn dữ liệu cũ dùng tạm.
   */
  invalidate(key: OfflineDataKey): void {

    try {

      const current =
        localStorage.getItem(this.storageKey(key));

      if (current) {
        localStorage.setItem(this.staleKey(key), current);
      }

      localStorage.removeItem(this.storageKey(key));

    } catch {
      // ignore
    }

  }

  // =====================================================
  // META
  // =====================================================

  getMeta(): OfflineDataMeta {

    try {

      const raw =
        localStorage.getItem(this.metaKey());

      if (!raw) {
        return { syncedAt: null, counts: {} };
      }

      return JSON.parse(raw) as OfflineDataMeta;

    } catch {

      return { syncedAt: null, counts: {} };

    }

  }

  private saveMeta(
    counts: Partial<Record<OfflineDataKey, number>>
  ): void {

    const meta: OfflineDataMeta = {
      syncedAt: new Date().toISOString(),
      counts
    };

    try {

      localStorage.setItem(
        this.metaKey(),
        JSON.stringify(meta)
      );

    } catch {
      // ignore
    }

  }

  // =====================================================
  // SYNC
  // =====================================================

  /**
   * Tải dữ liệu cần dùng offline vào localStorage:
   * khóa học + bookmark + tiến độ học.
   *
   * force=false (mặc định, mở app): cache-first — có cache là xong, không đụng API.
   * force=true (nút "Đồng bộ"): bỏ cache, luôn gọi API và ghi đè cache.
   */
  syncAll(force = false) {

    return this.learning.getCourses(force).pipe(
      map(response => response.data || []),
      switchMap(courses => forkJoin({
        courses: of(courses),

        bookmarks: this.learning.getBookmarks(force)
          .pipe(map(r => r.data || []), catchError(() => of([] as Vocabulary[]))),

        progress: this.learning.getAllProgress(force)
          .pipe(map(r => r.data || []), catchError(() => of([] as UserProgress[])))
      })),
      map(result => {

        this.set('courses', result.courses);

        this.set('bookmarks', result.bookmarks);

        this.set('progress', result.progress);

        this.saveMeta({
          courses: result.courses.length,
          bookmarks: result.bookmarks.length
        });

        return { courses: result.courses, bookmarks: result.bookmarks };

      })
    );

  }

  /**
   * Luôn đồng bộ khi mở app:
   * - Có cache -> trả tức thì + refresh nền (không chặn UI).
   * - Chưa có cache -> tải lần đầu (blocking) để có dữ liệu.
   */
  ensureData() {
    if (!this.hasData()) {
      return this.syncAll(false).pipe(catchError(() => of(null)));
    }

    const lastSync = this.getMeta().syncedAt;
    const lastSyncTime = lastSync ? new Date(lastSync).getTime() : 0;

    if (Date.now() - lastSyncTime < 10 * 60_000) {
      return of(null);
    }

    // Có cache: trả ngay, đồng bộ nền sau 2s để không tranh băng thông
    // với request của trang đang mở.
    return merge(
      of(null),
      timer(2000).pipe(
        switchMap(() => this.syncAll(true).pipe(catchError(() => of(null))))
      )
    );
  }

  // =====================================================
  // STATUS UI
  // =====================================================

  hasData(): boolean {
    return (
      this.get<Course[]>('courses') !== null ||
      this.get<Vocabulary[]>('bookmarks') !== null
    );
  }

  formattedSyncedAt(): string {

    const meta = this.getMeta();

    if (!meta.syncedAt) {
      return '--';
    }

    return new Date(meta.syncedAt).toLocaleString('vi-VN');

  }

}
