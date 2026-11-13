import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AuthUser {
  id: number;
  username: string;
  role: 'admin' | 'user';
}

interface AuthPayload {
  token: string;
  user: AuthUser;
}

const STORAGE_KEY = 'elf-auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private base = environment.apiUrl;
  private http = inject(HttpClient);

  /** null khi chưa đăng nhập. */
  readonly currentUser = signal<AuthUser | null>(this.restore());

  readonly isLoggedIn = computed(() => this.currentUser() !== null);
  readonly isAdmin = computed(() => this.currentUser()?.role === 'admin');

  register(username: string, password: string): Observable<AuthPayload> {
    return this.http.post<AuthPayload>(`${this.base}/auth/register`, { username, password })
      .pipe(tap(p => this.store(p)));
  }

  login(username: string, password: string): Observable<AuthPayload> {
    return this.http.post<AuthPayload>(`${this.base}/auth/login`, { username, password })
      .pipe(tap(p => this.store(p)));
  }

  logout(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.currentUser.set(null);
  }

  getToken(): string | null {
    return this.currentUser() ? this.readRaw()?.token ?? null : null;
  }

  private restore(): AuthUser | null {
    const raw = this.readRaw();
    return raw?.user ?? null;
  }

  private readRaw(): AuthPayload | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) as AuthPayload : null;
    } catch {
      return null;
    }
  }

  private store(payload: AuthPayload): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    this.currentUser.set(payload.user);
  }
}
