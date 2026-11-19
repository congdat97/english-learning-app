import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LeaderboardRow } from '../../models/learning.model';
import { AuthService } from '../../services/auth.service';
import { LearningService } from '../../services/learning.service';

type RankBy = 'completed' | 'avg_score' | 'last_activity';

interface RankedRow extends LeaderboardRow {
  rank: number;
}

@Component({
  selector: 'app-ranking',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './ranking.component.html',
  styleUrl: './ranking.component.css'
})
export class RankingComponent implements OnInit, OnDestroy {
  rows: LeaderboardRow[] = [];
  rankedRows: RankedRow[] = [];
  loading = true;
  error = false;
  slowHint = false;
  search = '';
  rankBy: RankBy = 'completed';
  limit = 10;

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

  load(): void {
    this.loading = true;
    this.error = false;
    this.learning.getLeaderboard().subscribe({
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
      .sort((a, b) => {
        if (this.rankBy === 'avg_score') {
          return (b.avg_score - a.avg_score) ||
            (b.completed - a.completed) ||
            this.byActivity(b, a) ||
            a.username.localeCompare(b.username);
        }
        if (this.rankBy === 'last_activity') {
          return this.byActivity(b, a) ||
            (b.completed - a.completed) ||
            (b.avg_score - a.avg_score) ||
            a.username.localeCompare(b.username);
        }
        return (b.completed - a.completed) ||
          (b.avg_score - a.avg_score) ||
          this.byActivity(b, a) ||
          a.username.localeCompare(b.username);
      });

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

  trackBy(_: number, row: RankedRow): number {
    return row.user_id;
  }

  private byActivity(a: LeaderboardRow, b: LeaderboardRow): number {
    return (a.last_activity || '').localeCompare(b.last_activity || '');
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
