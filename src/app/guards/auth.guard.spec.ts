import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

describe('authGuard', () => {
  let auth: AuthService;
  let router: Router;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  it('cho phép vào khi đã đăng nhập', () => {
    localStorage.setItem('elf-auth-user', JSON.stringify({ id: 1, username: 'a', role: 'user' }));
    (auth as any).userSignal.set({ id: 1, username: 'a', role: 'user' });
    const result = TestBed.runInInjectionContext(() => authGuard());
    expect(result).toBe(true);
  });

  it('chuyển hướng /login khi chưa đăng nhập', () => {
    const result = TestBed.runInInjectionContext(() => authGuard());
    expect(result.toString()).toBe('/login');
  });
});
