import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { finalize, shareReplay, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { Course, LeaderboardRow, Lesson, Listening, ReviewQuestion, StarLeaderboardRow, UserProgress, Vocabulary } from '../models/learning.model';
import { CACHE_MAX_AGE_MS, DYNAMIC_CACHE_MAX_AGE_MS, clearAppCaches } from '../cache-policy';

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
    clearAppCaches();
  }

  private get currentUid(): number | null {
    return this.auth.currentUser()?.id ?? null;
  }

  /** Cache phân theo user — user A không thấy cache của user B. */
  private cacheKey(url: string): string {
    const uid = this.currentUid;
    return 'api-cache:' + (uid ? uid + ':' : '') + url;
  }

  /** Chỉ thao tác trên key cache của user hiện tại. */
  private isCurrentUserCacheKey(key: string): boolean {
    const uid = this.currentUid;
    if (uid) {
      return key.startsWith(`api-cache:${uid}:`) || key.startsWith(`http_cache_${uid}:`);
    }
    const guestApi = key.startsWith('api-cache:') && !/^api-cache:\d+:/.test(key);
    const guestHttp = key.startsWith('http_cache_') && !/^http_cache_\d+:/.test(key);
    return guestApi || guestHttp;
  }

  private fetchAndCache<T>(url: string, force = false): Observable<ApiResult<T>> {
    const scope = this.currentUid ?? 'guest';
    const inflightKey = `${scope}|${force ? url + '::force' : url}`;
    const existing = this.inflight.get(inflightKey) as Observable<ApiResult<T>> | undefined;
    if (existing) return existing;

    const storageKey = this.cacheKey(url);
    const headers = force ? this.headers.set('X-Force-Refresh', '1') : this.headers;
    const obs = this.http.get<ApiResult<T>>(url, { headers }).pipe(
      tap({
        next: body => {
          try { localStorage.setItem(storageKey, JSON.stringify({ ts: Date.now(), body })); } catch {}
        },
        finalize: () => this.inflight.delete(inflightKey)
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );
    this.inflight.set(inflightKey, obs as Observable<ApiResult<unknown>>);
    return obs;
  }

  /**
   * Cache-first: luôn phát dữ liệu đã có ngay (kể cả đã cũ).
   * Hết hạn thì làm mới ngầm để lần sau có dữ liệu mới,
   * không chặn UI khi API Render đang khởi động lại.
   */
  private cachedGet<T>(
    url: string,
    force = false,
    ttlMs = CACHE_MAX_AGE_MS
  ): Observable<ApiResult<T>> {
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
        // Cache-first: luôn phát dữ liệu đã có ngay, kể cả đã cũ.
        observer.next(cached.body);

        if (Date.now() - (cached.ts || 0) >= ttlMs) {
          // Hết hạn: làm mới ngầm, không chặn UI (stale-while-revalidate).
          this.fetchAndCache<T>(url, true).subscribe({ error: () => {} });
        }

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
      entry.ts = Date.now();
      localStorage.setItem(key, JSON.stringify(entry));
    } catch {}
  }

  /** Đọc data của 1 cache (dùng để đồng bộ bảng xếp hạng sau khi lưu tiến độ). */
  private readCacheData<T>(url: string): T | null {
    const key = this.cacheKey(url);
    try {
      const raw = localStorage.getItem(key);
      const entry = raw ? (JSON.parse(raw) as CacheEntry<T>) : null;
      return entry?.body?.data ?? null;
    } catch {
      return null;
    }
  }

  /** Interceptor cũng cache GET — phải đọc/sửa cả bản đó để không trả dữ liệu cũ. */
  private readHttpCacheData<T>(url: string): T | null {
    const key = this.httpCacheKey(url);
    try {
      const raw = localStorage.getItem(key);
      const entry = raw ? (JSON.parse(raw) as { ts: number; body: ApiResult<T> }) : null;
      return entry?.body?.data ?? null;
    } catch {
      return null;
    }
  }

  private writeHttpCacheData(url: string, data: unknown): void {
    const key = this.httpCacheKey(url);
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const entry = JSON.parse(raw);
      entry.ts = Date.now();
      entry.body = { success: true, data };
      localStorage.setItem(key, JSON.stringify(entry));
    } catch {}
  }

  private httpCacheKey(url: string): string {
    const uid = this.auth.currentUser()?.id;
    return 'http_cache_' + (uid ? uid + ':' : '') + url;
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

  prefetchLesson(lessonId: number): void {
    this.getLesson(lessonId).subscribe({ error: () => {} });
    this.getVocabulary(lessonId).subscribe({ error: () => {} });
    this.getListening(lessonId).subscribe({ error: () => {} });
    this.getReview(lessonId).subscribe({ error: () => {} });
  }

  getProgress(lessonId: number, force = false): Observable<ApiResult<UserProgress | null>> {
    return this.cachedGet<UserProgress | null>(`${this.base}/lessons/${lessonId}/progress`, force, DYNAMIC_CACHE_MAX_AGE_MS);
  }

  /** Lấy tiến độ của TẤT CẢ lesson trong 1 request duy nhất. */
  getAllProgress(force = false): Observable<ApiResult<UserProgress[]>> {
    return this.cachedGet<UserProgress[]>(`${this.base}/lessons/progress/all`, force, DYNAMIC_CACHE_MAX_AGE_MS);
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
    return this.cachedGet<Vocabulary[]>(`${this.base}/vocabulary/bookmarks`, force, DYNAMIC_CACHE_MAX_AGE_MS);
  }

  getSettings(force = false): Observable<ApiResult<any>> {
    return this.cachedGet<any>(`${this.base}/settings`, force, DYNAMIC_CACHE_MAX_AGE_MS);
  }

  /** Admin: tiến độ học của mọi user (không cache — dữ liệu nhạy). */
  getAdminUserProgress(): Observable<ApiResult<any[]>> {
    const headers = this.headers.set('X-No-Cache', '1');
    return this.http.get<ApiResult<any[]>>(`${this.base}/auth/users/progress`, { headers });
  }

  /** Bảng xếp hạng dùng cache ngắn hạn (5 phút) + stale-while-revalidate. */
  getLeaderboard(force = false): Observable<ApiResult<LeaderboardRow[]>> {
    return this.cachedGet<LeaderboardRow[]>(`${this.base}/leaderboard`, force, DYNAMIC_CACHE_MAX_AGE_MS);
  }

  /** Xóa cả 2 lớp cache (service + interceptor) khi cần lấy lại từ server. */
  clearLeaderboardCache(): void {
    try {
      Object.keys(localStorage)
        .filter(key =>
          this.isCurrentUserCacheKey(key) &&
          key.includes(`${this.base}/leaderboard`)
        )
        .forEach(key => localStorage.removeItem(key));
    } catch {}
  }

  getStarLeaderboard(force = false): Observable<ApiResult<StarLeaderboardRow[]>> {
    return this.cachedGet<StarLeaderboardRow[]>(`${this.base}/game/leaderboard`, force, DYNAMIC_CACHE_MAX_AGE_MS);
  }

  clearStarLeaderboardCache(): void {
    try {
      Object.keys(localStorage)
        .filter(key =>
          this.isCurrentUserCacheKey(key) &&
          key.includes(`${this.base}/game/leaderboard`)
        )
        .forEach(key => localStorage.removeItem(key));
    } catch {}
  }

  saveGameResult(stageId: string, stars: number, score: number, total: number): Observable<ApiResult<{
    stage_id: string;
    stars: number;
    score: number;
    total_questions: number;
    updated_at: string;
  }>> {
    return this.http.post<ApiResult<{
      stage_id: string;
      stars: number;
      score: number;
      total_questions: number;
      updated_at: string;
    }>>(`${this.base}/game/result`, {
      stage_id: stageId,
      stars,
      score,
      total_questions: total
    }).pipe(tap(() => this.clearStarLeaderboardCache()));
  }

  /**
   * Cập nhật ngay bảng xếp hạng trong cache sau khi lưu tiến độ.
   * previous = tiến độ cũ (null nếu bài này chưa từng học),
   * next = tiến độ vừa lưu (có thể là bản optimistic).
   */
  syncLeaderboardAfterProgress(previous: UserProgress | null, next: UserProgress | null): void {
    const uid = this.auth.currentUser()?.id;
    if (!uid) return;

    const url = `${this.base}/leaderboard`;
    const rows =
      this.readCacheData<LeaderboardRow[]>(url) ??
      this.readHttpCacheData<LeaderboardRow[]>(url);
    if (!Array.isArray(rows)) return;

    const index = rows.findIndex(row => row.user_id === uid);
    if (index < 0) return;

    const allProgress = this.readCacheData<UserProgress[]>(`${this.base}/lessons/progress/all`);
    const completedRows = Array.isArray(allProgress) ? allProgress.filter(p => p.status === 'completed') : [];
    const useAllProgress = completedRows.length > 0 || rows[index].completed === 0;

    const completed = useAllProgress
      ? completedRows.length
      : Math.max(0, rows[index].completed + this.progressDelta(previous, next));
    const avgScore = useAllProgress
      ? this.averageScore(completedRows)
      : this.weightedAverage(rows[index], previous, next, completed);
    const lastActivity =
      next?.updated_at || next?.created_at ||
      completedRows.map(p => p.updated_at || p.created_at || '').filter(Boolean).sort().pop() ||
      rows[index].last_activity;

    const updated = rows
      .map((row, i) => i === index
        ? { ...row, completed, avg_score: avgScore, last_activity: lastActivity || null }
        : row)
      .sort((a, b) =>
        b.completed - a.completed ||
        b.avg_score - a.avg_score ||
        (b.last_activity || '').localeCompare(a.last_activity || '') ||
        a.username.localeCompare(b.username)
      );

    this.writeCacheData(url, updated);
    this.writeHttpCacheData(url, updated);
  }

  private progressDelta(previous: UserProgress | null, next: UserProgress | null): number {
    return (next?.status === 'completed' ? 1 : 0) - (previous?.status === 'completed' ? 1 : 0);
  }

  private scorePercent(row: UserProgress | null): number {
    if (!row || !row.total_questions) return 0;
    return Math.round((row.score / row.total_questions) * 100);
  }

  private averageScore(rows: UserProgress[]): number {
    if (!rows.length) return 0;
    return Math.round(rows.reduce((sum, row) => sum + this.scorePercent(row), 0) / rows.length);
  }

  private weightedAverage(
    row: LeaderboardRow,
    previous: UserProgress | null,
    next: UserProgress | null,
    completed: number
  ): number {
    if (!completed) return 0;
    const wasDone = previous?.status === 'completed';
    const isDone = next?.status === 'completed';
    const oldAvg = row.avg_score || 0;

    if (isDone && !wasDone) {
      return Math.round((oldAvg * (completed - 1) + this.scorePercent(next)) / completed);
    }
    if (isDone && wasDone) {
      return Math.round((oldAvg * completed - this.scorePercent(previous) + this.scorePercent(next)) / completed);
    }
    if (!isDone && wasDone) {
      return Math.round((oldAvg * (completed + 1) - this.scorePercent(previous)) / completed);
    }
    return oldAvg;
  }

  saveSettings(settings: any): Observable<ApiResult<any>> {
    return this.http.put<ApiResult<any>>(`${this.base}/settings`, settings).pipe(
      tap(res => this.syncSettingsCache(res?.data ?? settings))
    );
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
    this.writeBulkProgressCache(lessonId, row);
  }

  /** Đọc tiến độ đã cache để có thể hoàn tác khi lưu lên server thất bại. */
  getCachedProgress(lessonId: number): UserProgress | null {
    const direct = this.readCacheData<UserProgress>(`${this.base}/lessons/${lessonId}/progress`);
    if (direct) return direct;

    const all = this.readCacheData<UserProgress[]>(`${this.base}/lessons/progress/all`);
    return all?.find(p => p.lesson_id === lessonId) ?? null;
  }

  /** Xóa tiến độ optimistic khỏi cache khi API lưu thất bại. */
  clearProgressCache(lessonId: number): void {
    try {
      localStorage.removeItem(this.cacheKey(`${this.base}/lessons/${lessonId}/progress`));
      this.writeBulkProgressCache(lessonId, null);
    } catch {}
  }

  private writeBulkProgressCache(lessonId: number, row: UserProgress | null): void {
    const allUrl = `${this.base}/lessons/progress/all`;
    const key = this.cacheKey(allUrl);
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const entry = JSON.parse(raw);
      const list: UserProgress[] = entry.body?.data ?? [];
      const idx = list.findIndex(p => p.lesson_id === lessonId);
      if (!row) {
        entry.body.data = list.filter(p => p.lesson_id !== lessonId);
      } else if (idx >= 0) {
        list[idx] = row;
        entry.body.data = list;
      } else {
        entry.body.data = [...list, row];
      }
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
          !this.isCurrentUserCacheKey(key) ||
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
