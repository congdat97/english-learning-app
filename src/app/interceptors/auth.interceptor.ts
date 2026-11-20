import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/** Gắn token Bearer vào mọi request /api (trừ chính request đăng nhập). */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.getToken();

  const handle = (request: typeof req) => next(request).pipe(
    catchError(err => {
      if (err?.status === 401 && !req.url.includes('/auth/login')) {
        auth.logout();
        void router.navigate(['/login']);
      }
      return throwError(() => err);
    })
  );

  if (!token || req.url.includes('/auth/login') || req.url.includes('/auth/register')) {
    return handle(req);
  }

  return handle(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
