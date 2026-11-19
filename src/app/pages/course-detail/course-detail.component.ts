import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { LearningService } from '../../services/learning.service';
import { Course, Lesson, UserProgress } from '../../models/learning.model';

@Component({
  selector: 'app-course-detail',
  imports: [CommonModule, RouterLink],
  templateUrl: './course-detail.component.html',
  styleUrl: './course-detail.component.css'
})
export class CourseDetailComponent implements OnInit {
  course: Course | null = null;
  lessons: Lesson[] = [];
  loading = true;
  progressMap = new Map<number, UserProgress>();
  constructor(private route: ActivatedRoute, private learning: LearningService) {}
  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    forkJoin({
      course: this.learning.getCourse(id).pipe(catchError(() => of(null))),
      lessons: this.learning.getLessons(id).pipe(catchError(() => of(null))),
      progress: this.learning.getAllProgress().pipe(catchError(() => of(null)))
    }).subscribe(({ course, lessons, progress }) => {
      this.course = course?.data ?? null;
      this.lessons = lessons?.data ?? [];
      for (const row of (progress?.data || [])) {
        if (row.lesson_id != null) this.progressMap.set(row.lesson_id, row);
      }
      this.loading = false;
    });
  }

  completedCount(): number {
    return this.lessons.filter(l => this.progressMap.get(l.id)?.status === 'completed').length;
  }

  trackByLesson(_: number, lesson: Lesson): number {
    return lesson.id;
  }

  /** Warm 4 API của bài học ngay khi user hover/focus/chạm nút "Học". */
  prefetch(lessonId: number): void {
    this.learning.prefetchLesson(lessonId);
  }
}
