import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
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
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [LessonComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '1' })) } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LessonComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    // Đăng nhập giả để test được luồng lưu tiến độ theo user
    TestBed.inject(AuthService).login('tester', '123456').subscribe();
    http.expectOne(`${base}/auth/login`).flush({
      success: true,
      data: { token: 't', user: { id: 9, username: 'tester', role: 'user' } }
    });
  });

  afterEach(() => {
    http.verify();
    delete (window as any).speechSynthesis;
    delete (window as any).SpeechSynthesisUtterance;
  });

  /**
   * Mô phỏng speechSynthesis: speak() ghi lại text đọc theo thứ tự
   * và giữ tham chiếu câu mới nhất để test chủ động bắn onend.
   */
  function installSpeechMock() {
    const spoken: string[] = [];
    let last: any = null;
    class FakeUtterance {
      text: string;
      lang = '';
      rate = 1;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(text: string) { this.text = text; }
    }
    (window as any).SpeechSynthesisUtterance = FakeUtterance;
    (window as any).speechSynthesis = {
      cancel: () => {},
      speak: (u: any) => { spoken.push(u.text); last = u; },
      getVoices: () => []
    };
    return { spoken, lastRef: () => last };
  }

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

  it('selectAnswer records and blocks after checking', () => {
    component.selectAnswer(questions[0], 'a');
    expect(component.answers[1]).toBe('a');
    component.quizChecked.set(true);
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

  // ===== SPEECH: đọc TỪNG câu, có nghỉ giữa câu, bấm lại để dừng =====

  it('playGroup reads the dialogue sentence by sentence with a 700ms gap', () => {
    fixture.detectChanges();
    flushLesson();
    const mock = installSpeechMock();
    vi.useFakeTimers();
    try {
      component.playGroup('l1', ['Hello', 'How are you', 'Goodbye']);

      // Câu 1 đọc ngay, các câu sau chưa đọc
      expect(mock.spoken).toEqual(['Hello']);
      expect(component.speakingKey()).toBe('l1:0');
      expect(component.playingGroup()).toBe('l1');

      // Kết thúc câu 1 -> nghỉ 700ms -> câu 2
      mock.lastRef().onend!();
      vi.advanceTimersByTime(699);
      expect(mock.spoken).toEqual(['Hello']);
      vi.advanceTimersByTime(1);
      expect(mock.spoken).toEqual(['Hello', 'How are you']);
      expect(component.speakingKey()).toBe('l1:1');

      // Kết thúc câu 2 -> câu 3
      mock.lastRef().onend!();
      vi.advanceTimersByTime(700);
      expect(mock.spoken).toEqual(['Hello', 'How are you', 'Goodbye']);

      // Kết thúc câu cuối -> kết thúc cả đoạn, icon về ▶
      mock.lastRef().onend!();
      expect(component.playingGroup()).toBeNull();
      expect(component.speakingKey()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('clicking the group button again stops the remaining queue', () => {
    fixture.detectChanges();
    flushLesson();
    const mock = installSpeechMock();
    vi.useFakeTimers();
    try {
      component.playGroup('l1', ['A', 'B', 'C']);
      mock.lastRef().onend!();
      vi.advanceTimersByTime(700);
      expect(mock.spoken).toEqual(['A', 'B']);

      // Bấm lại nút cùng đoạn -> dừng, không đọc tiếp câu C
      component.playGroup('l1', ['A', 'B', 'C']);
      expect(component.playingGroup()).toBeNull();
      expect(component.speakingKey()).toBeNull();

      vi.advanceTimersByTime(5000);
      expect(mock.spoken).toEqual(['A', 'B']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('speakOnce reads a single word and toggles off on the second click', () => {
    fixture.detectChanges();
    flushLesson();
    const mock = installSpeechMock();
    try {
      component.speakOnce('v1', 'apple');
      expect(mock.spoken).toEqual(['apple']);
      expect(component.speakingKey()).toBe('v1');

      // Bấm lại cùng nút -> ngừng đọc, không đọc thêm
      component.speakOnce('v1', 'apple');
      expect(component.speakingKey()).toBeNull();
      expect(mock.spoken).toEqual(['apple']);
    } finally {
      component.stopSpeaking();
    }
  });

  it('leaving the lesson stops all speech', () => {
    fixture.detectChanges();
    flushLesson();
    const mock = installSpeechMock();
    vi.useFakeTimers();
    try {
      component.playGroup('l1', ['A', 'B', 'C']);
      component.ngOnDestroy();
      vi.advanceTimersByTime(5000);
      expect(mock.spoken).toEqual(['A']);
      expect(component.playingGroup()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
