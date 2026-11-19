import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { RankingComponent } from './ranking.component';

describe('RankingComponent', () => {
  let component: RankingComponent;
  let fixture: ReturnType<typeof TestBed.createComponent<RankingComponent>>;
  let http: HttpTestingController;
  const base = environment.apiUrl;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [RankingComponent],
      providers: [provideRouter([]), provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
    }).compileComponents();

    fixture = TestBed.createComponent(RankingComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
    localStorage.clear();
  });

  it('loads and sorts learners by completed lessons', () => {
    fixture.detectChanges();
    expect(component.loading).toBe(true);

    http.expectOne(`${base}/leaderboard`).flush({
      success: true,
      data: [
        { user_id: 1, username: 'ana', avatar: null, completed: 2, avg_score: 80, last_activity: '2026-11-19T01:00:00Z' },
        { user_id: 2, username: 'bin', avatar: null, completed: 5, avg_score: 60, last_activity: '2026-11-18T01:00:00Z' }
      ]
    });

    expect(component.loading).toBe(false);
    expect(component.rankedRows.length).toBe(2);
    expect(component.rankedRows[0].user_id).toBe(2);
    expect(component.rankedRows[0].rank).toBe(1);
  });

  it('re-sorts and filters without another request', () => {
    fixture.detectChanges();
    http.expectOne(`${base}/leaderboard`).flush({
      success: true,
      data: [
        { user_id: 1, username: 'ana', avatar: null, completed: 2, avg_score: 80, last_activity: '2026-11-19T01:00:00Z' },
        { user_id: 2, username: 'bin', avatar: null, completed: 5, avg_score: 60, last_activity: '2026-11-18T01:00:00Z' }
      ]
    });

    component.rankBy = 'avg_score';
    component.applyFilters();
    expect(component.rankedRows[0].user_id).toBe(1);

    component.search = 'bin';
    component.applyFilters();
    expect(component.rankedRows.length).toBe(1);
    expect(component.rankedRows[0].username).toBe('bin');
  });

  it('shows error state when leaderboard API fails', () => {
    fixture.detectChanges();
    http.expectOne(`${base}/leaderboard`).flush('boom', { status: 500, statusText: 'Server Error' });
    expect(component.error).toBe(true);
    expect(component.loading).toBe(false);
  });
});
