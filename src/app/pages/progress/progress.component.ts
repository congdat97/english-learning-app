import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin, Subject, takeUntil } from 'rxjs';
import { LearningService } from '../../services/learning.service';
import { Course, Lesson, UserProgress } from '../../models/learning.model';

interface CourseProgress {
  course: Course;
  lessons: Lesson[];
  progress: Record<number, UserProgress | null>;
  completed: number;
}

@Component({
  selector: 'app-progress',
  imports: [CommonModule, RouterLink],
  templateUrl: './progress.component.html',
  styleUrl: './progress.component.css'
})
export class ProgressComponent implements OnInit, OnDestroy {
  items: CourseProgress[] = [];
  loading = true;
  error = false;
  slowApi = false;
  private slowTimer?: ReturnType<typeof setTimeout>;
  private destroy$ = new Subject<void>();
  totalCompleted = 0;
  totalLessons = 0;

  constructor(private learning: LearningService) {}

  /** Emoji theo cấp độ khóa học (đồng bộ với dashboard) */
  courseEmoji(course: Course): string {
    const key = `${course.title} ${course.level}`.toLowerCase();
    if (key.includes('nền tảng') || key.includes('beginner')) return '🌱';
    if (key.includes('mở rộng') || key.includes('pre')) return '🌳';
    if (key.includes('giao tiếp') || key.includes('elementary')) return '🌿';
    return '📘';
  }

  /** Tên khóa hiển thị: bỏ tiền tố cấp độ trước dấu ":" */
  courseName(course: Course): string {
    const idx = course.title.indexOf(':');
    return idx > 0 ? course.title.slice(idx + 1).trim() : course.title;
  }

  ngOnInit(): void {
    this.slowTimer = setTimeout(() => { if (this.loading) this.slowApi = true; }, 8000);
    // 1 request tiến độ tổng + N request danh sách lesson (thay vì 1 request/lesson)
    forkJoin({
      courses: this.learning.getCourses(),
      progress: this.learning.getAllProgress()
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ courses, progress }) => {
          const byLesson = new Map<number, UserProgress>();
          (progress.data ?? []).forEach(p => byLesson.set(p.lesson_id, p));

          const list = courses.data ?? [];
          if (!list.length) {
            this.items = [];
            this.totalCompleted = 0;
            this.totalLessons = 0;
            this.loading = false;
            return;
          }

          const jobs = list.map(course =>
            this.learning.getLessons(course.id).pipe(takeUntil(this.destroy$))
          );
          forkJoin(jobs)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (lessonLists) => {
                this.items = lessonLists.map((lr, i) => {
                  const lessons = lr.data ?? [];
                  const progressMap: Record<number, UserProgress | null> = {};
                  let completed = 0;
                  for (const lesson of lessons) {
                    progressMap[lesson.id] = byLesson.get(lesson.id) ?? null;
                    if (progressMap[lesson.id]?.status === 'completed') completed++;
                  }
                  return { course: list[i], lessons, progress: progressMap, completed };
                });
                this.totalLessons = this.items.reduce((s, it) => s + it.lessons.length, 0);
                this.totalCompleted = this.items.reduce((s, it) => s + it.completed, 0);
                this.loading = false;
              },
              error: () => { this.loading = false; this.error = true; }
            });
        },
        error: () => { this.loading = false; this.error = true; }
      });
  }

  ngOnDestroy(): void {
    clearTimeout(this.slowTimer);
    this.destroy$.next();
    this.destroy$.complete();
  }
}
