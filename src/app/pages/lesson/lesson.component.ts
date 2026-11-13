import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { LearningService } from '../../services/learning.service';
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

  constructor(private route: ActivatedRoute, private learning: LearningService) {}

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

  toggleFavorite(v: Vocabulary): void {
    this.learning.toggleFavorite(v.id).subscribe({ next: (r) => v.is_favorite = r.data.is_favorite });
  }

  speak(text: string): void {
    if (!('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  submitReview(): void {
    this.submitted = true;
    this.score = this.review.filter(q => this.answers[q.id] === q.answer).length;
    if (this.lesson) {
      this.learning.saveProgress(this.lesson.id, 'completed', this.score, this.review.length).subscribe();
    }
  }

  resetReview(): void {
    this.answers = {};
    this.submitted = false;
    this.score = 0;
  }
}
