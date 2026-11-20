import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { Listening, ReviewQuestion, Vocabulary } from '../models/learning.model';
import { QuestionFactoryService } from './question-factory.service';

describe('QuestionFactoryService', () => {
  let service: QuestionFactoryService;
  let http: HttpTestingController;
  const base = environment.apiUrl;

  const review: ReviewQuestion[] = [
    { id: 1, lesson_id: 1, type: 'multiple_choice', question: 'Q1?', options: ['a', 'b'], answer: 'a', explanation_vi: null },
    { id: 2, lesson_id: 1, type: 'multiple_choice', question: 'Q2?', options: ['c', 'd'], answer: 'c', explanation_vi: null },
    { id: 3, lesson_id: 1, type: 'multiple_choice', question: 'Q3?', options: ['e', 'f'], answer: 'e', explanation_vi: null },
    { id: 4, lesson_id: 1, type: 'fill_blank', question: 'I am ____.', options: ['fine', 'book'], answer: 'fine', explanation_vi: null },
    { id: 5, lesson_id: 1, type: 'fill_blank', question: 'She is ____.', options: ['happy', 'chair'], answer: 'happy', explanation_vi: null },
    { id: 6, lesson_id: 1, type: 'listen', question: 'Listen and choose.', options: ['hi', 'bye'], answer: 'hi', explanation_vi: null }
  ];

  const listening: Listening[] = [{
    id: 1,
    lesson_id: 1,
    title: 'Greeting',
    audio: null,
    speed_options: ['1'],
    transcript: [
      { id: 1, listening_id: 1, speaker: 'A', text: 'Good morning', translation_vi: 'Chào buổi sáng', line_order: 1 }
    ],
    questions: [
      { id: 10, listening_id: 1, type: 'multiple_choice', question: 'What does A say?', options: ['Good morning', 'Good night'], answer: 'Good morning', explanation_vi: null }
    ]
  }];

  const vocabulary: Vocabulary[] = [
    { id: 1, lesson_id: 1, word: 'hello', ipa: '/həˈloʊ/', part_of_speech: 'int', meaning_vi: 'xin chào', audio: null, is_favorite: false,
      examples: [{ id: 1, vocabulary_id: 1, sentence: 'Hello my friend', translation_vi: 'Xin chào bạn', audio: null }] },
    { id: 2, lesson_id: 1, word: 'book', ipa: '/bʊk/', part_of_speech: 'n', meaning_vi: 'cuốn sách', audio: null, is_favorite: false, examples: [] },
    { id: 3, lesson_id: 1, word: 'friend', ipa: '/frend/', part_of_speech: 'n', meaning_vi: 'bạn bè', audio: null, is_favorite: false, examples: [] },
    { id: 4, lesson_id: 1, word: 'happy', ipa: '/ˈhæpi/', part_of_speech: 'adj', meaning_vi: 'vui vẻ', audio: null, is_favorite: false, examples: [] },
    { id: 5, lesson_id: 1, word: 'morning', ipa: '/ˈmɔːrnɪŋ/', part_of_speech: 'n', meaning_vi: 'buổi sáng', audio: null, is_favorite: false, examples: [] }
  ];

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
    });
    service = TestBed.inject(QuestionFactoryService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('builds 8-10 mixed questions from review, listening and vocabulary', async () => {
    const promise = firstValueFrom(service.build(1, 'lesson-1'));

    http.expectOne(`${base}/lessons/1/review`).flush({ success: true, data: review });
    http.expectOne(`${base}/lessons/1/listening`).flush({ success: true, data: listening });
    http.expectOne(`${base}/lessons/1/vocabulary`).flush({ success: true, data: vocabulary });

    const questions = await promise;
    expect(questions.length).toBeGreaterThanOrEqual(8);
    expect(questions.length).toBeLessThanOrEqual(10);
    expect(new Set(questions.map(q => q.id)).size).toBe(questions.length);
    expect(new Set(questions.map(q => q.type))).toEqual(new Set(['choice', 'fill', 'listen', 'pronounce', 'order']));

    for (const question of questions) {
      if (question.type === 'choice' || question.type === 'fill' || question.type === 'listen') {
        expect(question.options).toContain(question.answer);
      }
      if (question.type === 'order') {
        expect([...(question.tokens || [])].sort()).toEqual(question.answer.split(' ').sort());
      }
    }
  });
});
