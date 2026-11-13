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

  /** Stats hiện đang là dữ liệu mẫu — bấm vào sẽ cảnh báo. */
  stubAlert(label: string): void {
    window.alert(`⚠️ "${label}" đang hiển thị dữ liệu mẫu — tính năng theo dõi tiến độ thực tế chưa hoạt động.`);
  }
}
