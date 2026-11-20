import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Course, Lesson } from '../../models/learning.model';
import { GameStage } from '../../models/game.model';
import { GameService } from '../../services/game.service';
import { LearningService } from '../../services/learning.service';

interface CourseGroup {
  courseId: number;
  courseTitle: string;
  stages: GameStage[];
}

@Component({
  selector: 'app-game',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './game.component.html',
  styleUrl: './game.component.css'
})
export class GameComponent implements OnInit {
  loading = true;
  error = false;
  search = '';
  groups: CourseGroup[] = [];
  visibleGroups: CourseGroup[] = [];
  totalStars = 0;
  totalPlayed = 0;
  totalStages = 0;
  starBreakdown = 'Chưa có sao — hoàn thành một màn để ăn sao';

  constructor(private learning: LearningService, private game: GameService) {}

  ngOnInit(): void {
    this.load();
  }

  load(force = false): void {
    this.loading = true;
    this.error = false;
    this.learning.getCourses(force).subscribe({
      next: res => {
        const courses = res.data || [];
        if (!courses.length) {
          this.groups = [];
          this.applyFilters();
          this.loading = false;
          return;
        }

        forkJoin(courses.map(course =>
          this.learning.getLessons(course.id, force).pipe(
            catchError(() => of({ success: true, data: [] as Lesson[] })),
            map(res => res.data || [])
          )
        )).subscribe({
          next: lessonGroups => {
            this.buildGroups(courses, lessonGroups);
            this.loading = false;
          },
          error: () => {
            this.error = true;
            this.loading = false;
          }
        });
      },
      error: () => {
        this.error = true;
        this.loading = false;
      }
    });
  }

  applyFilters(): void {
    const term = this.search.trim().toLowerCase();
    this.visibleGroups = this.groups
      .map(group => ({
        ...group,
        stages: group.stages.filter(stage =>
          !term || stage.title.toLowerCase().includes(term) || (stage.topic || '').toLowerCase().includes(term)
        )
      }))
      .filter(group => group.stages.length > 0);
  }

  starsLabel(stars: number): string {
    return '★★★☆☆'.slice(3 - Math.max(0, Math.min(3, stars)), 6 - Math.max(0, Math.min(3, stars)));
  }

  trackGroup(_: number, group: CourseGroup): number {
    return group.courseId;
  }

  trackStage(_: number, stage: GameStage): string {
    return stage.id;
  }

  private buildGroups(courses: Course[], lessonGroups: Lesson[][]): void {
    const results = this.game.getAllResults();
    this.totalStars = results.reduce((sum, result) => sum + this.clampStars(result.stars), 0);
    this.totalPlayed = results.length;

    const counts = [0, 0, 0, 0];
    results.forEach(result => {
      const stars = this.clampStars(result.stars);
      if (stars > 0) counts[stars]++;
    });
    this.starBreakdown = counts
      .map((count, stars) => (count && stars ? `${stars}★ ×${count}` : ''))
      .filter(Boolean)
      .join(' · ') || 'Chưa có sao — hoàn thành một màn để ăn sao';

    this.groups = courses.map((course, index) => ({
      courseId: course.id,
      courseTitle: course.title,
      stages: (lessonGroups[index] || []).map(lesson => {
        const stageId = this.game.stageId(lesson.id);
        const result = this.game.getResult(stageId);
        return {
          id: stageId,
          lessonId: lesson.id,
          courseId: course.id,
          courseTitle: course.title,
          title: lesson.title,
          topic: lesson.topic,
          order: lesson.sort_order,
          bestStars: result ? this.clampStars(result.stars) : 0,
          bestAccuracy: result?.accuracy ?? 0,
          played: result ? 1 : 0
        };
      })
    })).filter(group => group.stages.length > 0);

    this.totalStages = this.groups.reduce((sum, group) => sum + group.stages.length, 0);
    this.applyFilters();
  }

  private clampStars(stars: number): number {
    return Math.max(0, Math.min(3, Number(stars) || 0));
  }
}
