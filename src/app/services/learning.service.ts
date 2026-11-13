import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Course, Lesson, Listening, ReviewQuestion, UserProgress, Vocabulary } from '../models/learning.model';

@Injectable({ providedIn: 'root' })
export class LearningService {
  private base = environment.apiUrl;
  private headers = new HttpHeaders({ 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' });

  constructor(private http: HttpClient) {}

  getCourses(): Observable<{ success: boolean; data: Course[] }> {
    return this.http.get<{ success: boolean; data: Course[] }>(`${this.base}/courses`, { headers: this.headers });
  }

  getCourse(id: number): Observable<{ success: boolean; data: Course }> {
    return this.http.get<{ success: boolean; data: Course }>(`${this.base}/courses/${id}`, { headers: this.headers });
  }

  getLessons(courseId: number): Observable<{ success: boolean; data: Lesson[] }> {
    return this.http.get<{ success: boolean; data: Lesson[] }>(`${this.base}/courses/${courseId}/lessons`, { headers: this.headers });
  }

  getLesson(id: number): Observable<{ success: boolean; data: Lesson }> {
    return this.http.get<{ success: boolean; data: Lesson }>(`${this.base}/lessons/${id}`, { headers: this.headers });
  }

  getVocabulary(lessonId: number): Observable<{ success: boolean; data: Vocabulary[] }> {
    return this.http.get<{ success: boolean; data: Vocabulary[] }>(`${this.base}/lessons/${lessonId}/vocabulary`, { headers: this.headers });
  }

  getListening(lessonId: number): Observable<{ success: boolean; data: Listening[] }> {
    return this.http.get<{ success: boolean; data: Listening[] }>(`${this.base}/lessons/${lessonId}/listening`, { headers: this.headers });
  }

  getReview(lessonId: number): Observable<{ success: boolean; data: ReviewQuestion[] }> {
    return this.http.get<{ success: boolean; data: ReviewQuestion[] }>(`${this.base}/lessons/${lessonId}/review`, { headers: this.headers });
  }

  getProgress(lessonId: number): Observable<{ success: boolean; data: UserProgress | null }> {
    return this.http.get<{ success: boolean; data: UserProgress | null }>(`${this.base}/lessons/${lessonId}/progress`, { headers: this.headers });
  }

  saveProgress(lessonId: number, status: string, score: number, total: number): Observable<{ success: boolean; data: UserProgress }> {
    return this.http.post<{ success: boolean; data: UserProgress }>(`${this.base}/lessons/${lessonId}/progress`, {
      status, score, total_questions: total
    });
  }

  getBookmarks(): Observable<{ success: boolean; data: Vocabulary[] }> {
    return this.http.get<{ success: boolean; data: Vocabulary[] }>(`${this.base}/vocabulary/bookmarks`, { headers: this.headers });
  }

  getSettings(): Observable<{ success: boolean; data: any }> {
    return this.http.get<{ success: boolean; data: any }>(`${this.base}/settings`, { headers: this.headers });
  }

  saveSettings(settings: any): Observable<{ success: boolean; data: any }> {
    return this.http.put<{ success: boolean; data: any }>(`${this.base}/settings`, settings);
  }

  toggleFavorite(vocabularyId: number): Observable<{ success: boolean; data: Vocabulary }> {
    return this.http.post<{ success: boolean; data: Vocabulary }>(`${this.base}/vocabulary/${vocabularyId}/favorite`, {});
  }

  bookmark(vocabularyId: number): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.base}/vocabulary/${vocabularyId}/bookmark`, {});
  }

  unbookmark(vocabularyId: number): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.base}/vocabulary/${vocabularyId}/bookmark`);
  }
}
