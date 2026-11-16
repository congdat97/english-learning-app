import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LearningService } from '../../services/learning.service';
import { AuthService } from '../../services/auth.service';

interface AdminProgressRow {
  id: number;
  lesson_id: number;
  lesson_title: string | null;
  status: string;
  score: number;
  total_questions: number;
  completed_at: string | null;
  updated_at: string;
  user_id: number;
  username: string;
  role: string;
}

interface UserProgressGroup {
  user_id: number;
  username: string;
  role: string;
  rows: AdminProgressRow[];
  completed: number;
  avgScore: number;
  lastActivity: string;
}

@Component({
  selector: 'app-admin-progress',
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-progress.component.html',
  styleUrl: './admin-progress.component.css'
})
export class AdminProgressComponent implements OnInit {
  groups: UserProgressGroup[] = [];
  loading = true;
  error = false;

  constructor(private learning: LearningService, private auth: AuthService) {}

  ngOnInit(): void {
    if (!this.auth.getToken()) { this.loading = false; this.error = true; return; }
    this.learning.getAdminUserProgress().subscribe({
      next: (res) => {
        const rows = res.data || [];
        const byUser = new Map<number, UserProgressGroup>();
        for (const r of rows) {
          let g = byUser.get(r.user_id);
          if (!g) {
            g = { user_id: r.user_id, username: r.username, role: r.role, rows: [], completed: 0, avgScore: 0, lastActivity: '' };
            byUser.set(r.user_id, g);
          }
          g.rows.push(r);
          if (r.status === 'completed') g.completed++;
        }
        this.groups = [...byUser.values()].map(g => {
          const scored = g.rows.filter(r => r.total_questions > 0);
          g.avgScore = scored.length
            ? Math.round((scored.reduce((s, r) => s + r.score / r.total_questions, 0) / scored.length) * 100)
            : 0;
          g.lastActivity = g.rows.reduce((max, r) => r.updated_at > max ? r.updated_at : max, '');
          g.rows.sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
          return g;
        });
        this.loading = false;
      },
      error: () => { this.error = true; this.loading = false; }
    });
  }
}
