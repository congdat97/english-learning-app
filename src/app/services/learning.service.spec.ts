import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../environments/environment';
import { LearningService } from './learning.service';

describe('LearningService', () => {
  let service: LearningService;
  let http: HttpTestingController;
  const base = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
    });
    service = TestBed.inject(LearningService);
    http = TestBed.inject(HttpTestingController);
    localStorage.clear();
  });

  afterEach(() => http.verify());

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

    it('emits cached data immediately, then fresh API data, and updates cache', () => {
      const url = `${base}/courses`;
      seedCache(url, { success: true, data: [{ id: 9, title: 'cached' }] });
      const emissions: any[] = [];
      let completed = false;
      service.getCourses().subscribe({ next: e => emissions.push(e), complete: () => (completed = true) });

      const req = http.expectOne(url);
      req.flush({ success: true, data: [{ id: 9, title: 'fresh' }] });

      expect(emissions.length).toBe(2);
      expect(emissions[0].data[0].title).toBe('cached');
      expect(emissions[1].data[0].title).toBe('fresh');
      expect(completed).toBe(true);
      const saved = JSON.parse(localStorage.getItem(`api-cache:${url}`) || '{}');
      expect(saved.body.data[0].title).toBe('fresh');
    });

    it('falls back to cache without erroring when the API fails', () => {
      const url = `${base}/courses`;
      seedCache(url, { success: true, data: [{ id: 9, title: 'cached' }] });
      const emissions: any[] = [];
      let errorCaught = false;
      let completed = false;
      service.getCourses().subscribe({
        next: e => emissions.push(e),
        error: () => (errorCaught = true),
        complete: () => (completed = true)
      });
      http.expectOne(url).flush('boom', { status: 500, statusText: 'Server Error' });

      expect(emissions.length).toBe(1);
      expect(emissions[0].data[0].title).toBe('cached');
      expect(errorCaught).toBe(false);
      expect(completed).toBe(true);
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

    it('ignores stale cache beyond max age', () => {
      const url = `${base}/courses`;
      seedCache(url, { success: true, data: [{ id: 9, title: 'stale' }] }, Date.now() - 20 * 60 * 1000);
      const emissions: any[] = [];
      service.getCourses().subscribe(e => emissions.push(e));
      http.expectOne(url).flush({ success: true, data: [{ id: 9, title: 'fresh' }] });

      expect(emissions.length).toBe(1);
      expect(emissions[0].data[0].title).toBe('fresh');
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
