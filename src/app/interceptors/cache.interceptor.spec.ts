import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { cacheInterceptor } from './cache.interceptor';

describe('CacheInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([cacheInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('caches GET response into localStorage', () => {
    http.get('/api/courses').subscribe();
    httpMock.expectOne('/api/courses').flush({ success: true, data: [1, 2, 3] });

    const raw = localStorage.getItem('http_cache_/api/courses');
    expect(raw).toBeTruthy();
    const entry = JSON.parse(raw!);
    expect(entry.body.data).toEqual([1, 2, 3]);
  });

  it('serves fresh cache without hitting the API', () => {
    localStorage.setItem(
      'http_cache_/api/courses',
      JSON.stringify({ expiry: Date.now() + 60_000, body: { success: true, data: ['cached'] } })
    );

    let result: unknown;
    http.get('/api/courses').subscribe((r) => (result = r));
    expect(result).toEqual({ success: true, data: ['cached'] });

    httpMock.expectNone('/api/courses');
  });

  it('serves stale cache and revalidates in background', () => {
    localStorage.setItem(
      'http_cache_/api/courses',
      JSON.stringify({ expiry: Date.now() - 60_000, body: { success: true, data: ['stale'] } })
    );

    let result: unknown;
    http.get('/api/courses').subscribe((r) => (result = r));
    expect(result).toEqual({ success: true, data: ['stale'] });

    // Background revalidate request happens
    httpMock.expectOne('/api/courses').flush({ success: true, data: ['fresh'] });

    const entry = JSON.parse(localStorage.getItem('http_cache_/api/courses')!);
    expect(entry.body.data).toEqual(['fresh']);
  });

  it('caches on first fetch and reuses afterwards', () => {
    let first: unknown;
    http.get('/api/settings').subscribe((r) => (first = r));
    httpMock.expectOne('/api/settings').flush({ success: true, data: { theme: 'mac-dinh' } });
    expect(first).toEqual({ success: true, data: { theme: 'mac-dinh' } });

    let second: unknown;
    http.get('/api/settings').subscribe((r) => (second = r));
    httpMock.expectNone('/api/settings');
    expect(second).toEqual({ success: true, data: { theme: 'mac-dinh' } });
  });

  it('clears resource family caches after successful POST', () => {
    localStorage.setItem(
      'http_cache_/api/lessons/1/progress',
      JSON.stringify({ expiry: Date.now() + 60_000, body: { success: true, data: null } })
    );

    http.post('/api/lessons/1/progress', {}).subscribe();
    httpMock.expectOne('/api/lessons/1/progress').flush({ success: true, data: {} });

    expect(localStorage.getItem('http_cache_/api/lessons/1/progress')).toBeNull();
  });

  it('keeps other family caches when posting to another family', () => {
    localStorage.setItem(
      'http_cache_/api/courses',
      JSON.stringify({ expiry: Date.now() + 60_000, body: { success: true, data: [] } })
    );

    http.post('/api/lessons/1/progress', {}).subscribe();
    httpMock.expectOne('/api/lessons/1/progress').flush({ success: true, data: {} });

    expect(localStorage.getItem('http_cache_/api/courses')).toBeTruthy();
  });
});
