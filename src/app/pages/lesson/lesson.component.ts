import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { LearningService } from '../../services/learning.service';
import { SettingsService } from '../../services/settings.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { Lesson, Vocabulary, Listening, ReviewQuestion, UserProgress } from '../../models/learning.model';

@Component({
  selector: 'app-lesson',
  imports: [CommonModule],
  templateUrl: './lesson.component.html',
  styleUrl: './lesson.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LessonComponent implements OnInit, OnDestroy {
  lesson: Lesson | null = null;
  vocabulary: Vocabulary[] = [];
  listening: Listening[] = [];
  review: ReviewQuestion[] = [];
  loading = true;
  loadError = false;
  section: 'vocabulary' | 'listening' | 'review' = 'vocabulary';
  answers: Record<number, string> = {};
  submitted = false;
  score = 0;
  listeningAnswers: Record<number, string> = {};
  listeningSubmitted = false;
  listeningScore = 0;

  /** Tốc độ đọc — chỉnh ngay trong bài học. */
  speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
  speed = 1;

  /** Key của mục đang đọc (đổi icon/màu nút tương ứng). */
  speakingKey = signal<string | number | null>(null);
  /** Id của đoạn hội thoại đang đọc cả nhóm (đổi nút ▶ thành ⏸). */
  playingGroup = signal<string | number | null>(null);

  /** Đọc từ SettingsService qua signal — không đọc localStorage mỗi lần đổi detection. */
  readonly showTranslation = computed(() => this.settings.settings()?.showTranslation ?? true);
  /** Hiển thị bản dịch trong section Listening (mặc định false – bấm nút để hiện) */
  public showLisTranslation = signal(false);

  private gapTimer: ReturnType<typeof setTimeout> | null = null;
  private speakToken = 0;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private speakFallbackTimer: ReturnType<typeof setTimeout> | null = null;
  private routeSub?: Subscription;
  private loadSeq = 0;
  private touchX = 0;
  private touchY = 0;

  /** Chỉ alert 1 lần mỗi phiên để không spam. */

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private learning: LearningService,
    private settings: SettingsService,
    private auth: AuthService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.speed = this.settings.audioSpeed;
    // Giá trị lưu lạ (không nằm trong danh sách chip) -> trả về mặc định 1x
    if (!this.speeds.includes(this.speed)) {
      this.speed = 1;
      this.settings.save({ ...this.settings.load(), audioSpeed: 1 });
    }
    // Khôi phục trạng thái bài học đã lưu (nếu có)
    this.restoreState();
    // Theo dõi paramMap để chuyển bài bằng nút Next không bị reuse component.
    this.routeSub = this.route.paramMap.subscribe(params => {
      const id = Number(params.get('id'));
      if (!id) {
        this.loading = false;
        this.cdr.markForCheck();
        return;
      }
      this.loadLesson(id);
    });
  }

  private loadLesson(id: number): void {
    const seq = ++this.loadSeq;
    this.stopSpeaking();
    this.loading = true;
    this.loadError = false;
    this.lesson = null;
    this.vocabulary = [];
    this.listening = [];
    this.review = [];
    this.section = 'vocabulary';
    this.vocabIndex.set(0);
    this.answers = {};
    this.submitted = false;
    this.score = 0;
    this.listeningAnswers = {};
    this.listeningSubmitted = false;
    this.listeningScore = 0;
    this.quizIndex.set(0);
    this.quizChecked.set(false);
    this.quizCorrect.set(false);
    this.prevLessonTitle = '';
    this.prevLessonVocab = [];
    this.nextLessonId = null;
    this.nextLessonTitle = '';
    this.pronState.set(null);
    this.pronResult.set('none');
    this.pronHeard.set('');
    this.pronScore.set(0);
    this.cdr.markForCheck();

    this.learning.getLesson(id).subscribe({
      next: (r) => {
        if (seq !== this.loadSeq) return;
        this.lesson = r.data;
        if (r.data?.course_id) this.loadLessonNeighbors(r.data, seq);
        this.cdr.markForCheck();
      },
      error: () => {
        if (seq !== this.loadSeq) return;
        this.loading = false;
        this.loadError = true;
        this.cdr.markForCheck();
      }
    });
    this.learning.getVocabulary(id).subscribe({
      next: (r) => {
        if (seq !== this.loadSeq) return;
        this.vocabulary = r.data;
        this.cdr.markForCheck();
      },
      error: () => {
        if (seq !== this.loadSeq) return;
        this.loading = false;
        this.loadError = true;
        this.cdr.markForCheck();
      }
    });
    this.learning.getListening(id).subscribe({
      next: (r) => {
        if (seq !== this.loadSeq) return;
        this.listening = r.data;
        this.cdr.markForCheck();
      },
      error: () => {
        if (seq !== this.loadSeq) return;
        this.loading = false;
        this.loadError = true;
        this.cdr.markForCheck();
      }
    });
    this.learning.getReview(id).subscribe({
      next: (r) => {
        if (seq !== this.loadSeq) return;
        this.review = r.data;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        if (seq !== this.loadSeq) return;
        this.loading = false;
        this.loadError = true;
        this.cdr.markForCheck();
      }
    });
  }

  // ===== Từ vựng của BÀI TRƯỚC — hiển thị ở tab Luyện nghe để ôn lại =====
  prevLessonTitle = '';
  prevLessonVocab: Vocabulary[] = [];
  nextLessonId: number | null = null;
  nextLessonTitle = '';

  private loadLessonNeighbors(lesson: Lesson, seq = this.loadSeq): void {
    this.learning.getLessons(lesson.course_id).subscribe({
      next: (res) => {
        if (seq !== this.loadSeq) return;
        const sorted = [...(res.data || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
        const index = sorted.findIndex(l => l.id === lesson.id);
        const prev = index > 0 ? sorted[index - 1] : null;
        const next = index >= 0 && index < sorted.length - 1 ? sorted[index + 1] : null;

        this.nextLessonId = next?.id ?? null;
        this.nextLessonTitle = next?.title ?? '';

        if (prev) {
          this.prevLessonTitle = prev.title;
          this.learning.getVocabulary(prev.id).subscribe({
            next: (vr) => {
              if (seq !== this.loadSeq) return;
              this.prevLessonVocab = vr.data;
              this.cdr.markForCheck();
            },
            error: () => {}
          });
        }

        this.cdr.markForCheck();
      },
      error: () => {}
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.stopSpeaking();
    this.saveState();
  }

  private saveState(): void {
    const state = {
      section: this.section,
      vocabIndex: this.vocabIndex(),
      quizIndex: this.quizIndex(),
      quizChecked: this.quizChecked(),
      listeningSubmitted: this.listeningSubmitted,
      listeningScore: this.listeningScore,
      answers: this.answers,
    };
    localStorage.setItem('lesson-state-' + this.lesson?.id, JSON.stringify(state));
  }

  private restoreState(): void {
    if (!this.lesson?.id) return;
    const state = localStorage.getItem('lesson-state-' + this.lesson.id);
    if (state) {
      const parsed = JSON.parse(state);
      this.section = parsed.section || 'vocabulary';
      this.vocabIndex.set(parsed.vocabIndex ?? 0);
      this.quizIndex.set(parsed.quizIndex ?? 0);
      this.quizChecked.set(parsed.quizChecked ?? false);
      this.listeningSubmitted = parsed.listeningSubmitted ?? false;
      this.listeningScore = parsed.listeningScore ?? 0;
      this.answers = parsed.answers || {};
    }
  }

  setSection(s: 'vocabulary' | 'listening' | 'review'): void {
    this.stopSpeaking();
    this.section = s;
    setTimeout(() => window.scrollTo(0, 0), 150);
  }

  toggleLisTranslation(): void {
    this.showLisTranslation.update(v => !v);
  }

  retryLoad(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) this.loadLesson(id);
  }

  trackBySpeed(_: number, rate: number): number { return rate; }
  trackByVocabulary(_: number, item: Vocabulary): number { return item.id; }
  trackByExample(index: number, _: unknown): number { return index; }
  trackByListening(_: number, item: Listening): number { return item.id; }
  trackByLine(index: number, _: unknown): number { return index; }
  trackByQuestion(_: number, item: { id: number }): number { return item.id; }
  trackByOption(_: number, option: string): string { return option; }

  selectAnswer(q: ReviewQuestion, option: string): void {
    if (this.quizChecked()) return;
    this.answers[q.id] = option;
  }

  // ===== Từ vựng: carousel 1 từ / lượt (theo mockup) =====
  vocabIndex = signal(0);

  get currentVocab(): Vocabulary | null {
    return this.vocabulary[this.vocabIndex()] ?? null;
  }

  prevVocab(): void {
    this.stopSpeaking();
    this.vocabIndex.update(i => Math.max(0, i - 1));
  }

  nextVocab(): void {
    this.stopSpeaking();
    if (this.vocabIndex() < this.vocabulary.length - 1) {
      this.vocabIndex.update(i => i + 1);
    }
  }

  goVocab(index: number): void {
    this.stopSpeaking();
    this.vocabIndex.set(Math.max(0, Math.min(index, this.vocabulary.length - 1)));
  }

  onVocabTouchStart(event: TouchEvent): void {
    const touch = event.changedTouches[0];
    if (!touch) return;
    this.touchX = touch.clientX;
    this.touchY = touch.clientY;
  }

  onVocabTouchEnd(event: TouchEvent): void {
    const touch = event.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - this.touchX;
    const dy = touch.clientY - this.touchY;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
    if (dx < 0) this.nextVocab();
    else this.prevVocab();
  }

  goNextLesson(): void {
    this.stopSpeaking();
    if (this.nextLessonId != null) {
      this.router.navigate(['/lessons', this.nextLessonId]);
      return;
    }
    if (this.lesson?.course_id) {
      this.router.navigate(['/courses', this.lesson.course_id]);
      return;
    }
    this.router.navigate(['/courses']);
  }

  get vocabCounter(): string {
    return ('0' + (this.vocabIndex() + 1)).slice(-2) + ' / ' + ('0' + this.vocabulary.length).slice(-2);
  }

  get vocabPercent(): number {
    return this.vocabulary.length
      ? Math.round(((this.vocabIndex() + 1) / this.vocabulary.length) * 100)
      : 0;
  }

  // ===== Ôn tập: 1 câu / lượt + Kiểm tra đáp án (theo mockup) =====
  quizIndex = signal(0);
  quizChecked = signal(false);
  quizCorrect = signal(false);

  get currentQuiz(): ReviewQuestion | null {
    return this.review[this.quizIndex()] ?? null;
  }

  get quizCount(): string {
    return 'Câu ' + (this.quizIndex() + 1) + ' / ' + this.review.length;
  }

  get quizPercent(): number {
    return this.review.length
      ? Math.round(((this.quizIndex() + 1) / this.review.length) * 100)
      : 0;
  }

  /** Kiểm tra câu hiện tại: hiện đúng/sai + giải thích */
  checkAnswer(): void {
    const q = this.currentQuiz;
    if (!q || !this.answers[q.id] || this.quizChecked()) return;
    this.quizCorrect.set(this.answers[q.id] === q.answer);
    this.quizChecked.set(true);
  }

  /** Bỏ qua câu hiện tại → chuyển sang câu tiếp theo (hoặc submit nếu bài cuối) */
  skipQuestion(): void {
    if (this.quizIndex() < this.review.length - 1) {
      this.quizIndex.update(i => i + 1);
      this.quizChecked.set(false);
    } else {
      this.submitReview();
    }
  }

  /** Câu tiếp theo; câu cuối -> submitReview (lưu tiến độ + tổng kết) */
  nextQuestion(): void {
    if (!this.quizChecked()) return;
    if (this.quizIndex() < this.review.length - 1) {
      this.quizIndex.update(i => i + 1);
      this.quizChecked.set(false);
    } else {
      this.submitReview();
    }
  }

  /** Luyện nghe: chọn đáp án trước khi nộp. */
  pickListening(q: { id: number }, option: string): void {
    if (this.listeningSubmitted) return;
    this.listeningAnswers[q.id] = option;
  }

  get allListeningQuestions(): { id: number; answer: string; explanation_vi: string | null }[] {
    return this.listening.flatMap(l => l.questions);
  }

  submitListening(): void {
    this.listeningSubmitted = true;
    this.listeningScore = this.allListeningQuestions.filter(q => this.listeningAnswers[q.id] === q.answer).length;
  }

  resetListening(): void {
    this.listeningAnswers = {};
    this.listeningSubmitted = false;
    this.listeningScore = 0;
  }

  toggleFavorite(v: Vocabulary): void {
    if (!this.auth.isLoggedIn()) {
        this.toast.info('⚠️ Cần đăng nhập để lưu từ vào sổ từ vựng. Bấm "Đăng nhập" trên đầu trang.');
      return;
    }

    // Optimistic: đổi icon NGAY khi bấm, đợi API ở nền; lỗi thì hoàn tác
    const newState = !v.is_bookmarked;
    const req$ = v.is_bookmarked
      ? this.learning.unbookmark(v.id)
      : this.learning.bookmark(v.id);

    v.is_bookmarked = newState;
    v.is_favorite = newState;
    this.learning.syncBookmarkCache(v, newState);
    this.learning.syncVocabularyBookmarkCache(v.id, newState);

    req$.subscribe({
      error: () => {
        v.is_bookmarked = !newState;
        v.is_favorite = v.is_bookmarked;
        this.learning.syncBookmarkCache(v, v.is_bookmarked);
        this.learning.syncVocabularyBookmarkCache(v.id, v.is_bookmarked);
        this.cdr.markForCheck();
        this.toast.error('❌ Không lưu được trạng thái từ vựng — thử lại sau.');
      }
    });
  }

  /** Đổi tốc độ đọc — áp dụng cho lần phát tiếp theo. */
  setSpeed(rate: number): void {
    this.speed = rate;
    this.settings.setAudioSpeed(rate);
  }

  /** Đọc 1 mục (từ/câu) — bấm lại thì ngừng. */
  speakOnce(key: string | number, text: string): void {
    if (this.speakingKey() === key) {
      this.stopSpeaking();
      return;
    }
    this.stopSpeaking();
    this.speakingKey.set(key);
    this.speakText(text, () => { this.speakingKey.set(null); });
  }

  /** Đọc cả đoạn hội thoại, có khoảng nghỉ giữa các câu. Bấm lại thì ngừng. */
  playGroup(groupId: string | number, texts: string[]): void {
    if (this.playingGroup() === groupId) {
      this.stopSpeaking();
      return;
    }
    this.stopSpeaking();
    this.playingGroup.set(groupId);
    this.playQueue(groupId, texts, 0);
  }

  /** Phát từ 1 câu trong hội thoại và TỰ ĐỘNG đọc tiếp các câu sau (nút chuyển sang pause) */
  speakFrom(groupId: string | number, index: number, texts: string[]): void {
    const key = `${groupId}:${index}`;
    if (this.playingGroup() === groupId && this.speakingKey() === key) {
      this.stopSpeaking();
      return;
    }
    this.stopSpeaking();
    this.playingGroup.set(groupId);
    this.playQueue(groupId, texts, index);
  }

  private playQueue(groupId: string | number, texts: string[], index: number): void {
    if (this.playingGroup() !== groupId || index >= texts.length) {
      this.playingGroup.set(null);
      this.speakingKey.set(null);
      return;
    }
    const key = `${groupId}:${index}`;
    this.speakingKey.set(key);
    this.speakText(texts[index], () => {
      if (this.playingGroup() !== groupId) return;
      // Câu cuối -> kết thúc ngay (không nghỉ thêm)
      if (index >= texts.length - 1) {
        this.playingGroup.set(null);
        this.speakingKey.set(null);
        return;
      }
      // Khoảng nghỉ giữa các câu trước khi đọc câu tiếp theo
      this.gapTimer = setTimeout(() => this.playQueue(groupId, texts, index + 1), 700);
    });
  }

  stopSpeaking(): void {
    if (this.gapTimer) {
      clearTimeout(this.gapTimer);
      this.gapTimer = null;
    }
    if (this.speakFallbackTimer) {
      clearTimeout(this.speakFallbackTimer);
      this.speakFallbackTimer = null;
    }
    this.speakToken++;
    this.speakingKey.set(null);
    this.playingGroup.set(null);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  private speakText(text: string, onDone: () => void): void {
    if (!('speechSynthesis' in window)) {
      onDone();
      return;
    }
    const token = ++this.speakToken;
    const s = this.settings.load();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = this.speed;
    if (s.voice) {
      const voice = speechSynthesis.getVoices().find(v => v.name === s.voice);
      if (voice) utterance.voice = voice;
    }

    // finish(): chạy đúng 1 lần — do onend/onerror bắn hoặc timer dự phòng bắn.
    // Callback này nằm NGOÀI Angular (zoneless) nên mọi state dùng signal để UI cập nhật.
    let finished = false;
    const finish = () => {
      if (finished || token !== this.speakToken) return;
      finished = true;
      if (this.speakFallbackTimer) {
        clearTimeout(this.speakFallbackTimer);
        this.speakFallbackTimer = null;
      }
      onDone();
    };
    utterance.onend = finish;
    utterance.onerror = finish;

    // Giữ tham chiếu utterance (tránh GC làm mất sự kiện onend trên một số trình duyệt)
    this.currentUtterance = utterance;

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);

    // Dự phòng: nếu onend không bao giờ bắn (bug Chrome) -> ước lượng thời gian đọc rồi trả icon ▶
    if (this.speakFallbackTimer) clearTimeout(this.speakFallbackTimer);
    this.speakFallbackTimer = setTimeout(finish, Math.max(2000, (text.length * 75) / this.speed + 1200));
  }

  /** Phát từ cho câu hỏi "Nghe và chọn" (không lộ đáp án — phát chính là đáp án) */
  playListenWord(q: ReviewQuestion): void {
    this.speakOnce('rv-' + q.id, q.answer);
  }

  // ===== Phát âm từ bằng micro (SpeechRecognition) + chấm điểm % giống =====
  /** Id từ đang luyện phát âm (null = không ai) */
  pronState = signal<string | number | null>(null);
  /** Kết quả lần luyện gần nhất: none | ok | mid | miss */
  pronResult = signal<'none' | 'ok' | 'mid' | 'miss'>('none');
  /** Text máy nghe được */
  pronHeard = signal('');
  /** Điểm giống (% 0-100) giữa phát âm nghe được và từ cần đọc */
  pronScore = signal(0);
  /** Điểm cao nhất từng đạt được cho mỗi từ (id từ -> %) */
  pronBest = signal<Record<number, number>>({});
  lessonCompleted = signal(false);
  private recognition: any = null;

  /** Khoảng cách Levenshtein — dùng để tính % giống phát âm */
  private levenshtein(a: string, b: string): number {
    const m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(
          prev[j] + 1,                       // xóa
          cur[j - 1] + 1,                    // thêm
          prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1) // thay
        );
      }
      prev = cur;
    }
    return prev[n];
  }

  /** % giống (0-100) tốt nhất giữa từ cần đọc và các phiên bản máy nghe được */
  private bestSimilarity(target: string, candidates: string[]): number {
    let best = 0;
    for (const c of candidates) {
      if (!c) continue;
      // Máy nghe được nhiều từ: xét cả chuỗi nguyên và từng từ riêng
      const parts = [c, ...c.split(/\s+/)];
      for (const p of parts) {
        const dist = this.levenshtein(target, p);
        const sim = Math.round((1 - dist / Math.max(target.length, p.length)) * 100);
        if (sim > best) best = sim;
      }
    }
    return Math.max(0, Math.min(100, best));
  }

  /** Mở micro, người dùng đọc từ, app chấm điểm % giống */
  startPronounce(v: Vocabulary): void {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      window.alert('Trình duyệt không hỗ trợ nhận diện giọng nói. Hãy dùng Chrome hoặc Edge.');
      return;
    }
    this.pronResult.set('none');
    this.pronHeard.set('');
    this.pronScore.set(0);
    this.pronState.set(v.id);
    if (this.recognition) { try { this.recognition.abort(); } catch { /* ignore */ } }

    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 5;
    rec.onresult = (e: any) => {
      const alts: string[] = Array.from(e.results[0]).map((a: any) =>
        String(a.transcript || '').toLowerCase().replace(/[^a-z' ]/g, '').trim());
      this.pronHeard.set(alts[0] || '');
      const target = v.word.toLowerCase().replace(/[^a-z' ]/g, '').trim();
      const score = this.bestSimilarity(target, alts);
      this.pronScore.set(score);
      // Lưu điểm cao nhất của từ này để hiện badge bên cạnh nút Phát âm
      if (score > (this.pronBest()[v.id] || 0)) {
        this.pronBest.update(m => ({ ...m, [v.id]: score }));
      }
      // Điểm: >=85 chuẩn, 55-84 khá, <55 cần thử lại
      this.pronResult.set(score >= 85 ? 'ok' : score >= 55 ? 'mid' : 'miss');
      this.pronState.set(null);
    };
    rec.onerror = () => {
      this.pronResult.set('miss');
      this.pronScore.set(0);
      this.pronHeard.set('(không nghe được — hãy thử lại)');
      this.pronState.set(null);
    };
    rec.onend = () => { if (this.pronState() === v.id) this.pronState.set(null); };
    this.recognition = rec;
    rec.start();
  }

  submitReview(): void {
    this.submitted = true;
    this.score = this.review.filter(q => this.answers[q.id] === q.answer).length;
    if (this.lesson) {
      if (!this.auth.isLoggedIn()) {
        this.toast.info(`⚠️ Hoàn thành bài học! Điểm: ${this.score}/${this.review.length}. Đang đăng nhập để lưu tiến độ vào tài khoản.`);
        return;
      }
      const lessonId = this.lesson.id;
      const previous = this.learning.getCachedProgress(lessonId);
      const now = new Date().toISOString();
      const optimistic: UserProgress = {
        id: -lessonId,
        lesson_id: lessonId,
        status: 'completed',
        score: this.score,
        total_questions: this.review.length,
        completed_at: now,
        updated_at: now
      };
      this.learning.syncProgressCache(lessonId, optimistic);
      this.learning.syncLeaderboardAfterProgress(previous, optimistic);

this.learning.saveProgress(lessonId, 'completed', this.score, this.review.length).subscribe({
        next: (res) => {
          if (res.data) {
            this.learning.syncProgressCache(lessonId, res.data);
            this.learning.syncLeaderboardAfterProgress(optimistic, res.data);
          } else {
            this.learning.clearLeaderboardCache();
          }
          this.lessonCompleted.set(true);
          this.cdr.markForCheck();
          this.toast.success(`🎉 Hoàn thành bài học! Điểm: ${this.score}/${this.review.length} (đã lưu tiến độ).`);
          // Tự động reset sau 2s
          setTimeout(() => this.lessonCompleted.set(false), 2000);
        },
        error: () => {
          if (previous) this.learning.syncProgressCache(lessonId, previous);
          else this.learning.clearProgressCache(lessonId);
          this.learning.clearLeaderboardCache();
          this.toast.error(`❌ Không lưu được tiến độ lên server — điểm ${this.score}/${this.review.length} chỉ hiển thị tạm thời.`);
        }
      });
    }
  }

  resetReview(): void {
    this.answers = {};
    this.submitted = false;
    this.score = 0;
    this.quizIndex.set(0);
    this.quizChecked.set(false);
    this.quizCorrect.set(false);
  }
}




