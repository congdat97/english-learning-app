import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { StarLeaderboardRow } from '../../models/learning.model';
import { AuthService } from '../../services/auth.service';
import { LearningService } from '../../services/learning.service';

type StarRankBy = 'total_stars' | 'three_stars' | 'avg_score' | 'last_activity';

interface RankedStarRow extends StarLeaderboardRow {
  rank: number;
}

@Component({
  selector: 'app-star-ranking',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './star-ranking.component.html',
  styleUrl: './star-ranking.component.css'
})
export class StarRankingComponent implements OnInit, OnDestroy {
  rows: StarLeaderboardRow[] = [];
  rankedRows: RankedStarRow[] = [];
  loading = true;
  error = false;
  slowHint = false;
  search = '';
  rankBy: StarRankBy = 'total_stars';
  limit = 10;
  myRank = 0;
  myTotal = 0;
  myStars = 0;

  private slowTimer?: ReturnType<typeof setTimeout>;

  constructor(private learning: LearningService, private auth: AuthService) {}

  ngOnInit(): void {
    this.slowTimer = setTimeout(() => {
      if (this.loading) this.slowHint = true;
    }, 8000);
    this.load();
  }

  ngOnDestroy(): void {
    if (this.slowTimer) clearTimeout(this.slowTimer);
  }

  load(force = false): void {
    this.loading = true;
    this.error = false;
    this.learning.getStarLeaderboard(force).subscribe({
      next: res => {
        this.rows = Array.isArray(res.data) ? res.data : [];
        this.applyFilters();
        this.finishLoading();
      },
      error: () => {
        this.error = true;
        this.finishLoading();
      }
    });
  }

  applyFilters(): void {
    const term = this.search.trim().toLowerCase();
    const sorted = this.rows
      .filter(row => !term || row.username.toLowerCase().includes(term))
      .sort((a, b) => this.compare(a, b));

    const uid = this.auth.currentUser()?.id;
    const myIndex = uid ? sorted.findIndex(row => row.user_id === uid) : -1;
    this.myRank = myIndex >= 0 ? myIndex + 1 : 0;
    this.myTotal = sorted.length;
    this.myStars = myIndex >= 0 ? sorted[myIndex].total_stars : 0;

    this.rankedRows = sorted.slice(0, this.limit).map((row, index) => ({ ...row, rank: index + 1 }));
  }

  isCurrent(userId: number): boolean {
    return this.auth.currentUser()?.id === userId;
  }

  rankLabel(rank: number): string {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return String(rank);
  }

  played(row: StarLeaderboardRow): number {
    return row.three_stars + row.two_stars + row.one_star + row.zero_stars;
  }

  trackBy(_: number, row: RankedStarRow): number {
    return row.user_id;
  }

  private compare(a: StarLeaderboardRow, b: StarLeaderboardRow): number {
    const activity = (b.last_activity || '').localeCompare(a.last_activity || '');
    const name = a.username.localeCompare(b.username);

    if (this.rankBy === 'three_stars') {
      return (b.three_stars - a.three_stars) ||
        (b.total_stars - a.total_stars) ||
        (b.two_stars - a.two_stars) ||
        (b.avg_score - a.avg_score) || activity || name;
    }
    if (this.rankBy === 'avg_score') {
      return (b.avg_score - a.avg_score) ||
        (b.total_questions - a.total_questions) ||
        (b.total_stars - a.total_stars) || activity || name;
    }
    if (this.rankBy === 'last_activity') {
      return activity ||
        (b.total_stars - a.total_stars) ||
        (b.three_stars - a.three_stars) ||
        (b.avg_score - a.avg_score) || name;
    }
    return (b.total_stars - a.total_stars) ||
      (b.three_stars - a.three_stars) ||
      (b.two_stars - a.two_stars) ||
      (b.one_star - a.one_star) ||
      (b.avg_score - a.avg_score) || activity || name;
  }

  private finishLoading(): void {
    this.loading = false;
    this.slowHint = false;
    if (this.slowTimer) {
      clearTimeout(this.slowTimer);
      this.slowTimer = undefined;
    }
  }
}
