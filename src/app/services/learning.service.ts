import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
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

  constructor(private http: HttpClient) {}

  /**
   * Cache-first + revalidate:
   * - Nếu có cache hợp lệ -> phát cache ngay lập tức (UI không phải chờ).
   * - Vẫn gọi API nền; thành công -> lưu cache và phát data mới (UI tự cập nhật).
   * - API lỗi mà có cache -> dùng cache, không throw (dữ liệu tĩnh nên vẫn dùng được).
   */
  private cachedGet<T>(url: string): Observable<ApiResult<T>> {
    return new Observable<ApiResult<T>>(observer => {
      const key = 'api-cache:' + url;
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
        this.http.get<ApiResult<T>>(url, { headers: this.headers }).subscribe({
          next: body => {
            try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), body })); } catch {}
          },
          error: () => {}
        });
        return () => {};
      }

      const sub = this.http.get<ApiResult<T>>(url, { headers: this.headers }).subscribe({
        next: body => {
          try {
            localStorage.setItem(key, JSON.stringify({ ts: Date.now(), body }));
          } catch {}
          observer.next(body);
        },
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
    try { localStorage.removeItem('api-cache:' + `${this.base}/lessons/progress/all`); } catch {}
  }

  /** Xóa cache sổ từ vựng (gọi sau khi thêm/xóa bookmark). */
  invalidateBookmarksCache(): void {
    try { localStorage.removeItem('api-cache:' + `${this.base}/vocabulary/bookmarks`); } catch {}
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
    const url = 'api-cache:' + `${this.base}/vocabulary/bookmarks`;
    try {
      const raw = localStorage.getItem(url);
      if (raw) localStorage.setItem(url, JSON.stringify({ ts: Date.now(), body: { success: true, data: list } }));
    } catch {}
  }

  /** Đồng bộ 1 từ trong cache sổ từ vựng (saved=true: thêm vào, false: xóa đi). */
  syncBookmarkCache(v: Vocabulary, saved: boolean): void {
    const url = 'api-cache:' + `${this.base}/vocabulary/bookmarks`;
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
