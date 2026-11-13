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
