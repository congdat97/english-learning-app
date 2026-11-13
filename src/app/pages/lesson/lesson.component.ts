import { Component, OnInit } from '@angular/core';
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
export class LessonComponent implements OnInit {
  lesson: Lesson | null = null;
  vocabulary: Vocabulary[] = [];
  listening: Listening[] = [];
  review: ReviewQuestion[] = [];
  loading = true;
  section: 'intro' | 'vocabulary' | 'listening' | 'review' = 'intro';
  answers: Record<number, string> = {};
  submitted = false;
  score = 0;

  /** Chỉ alert 1 lần mỗi phiên để không spam. */
  private listeningAlertShown = false;

  constructor(private route: ActivatedRoute, private learning: LearningService, private settings: SettingsService) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.learning.getLesson(id).subscribe({ next: (r) => this.lesson = r.data, error: () => this.loading = false });
    this.learning.getVocabulary(id).subscribe({ next: (r) => this.vocabulary = r.data, error: () => this.loading = false });
    this.learning.getListening(id).subscribe({ next: (r) => this.listening = r.data, error: () => this.loading = false });
    this.learning.getReview(id).subscribe({ next: (r) => { this.review = r.data; this.loading = false; }, error: () => this.loading = false });
  }

  setSection(s: 'intro' | 'vocabulary' | 'listening' | 'review'): void {
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
    this.learning.toggleFavorite(v.id).subscribe({
      next: (r) => {
        v.is_favorite = r.data?.is_favorite ?? !v.is_favorite;
        this.learning.syncBookmarkCache(v);
      },
      error: () => window.alert('⚠️ Không lưu được trạng thái từ vựng (API chưa hoạt động) — thử lại sau.')
    });
  }

  get showTranslation(): boolean {
    return this.settings.showTranslation;
  }

  speak(text: string): void {
    if (!('speechSynthesis' in window)) return;
    const s = this.settings.load();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = s.audioSpeed;
    if (s.voice) {
      const voice = speechSynthesis.getVoices().find(v => v.name === s.voice);
      if (voice) utterance.voice = voice;
    }
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
