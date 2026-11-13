import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { LearningService } from '../../services/learning.service';
import { Course, UserProgress, Vocabulary } from '../../models/learning.model';

type ApiResult<T> = { success: boolean; data: T };

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit, OnDestroy {
  courses: Course[] = [];
  loading = true;
  error = false;

  /** Thống kê theo dữ liệu thật */
  completedLessons = 0;
  savedWords = 0;
  streakDays = 0;

  /** Báo hiệu API Render (free tier) đang khởi động chậm. */
  slowApi = false;
  private slowTimer?: ReturnType<typeof setTimeout>;

  constructor(private learning: LearningService) {}

  ngOnInit(): void {
    this.load();
    this.slowTimer = setTimeout(() => { if (this.loading) this.slowApi = true; }, 8000);
  }

  ngOnDestroy(): void {
    clearTimeout(this.slowTimer);
  }

  load(): void {
    this.loading = true;
    this.slowApi = false;
    this.error = false;
    // Mỗi stream tự chịu lỗi: thống kê lỗi không làm chết danh sách khóa học
    forkJoin({
      courses: this.learning.getCourses().pipe(catchError(() => of(null))),
      progress: this.learning.getAllProgress().pipe(catchError(() => of(null))),
      bookmarks: this.learning.getBookmarks().pipe(catchError(() => of(null)))
    }).subscribe({
      next: ({ courses, progress, bookmarks }) => {
        this.courses = (courses as ApiResult<Course[]> | null)?.data || [];
        const rows = (progress as ApiResult<UserProgress[]> | null)?.data || [];
        this.completedLessons = rows.filter(p => p.status === 'completed').length;
        this.savedWords = ((bookmarks as ApiResult<Vocabulary[]> | null)?.data || []).length;
        this.streakDays = this.computeStreak(rows);
        this.error = courses === null;
        this.loading = false;
      },
      error: () => { this.error = true; this.loading = false; }
    });
  }

  /** Số ngày liên tiếp có hoạt động học (theo updated_at của tiến độ). */
  private computeStreak(rows: UserProgress[]): number {
    const days = new Set(
      rows
        .filter(p => p.updated_at || p.created_at)
        .map(p => new Date(p.updated_at || p.created_at!).toDateString())
    );
    if (days.size === 0) return 0;
    const cursor = new Date();
    if (!days.has(cursor.toDateString())) {
      cursor.setDate(cursor.getDate() - 1);
    }
    let streak = 0;
    while (days.has(cursor.toDateString())) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  /** Icon theo lộ trình học: cây lớn dần, thống nhất một bộ cho mọi khóa. */
  courseEmoji(course: Course): string {
    const key = `${course.title} ${course.level}`.toLowerCase();
    if (key.includes('nền tảng') || key.includes('beginner')) return '🌱';
    if (key.includes('mở rộng') || key.includes('pre')) return '🌳';
    if (key.includes('giao tiếp') || key.includes('elementary')) return '🌿';
    return '🌿';
  }

  /** Tên khóa hiển thị: bỏ tiền tố cấp độ trước dấu ":". */
  courseName(course: Course): string {
    const idx = course.title.indexOf(':');
    return idx > 0 ? course.title.slice(idx + 1).trim() : course.title;
  }
}
