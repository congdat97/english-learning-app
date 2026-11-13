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
});
