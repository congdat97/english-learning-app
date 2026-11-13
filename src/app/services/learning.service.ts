import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { finalize, shareReplay, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { Course, Lesson, Listening, ReviewQuestion, UserProgress, Vocabulary } from '../models/learning.model';

type ApiResult<T> = { success: boolean; data: T };

interface CacheEntry<T> {
  ts: number;
  body: ApiResult<T>;
}

@Injectable({ providedIn: 'root' })
export class LearningService {
  private base = environment.apiUrl;
  private headers = new HttpHeaders({ 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' });
  private readonly maxAgeMs = 24 * 60 * 60 * 1000;

  /** Các GET đang chạy: nhiều nơi gọi cùng lúc thì share 1 kết nối. */
  private inflight = new Map<string, Observable<ApiResult<unknown>>>();

  private auth = inject(AuthService);

  constructor(private http: HttpClient) {}

  /** Cache phân theo user — user A không thấy cache của user B. */
  private cacheKey(url: string): string {
    const uid = this.auth.currentUser()?.id;
    return 'api-cache:' + (uid ? uid + ':' : '') + url;
  }

  private fetchAndCache<T>(url: string): Observable<ApiResult<T>> {
    const existing = this.inflight.get(url) as Observable<ApiResult<T>> | undefined;
    if (existing) return existing;

    const obs = this.http.get<ApiResult<T>>(url, { headers: this.headers }).pipe(
      tap({
        next: body => {
          try { localStorage.setItem(this.cacheKey(url), JSON.stringify({ ts: Date.now(), body })); } catch {}
        },
        finalize: () => this.inflight.delete(url)
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );
    this.inflight.set(url, obs as Observable<ApiResult<unknown>>);
    return obs;
  }

  /**
   * Cache-first + revalidate:
   * - Nếu có cache hợp lệ -> phát cache ngay lập tức (UI không phải chờ).
   * - Vẫn gọi API nền; thành công -> lưu cache và phát data mới (UI tự cập nhật).
   * - API lỗi mà có cache -> dùng cache, không throw (dữ liệu tĩnh nên vẫn dùng được).
   */
  private cachedGet<T>(url: string): Observable<ApiResult<T>> {
    return new Observable<ApiResult<T>>(observer => {
      const key = this.cacheKey(url);
      let cached: CacheEntry<T> | null = null;
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw) as CacheEntry<T>;
          if (parsed?.body) {
            if (Date.now() - parsed.ts < this.maxAgeMs) cached = parsed;
            else localStorage.removeItem(key);
          }
        }
      } catch {}

      // Có cache hợp lệ -> trả ngay lập tức (không chờ API),
      // refresh nền âm thầm để lần sau có data mới.
      if (cached) {
        observer.next(cached.body);
        observer.complete();
        this.fetchAndCache<T>(url).subscribe({ error: () => {} });
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

  /** Xóa toàn bộ cache API (dùng khi muốn ép load mới). */
  clearCache(): void {
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith('api-cache:'))
        .forEach(k => localStorage.removeItem(k));
    } catch {}
  }

  getCourses(): Observable<ApiResult<Course[]>> {
    return this.cachedGet<Course[]>(`${this.base}/courses`);
  }

  getCourse(id: number): Observable<ApiResult<Course>> {
    return this.cachedGet<Course>(`${this.base}/courses/${id}`);
  }

  getLessons(courseId: number): Observable<ApiResult<Lesson[]>> {
    return this.cachedGet<Lesson[]>(`${this.base}/courses/${courseId}/lessons`);
  }

  getLesson(id: number): Observable<ApiResult<Lesson>> {
    return this.cachedGet<Lesson>(`${this.base}/lessons/${id}`);
  }

  getVocabulary(lessonId: number): Observable<ApiResult<Vocabulary[]>> {
    return this.cachedGet<Vocabulary[]>(`${this.base}/lessons/${lessonId}/vocabulary`);
  }

  getListening(lessonId: number): Observable<ApiResult<Listening[]>> {
    return this.cachedGet<Listening[]>(`${this.base}/lessons/${lessonId}/listening`);
  }

  getReview(lessonId: number): Observable<ApiResult<ReviewQuestion[]>> {
    return this.cachedGet<ReviewQuestion[]>(`${this.base}/lessons/${lessonId}/review`);
  }

  getProgress(lessonId: number): Observable<ApiResult<UserProgress | null>> {
    return this.cachedGet<UserProgress | null>(`${this.base}/lessons/${lessonId}/progress`);
  }

  /** Lấy tiến độ của TẤT CẢ lesson trong 1 request duy nhất. */
  getAllProgress(): Observable<ApiResult<UserProgress[]>> {
    return this.cachedGet<UserProgress[]>(`${this.base}/lessons/progress/all`);
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

  getBookmarks(): Observable<ApiResult<Vocabulary[]>> {
    return this.cachedGet<Vocabulary[]>(`${this.base}/vocabulary/bookmarks`);
  }

  getSettings(): Observable<ApiResult<any>> {
    return this.cachedGet<any>(`${this.base}/settings`);
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
}
