import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LearningService } from '../../services/learning.service';
import { Course } from '../../models/learning.model';

@Component({
  selector: 'app-courses',
  imports: [CommonModule, RouterLink],
  templateUrl: './courses.component.html',
  styleUrl: './courses.component.css'
})
export class CoursesComponent implements OnInit, OnDestroy {
  courses: Course[] = [];
  loading = true;
  slowApi = false;
  private slowTimer?: ReturnType<typeof setTimeout>;

  constructor(private learning: LearningService) {}
  ngOnInit(): void {
    this.learning.getCourses().subscribe({ next: (r) => { this.courses = r.data; this.loading = false; }, error: () => this.loading = false });
    this.slowTimer = setTimeout(() => { if (this.loading) this.slowApi = true; }, 8000);
  }
  ngOnDestroy(): void {
    clearTimeout(this.slowTimer);
  }

  /** Icon riêng cho từng khóa học (theo tên + cấp độ). */
  courseEmoji(course: Course): string {
    const key = `${course.title} ${course.level}`.toLowerCase();
    if (key.includes('nền tảng') || key.includes('beginner')) return '🌱';
    if (key.includes('giao tiếp') || key.includes('elementary')) return '☕';
    if (key.includes('mở rộng') || key.includes('pre')) return '🌐';
    if (key.includes('intermediate')) return '🗣️';
    if (key.includes('advanced')) return '🎯';
    return '📘';
  }

  /** Màu accent đi kèm icon, dùng làm biến --card-accent trên card. */
  courseAccent(course: Course): string {
    switch (this.courseEmoji(course)) {
      case '🌱': return '#f59e0b';
      case '☕': return '#0ea5e9';
      case '🌐': return '#8b5cf6';
      case '🗣️': return '#f43f5e';
      case '🎯': return '#10b981';
      default: return '#3b82f6';
    }
  }
}
