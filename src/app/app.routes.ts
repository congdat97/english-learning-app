import { Routes } from '@angular/router';
import { adminGuard } from './guards/admin.guard';
import { authGuard } from './guards/auth.guard';

/**
 * Lazy-load từng trang: chỉ tải code trang khi người dùng vào trang đó
 * -> bundle khởi động nhỏ hơn, mở app nhanh hơn.
 */
export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent)
  },
  {
    path: 'courses',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/courses/courses.component').then(m => m.CoursesComponent)
  },
  {
    path: 'courses/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/course-detail/course-detail.component').then(m => m.CourseDetailComponent)
  },
  {
    path: 'lessons/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/lesson/lesson.component').then(m => m.LessonComponent)
  },
  {
    path: 'bookmarks',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/bookmarks/bookmarks.component').then(m => m.BookmarksComponent)
  },
  {
    path: 'progress',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/progress/progress.component').then(m => m.ProgressComponent)
  },
  {
    path: 'settings',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/settings/settings.component').then(m => m.SettingsComponent)
  },
  {
    path: 'admin/users',
    canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./pages/admin-users/admin-users.component').then(m => m.AdminUsersComponent)
  },
  {
    path: 'admin/progress',
    canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./pages/admin-progress/admin-progress.component').then(m => m.AdminProgressComponent)
  },
  { path: '**', redirectTo: 'dashboard' }
];
