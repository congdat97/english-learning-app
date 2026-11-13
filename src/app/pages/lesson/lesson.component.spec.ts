import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute } from '@angular/router';
import { environment } from '../../../environments/environment';
import { LessonComponent } from './lesson.component';
import { ReviewQuestion } from '../../models/learning.model';

describe('LessonComponent', () => {
  let component: LessonComponent;
  let fixture: ReturnType<typeof TestBed.createComponent<LessonComponent>>;
  let http: HttpTestingController;
  const base = environment.apiUrl;

  const questions: ReviewQuestion[] = [
    { id: 1, lesson_id: 1, type: 'mcq', question: 'Q1?', options: ['a', 'b'], answer: 'a', explanation_vi: null },
    { id: 2, lesson_id: 1, type: 'mcq', question: 'Q2?', options: ['x', 'y'], answer: 'y', explanation_vi: null }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LessonComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => '1' } } } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LessonComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function flushLesson() {
    http.expectOne(`${base}/lessons/1`).flush({ success: true, data: { id: 1, title: 'L1' } });
    http.expectOne(`${base}/lessons/1/vocabulary`).flush({ success: true, data: [] });
    http.expectOne(`${base}/lessons/1/listening`).flush({ success: true, data: [] });
    http.expectOne(`${base}/lessons/1/review`).flush({ success: true, data: questions });
  }

  it('loads lesson data and stops loading', () => {
    fixture.detectChanges();
    flushLesson();
    expect(component.loading).toBe(false);
    expect(component.review.length).toBe(2);
  });

  it('selectAnswer records and blocks after submit', () => {
    component.selectAnswer(questions[0], 'a');
    expect(component.answers[1]).toBe('a');
    component.submitted = true;
    component.selectAnswer(questions[0], 'b');
    expect(component.answers[1]).toBe('a');
  });

  it('submitReview scores correct answers and posts progress', () => {
    fixture.detectChanges();
    flushLesson();
    component.answers = { 1: 'a', 2: 'x' };
    component.submitReview();
    expect(component.submitted).toBe(true);
    expect(component.score).toBe(1);
    const req = http.expectOne(`${base}/lessons/1/progress`);
    expect(req.request.body).toEqual({ status: 'completed', score: 1, total_questions: 2 });
    req.flush({ success: true, data: {} });
  });

  it('resetReview clears state', () => {
    component.answers = { 1: 'a' };
    component.submitted = true;
    component.score = 1;
    component.resetReview();
    expect(component.answers).toEqual({});
    expect(component.submitted).toBe(false);
    expect(component.score).toBe(0);
  });

  it('setSection switches section', () => {
    component.setSection('vocabulary');
    expect(component.section).toBe('vocabulary');
  });
});
