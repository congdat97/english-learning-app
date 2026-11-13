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
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [provideRouter([]), provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('shows loading initially then renders courses', () => {
    fixture.detectChanges();
    expect(component.loading).toBe(true);
    const req = http.expectOne(`${base}/courses`);
    req.flush({ success: true, data: [
      { id: 1, title: 'Cơ bản', description: 'A1', level: 'beginner', sort_order: 1 }
    ]});
    expect(component.loading).toBe(false);
    expect(component.courses.length).toBe(1);
    expect(component.error).toBe(false);
  });

  it('handles data being null as empty list', () => {
    fixture.detectChanges();
    http.expectOne(`${base}/courses`).flush({ success: true, data: null });
    expect(component.courses).toEqual([]);
    expect(component.loading).toBe(false);
  });

  it('sets error state on request failure and supports retry', () => {
    fixture.detectChanges();
    http.expectOne(`${base}/courses`).flush('boom', { status: 500, statusText: 'Server Error' });
    expect(component.error).toBe(true);
    expect(component.loading).toBe(false);

    component.load();
    const retry = http.expectOne(`${base}/courses`);
    expect(component.error).toBe(false);
    retry.flush({ success: true, data: [] });
    expect(component.loading).toBe(false);
  });
});
