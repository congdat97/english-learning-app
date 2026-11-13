import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  mode: 'login' | 'register' = 'login';

  username = '';
  password = '';
  showPassword = false;
  error = '';
  busy = false;

  private auth = inject(AuthService);
  private router = inject(Router);

  switchMode(m: 'login' | 'register'): void {
    this.mode = m;
    this.error = '';
  }

  submit(): void {
    if (this.busy) return;
    this.error = '';

    if (this.username.trim().length < 3) {
      this.error = 'Tên đăng nhập cần ít nhất 3 ký tự.';
      return;
    }
    if (this.password.length < 6) {
      this.error = 'Mật khẩu cần ít nhất 6 ký tự.';
      return;
    }

    this.busy = true;
    const req$ = this.mode === 'login'
      ? this.auth.login(this.username.trim(), this.password)
      : this.auth.register(this.username.trim(), this.password);

    req$.subscribe({
      next: () => {
        this.busy = false;
        this.router.navigate(['/dashboard']);
      },
      error: (e) => {
        this.busy = false;
        this.error = e?.error?.message || (this.mode === 'login'
          ? 'Đăng nhập thất bại — thử lại sau.'
          : 'Đăng ký thất bại — thử lại sau.');
      }
    });
  }
}
