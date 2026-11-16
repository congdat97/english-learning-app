import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { CoursesComponent } from './pages/courses/courses.component';
import { CourseDetailComponent } from './pages/course-detail/course-detail.component';
import { LessonComponent } from './pages/lesson/lesson.component';
import { BookmarksComponent } from './pages/bookmarks/bookmarks.component';
import { ProgressComponent } from './pages/progress/progress.component';
import { SettingsComponent } from './pages/settings/settings.component';
import { LoginComponent } from './pages/login/login.component';
import { AdminUsersComponent } from './pages/admin-users/admin-users.component';
import { AdminProgressComponent } from './pages/admin-progress/admin-progress.component';
import { adminGuard } from './guards/admin.guard';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'courses', component: CoursesComponent, canActivate: [authGuard] },
  { path: 'courses/:id', component: CourseDetailComponent, canActivate: [authGuard] },
  { path: 'lessons/:id', component: LessonComponent, canActivate: [authGuard] },
  { path: 'bookmarks', component: BookmarksComponent, canActivate: [authGuard] },
  { path: 'progress', component: ProgressComponent, canActivate: [authGuard] },
  { path: 'settings', component: SettingsComponent, canActivate: [authGuard] },
  { path: 'admin/users', component: AdminUsersComponent, canActivate: [authGuard, adminGuard] },
  { path: 'admin/progress', component: AdminProgressComponent, canActivate: [authGuard, adminGuard] },
  { path: '**', redirectTo: 'dashboard' }
];
