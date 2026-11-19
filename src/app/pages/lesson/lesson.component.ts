import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { LearningService } from '../../services/learning.service';
import { SettingsService } from '../../services/settings.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { Lesson, Vocabulary, Listening, ReviewQuestion } from '../../models/learning.model';

@Component({
  selector: 'app-lesson',
  imports: [CommonModule],
  templateUrl: './lesson.component.html',
  styleUrl: './lesson.component.css'
})
export class LessonComponent implements OnInit, OnDestroy {
  lesson: Lesson | null = null;
  vocabulary: Vocabulary[] = [];
  listening: Listening[] = [];
  review: ReviewQuestion[] = [];
  loading = true;
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
  /** Id c?a do?n h?i tho?i dang d?c c? nh�m (d?i n�t ? th�nh ?). */
  playingGroup = signal<string | number | null>(null);

  private gapTimer: ReturnType<typeof setTimeout> | null = null;
  private speakToken = 0;
  private touchStartX = 0;
  private touchEndX = 0;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private speakFallbackTimer: ReturnType<typeof setTimeout> | null = null;

  /** Chỉ alert 1 lần mỗi phiên để không spam. */

  constructor(private route: ActivatedRoute, private learning: LearningService, private settings: SettingsService, private auth: AuthService, private toast: ToastService) {}

  ngOnInit(): void {
    this.speed = this.settings.audioSpeed;
    // Giá trị lưu lạ (không nằm trong danh sách chip) -> trả về mặc định 1x
    if (!this.speeds.includes(this.speed)) {
      this.speed = 1;
      this.settings.save({ ...this.settings.load(), audioSpeed: 1 });
    }
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.learning.getLesson(id).subscribe({
      next: (r) => {
        this.lesson = r.data;
        if (r.data?.course_id && r.data.sort_order > 1) this.loadPrevLessonVocab(r.data);
      },
      error: () => this.loading = false
    });
    this.learning.getVocabulary(id).subscribe({ next: (r) => this.vocabulary = r.data, error: () => this.loading = false });
    this.learning.getListening(id).subscribe({ next: (r) => this.listening = r.data, error: () => this.loading = false });
    this.learning.getReview(id).subscribe({ next: (r) => { this.review = r.data; this.loading = false; }, error: () => this.loading = false });
  }

  // ===== Từ vựng của BÀI TRƯỚC — hiển thị ở tab Luyện nghe để ôn lại =====
  prevLessonTitle = '';
  prevLessonVocab: Vocabulary[] = [];

  private loadPrevLessonVocab(lesson: Lesson): void {
    this.learning.getLessons(lesson.course_id).subscribe({
      next: (res) => {
        const prev = res.data.find(l => l.sort_order === lesson.sort_order - 1);
        if (!prev) return;
        this.prevLessonTitle = prev.title;
        this.learning.getVocabulary(prev.id).subscribe({
          next: (vr) => this.prevLessonVocab = vr.data,
          error: () => {}
        });
      },
      error: () => {}
    });
  }

  ngOnDestroy(): void {
    this.stopSpeaking();
  }

  setSection(s: 'vocabulary' | 'listening' | 'review'): void {
    this.stopSpeaking();
    this.section = s;
  }

  selectAnswer(q: ReviewQuestion, option: string): void {
    if (this.quizChecked()) return;
    this.answers[q.id] = option;
  }

  // ===== T? v?ng: carousel 1 t? / lu?t (theo mockup) =====
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
    // T? cu?i -> chuy?n sang ph?n Luy?n nghe (kh?ng quay l?i t? ??u n?a)
    if (this.vocabIndex() >= this.vocabulary.length - 1) {
      this.setSection('listening');
      return;
    }
    this.vocabIndex.update(i => i + 1);
  }

  get vocabCounter(): string {
    return ('0' + (this.vocabIndex() + 1)).slice(-2) + ' / ' + ('0' + this.vocabulary.length).slice(-2);
  }

  get vocabPercent(): number {
    return this.vocabulary.length
      ? Math.round(((this.vocabIndex() + 1) / this.vocabulary.length) * 100)
      : 0;
  }

  // ===== Lu?t t? b?ng tay =====
  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.touches[0]?.pageX ?? 0;
  }

  onTouchEnd(event: TouchEvent): void {
    this.touchEndX = event.changedTouches[0].pageX;
    this.handleSwipe();
  }

  onTouchMove(event: TouchEvent): void {
    // Ngan ch?n scroll khi di chuy?n ngang
    const deltaX = event.changedTouches[0].pageX - this.touchStartX;
    if (Math.abs(deltaX) > 10) {
      event.preventDefault();
    }
  }

  private handleSwipe(): void {
    const deltaX = this.touchEndX - this.touchStartX;
    const swipeThreshold = 30;
    if (Math.abs(deltaX) < swipeThreshold) return;
    const goNext = deltaX < 0; // l?t tr?i = ti?n ph?n

    if (this.section === 'vocabulary') {
      goNext ? this.nextVocab() : this.prevVocab();
    } else if (this.section === 'listening') {
      // L?u t?i ph?n Luy?n nghe -> ti?n sang ?n t?p, quay l?i -> t? v?ng
      if (goNext) this.setSection('review');
      else this.setSection('vocabulary');
    } else if (this.section === 'review' && !goNext) {
      this.setSection('listening');
    }
  }
  // ===== �n t?p: 1 c�u / lu?t + Ki?m tra d�p �n (theo mockup) =====
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

  /** Ki?m tra c�u hi?n t?i: hi?n d�ng/sai + gi?i th�ch */
  checkAnswer(): void {
    const q = this.currentQuiz;
    if (!q || !this.answers[q.id] || this.quizChecked()) return;
    this.quizCorrect.set(this.answers[q.id] === q.answer);
    this.quizChecked.set(true);
  }

  /** C�u ti?p theo; c�u cu?i -> submitReview (luu ti?n d? + t?ng k?t) */
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

    // Optimistic: d?i icon NGAY khi b?m, d?i API ? n?n; l?i th� ho�n t�c
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
        this.toast.error('❌ Không lưu được trạng thái từ vựng — thử lại sau.');
      }
    });
  }

  get showTranslation(): boolean {
    return this.settings.showTranslation;
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

  /** Ph�t t? 1 c�u trong h?i tho?i v� T? �?NG d?c ti?p c�c c�u sau (n�t chuy?n sang pause) */
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
      // C�u cu?i -> k?t th�c ngay (kh�ng ngh? th�m)
      if (index >= texts.length - 1) {
        this.playingGroup.set(null);
        this.speakingKey.set(null);
        return;
      }
      // Kho?ng ngh? gi?a c�c c�u tru?c khi d?c c�u ti?p theo
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

    // finish(): ch?y d�ng 1 l?n � do onend/onerror b?n ho?c timer d? ph�ng b?n.
    // Callback n�y n?m NGO�I Angular (zoneless) n�n m?i state d�ng signal d? UI c?p nh?t.
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

    // Gi? tham chi?u utterance (tr�nh GC l�m m?t s? ki?n onend tr�n m?t s? tr�nh duy?t)
    this.currentUtterance = utterance;

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);

    // D? ph�ng: n?u onend kh�ng bao gi? b?n (bug Chrome) -> u?c lu?ng th?i gian d?c r?i tr? icon ?
    if (this.speakFallbackTimer) clearTimeout(this.speakFallbackTimer);
    this.speakFallbackTimer = setTimeout(finish, Math.max(2000, (text.length * 75) / this.speed + 1200));
  }

  /** Ph�t t? cho c�u h?i "Nghe v� ch?n" (kh�ng l? d�p �n � ph�t ch�nh l� d�p �n) */
  playListenWord(q: ReviewQuestion): void {
    this.speakOnce('rv-' + q.id, q.answer);
  }

  // ===== Ph�t �m t? b?ng micro (SpeechRecognition) + ch?m di?m % gi?ng =====
  /** Id t? dang luy?n ph�t �m (null = kh�ng ai) */
  pronState = signal<string | number | null>(null);
  /** K?t qu? l?n luy?n g?n nh?t: none | ok | mid | miss */
  pronResult = signal<'none' | 'ok' | 'mid' | 'miss'>('none');
  /** Text m�y nghe du?c */
  pronHeard = signal('');
  /** �i?m gi?ng (% 0-100) gi?a ph�t �m nghe du?c v� t? c?n d?c */
  pronScore = signal(0);
  /** �i?m cao nh?t t?ng d?t du?c cho m?i t? (id t? -> %) */
  pronBest = signal<Record<number, number>>({});
  private recognition: any = null;

  /** Kho?ng c�ch Levenshtein � d�ng d? t�nh % gi?ng ph�t �m */
  private levenshtein(a: string, b: string): number {
    const m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(
          prev[j] + 1,                       // x�a
          cur[j - 1] + 1,                    // th�m
          prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1) // thay
        );
      }
      prev = cur;
    }
    return prev[n];
  }

  /** % gi?ng (0-100) t?t nh?t gi?a t? c?n d?c v� c�c phi�n b?n m�y nghe du?c */
  private bestSimilarity(target: string, candidates: string[]): number {
    let best = 0;
    for (const c of candidates) {
      if (!c) continue;
      // M�y nghe du?c nhi?u t?: x�t c? chu?i nguy�n v� t?ng t? ri�ng
      const parts = [c, ...c.split(/\s+/)];
      for (const p of parts) {
        const dist = this.levenshtein(target, p);
        const sim = Math.round((1 - dist / Math.max(target.length, p.length)) * 100);
        if (sim > best) best = sim;
      }
    }
    return Math.max(0, Math.min(100, best));
  }

  /** M? micro, ngu?i d�ng d?c t?, app ch?m di?m % gi?ng */
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
      // Luu di?m cao nh?t c?a t? n�y d? hi?n badge b�n c?nh n�t Ph�t �m
      if (score > (this.pronBest()[v.id] || 0)) {
        this.pronBest.update(m => ({ ...m, [v.id]: score }));
      }
      // �i?m: >=85 chu?n, 55-84 kh�, <55 c?n th? l?i
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
      this.learning.saveProgress(this.lesson.id, 'completed', this.score, this.review.length).subscribe({
        next: (res) => {
          // Luu DB xong -> c?p nh?t lu�n cache ti?n d? trong localStorage
          if (res.data) this.learning.syncProgressCache(this.lesson!.id, res.data);
          this.toast.success(`🎉 Hoàn thành bài học! Điểm: ${this.score}/${this.review.length} (đã lưu tiến độ).`);
        },
        error: () => this.toast.error(`❌ Không lưu được tiến độ lên server — điểm ${this.score}/${this.review.length} chỉ hiển thị tạm thời.`)
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




