import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
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
    this.learning.getCourse(id).subscribe({ next: (r) => this.course = r.data, error: () => this.loading = false });
    this.learning.getLessons(id).subscribe({ next: (r) => { this.lessons = r.data; this.loading = false; }, error: () => this.loading = false });
    // Tiến độ lấy từ cache (lấy nhanh, không đợi API) để đánh dấu bài đã học
    this.learning.getAllProgress().subscribe({
      next: (r) => {
        for (const row of (r.data || [])) {
          if (row.lesson_id != null) this.progressMap.set(row.lesson_id, row);
        }
      },
      error: () => {}
    });
  }

  completedCount(): number {
    return this.lessons.filter(l => this.progressMap.get(l.id)?.status === 'completed').length;
  }
}
