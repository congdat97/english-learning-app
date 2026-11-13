import { Injectable, inject } from '@angular/core';

import {
  catchError,
  forkJoin,
  map,
  of
} from 'rxjs';

import { LearningService } from './learning.service';

import { Course, Vocabulary } from '../models/learning.model';

export type OfflineDataKey = 'courses' | 'bookmarks';

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

  // =====================================================
  // STORAGE
  // =====================================================

  private storageKey(key: OfflineDataKey): string {
    return `${PREFIX}${key}`;
  }

  private staleKey(key: OfflineDataKey): string {
    return `${PREFIX}${key}:stale`;
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

  private static readonly META_KEY = `${PREFIX}meta`;

  getMeta(): OfflineDataMeta {

    try {

      const raw =
        localStorage.getItem(OfflineDataService.META_KEY);

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
        OfflineDataService.META_KEY,
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
   * Tải dữ liệu cần dùng offline
   * (khóa học + từ đã lưu) về localStorage.
   * Đi qua cache SWR chung của LearningService.
   */
  syncAll() {

    return forkJoin({
      courses: this.learning.getCourses()
        .pipe(map(response => response.data)),

      bookmarks: this.learning.getBookmarks()
        .pipe(map(response => response.data))
    })
      .pipe(
        map(result => {

          this.set('courses', result.courses);

          this.set('bookmarks', result.bookmarks);

          this.saveMeta({
            courses: result.courses.length,
            bookmarks: result.bookmarks.length
          });

          return result;

        })
      );

  }

  /**
   * Nếu chưa có dữ liệu offline
   * thì tự tải và lưu 1 lần.
   */
  ensureData() {

    if (this.hasData()) {
      return of(null);
    }

    return this.syncAll()
      .pipe(catchError(() => of(null)));

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
