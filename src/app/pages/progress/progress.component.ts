import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
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
  slowApi = false;
  private slowTimer?: ReturnType<typeof setTimeout>;
  totalCompleted = 0;
  totalLessons = 0;

  constructor(private learning: LearningService) {}

  ngOnInit(): void {
    this.slowTimer = setTimeout(() => { if (this.loading) this.slowApi = true; }, 8000);
    this.learning.getCourses().subscribe({
      next: (res) => {
        const courses = res.data;
        if (courses.length === 0) { this.loading = false; return; }
        const courseProgresses = courses.map((course) => {
          const cp: CourseProgress = { course, lessons: [], progress: {}, completed: 0 };
          return this.learning.getLessons(course.id).toPromise().then((lr) => {
            cp.lessons = lr?.data || [];
            return Promise.all(cp.lessons.map((lesson) =>
              this.learning.getProgress(lesson.id).toPromise().then((pr) => {
                cp.progress[lesson.id] = pr?.data || null;
                if (pr?.data?.status === 'completed') cp.completed++;
              }).catch(() => { cp.progress[lesson.id] = null; })
            )).then(() => cp);
          }).catch(() => cp);
        });
        Promise.all(courseProgresses).then((items) => {
          this.items = items;
          this.totalLessons = items.reduce((sum, item) => sum + item.lessons.length, 0);
          this.totalCompleted = items.reduce((sum, item) => sum + item.completed, 0);
          this.loading = false;
        });
      },
      error: () => { this.loading = false; }
    });
  }

  ngOnDestroy(): void {
    clearTimeout(this.slowTimer);
  }
}
