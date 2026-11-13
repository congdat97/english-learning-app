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
  listeningAnswers: Record<number, string> = {};
  listeningSubmitted = false;
  listeningScore = 0;

  /** Tá»‘c Ä‘á»™ Ä‘á»c â€” chá»‰nh ngay trong bÃ i há»c. */
  speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
  speed = 1;

  /** Key cá»§a má»¥c Ä‘ang Ä‘á»c (Ä‘á»•i icon/mÃ u nÃºt tÆ°Æ¡ng á»©ng). */
  speakingKey: string | number | null = null;
  /** Id cá»§a Ä‘oáº¡n há»™i thoáº¡i Ä‘ang Ä‘á»c cáº£ nhÃ³m (Ä‘á»•i nÃºt â–¶ thÃ nh â¸). */
  playingGroup: string | number | null = null;

  private gapTimer: ReturnType<typeof setTimeout> | null = null;
  private speakToken = 0;

  /** Chá»‰ alert 1 láº§n má»—i phiÃªn Ä‘á»ƒ khÃ´ng spam. */

  constructor(private route: ActivatedRoute, private learning: LearningService, private settings: SettingsService) {}

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
    if (this.submitted) return;
    this.answers[q.id] = option;
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
    const req$ = v.is_bookmarked
      ? this.learning.unbookmark(v.id)
      : this.learning.bookmark(v.id);
    req$.subscribe({
      next: () => {
        v.is_bookmarked = !v.is_bookmarked;
        v.is_favorite = v.is_bookmarked;
        this.learning.syncBookmarkCache(v, v.is_bookmarked);
      },
      error: () => window.alert('âš ï¸ KhÃ´ng lÆ°u Ä‘Æ°á»£c tráº¡ng thÃ¡i tá»« vá»±ng (API chÆ°a hoáº¡t Ä‘á»™ng) â€” thá»­ láº¡i sau.')
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
    if (this.speakingKey === key) {
      this.stopSpeaking();
      return;
    }
    this.stopSpeaking();
    this.speakingKey = key;
    this.speakText(text, () => { this.speakingKey = null; });
  }

  /** Äá»c cáº£ Ä‘oáº¡n há»™i thoáº¡i, cÃ³ khoáº£ng nghá»‰ giá»¯a cÃ¡c cÃ¢u. Báº¥m láº¡i thÃ¬ ngá»«ng. */
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
      // Khoáº£ng nghá»‰ giá»¯a cÃ¡c cÃ¢u trÆ°á»›c khi Ä‘á»c cÃ¢u tiáº¿p theo
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
        next: () => { this.learning.invalidateProgressCache(); window.alert(`âœ… HoÃ n thÃ nh bÃ i há»c! Äiá»ƒm: ${this.score}/${this.review.length} (Ä‘Ã£ lÆ°u tiáº¿n Ä‘á»™).`); },
        error: () => window.alert(`âš ï¸ KhÃ´ng lÆ°u Ä‘Æ°á»£c tiáº¿n Ä‘á»™ lÃªn server (API chÆ°a hoáº¡t Ä‘á»™ng) â€” Ä‘iá»ƒm ${this.score}/${this.review.length} chá»‰ hiá»ƒn thá»‹ táº¡m thá»i.`)
      });
    }
  }

  resetReview(): void {
    this.answers = {};
    this.submitted = false;
    this.score = 0;
  }
}

