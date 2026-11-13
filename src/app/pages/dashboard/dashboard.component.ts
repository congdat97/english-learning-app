import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LearningService } from '../../services/learning.service';
import { Course } from '../../models/learning.model';

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
    this.learning.getCourses().subscribe({
      next: (res) => { this.courses = res.data || []; this.loading = false; },
      error: () => { this.error = true; this.loading = false; }
    });
  }

  /** Icon riêng cho từng khóa học (theo tên + cấp độ). */
  courseEmoji(course: Course): string {
    const key = `${course.title} ${course.level}`.toLowerCase();
    if (key.includes('nền tảng') || key.includes('beginner')) return '🌱';
    if (key.includes('giao tiếp') || key.includes('elementary')) return '💬';
    if (key.includes('mở rộng') || key.includes('pre')) return '🚀';
    if (key.includes('intermediate')) return '🗣️';
    if (key.includes('advanced')) return '🎯';
    return '📘';
  }

  /** Màu accent đi kèm icon, dùng làm biến --card-accent trên card. */
  courseAccent(course: Course): string {
    switch (this.courseEmoji(course)) {
      case '🌱': return '#f59e0b';
      case '💬': return '#0ea5e9';
      case '🚀': return '#8b5cf6';
      case '🗣️': return '#f43f5e';
      case '🎯': return '#10b981';
      default: return '#3b82f6';
    }
  }

  /** Stats hiện đang là dữ liệu mẫu — bấm vào sẽ cảnh báo. */
  stubAlert(label: string): void {
    window.alert(`⚠️ "${label}" đang hiển thị dữ liệu mẫu — tính năng theo dõi tiến độ thực tế chưa hoạt động.`);
  }
}
