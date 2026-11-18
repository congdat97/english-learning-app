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
  section: 'intro' | 'vocabulary' | 'listening' | 'review' = 'intro';
  answers: Record<number, string> = {};
  submitted = false;
  score = 0;
  listeningAnswers: Record<number, string> = {};
  listeningSubmitted = false;
  listeningScore = 0;

  /** Tá»‘c Ä‘á»™ Ä‘á»c â€” chá»‰nh ngay trong bÃ i há»c. */
  speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
  speed = 1;

  /** Key cá»§a má»¥c Ä‘ang Ä‘á»c (Ä‘á»•i icon/mÃ u nÃºt tÆ°Æ¡ng á»©ng). */
  speakingKey = signal<string | number | null>(null);
  /** Id của đoạn hội thoại đang đọc cả nhóm (đổi nút ▶ thành ⏸). */
  playingGroup = signal<string | number | null>(null);

  private gapTimer: ReturnType<typeof setTimeout> | null = null;
  private speakToken = 0;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private speakFallbackTimer: ReturnType<typeof setTimeout> | null = null;

  /** Chá»‰ alert 1 láº§n má»—i phiÃªn Ä‘á»ƒ khÃ´ng spam. */

  constructor(private route: ActivatedRoute, private learning: LearningService, private settings: SettingsService, private auth: AuthService, private toast: ToastService) {}

  ngOnInit(): void {
    this.speed = this.settings.audioSpeed;
    // GiÃ¡ trá»‹ lÆ°u láº¡ (khÃ´ng náº±m trong danh sÃ¡ch chip) -> tráº£ vá» máº·c Ä‘á»‹nh 1x
    if (!this.speeds.includes(this.speed)) {
      this.speed = 1;
      this.settings.save({ ...this.settings.load(), audioSpeed: 1 });
    }
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.learning.getLesson(id).subscribe({ next: (r) => this.lesson = r.data, error: () => this.loading = false });
    this.learning.getVocabulary(id).subscribe({ next: (r) => this.vocabulary = r.data, error: () => this.loading = false });
    this.learning.getListening(id).subscribe({ next: (r) => this.listening = r.data, error: () => this.loading = false });
    this.learning.getReview(id).subscribe({ next: (r) => { this.review = r.data; this.loading = false; }, error: () => this.loading = false });
  }

  ngOnDestroy(): void {
    this.stopSpeaking();
  }

  setSection(s: 'intro' | 'vocabulary' | 'listening' | 'review'): void {
    this.stopSpeaking();
    this.section = s;
  }

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
    // Từ cuối -> quay lại từ đầu (giống mockup "Học lại từ đầu")
    this.vocabIndex.update(i => (i + 1) % Math.max(1, this.vocabulary.length));
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

  /** Luyá»‡n nghe: chá»n Ä‘Ã¡p Ã¡n trÆ°á»›c khi ná»™p. */
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
      this.toast.info('🔐 Cần đăng nhập để lưu từ vào sổ từ vựng. Bấm "Đăng nhập" trên đầu trang.');
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
        this.toast.error('⚠️ Không lưu được trạng thái từ vựng — thử lại sau.');
      }
    });
  }

  get showTranslation(): boolean {
    return this.settings.showTranslation;
  }

  /** Äá»•i tá»‘c Ä‘á»™ Ä‘á»c â€” Ã¡p dá»¥ng cho láº§n phÃ¡t tiáº¿p theo. */
  setSpeed(rate: number): void {
    this.speed = rate;
    this.settings.setAudioSpeed(rate);
  }

  /** Äá»c 1 má»¥c (tá»«/cÃ¢u) â€” báº¥m láº¡i thÃ¬ ngá»«ng. */
  speakOnce(key: string | number, text: string): void {
    if (this.speakingKey() === key) {
      this.stopSpeaking();
      return;
    }
    this.stopSpeaking();
    this.speakingKey.set(key);
    this.speakText(text, () => { this.speakingKey.set(null); });
  }

  /** Äá»c cáº£ Ä‘oáº¡n há»™i thoáº¡i, cÃ³ khoáº£ng nghá»‰ giá»¯a cÃ¡c cÃ¢u. Báº¥m láº¡i thÃ¬ ngá»«ng. */
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

  // ===== Phát âm từ bằng micro (SpeechRecognition) =====
  /** Id từ đang luyện phát âm (null = không ai) */
  pronState = signal<string | number | null>(null);
  /** Kết quả lần luyện gần nhất: none | ok | miss */
  pronResult = signal<'none' | 'ok' | 'miss'>('none');
  /** Text máy nghe được */
  pronHeard = signal('');
  private recognition: any = null;

  /** Mở micro, người dùng đọc từ, app so sánh và xác nhận */
  startPronounce(v: Vocabulary): void {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      window.alert('Trình duyệt không hỗ trợ nhận diện giọng nói. Hãy dùng Chrome hoặc Edge.');
      return;
    }
    this.pronResult.set('none');
    this.pronHeard.set('');
    this.pronState.set(v.id);
    if (this.recognition) { try { this.recognition.abort(); } catch { /* ignore */ } }

    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 3;
    rec.onresult = (e: any) => {
      const alts: string[] = Array.from(e.results[0]).map((a: any) =>
        String(a.transcript || '').toLowerCase().replace(/[^a-z' ]/g, '').trim());
      this.pronHeard.set(alts[0] || '');
      const target = v.word.toLowerCase().replace(/[^a-z' ]/g, '').trim();
      const ok = alts.some(a => a === target || a.includes(target) || target.includes(a));
      this.pronResult.set(ok ? 'ok' : 'miss');
      this.pronState.set(null);
    };
    rec.onerror = () => {
      this.pronResult.set('miss');
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
        this.toast.info(`✅ Hoàn thành bài học! Điểm: ${this.score}/${this.review.length}. Đăng nhập để lưu tiến độ vào tài khoản.`);
        return;
      }
      this.learning.saveProgress(this.lesson.id, 'completed', this.score, this.review.length).subscribe({
        next: (res) => {
          // Lưu DB xong -> cập nhật luôn cache tiến độ trong localStorage
          if (res.data) this.learning.syncProgressCache(this.lesson!.id, res.data);
          this.toast.success(`🎉 Hoàn thành bài học! Điểm: ${this.score}/${this.review.length} (đã lưu tiến độ).`);
        },
        error: () => this.toast.error(`⚠️ Không lưu được tiến độ lên server — điểm ${this.score}/${this.review.length} chỉ hiển thị tạm thời.`)
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

