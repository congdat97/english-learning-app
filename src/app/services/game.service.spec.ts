import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { AuthService } from './auth.service';
import { GameService } from './game.service';
import { GameResult } from '../models/game.model';

describe('GameService', () => {
  let service: GameService;

  const result = (stageId: string, stars: number, accuracy: number): GameResult => ({
    stageId,
    lessonId: 1,
    stars,
    score: accuracy,
    total: 100,
    accuracy,
    pronunciation: null,
    answers: [],
    completedAt: '2026-11-20T00:00:00Z'
  });

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
    });
    service = TestBed.inject(GameService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('maps score and pronunciation to stars', () => {
    expect(service.starsFor(40, 100, null)).toBe(0);
    expect(service.starsFor(70, 100, null)).toBe(1);
    expect(service.starsFor(90, 100, 95)).toBe(2);
    expect(service.starsFor(100, 100, 92)).toBe(3);
    expect(service.starsFor(100, 100, 80)).toBe(2);
    expect(service.starsFor(100, 100, null)).toBe(2);
  });

  it('keeps only the best result per stage', () => {
    service.saveResult(result('lesson-1', 1, 70));
    service.saveResult(result('lesson-1', 3, 100));
    service.saveResult(result('lesson-1', 2, 85));

    expect(service.getResult('lesson-1')?.stars).toBe(3);
    expect(service.getResult('lesson-1')?.accuracy).toBe(100);
    expect(service.lastResultFor('lesson-1')?.stars).toBe(2);
  });

  it('scopes results by current user', () => {
    const auth = TestBed.inject(AuthService);
    vi.spyOn(auth, 'currentUser').mockReturnValue({ id: 7, username: 'me', role: 'user' });
    service.saveResult(result('lesson-9', 2, 85));

    expect(localStorage.getItem('elf-game.7')).toBeTruthy();
    expect(localStorage.getItem('elf-game.guest')).toBeNull();
    expect(service.getResult('lesson-9')?.stars).toBe(2);
  });

  it('shuffles deterministically by seed', () => {
    const values = ['a', 'b', 'c', 'd', 'e'];
    expect(service.shuffle(values, 'stage-1')).toEqual(service.shuffle(values, 'stage-1'));
    expect(service.shuffle(values, 'stage-2')).not.toEqual(service.shuffle(values, 'stage-1'));
    expect(values).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});
