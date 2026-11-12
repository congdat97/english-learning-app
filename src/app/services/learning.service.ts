import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Course, Lesson, Listening, ReviewQuestion, UserProgress, Vocabulary } from '../models/learning.model';

@Injectable({ providedIn: 'root' })
export class LearningService {
  private base = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getCourses(): Observable<{ success: boolean; data: Course[] }> {
    return this.http.get<{ success: boolean; data: Course[] }>(`${this.base}/courses`);
  }

  getCourse(id: number): Observable<{ success: boolean; data: Course }> {
    return this.http.get<{ success: boolean; data: Course }>(`${this.base}/courses/${id}`);
  }

  getLessons(courseId: number): Observable<{ success: boolean; data: Lesson[] }> {
    return this.http.get<{ success: boolean; data: Lesson[] }>(`${this.base}/courses/${courseId}/lessons`);
  }

  getLesson(id: number): Observable<{ success: boolean; data: Lesson }> {
    return this.http.get<{ success: boolean; data: Lesson }>(`${this.base}/lessons/${id}`);
  }

  getVocabulary(lessonId: number): Observable<{ success: boolean; data: Vocabulary[] }> {
    return this.http.get<{ success: boolean; data: Vocabulary[] }>(`${this.base}/lessons/${lessonId}/vocabulary`);
  }

  getListening(lessonId: number): Observable<{ success: boolean; data: Listening[] }> {
    return this.http.get<{ success: boolean; data: Listening[] }>(`${this.base}/lessons/${lessonId}/listening`);
  }

  getReview(lessonId: number): Observable<{ success: boolean; data: ReviewQuestion[] }> {
    return this.http.get<{ success: boolean; data: ReviewQuestion[] }>(`${this.base}/lessons/${lessonId}/review`);
  }

  getProgress(lessonId: number): Observable<{ success: boolean; data: UserProgress | null }> {
    return this.http.get<{ success: boolean; data: UserProgress | null }>(`${this.base}/lessons/${lessonId}/progress`);
  }

  saveProgress(lessonId: number, status: string, score: number, total: number): Observable<{ success: boolean; data: UserProgress }> {
    return this.http.post<{ success: boolean; data: UserProgress }>(`${this.base}/lessons/${lessonId}/progress`, {
      status, score, total_questions: total
    });
  }

  getBookmarks(): Observable<{ success: boolean; data: Vocabulary[] }> {
    return this.http.get<{ success: boolean; data: Vocabulary[] }>(`${this.base}/vocabulary/bookmarks`);
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
