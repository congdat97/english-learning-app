import { Component, OnInit } from '@angular/core';
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
export class CoursesComponent implements OnInit {
  courses: Course[] = [];
  loading = true;
  constructor(private learning: LearningService) {}
  ngOnInit(): void {
    this.learning.getCourses().subscribe({ next: (r) => { this.courses = r.data; this.loading = false; }, error: () => this.loading = false });
  }
}
