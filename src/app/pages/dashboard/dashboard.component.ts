import { Component, OnInit } from '@angular/core';
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
export class DashboardComponent implements OnInit {
  courses: Course[] = [];
  loading = true;

  constructor(private learning: LearningService) {}

  ngOnInit(): void {
    this.learning.getCourses().subscribe({
      next: (res) => { this.courses = res.data; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }
}
