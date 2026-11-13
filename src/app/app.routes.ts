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
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'courses', component: CoursesComponent },
  { path: 'courses/:id', component: CourseDetailComponent },
  { path: 'lessons/:id', component: LessonComponent },
  { path: 'bookmarks', component: BookmarksComponent },
  { path: 'progress', component: ProgressComponent },
  { path: 'settings', component: SettingsComponent },
  { path: 'login', component: LoginComponent },
  { path: 'admin/users', component: AdminUsersComponent, canActivate: [adminGuard] },
  { path: '**', redirectTo: 'dashboard' }
];
