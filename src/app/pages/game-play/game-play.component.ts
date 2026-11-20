import { Component, DestroyRef, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { GameQuestion, GameQuestionAnswer, GameResult } from '../../models/game.model';
import { GameService } from '../../services/game.service';
import { LearningService } from '../../services/learning.service';
import { PronunciationService } from '../../services/pronunciation.service';
import { QuestionFactoryService } from '../../services/question-factory.service';
import { SpeechService } from '../../services/speech.service';

@Component({
  selector: 'app-game-play',
  imports: [CommonModule],
  templateUrl: './game-play.component.html',
  styleUrl: './game-play.component.css'
})
export class GamePlayComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private factory = inject(QuestionFactoryService);
  private learning = inject(LearningService);
  private game = inject(GameService);
  private speech = inject(SpeechService);
  private pronunciationService = inject(PronunciationService);

  stageId = '';
  lessonId = 0;
  questions: GameQuestion[] = [];
  index = 0;
  loading = true;
  error = false;
  selectedOption = '';
  selectedTokens: string[] = [];
  availableTokens: string[] = [];
  pronunciation: number | null = null;
  checkingPronunciation = false;
  feedback: 'correct' | 'wrong' | null = null;
  answers: GameQuestionAnswer[] = [];
  pronunciationScores: number[] = [];
  score = 0;

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.stageId = params.get('stageId') || '';
      this.lessonId = this.game.lessonIdFromStage(this.stageId) || 0;
      if (!this.lessonId) {
        this.error = true;
        this.loading = false;
        return;
      }
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.speech.stop();
  }

  get current(): GameQuestion | null {
    return this.questions[this.index] ?? null;
  }

  get total(): number {
    return this.questions.length;
  }

  load(): void {
    this.loading = true;
    this.error = false;
    this.factory.build(this.lessonId, this.stageId).subscribe({
      next: questions => {
        this.questions = questions || [];
        this.resetQuestion();
        this.loading = false;
        if (!this.questions.length) this.error = true;
      },
      error: () => {
        this.error = true;
        this.loading = false;
      }
    });
  }

  retry(): void {
    this.answers = [];
    this.pronunciationScores = [];
    this.score = 0;
    this.index = 0;
    this.load();
  }

  speak(): void {
    const question = this.current;
    if (question) this.speech.speak(question.speakText || question.answer);
  }

  startPronunciation(): void {
    if (!this.current || this.checkingPronunciation) return;
    this.checkingPronunciation = true;
    this.pronunciationService.score(this.current.answer).subscribe({
      next: value => {
        this.pronunciation = value;
        this.checkingPronunciation = false;
      },
      error: () => {
        this.pronunciation = 0;
        this.checkingPronunciation = false;
      }
    });
  }

  pronunciationSupported(): boolean {
    return this.pronunciationService.supported();
  }

  choose(option: string): void {
    if (this.feedback) return;
    this.selectedOption = option;
  }

  pickToken(index: number): void {
    if (this.feedback || index < 0 || index >= this.availableTokens.length) return;
    this.selectedTokens.push(this.availableTokens[index]);
    this.availableTokens.splice(index, 1);
  }

  removeToken(index: number): void {
    if (this.feedback || index < 0 || index >= this.selectedTokens.length) return;
    this.availableTokens.push(this.selectedTokens[index]);
    this.selectedTokens.splice(index, 1);
  }

  canCheck(): boolean {
    const question = this.current;
    if (!question || this.feedback) return false;
    if (question.type === 'pronounce') return this.pronunciation !== null;
    if (question.type === 'order') return this.selectedTokens.length > 0;
    return Boolean(this.selectedOption);
  }

  check(): void {
    const question = this.current;
    if (!question || !this.canCheck()) return;

    let selected: string | null = null;
    let correct = false;

    if (question.type === 'pronounce') {
      selected = this.pronunciation !== null ? `${this.pronunciation}%` : null;
      correct = (this.pronunciation ?? 0) >= 90;
      this.pronunciationScores.push(this.pronunciation ?? 0);
    } else if (question.type === 'order') {
      selected = this.selectedTokens.join(' ');
      correct = this.normalize(selected) === this.normalize(question.answer);
    } else {
      selected = this.selectedOption;
      correct = this.normalize(selected) === this.normalize(question.answer);
    }

    if (correct) this.score++;
    this.answers.push({
      questionId: question.id,
      prompt: question.prompt,
      selected,
      answer: question.answer,
      correct,
      explanation: question.explanation
    });
    this.feedback = correct ? 'correct' : 'wrong';
  }

  next(): void {
    if (this.index < this.questions.length - 1) {
      this.index++;
      this.resetQuestion();
      return;
    }
    this.finish();
  }

  progressPercent(): number {
    return this.total ? Math.round(((this.index + 1) / this.total) * 100) : 0;
  }

  typeLabel(type: string): string {
    const labels: Record<string, string> = {
      choice: 'Chọn đáp án',
      fill: 'Điền chỗ trống',
      listen: 'Nghe và chọn',
      pronounce: 'Phát âm',
      order: 'Sắp xếp câu'
    };
    return labels[type] || 'Câu hỏi';
  }

  private resetQuestion(): void {
    this.selectedOption = '';
    this.selectedTokens = [];
    this.availableTokens = [...(this.current?.tokens || [])];
    this.pronunciation = null;
    this.checkingPronunciation = false;
    this.feedback = null;
  }

  private finish(): void {
    const total = this.answers.length || this.questions.length;
    const pronunciation = this.pronunciationScores.length
      ? Math.round(this.pronunciationScores.reduce((sum, value) => sum + value, 0) / this.pronunciationScores.length)
      : null;
    const stars = this.game.starsFor(this.score, total, pronunciation);
    const result: GameResult = {
      stageId: this.stageId,
      lessonId: this.lessonId,
      stars,
      score: this.score,
      total,
      accuracy: total > 0 ? Math.round((this.score / total) * 100) : 0,
      pronunciation,
      answers: this.answers,
      completedAt: new Date().toISOString()
    };

    this.game.saveResult(result);
    this.learning.saveGameResult(this.stageId, stars, this.score, total).subscribe({ error: () => {} });
    this.router.navigate(['/game/result', this.stageId]);
  }

  private normalize(value: string | null): string {
    return String(value || '')
      .toLowerCase()
      .replace(/[.,!?;:"“”]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
