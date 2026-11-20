export type GameQuestionType = 'choice' | 'fill' | 'listen' | 'pronounce' | 'order';

export interface GameQuestion {
  id: string;
  type: GameQuestionType;
  prompt: string;
  translation?: string | null;
  options: string[];
  answer: string;
  explanation?: string | null;
  speakText?: string;
  tokens?: string[];
}

export interface GameStage {
  id: string;
  lessonId: number;
  courseId: number;
  courseTitle: string;
  title: string;
  topic: string | null;
  order: number;
  bestStars: number;
  bestAccuracy: number;
  played: number;
}

export interface GameResult {
  stageId: string;
  lessonId: number;
  stars: number;
  score: number;
  total: number;
  accuracy: number;
  pronunciation: number | null;
  answers: GameQuestionAnswer[];
  completedAt: string;
}

export interface GameQuestionAnswer {
  questionId: string;
  prompt: string;
  selected: string | null;
  answer: string;
  correct: boolean;
  explanation?: string | null;
}
