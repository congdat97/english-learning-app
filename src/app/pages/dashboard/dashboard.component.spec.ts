import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ReturnType<typeof TestBed.createComponent<DashboardComponent>>;
  let http: HttpTestingController;
  const base = environment.apiUrl;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [provideRouter([]), provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('shows loading initially then renders courses', () => {
    fixture.detectChanges();
    expect(component.loading).toBe(true);
    http.expectOne(`${base}/courses`).flush({ success: true, data: [
      { id: 1, title: 'Beginner: Nền tảng', description: 'A1', level: 'beginner', sort_order: 1 }
    ]});
    http.expectOne(`${base}/lessons/progress/all`).flush({ success: true, data: [
      { id: 1, lesson_id: 1, status: 'completed', score: 2, total_questions: 5, completed_at: null, updated_at: new Date().toISOString() }
    ]});
    http.expectOne(`${base}/vocabulary/bookmarks`).flush({ success: true, data: [{ id: 9 }] });
    expect(component.loading).toBe(false);
    expect(component.courses.length).toBe(1);
    expect(component.error).toBe(false);
    expect(component.completedLessons).toBe(1);
    expect(component.savedWords).toBe(1);
    expect(component.streakDays).toBeGreaterThanOrEqual(0);
  });

  it('handles data being null as empty list', () => {
    fixture.detectChanges();
    http.expectOne(`${base}/courses`).flush({ success: true, data: null });
    http.expectOne(`${base}/lessons/progress/all`).flush({ success: true, data: null });
    http.expectOne(`${base}/vocabulary/bookmarks`).flush({ success: true, data: null });
    expect(component.courses).toEqual([]);
    expect(component.loading).toBe(false);
    expect(component.completedLessons).toBe(0);
    expect(component.savedWords).toBe(0);
  });

  it('sets error state on request failure and supports retry', () => {
    fixture.detectChanges();
    // Mỗi stream tự catchError nên cả 3 request đều chờ được flush
    http.expectOne(`${base}/courses`).flush('boom', { status: 500, statusText: 'Server Error' });
    http.expectOne(`${base}/lessons/progress/all`).flush('boom', { status: 500, statusText: 'Server Error' });
    http.expectOne(`${base}/vocabulary/bookmarks`).flush('boom', { status: 500, statusText: 'Server Error' });
    expect(component.error).toBe(true);
    expect(component.loading).toBe(false);

    component.load();
    http.expectOne(`${base}/courses`).flush({ success: true, data: [] });
    http.expectOne(`${base}/lessons/progress/all`).flush({ success: true, data: [] });
    http.expectOne(`${base}/vocabulary/bookmarks`).flush({ success: true, data: [] });
    expect(component.error).toBe(false);
    expect(component.loading).toBe(false);
  });

  it('strips the level prefix from course titles', () => {
    fixture.detectChanges();
    http.expectOne(`${base}/courses`).flush({ success: true, data: [
      { id: 1, title: 'Elementary: Giao tiếp thường ngày', description: 'A2', level: 'elementary', sort_order: 1 }
    ]});
    http.expectOne(`${base}/lessons/progress/all`).flush({ success: true, data: [] });
    http.expectOne(`${base}/vocabulary/bookmarks`).flush({ success: true, data: [] });
    expect(component.courseName(component.courses[0])).toBe('Giao tiếp thường ngày');
  });
});
