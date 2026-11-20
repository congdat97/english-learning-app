import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { StarLeaderboardRow } from '../../models/learning.model';
import { AuthService } from '../../services/auth.service';
import { StarRankingComponent } from './star-ranking.component';

describe('StarRankingComponent', () => {
  let component: StarRankingComponent;
  let fixture: ReturnType<typeof TestBed.createComponent<StarRankingComponent>>;
  let http: HttpTestingController;
  const base = environment.apiUrl;

  const row = (
    user_id: number,
    username: string,
    total_stars: number,
    three_stars: number,
    avg_score: number
  ): StarLeaderboardRow => ({
    user_id,
    username,
    avatar: null,
    three_stars,
    two_stars: 1,
    one_star: 0,
    zero_stars: 0,
    total_stars,
    total_score: 18,
    total_questions: 20,
    avg_score,
    last_activity: '2026-11-20T01:00:00Z'
  });

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [StarRankingComponent],
      providers: [provideRouter([]), provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
    }).compileComponents();

    fixture = TestBed.createComponent(StarRankingComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('loads and sorts learners by total stars', () => {
    fixture.detectChanges();
    expect(component.loading).toBe(true);

    http.expectOne(`${base}/game/leaderboard`).flush({
      success: true,
      data: [row(1, 'ana', 5, 1, 80), row(2, 'bin', 11, 3, 95)]
    });

    expect(component.loading).toBe(false);
    expect(component.rankedRows.length).toBe(2);
    expect(component.rankedRows[0].user_id).toBe(2);
    expect(component.rankedRows[0].rank).toBe(1);
  });

  it('re-sorts by three-star stages and filters without another request', () => {
    fixture.detectChanges();
    http.expectOne(`${base}/game/leaderboard`).flush({
      success: true,
      data: [row(1, 'ana', 5, 1, 80), row(2, 'bin', 11, 3, 95)]
    });

    component.rankBy = 'three_stars';
    component.applyFilters();
    expect(component.rankedRows[0].user_id).toBe(2);

    component.search = 'ana';
    component.applyFilters();
    expect(component.rankedRows.length).toBe(1);
    expect(component.rankedRows[0].username).toBe('ana');
  });

  it('computes the current user rank and star total', () => {
    vi.spyOn(TestBed.inject(AuthService), 'currentUser').mockReturnValue({ id: 9, username: 'me', role: 'user' });
    fixture.detectChanges();
    http.expectOne(`${base}/game/leaderboard`).flush({
      success: true,
      data: [row(1, 'ana', 12, 4, 98), row(9, 'me', 8, 2, 88), row(2, 'bin', 5, 1, 70)]
    });

    expect(component.myRank).toBe(2);
    expect(component.myTotal).toBe(3);
    expect(component.myStars).toBe(8);
  });

  it('load(true) refetches even when a cache exists', () => {
    fixture.detectChanges();
    http.expectOne(`${base}/game/leaderboard`).flush({ success: true, data: [] });

    component.load(true);

    http.expectOne(`${base}/game/leaderboard`).flush({ success: true, data: [] });
    expect(component.loading).toBe(false);
  });

  it('shows error state when the API fails', () => {
    fixture.detectChanges();
    http.expectOne(`${base}/game/leaderboard`).flush('boom', { status: 500, statusText: 'Server Error' });
    expect(component.error).toBe(true);
    expect(component.loading).toBe(false);
  });
});
