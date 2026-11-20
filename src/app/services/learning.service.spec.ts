import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { LearningService } from './learning.service';

describe('LearningService', () => {
  let service: LearningService;
  let http: HttpTestingController;
  const base = environment.apiUrl;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
    });
    service = TestBed.inject(LearningService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    http.verify();
  });

  it('getCourses fetches from the correct URL', () => {
    service.getCourses().subscribe();
    const req = http.expectOne(`${base}/courses`);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Cache-Control')).toBe('no-cache');
    req.flush({ success: true, data: [] });
  });

  it('getCourse builds /courses/:id', () => {
    service.getCourse(5).subscribe();
    http.expectOne(`${base}/courses/5`).flush({ success: true, data: { id: 5 } });
  });

  it('getLessons builds /courses/:id/lessons', () => {
    service.getLessons(2).subscribe();
    http.expectOne(`${base}/courses/2/lessons`).flush({ success: true, data: [] });
  });

  it('getLesson builds /lessons/:id', () => {
    service.getLesson(9).subscribe();
    http.expectOne(`${base}/lessons/9`).flush({ success: true, data: { id: 9 } });
  });

  it('getVocabulary builds /lessons/:id/vocabulary', () => {
    service.getVocabulary(3).subscribe();
    http.expectOne(`${base}/lessons/3/vocabulary`).flush({ success: true, data: [] });
  });

  it('getListening builds /lessons/:id/listening', () => {
    service.getListening(3).subscribe();
    http.expectOne(`${base}/lessons/3/listening`).flush({ success: true, data: [] });
  });

  it('getReview builds /lessons/:id/review', () => {
    service.getReview(3).subscribe();
    http.expectOne(`${base}/lessons/3/review`).flush({ success: true, data: [] });
  });

  it('prefetchLesson warms all lesson endpoints', () => {
    service.prefetchLesson(4);

    for (const url of [
      `${base}/lessons/4`,
      `${base}/lessons/4/vocabulary`,
      `${base}/lessons/4/listening`,
      `${base}/lessons/4/review`
    ]) {
      const req = http.expectOne(url);
      expect(req.request.method).toBe('GET');
      req.flush({ success: true, data: [] });
    }
  });

  it('getProgress builds /lessons/:id/progress', () => {
    service.getProgress(3).subscribe();
    http.expectOne(`${base}/lessons/3/progress`).flush({ success: true, data: null });
  });

  it('getAllProgress builds /lessons/progress/all', () => {
    service.getAllProgress().subscribe();
    const req = http.expectOne(`${base}/lessons/progress/all`);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: [] });
  });

  it('getAdminUserProgress builds /auth/users/progress without caching', () => {
    service.getAdminUserProgress().subscribe();
    const req = http.expectOne(`${base}/auth/users/progress`);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('X-No-Cache')).toBe('1');
    req.flush({ success: true, data: [] });
  });

  it('getLeaderboard uses the short-lived cache by default', () => {
    service.getLeaderboard().subscribe();
    const req = http.expectOne(`${base}/leaderboard`);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('X-Force-Refresh')).toBeNull();
    req.flush({ success: true, data: [] });

    service.getLeaderboard().subscribe();
    http.expectNone(`${base}/leaderboard`);
  });

  it('getLeaderboard(true) always refreshes from the server', () => {
    service.getLeaderboard(true).subscribe();
    const req = http.expectOne(`${base}/leaderboard`);
    expect(req.request.headers.get('X-Force-Refresh')).toBe('1');
    req.flush({ success: true, data: [] });
  });

  it('getStarLeaderboard uses the short-lived cache by default', () => {
    service.getStarLeaderboard().subscribe();
    const req = http.expectOne(`${base}/game/leaderboard`);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('X-Force-Refresh')).toBeNull();
    req.flush({ success: true, data: [] });

    service.getStarLeaderboard().subscribe();
    http.expectNone(`${base}/game/leaderboard`);
  });

  it('getStarLeaderboard(true) always refreshes from the server', () => {
    service.getStarLeaderboard(true).subscribe();
    const req = http.expectOne(`${base}/game/leaderboard`);
    expect(req.request.headers.get('X-Force-Refresh')).toBe('1');
    req.flush({ success: true, data: [] });
  });

  it('saveGameResult posts the stage result and clears both star cache layers', () => {
    const apiKey = 'api-cache:' + `${base}/game/leaderboard`;
    const httpKey = 'http_cache_' + `${base}/game/leaderboard`;
    localStorage.setItem(apiKey, JSON.stringify({ ts: Date.now(), body: { success: true, data: [] } }));
    localStorage.setItem(httpKey, JSON.stringify({ ts: Date.now(), body: { success: true, data: [] } }));

    service.saveGameResult('lesson-1', 3, 9, 10).subscribe();
    const req = http.expectOne(`${base}/game/result`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ stage_id: 'lesson-1', stars: 3, score: 9, total_questions: 10 });
    req.flush({ success: true, data: { stage_id: 'lesson-1', stars: 3, score: 9, total_questions: 10, updated_at: '2026-11-20T00:00:00Z' } });

    expect(localStorage.getItem(apiKey)).toBeNull();
    expect(localStorage.getItem(httpKey)).toBeNull();
  });

  it('invalidateProgressCache removes the bulk progress cache', () => {
    localStorage.setItem('api-cache:' + `${base}/lessons/progress/all`, JSON.stringify({ ts: Date.now(), body: { success: true, data: [] } }));
    service.invalidateProgressCache();
    expect(localStorage.getItem('api-cache:' + `${base}/lessons/progress/all`)).toBeNull();
  });

  it('updateCachedBookmarks rewrites the bookmarks cache when it exists', () => {
    const url = 'api-cache:' + `${base}/vocabulary/bookmarks`;
    localStorage.setItem(url, JSON.stringify({ ts: Date.now(), body: { success: true, data: [] } }));
    service.updateCachedBookmarks([{ id: 1 } as any]);
    const saved = JSON.parse(localStorage.getItem(url) || '{}');
    expect(saved.body.data.length).toBe(1);
  });

  it('saveProgress posts the correct payload', () => {
    service.saveProgress(3, 'completed', 2, 4).subscribe();
    const req = http.expectOne(`${base}/lessons/3/progress`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ status: 'completed', score: 2, total_questions: 4 });
    req.flush({ success: true, data: {} });
  });

  it('getBookmarks builds /vocabulary/bookmarks', () => {
    service.getBookmarks().subscribe();
    http.expectOne(`${base}/vocabulary/bookmarks`).flush({ success: true, data: [] });
  });

  it('toggleFavorite posts to /vocabulary/:id/favorite', () => {
    service.toggleFavorite(7).subscribe();
    const req = http.expectOne(`${base}/vocabulary/7/favorite`);
    expect(req.request.method).toBe('POST');
    req.flush({ success: true, data: {} });
  });

  it('bookmark posts to /vocabulary/:id/bookmark', () => {
    service.bookmark(7).subscribe();
    const req = http.expectOne(`${base}/vocabulary/7/bookmark`);
    expect(req.request.method).toBe('POST');
    req.flush({ success: true });
  });

  it('unbookmark deletes /vocabulary/:id/bookmark', () => {
    service.unbookmark(7).subscribe();
    const req = http.expectOne(`${base}/vocabulary/7/bookmark`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ success: true });
  });

  describe('cache layer', () => {
    function seedCache(url: string, body: unknown, ts = Date.now()) {
      localStorage.setItem(`api-cache:${url}`, JSON.stringify({ ts, body }));
    }

    it('emits cached data immediately and does NOT call the API when cache exists', () => {
      const url = `${base}/courses`;
      seedCache(url, { success: true, data: [{ id: 9, title: 'cached' }] });
      const emissions: any[] = [];
      let completed = false;
      service.getCourses().subscribe({ next: e => emissions.push(e), complete: () => (completed = true) });

      // cache trả ngay, complete ngay -> không chờ API, không phát request nào
      expect(emissions.length).toBe(1);
      expect(emissions[0].data[0].title).toBe('cached');
      expect(completed).toBe(true);
      http.expectNone(url);
    });

    it('fetches from API only when there is no cache, then saves the cache', () => {
      const url = `${base}/courses`;
      const emissions: any[] = [];
      service.getCourses().subscribe(e => emissions.push(e));
      http.expectOne(url).flush({ success: true, data: [{ id: 1, title: 'from-api' }] });

      expect(emissions[0].data[0].title).toBe('from-api');
      const saved = JSON.parse(localStorage.getItem(`api-cache:${url}`) || '{}');
      expect(saved.body.data[0].title).toBe('from-api');
    });

    it('force refresh bypasses the cache and overwrites it', () => {
      const url = `${base}/courses`;
      seedCache(url, { success: true, data: [{ id: 9, title: 'cached' }] });
      const emissions: any[] = [];
      service.getCourses(true).subscribe(e => emissions.push(e));
      http.expectOne(url).flush({ success: true, data: [{ id: 9, title: 'fresh' }] });

      expect(emissions[0].data[0].title).toBe('fresh');
      const saved = JSON.parse(localStorage.getItem(`api-cache:${url}`) || '{}');
      expect(saved.body.data[0].title).toBe('fresh');
    });

    it('syncProgressCache updates both per-lesson and bulk progress caches', () => {
      const lessonUrl = `api-cache:${base}/lessons/7/progress`;
      const allUrl = `api-cache:${base}/lessons/progress/all`;
      localStorage.setItem(lessonUrl, JSON.stringify({ ts: Date.now(), body: { success: true, data: null } }));
      localStorage.setItem(allUrl, JSON.stringify({ ts: Date.now(), body: { success: true, data: [] } }));

      const row = { lesson_id: 7, status: 'completed', score: 3 } as any;
      service.syncProgressCache(7, row);

      expect(JSON.parse(localStorage.getItem(lessonUrl)!).body.data).toEqual(row);

      const list = JSON.parse(localStorage.getItem(allUrl)!).body.data;
      expect(list.length).toBe(1);
      expect(list[0].score).toBe(3);
    });

    it('getCachedProgress and clearProgressCache roll back optimistic progress', () => {
      const lessonUrl = `api-cache:${base}/lessons/7/progress`;
      const allUrl = `api-cache:${base}/lessons/progress/all`;
      localStorage.setItem(lessonUrl, JSON.stringify({ ts: Date.now(), body: { success: true, data: null } }));
      localStorage.setItem(allUrl, JSON.stringify({ ts: Date.now(), body: { success: true, data: [] } }));

      const optimistic = { lesson_id: 7, status: 'completed', score: 3 } as any;
      service.syncProgressCache(7, optimistic);
      expect(service.getCachedProgress(7)).toEqual(optimistic);

      service.clearProgressCache(7);
      expect(service.getCachedProgress(7)).toBeNull();
      expect(JSON.parse(localStorage.getItem(allUrl)!).body.data).toEqual([]);
    });

    it('getCachedProgress falls back to the bulk progress cache', () => {
      const allUrl = `api-cache:${base}/lessons/progress/all`;
      const row = { lesson_id: 7, status: 'completed', score: 4 } as any;
      localStorage.setItem(allUrl, JSON.stringify({ ts: Date.now(), body: { success: true, data: [row] } }));

      expect(service.getCachedProgress(7)).toEqual(row);
    });

    it('saveSettings refreshes the cached settings response', () => {
      const key = `api-cache:${base}/settings`;
      localStorage.setItem(key, JSON.stringify({ ts: Date.now(), body: { success: true, data: { theme: 'mac-dinh' } } }));

      service.saveSettings({ theme: 'tim-mong' }).subscribe();
      http.expectOne(`${base}/settings`).flush({ success: true, data: { theme: 'tim-mong' } });

      expect(JSON.parse(localStorage.getItem(key)!).body.data.theme).toBe('tim-mong');
    });

    it('syncVocabularyBookmarkCache only touches the current user cache', () => {
      vi.spyOn(TestBed.inject(AuthService), 'currentUser').mockReturnValue({ id: 9, username: 'me', role: 'user' });
      const mine = `api-cache:9:${base}/lessons/1/vocabulary`;
      const other = `api-cache:2:${base}/lessons/1/vocabulary`;
      localStorage.setItem(mine, JSON.stringify({ ts: Date.now(), body: { success: true, data: [{ id: 5, is_bookmarked: false }] } }));
      localStorage.setItem(other, JSON.stringify({ ts: Date.now(), body: { success: true, data: [{ id: 5, is_bookmarked: false }] } }));

      service.syncVocabularyBookmarkCache(5, true);

      expect(JSON.parse(localStorage.getItem(mine)!).body.data[0].is_bookmarked).toBe(true);
      expect(JSON.parse(localStorage.getItem(other)!).body.data[0].is_bookmarked).toBe(false);
    });

    it('syncLeaderboardAfterProgress updates both cache layers', () => {
      vi.spyOn(TestBed.inject(AuthService), 'currentUser').mockReturnValue({ id: 9, username: 'me', role: 'user' });
      const url = `${base}/leaderboard`;
      const apiKey = `api-cache:9:${url}`;
      const httpKey = `http_cache_9:${url}`;
      const initial = [
        { user_id: 9, username: 'me', avatar: null, completed: 2, avg_score: 80, last_activity: '2026-11-18T01:00:00Z' },
        { user_id: 2, username: 'bin', avatar: null, completed: 5, avg_score: 60, last_activity: '2026-11-19T01:00:00Z' }
      ];
      localStorage.setItem(apiKey, JSON.stringify({ ts: Date.now(), body: { success: true, data: initial } }));
      localStorage.setItem(httpKey, JSON.stringify({ ts: Date.now(), body: { success: true, data: initial } }));

      const next = { id: -7, lesson_id: 7, status: 'completed', score: 4, total_questions: 4, updated_at: '2026-11-20T01:00:00Z' } as any;
      service.syncLeaderboardAfterProgress(null, next);

      const apiRows = JSON.parse(localStorage.getItem(apiKey)!).body.data;
      const httpRows = JSON.parse(localStorage.getItem(httpKey)!).body.data;
      expect(apiRows).toEqual(httpRows);
      expect(apiRows.find((r: any) => r.user_id === 9).completed).toBe(3);
      expect(apiRows.find((r: any) => r.user_id === 9).avg_score).toBe(87);
      expect(apiRows.find((r: any) => r.user_id === 9).last_activity).toBe('2026-11-20T01:00:00Z');
      expect(apiRows[0].user_id).toBe(2);
    });

    it('clearLeaderboardCache removes both cache layers', () => {
      vi.spyOn(TestBed.inject(AuthService), 'currentUser').mockReturnValue({ id: 9, username: 'me', role: 'user' });
      const url = `${base}/leaderboard`;
      localStorage.setItem(`api-cache:9:${url}`, JSON.stringify({ ts: Date.now(), body: { success: true, data: [] } }));
      localStorage.setItem(`http_cache_9:${url}`, JSON.stringify({ ts: Date.now(), body: { success: true, data: [] } }));

      service.clearLeaderboardCache();

      expect(localStorage.getItem(`api-cache:9:${url}`)).toBeNull();
      expect(localStorage.getItem(`http_cache_9:${url}`)).toBeNull();
    });

    it('errors when there is no cache and the API fails', () => {
      let errorCaught = false;
      let completed = false;
      service.getCourses().subscribe({
        error: () => (errorCaught = true),
        complete: () => (completed = true)
      });
      http.expectOne(`${base}/courses`).flush('boom', { status: 500, statusText: 'Server Error' });

      expect(errorCaught).toBe(true);
      expect(completed).toBe(false);
    });

    it('serves expired cache immediately then refreshes it in the background', () => {
      const url = `${base}/courses`;
      seedCache(url, { success: true, data: [{ id: 9, title: 'old-but-valid' }] }, Date.now() - 30 * 24 * 60 * 60 * 1000);
      const emissions: any[] = [];
      let completed = false;
      service.getCourses().subscribe({ next: e => emissions.push(e), complete: () => (completed = true) });

      // UI nhận dữ liệu cũ ngay, không phải chờ API
      expect(emissions[0].data[0].title).toBe('old-but-valid');
      expect(completed).toBe(true);

      const req = http.expectOne(url);
      expect(req.request.headers.get('X-Force-Refresh')).toBe('1');
      req.flush({ success: true, data: [{ id: 1, title: 'fresh' }] });

      const saved = JSON.parse(localStorage.getItem(`api-cache:${url}`) || '{}');
      expect(saved.body.data[0].title).toBe('fresh');
    });

    it('falls back to stale cache when the API fails', () => {
      const url = `${base}/courses`;
      seedCache(url, { success: true, data: [{ id: 9, title: 'old-but-valid' }] }, Date.now() - 30 * 24 * 60 * 60 * 1000);
      const emissions: any[] = [];
      service.getCourses().subscribe(e => emissions.push(e));

      http.expectOne(url).flush('boom', { status: 500, statusText: 'Server Error' });

      expect(emissions[0].data[0].title).toBe('old-but-valid');
    });

    it('clearCache removes all api-cache entries', () => {
      localStorage.setItem('api-cache:x', '1');
      localStorage.setItem('other', 'keep');
      service.clearCache();
      expect(localStorage.getItem('api-cache:x')).toBeNull();
      expect(localStorage.getItem('other')).toBe('keep');
    });
  });
});
