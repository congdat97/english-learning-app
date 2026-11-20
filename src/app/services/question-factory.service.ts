import { Injectable, inject } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { GameQuestion, GameQuestionType } from '../models/game.model';
import { Listening, ListeningQuestion, ReviewQuestion, Vocabulary, VocabularyExample } from '../models/learning.model';
import { GameService } from './game.service';
import { LearningService } from './learning.service';

type ApiData<T> = { success: boolean; data: T };

@Injectable({ providedIn: 'root' })
export class QuestionFactoryService {
  private learning = inject(LearningService);
  private game = inject(GameService);

  build(lessonId: number, stageId: string) {
    return forkJoin({
      review: this.learning.getReview(lessonId).pipe(
        catchError(() => of<ApiData<ReviewQuestion[]>>({ success: true, data: [] })),
        map(res => res.data || [])
      ),
      listening: this.learning.getListening(lessonId).pipe(
        catchError(() => of<ApiData<Listening[]>>({ success: true, data: [] })),
        map(res => res.data || [])
      ),
      vocabulary: this.learning.getVocabulary(lessonId).pipe(
        catchError(() => of<ApiData<Vocabulary[]>>({ success: true, data: [] })),
        map(res => res.data || [])
      )
    }).pipe(map(({ review, listening, vocabulary }) =>
      this.makeQuestions(stageId, review, listening, vocabulary)
    ));
  }

  private makeQuestions(
    stageId: string,
    review: ReviewQuestion[],
    listening: Listening[],
    vocabulary: Vocabulary[]
  ): GameQuestion[] {
    const questions: GameQuestion[] = [];
    const seed = `${stageId}:${review.length}:${listening.length}:${vocabulary.length}`;
    const add = (question: GameQuestion | null) => {
      if (question && questions.length < 10 && !questions.some(item => item.id === question.id)) {
        questions.push(question);
      }
    };

    const choices = review.filter(q => q.type === 'multiple_choice' || q.type === 'mcq');
    for (const q of this.game.shuffle(choices, `${seed}:choice`).slice(0, 3)) {
      add(this.fromReview(q, 'choice'));
    }

    const fills = review.filter(q => q.type === 'fill_blank');
    for (const q of this.game.shuffle(fills, `${seed}:fill`).slice(0, 2)) {
      add(this.fromReview(q, 'fill'));
    }

    const listens = review.filter(q => q.type === 'listen');
    for (const q of this.game.shuffle(listens, `${seed}:listen`).slice(0, 1)) {
      add(this.fromReview(q, 'listen'));
    }

    const listeningQuestions: { question: ListeningQuestion; transcript: string }[] = [];
    for (const item of listening) {
      const transcript = (item.transcript || []).map(line => line.text).join(' ').trim();
      for (const question of item.questions || []) {
        listeningQuestions.push({ question, transcript });
      }
    }
    for (const item of this.game.shuffle(listeningQuestions, `${seed}:listening`).slice(0, 2)) {
      add(this.fromListeningQuestion(item.question, item.transcript));
    }

    const orderedVocab = this.game.shuffle(vocabulary, `${seed}:vocab`);
    for (const word of orderedVocab.slice(0, 1)) {
      add(this.fromPronunciation(word));
    }
    for (const word of orderedVocab) {
      const example = (word.examples || []).find(item => item.sentence.trim().split(/\s+/).length >= 3);
      if (example) {
        add(this.fromExample(example));
        break;
      }
    }
    for (const word of orderedVocab.slice(0, 4)) {
      add(this.fromVocabularyMeaning(word, vocabulary));
    }
    for (const item of this.game.shuffle(listeningQuestions, `${seed}:more-listening`)) {
      if (questions.length >= 8) break;
      add(this.fromListeningQuestion(item.question, item.transcript));
    }
    for (const q of this.game.shuffle(choices, `${seed}:more-choice`)) {
      if (questions.length >= 8) break;
      add(this.fromReview(q, 'choice'));
    }

    return this.game.shuffle(questions, `${seed}:final`).slice(0, 10);
  }

  private fromReview(q: ReviewQuestion, type: GameQuestionType): GameQuestion {
    return {
      id: `review-${q.id}`,
      type,
      prompt: q.question,
      options: this.prepareOptions(q.options, q.answer, `review-${q.id}`),
      answer: q.answer,
      explanation: q.explanation_vi,
      speakText: type === 'listen' ? q.answer : undefined
    };
  }

  private fromListeningQuestion(q: ListeningQuestion, transcript: string): GameQuestion | null {
    if (!q?.answer) return null;
    return {
      id: `listening-${q.id}`,
      type: 'listen',
      prompt: q.question,
      options: this.prepareOptions(q.options, q.answer, `listening-${q.id}`),
      answer: q.answer,
      explanation: q.explanation_vi,
      speakText: transcript || q.answer
    };
  }

  private fromPronunciation(word: Vocabulary): GameQuestion {
    return {
      id: `pronounce-${word.id}`,
      type: 'pronounce',
      prompt: 'Nói từ này',
      options: [],
      answer: word.word,
      translation: word.meaning_vi,
      speakText: word.word
    };
  }

  private fromExample(example: VocabularyExample): GameQuestion | null {
    const answer = example.sentence.trim().replace(/\s+/g, ' ');
    const tokens = answer.split(' ').filter(Boolean);
    if (tokens.length < 3) return null;
    return {
      id: `order-${example.id}`,
      type: 'order',
      prompt: 'Sắp xếp thành câu đúng',
      options: [],
      answer,
      tokens: this.game.shuffle(tokens, `order-${example.id}`),
      translation: example.translation_vi
    };
  }

  private fromVocabularyMeaning(word: Vocabulary, all: Vocabulary[]): GameQuestion {
    const distractors = all
      .filter(item => item.id !== word.id && item.meaning_vi !== word.meaning_vi)
      .map(item => item.meaning_vi);
    return {
      id: `vocab-${word.id}`,
      type: 'choice',
      prompt: `“${word.word}” nghĩa là gì?`,
      options: this.prepareOptions([word.meaning_vi, ...distractors], word.meaning_vi, `vocab-${word.id}`, 4),
      answer: word.meaning_vi,
      translation: word.ipa
    };
  }

  private prepareOptions(options: string[] | undefined, answer: string, seed: string, limit?: number): string[] {
    const unique = [...new Set((options || []).map(item => String(item).trim()).filter(Boolean))];
    if (answer && !unique.includes(answer)) unique.unshift(answer);
    const shuffled = this.game.shuffle(unique, seed);
    if (!limit || shuffled.length <= limit) return shuffled;

    const limited = shuffled.slice(0, limit);
    if (answer && !limited.includes(answer)) limited[0] = answer;
    return limited;
  }
}
