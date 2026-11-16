import { Injectable, inject } from '@angular/core';

import { AuthService } from './auth.service';

import {
  catchError,
  forkJoin,
  map,
  of,
  switchMap
} from 'rxjs';

import { LearningService } from './learning.service';

import { Course, Lesson, UserProgress, Vocabulary } from '../models/learning.model';

export type OfflineDataKey = 'courses' | 'bookmarks' | 'progress' | 'lessons';

export interface OfflineDataMeta {
  syncedAt: string | null;
  counts: Partial<Record<OfflineDataKey, number>>;
}

export interface SyncResult {
  courses: Course[];
  bookmarks: Vocabulary[];
}

// Prefix riÃªng cho app tiáº¿ng Anh
const PREFIX = 'elf-data.';

@Injectable({ providedIn: 'root' })
export class OfflineDataService {

  private readonly learning = inject(LearningService);
  private readonly auth = inject(AuthService);

  // =====================================================
  // STORAGE (phÃ¢n theo user â€” user A khÃ´ng Ä‘á»¥ng dá»¯ liá»‡u offline cá»§a user B)
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

      // CÃ³ báº£n má»›i => xoÃ¡ báº£n stale cÅ©
      localStorage.removeItem(this.staleKey(key));

    } catch (error) {

      console.warn('KhÃ´ng thá»ƒ lÆ°u dá»¯ liá»‡u offline:', error);

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
   * VÃ´ hiá»‡u hoÃ¡ cache khi cÃ³ thao tÃ¡c ghi.
   * Giá»¯ báº£n stale Ä‘á»ƒ khi API ngá»§
   * váº«n cÃ²n dá»¯ liá»‡u cÅ© dÃ¹ng táº¡m.
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
   * Tải dữ liệu cần dùng offline về localStorage:
   * khóa học + sổ từ + tiến độ tổng + danh sách lesson mỗi khóa.
   *
   * force=false (mặc định, mở app): cache-first — có cache là xong, không đụng API.
   * force=true (nút 🔄 Đồng bộ): bỏ cache, luôn gọi API và ghi đè cache.
   */
  syncAll(force = false) {

    return this.learning.getCourses(force).pipe(
      map(response => response.data || []),
      switchMap(courses => forkJoin({
        courses: of(courses),

        bookmarks: this.learning.getBookmarks(force)
          .pipe(map(r => r.data || []), catchError(() => of([] as Vocabulary[]))),

        progress: this.learning.getAllProgress(force)
          .pipe(map(r => r.data || []), catchError(() => of([] as UserProgress[]))),

        lessons: forkJoin(
          courses.map(c =>
            this.learning.getLessons(c.id, force)
              .pipe(map(r => r.data || []), catchError(() => of([] as Lesson[])))
          )
        )
      })),
      map(result => {

        this.set('courses', result.courses);

        this.set('bookmarks', result.bookmarks);

        this.set('progress', result.progress);

        this.set('lessons', result.lessons.flat());

        this.saveMeta({
          courses: result.courses.length,
          bookmarks: result.bookmarks.length
        });

        return { courses: result.courses, bookmarks: result.bookmarks };

      })
    );

  }

  /**
   * LuÃ´n Ä‘á»“ng bá»™ khi má»Ÿ app:
   * - CÃ³ cache -> tráº£ tá»©c thÃ¬ + refresh ná»n (khÃ´ng cháº·n UI).
   * - ChÆ°a cÃ³ cache -> táº£i láº§n Ä‘áº§u (ná»n, UI váº«n hiá»‡n tráº¡ng thÃ¡i chá» riÃªng).
   */
  ensureData() {
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
