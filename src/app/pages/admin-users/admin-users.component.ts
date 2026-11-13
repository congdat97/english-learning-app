import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService, AuthUser } from '../../services/auth.service';

interface UserRow {
  id: number;
  username: string;
  role: 'admin' | 'user';
  created_at: string;
}

@Component({
  selector: 'app-admin-users',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.css'
})
export class AdminUsersComponent implements OnInit {
  users: UserRow[] = [];
  loading = true;

  newUsername = '';
  newPassword = '';
  newRole: 'user' | 'admin' = 'user';
  creating = false;
  message = '';

  private base = environment.apiUrl;
  private http = inject(HttpClient);
  readonly auth = inject(AuthService);

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading = true;
    this.http.get<{ success: boolean; data: UserRow[] }>(`${this.base}/auth/users`).subscribe({
      next: (r) => { this.users = r.data || []; this.loading = false; },
      error: () => { this.loading = false; this.message = '⚠️ Không tải được danh sách tài khoản.'; }
    });
  }

  createUser(): void {
    if (this.creating) return;
    this.message = '';

    if (this.newUsername.trim().length < 3) {
      this.message = 'Tên đăng nhập cần ít nhất 3 ký tự.';
      return;
    }
    if (this.newPassword.length < 6) {
      this.message = 'Mật khẩu cần ít nhất 6 ký tự.';
      return;
    }

    this.creating = true;
    this.http.post<{ success: boolean; data: UserRow }>(`${this.base}/auth/users`, {
      username: this.newUsername.trim(),
      password: this.newPassword,
      role: this.newRole
    }).subscribe({
      next: () => {
        this.creating = false;
        this.newUsername = '';
        this.newPassword = '';
        this.newRole = 'user';
        this.message = '✅ Đã tạo tài khoản.';
        this.loadUsers();
      },
      error: (e) => {
        this.creating = false;
        this.message = e?.error?.message || '⚠️ Không tạo được tài khoản.';
      }
    });
  }

  removeUser(u: UserRow): void {
    if (u.id === this.auth.currentUser()?.id) return;
    if (!window.confirm(`Xóa tài khoản "${u.username}"?`)) return;
    this.http.delete<{ success: boolean }>(`${this.base}/auth/users/${u.id}`).subscribe({
      next: () => this.loadUsers(),
      error: (e) => this.message = e?.error?.message || '⚠️ Không xóa được tài khoản.'
    });
  }
}
