import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { LearningService } from '../../services/learning.service';
import { SettingsService } from '../../services/settings.service';
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

  /** Tốc độ đọc — chỉnh ngay trong bài học. */
  speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
  speed = 1;

  /** Key của mục đang đọc (đổi icon/màu nút tương ứng). */
  speakingKey: string | number | null = null;
  /** Id của đoạn hội thoại đang đọc cả nhóm (đổi nút ▶ thành ⏸). */
  playingGroup: string | number | null = null;

  private gapTimer: ReturnType<typeof setTimeout> | null = null;
  private speakToken = 0;

  /** Chỉ alert 1 lần mỗi phiên để không spam. */
  private listeningAlertShown = false;

  constructor(private route: ActivatedRoute, private learning: LearningService, private settings: SettingsService) {}

  ngOnInit(): void {
    this.speed = this.settings.audioSpeed;
    // Giá trị lưu lạ (không nằm trong danh sách chip) -> trả về mặc định 1x
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
    if (this.submitted) return;
    this.answers[q.id] = option;
  }

  /** Luyện nghe: lưu lựa chọn + cảnh báo tính năng chưa chấm điểm. */
  pickListening(q: { id: number }, option: string): void {
    this.answers[q.id] = option;
    if (!this.listeningAlertShown) {
      this.listeningAlertShown = true;
      window.alert('⚠️ Tính năng chấm điểm Luyện nghe chưa hoàn thiện — lựa chọn của bạn chưa được tính điểm.');
    }
  }

  toggleFavorite(v: Vocabulary): void {
    const req$ = v.is_bookmarked
      ? this.learning.unbookmark(v.id)
      : this.learning.bookmark(v.id);
    req$.subscribe({
      next: () => {
        v.is_bookmarked = !v.is_bookmarked;
        v.is_favorite = v.is_bookmarked;
        this.learning.invalidateBookmarksCache();
      },
      error: () => window.alert('⚠️ Không lưu được trạng thái từ vựng (API chưa hoạt động) — thử lại sau.')
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
    if (this.speakingKey === key) {
      this.stopSpeaking();
      return;
    }
    this.stopSpeaking();
    this.speakingKey = key;
    this.speakText(text, () => { this.speakingKey = null; });
  }

  /** Đọc cả đoạn hội thoại, có khoảng nghỉ giữa các câu. Bấm lại thì ngừng. */
  playGroup(groupId: string | number, texts: string[]): void {
    if (this.playingGroup === groupId) {
      this.stopSpeaking();
      return;
    }
    this.stopSpeaking();
    this.playingGroup = groupId;
    this.playQueue(groupId, texts, 0);
  }

  private playQueue(groupId: string | number, texts: string[], index: number): void {
    if (this.playingGroup !== groupId || index >= texts.length) {
      this.playingGroup = null;
      this.speakingKey = null;
      return;
    }
    const key = `${groupId}:${index}`;
    this.speakingKey = key;
    this.speakText(texts[index], () => {
      if (this.playingGroup !== groupId) return;
      // Khoảng nghỉ giữa các câu trước khi đọc câu tiếp theo
      this.gapTimer = setTimeout(() => this.playQueue(groupId, texts, index + 1), 700);
    });
  }

  stopSpeaking(): void {
    if (this.gapTimer) {
      clearTimeout(this.gapTimer);
      this.gapTimer = null;
    }
    this.speakToken++;
    this.speakingKey = null;
    this.playingGroup = null;
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
    utterance.onend = () => { if (token === this.speakToken) onDone(); };
    utterance.onerror = () => { if (token === this.speakToken) onDone(); };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  submitReview(): void {
    this.submitted = true;
    this.score = this.review.filter(q => this.answers[q.id] === q.answer).length;
    if (this.lesson) {
      this.learning.saveProgress(this.lesson.id, 'completed', this.score, this.review.length).subscribe({
        next: () => { this.learning.invalidateProgressCache(); window.alert(`✅ Hoàn thành bài học! Điểm: ${this.score}/${this.review.length} (đã lưu tiến độ).`); },
        error: () => window.alert(`⚠️ Không lưu được tiến độ lên server (API chưa hoạt động) — điểm ${this.score}/${this.review.length} chỉ hiển thị tạm thời.`)
      });
    }
  }

  resetReview(): void {
    this.answers = {};
    this.submitted = false;
    this.score = 0;
  }
}
