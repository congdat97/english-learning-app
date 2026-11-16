import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AuthUser {
  id: number;
  username: string;
  role: string;
  avatar?: string | null;
}

interface AuthResponse {
  success: boolean;
  data: { token: string; user: AuthUser };
}

interface MeResponse {
  success: boolean;
  data: AuthUser;
}

const TOKEN_KEY = 'elf-auth-token';
const USER_KEY = 'elf-auth-user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  private readonly userSignal = signal<AuthUser | null>(this.restore());

  /** null = chưa đăng nhập */
  currentUser(): AuthUser | null {
    return this.userSignal();
  }

  getToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }

  isLoggedIn(): boolean {
    return this.userSignal() !== null;
  }

  isAdmin(): boolean {
    return this.userSignal()?.role === 'admin';
  }

  login(username: string, password: string): Observable<AuthUser> {
    return this.http
      .post<AuthResponse>(`${this.base}/auth/login`, { username, password })
      .pipe(tap(res => this.accept(res.data)), map(res => res.data.user));
  }

  register(username: string, password: string): Observable<AuthUser> {
    return this.http
      .post<AuthResponse>(`${this.base}/auth/register`, { username, password })
      .pipe(tap(res => this.accept(res.data)), map(res => res.data.user));
  }

  /** Lưu avatar lên server và cập nhật user hiện tại trong localStorage */
  updateAvatar(avatar: string): Observable<AuthUser> {
    return this.http
      .put<MeResponse>(`${this.base}/auth/me`, { avatar })
      .pipe(
        map(res => res.data),
        tap(user => this.patchUser(user))
      );
  }

  /** Gộp dữ liệu user mới vào signal hiện tại (giữ nguyên token) */
  private patchUser(user: AuthUser): void {
    const merged = { ...this.userSignal(), ...user };
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(merged));
    } catch {
      /* ignore */
    }
    this.userSignal.set(merged);
  }

  logout(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch {
      /* ignore */
    }
    this.userSignal.set(null);
  }

  private accept(data: { token: string; user: AuthUser }): void {
    try {
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    } catch {
      /* ignore */
    }
    this.userSignal.set(data.user);
  }

  private restore(): AuthUser | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  }
}
