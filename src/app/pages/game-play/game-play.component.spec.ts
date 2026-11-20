import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { GameService } from '../../services/game.service';
import { PronunciationService } from '../../services/pronunciation.service';
import { SpeechService } from '../../services/speech.service';
import { GamePlayComponent } from './game-play.component';

describe('GamePlayComponent', () => {
  let component: GamePlayComponent;
  let fixture: ReturnType<typeof TestBed.createComponent<GamePlayComponent>>;
  let http: HttpTestingController;
  let router: Router;
  let game: GameService;
  const base = environment.apiUrl;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [GamePlayComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ stageId: 'lesson-1' })) } },
        { provide: SpeechService, useValue: { speak: vi.fn(), stop: vi.fn() } },
        { provide: PronunciationService, useValue: { supported: () => true, score: () => of(92) } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(GamePlayComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    game = TestBed.inject(GameService);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('answers every generated question, saves 3 stars and navigates to the result', () => {
    fixture.detectChanges();

    http.expectOne(`${base}/lessons/1/review`).flush({
      success: true,
      data: [
        { id: 1, lesson_id: 1, type: 'multiple_choice', question: 'Q1?', options: ['a', 'b'], answer: 'a', explanation_vi: null },
        { id: 2, lesson_id: 1, type: 'fill_blank', question: 'I am ____.', options: ['fine', 'book'], answer: 'fine', explanation_vi: null },
        { id: 3, lesson_id: 1, type: 'listen', question: 'Listen.', options: ['hi', 'bye'], answer: 'hi', explanation_vi: null }
      ]
    });
    http.expectOne(`${base}/lessons/1/listening`).flush({ success: true, data: [] });
    http.expectOne(`${base}/lessons/1/vocabulary`).flush({
      success: true,
      data: [
        { id: 1, lesson_id: 1, word: 'hello', ipa: '', part_of_speech: 'int', meaning_vi: 'xin chào', audio: null, is_favorite: false,
          examples: [{ id: 1, vocabulary_id: 1, sentence: 'Hello my friend', translation_vi: '', audio: null }] },
        { id: 2, lesson_id: 1, word: 'book', ipa: '', part_of_speech: 'n', meaning_vi: 'sách', audio: null, is_favorite: false, examples: [] },
        { id: 3, lesson_id: 1, word: 'friend', ipa: '', part_of_speech: 'n', meaning_vi: 'bạn', audio: null, is_favorite: false, examples: [] },
        { id: 4, lesson_id: 1, word: 'happy', ipa: '', part_of_speech: 'adj', meaning_vi: 'vui', audio: null, is_favorite: false, examples: [] },
        { id: 5, lesson_id: 1, word: 'morning', ipa: '', part_of_speech: 'n', meaning_vi: 'sáng', audio: null, is_favorite: false, examples: [] }
      ]
    });

    expect(component.loading).toBe(false);
    expect(component.total).toBeGreaterThan(0);

    for (let i = 0; i < component.total; i++) {
      const question = component.current!;
      if (question.type === 'pronounce') component.startPronunciation();
      if (question.type === 'order') {
        for (const token of question.answer.split(' ')) {
          const index = component.availableTokens.indexOf(token);
          if (index >= 0) component.pickToken(index);
        }
      } else {
        component.choose(question.answer);
      }
      component.check();
      expect(component.feedback).toBe('correct');
      component.next();
    }

    const post = http.expectOne(`${base}/game/result`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ stage_id: 'lesson-1', stars: 3, score: component.total, total_questions: component.total });
    post.flush({ success: true, data: { stage_id: 'lesson-1', stars: 3, score: component.total, total_questions: component.total, updated_at: '2026-11-20T00:00:00Z' } });

    expect(router.navigate).toHaveBeenCalledWith(['/game/result', 'lesson-1']);
    expect(game.getResult('lesson-1')?.stars).toBe(3);
    expect(game.getResult('lesson-1')?.pronunciation).toBe(92);
  });
});
