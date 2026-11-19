import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { finalize, shareReplay, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { Course, LeaderboardRow, Lesson, Listening, ReviewQuestion, UserProgress, Vocabulary } from '../models/learning.model';

type ApiResult<T> = { success: boolean; data: T };

interface CacheEntry<T> {
  ts: number;
  body: ApiResult<T>;
}

@Injectable({ providedIn: 'root' })
export class LearningService {
  private base = environment.apiUrl;
  private headers = new HttpHeaders({ 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' });

  /** Các GET đang chạy: nhiều nơi gọi cùng lúc thì share 1 kết nối. */
  private inflight = new Map<string, Observable<ApiResult<unknown>>>();

  private auth = inject(AuthService);

  constructor(private http: HttpClient) {
    try {
      const version = '2026-11-19-v1';
      if (localStorage.getItem('api-cache-version') !== version) {
        Object.keys(localStorage)
          .filter(k => k.startsWith('api-cache:') || k.startsWith('http_cache_'))
          .forEach(k => localStorage.removeItem(k));
        localStorage.setItem('api-cache-version', version);
      }
    } catch {}
  }

  /** Cache phân theo user — user A không thấy cache của user B. */
  private cacheKey(url: string): string {
    const uid = this.auth.currentUser()?.id;
    return 'api-cache:' + (uid ? uid + ':' : '') + url;
  }

  private fetchAndCache<T>(url: string, force = false): Observable<ApiResult<T>> {
    const inflightKey = force ? url + '::force' : url;
    const existing = this.inflight.get(inflightKey) as Observable<ApiResult<T>> | undefined;
    if (existing) return existing;

    const headers = force ? this.headers.set('X-Force-Refresh', '1') : this.headers;
    const obs = this.http.get<ApiResult<T>>(url, { headers }).pipe(
      tap({
        next: body => {
          try { localStorage.setItem(this.cacheKey(url), JSON.stringify({ ts: Date.now(), body })); } catch {}
        },
        finalize: () => this.inflight.delete(inflightKey)
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );
    this.inflight.set(inflightKey, obs as Observable<ApiResult<unknown>>);
    return obs;
  }

  /**
   * CACHE-FIRST tuyệt đối:
   * - Có cache (dù cũ bao lâu) -> phát cache ngay, KHÔNG gọi API.
   * - Chưa có cache -> gọi API, lưu cache rồi mới phát.
   * - force=true (nút 🔄 Đồng bộ): bỏ cache, luôn gọi API và ghi đè cache.
   */
  private cachedGet<T>(url: string, force = false): Observable<ApiResult<T>> {
    if (force) return this.fetchAndCache<T>(url, true);

    return new Observable<ApiResult<T>>(observer => {
      const key = this.cacheKey(url);
      let cached: CacheEntry<T> | null = null;
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw) as CacheEntry<T>;
          if (parsed?.body) cached = parsed;
        }
      } catch {}

      if (cached) {
        observer.next(cached.body);
        observer.complete();
        return () => {};
      }

      const sub = this.fetchAndCache<T>(url).subscribe({
        next: body => observer.next(body),
        error: err => observer.error(err),
        complete: () => observer.complete()
      });
      return () => sub.unsubscribe();
    });
  }

  /** Ghi đè phần data của 1 cache nếu cache đó đang tồn tại. */
  private writeCacheData(url: string, data: unknown): void {
    const key = this.cacheKey(url);
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const entry = JSON.parse(raw);
      entry.body = { success: true, data };
      localStorage.setItem(key, JSON.stringify(entry));
    } catch {}
  }

  /** Xóa toàn bộ cache API (dùng khi muốn ép load mới). */
  clearCache(): void {
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith('api-cache:'))
        .forEach(k => localStorage.removeItem(k));
    } catch {}
  }

  getCourses(force = false): Observable<ApiResult<Course[]>> {
    return this.cachedGet<Course[]>(`${this.base}/courses`, force);
  }

  getCourse(id: number, force = false): Observable<ApiResult<Course>> {
    return this.cachedGet<Course>(`${this.base}/courses/${id}`, force);
  }

  getLessons(courseId: number, force = false): Observable<ApiResult<Lesson[]>> {
    return this.cachedGet<Lesson[]>(`${this.base}/courses/${courseId}/lessons`, force);
  }

  getLesson(id: number, force = false): Observable<ApiResult<Lesson>> {
    return this.cachedGet<Lesson>(`${this.base}/lessons/${id}`, force);
  }

  getVocabulary(lessonId: number, force = false): Observable<ApiResult<Vocabulary[]>> {
    return this.cachedGet<Vocabulary[]>(`${this.base}/lessons/${lessonId}/vocabulary`, force);
  }

  getListening(lessonId: number, force = false): Observable<ApiResult<Listening[]>> {
    return this.cachedGet<Listening[]>(`${this.base}/lessons/${lessonId}/listening`, force);
  }

  getReview(lessonId: number, force = false): Observable<ApiResult<ReviewQuestion[]>> {
    return this.cachedGet<ReviewQuestion[]>(`${this.base}/lessons/${lessonId}/review`, force);
  }

  getProgress(lessonId: number, force = false): Observable<ApiResult<UserProgress | null>> {
    return this.cachedGet<UserProgress | null>(`${this.base}/lessons/${lessonId}/progress`, force);
  }

  /** Lấy tiến độ của TẤT CẢ lesson trong 1 request duy nhất. */
  getAllProgress(force = false): Observable<ApiResult<UserProgress[]>> {
    return this.cachedGet<UserProgress[]>(`${this.base}/lessons/progress/all`, force);
  }

  /** Xóa cache tiến độ tổng (gọi sau khi lưu tiến độ mới). */
  invalidateProgressCache(): void {
    try { localStorage.removeItem(this.cacheKey(`${this.base}/lessons/progress/all`)); } catch {}
  }

  /** Xóa cache sổ từ vựng (gọi sau khi thêm/xóa bookmark). */
  invalidateBookmarksCache(): void {
    try { localStorage.removeItem(this.cacheKey(`${this.base}/vocabulary/bookmarks`)); } catch {}
  }

  saveProgress(lessonId: number, status: string, score: number, total: number): Observable<ApiResult<UserProgress>> {
    return this.http.post<ApiResult<UserProgress>>(`${this.base}/lessons/${lessonId}/progress`, {
      status, score, total_questions: total
    });
  }

  getBookmarks(force = false): Observable<ApiResult<Vocabulary[]>> {
    return this.cachedGet<Vocabulary[]>(`${this.base}/vocabulary/bookmarks`, force);
  }

  getSettings(force = false): Observable<ApiResult<any>> {
    return this.cachedGet<any>(`${this.base}/settings`, force);
  }

  /** Admin: tiến độ học của mọi user (không cache — dữ liệu nhạy). */
  getAdminUserProgress(): Observable<ApiResult<any[]>> {
    return this.http.get<ApiResult<any[]>>(`${this.base}/auth/users/progress`, { headers: this.headers });
  }

  getLeaderboard(): Observable<ApiResult<LeaderboardRow[]>> {
    return this.http.get<ApiResult<LeaderboardRow[]>>(`${this.base}/leaderboard`, {
      headers: this.headers.set('X-Force-Refresh', '1')
    });
  }

  saveSettings(settings: any): Observable<ApiResult<any>> {
    return this.http.put<ApiResult<any>>(`${this.base}/settings`, settings);
  }

  toggleFavorite(vocabularyId: number): Observable<ApiResult<Vocabulary>> {
    return this.http.post<ApiResult<Vocabulary>>(`${this.base}/vocabulary/${vocabularyId}/favorite`, {});
  }

  bookmark(vocabularyId: number): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.base}/vocabulary/${vocabularyId}/bookmark`, {});
  }

  unbookmark(vocabularyId: number): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.base}/vocabulary/${vocabularyId}/bookmark`);
  }

  /** Cập nhật cache sổ từ vựng ngay sau khi thêm/xóa bookmark. */
  updateCachedBookmarks(list: Vocabulary[]): void {
    const url = this.cacheKey(`${this.base}/vocabulary/bookmarks`);
    try {
      const raw = localStorage.getItem(url);
      if (raw) localStorage.setItem(url, JSON.stringify({ ts: Date.now(), body: { success: true, data: list } }));
    } catch {}
  }

  /** Đồng bộ 1 từ trong cache sổ từ vựng (saved=true: thêm vào, false: xóa đi). */
  syncBookmarkCache(v: Vocabulary, saved: boolean): void {
    const url = this.cacheKey(`${this.base}/vocabulary/bookmarks`);
    try {
      const raw = localStorage.getItem(url);
      if (!raw) return;
      const entry = JSON.parse(raw) as { ts: number; body: { success: boolean; data: Vocabulary[] } };
      const list = (entry.body?.data ?? []).filter(b => b.id !== v.id);
      if (saved) list.unshift({ ...v, is_bookmarked: true });
      entry.body.data = list;
      localStorage.setItem(url, JSON.stringify(entry));
    } catch {}
  }

  /**
   * Sau khi lưu/xóa tiến độ: cập nhật ngay cache tiến độ trong localStorage
   * (cache từng bài + cache tổng) — không cần gọi lại API GET.
   */
  syncProgressCache(lessonId: number, row: UserProgress): void {
    this.writeCacheData(`${this.base}/lessons/${lessonId}/progress`, row);

    const allUrl = `${this.base}/lessons/progress/all`;
    const key = this.cacheKey(allUrl);
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const entry = JSON.parse(raw);
      const list: UserProgress[] = entry.body?.data ?? [];
      const idx = list.findIndex(p => p.lesson_id === lessonId);
      if (idx >= 0) list[idx] = row; else list.push(row);
      entry.body.data = list;
      localStorage.setItem(key, JSON.stringify(entry));
    } catch {}
  }

  /** Cập nhật cờ đã-lưu của 1 từ trong mọi cache danh sách từ vựng của lesson. */
  syncVocabularyBookmarkCache(vocabularyId: number, saved: boolean): void {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          !key ||
          !key.startsWith('api-cache:') ||
          !key.includes(`${this.base}/lessons/`) ||
          !key.includes('/vocabulary')
        ) continue;
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const entry = JSON.parse(raw);
        const list = entry.body?.data;
        if (!Array.isArray(list)) continue;
        const item = list.find((v: { id: number }) => v.id === vocabularyId);
        if (item) {
          item.is_bookmarked = saved;
          item.is_favorite = saved;
          localStorage.setItem(key, JSON.stringify(entry));
        }
      }
    } catch {}
  }

  /** Sau khi lưu cài đặt: cập nhật cache GET /settings cho khớp với giá trị mới. */
  syncSettingsCache(data: unknown): void {
    this.writeCacheData(`${this.base}/settings`, data);
  }
}
