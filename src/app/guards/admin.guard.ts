import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Chỉ admin vào được trang quản lý tài khoản. */
export const adminGuard = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAdmin()) return true;

  return router.createUrlTree(['/login']);
};
