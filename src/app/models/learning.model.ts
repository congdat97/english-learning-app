export interface Course {
  id: number;
  title: string;
  description: string | null;
  level: string;
  sort_order: number;
}

export interface Lesson {
  id: number;
  course_id: number;
  title: string;
  topic: string | null;
  objectives: string[];
  duration_minutes: number;
  image_url: string | null;
  sort_order: number;
}

export interface VocabularyExample {
  id: number;
  vocabulary_id: number;
  sentence: string;
  translation_vi: string;
  audio: string | null;
}

export interface Vocabulary {
  id: number;
  lesson_id: number;
  word: string;
  ipa: string;
  part_of_speech: string;
  meaning_vi: string;
  audio: string | null;
  is_favorite: boolean;
  examples?: VocabularyExample[];
}

export interface ListeningLine {
  id: number;
  listening_id: number;
  speaker: string;
  text: string;
  translation_vi: string;
  line_order: number;
}

export interface ListeningQuestion {
  id: number;
  listening_id: number;
  type: string;
  question: string;
  options: string[];
  answer: string;
  explanation_vi: string | null;
}

export interface Listening {
  id: number;
  lesson_id: number;
  title: string;
  audio: string | null;
  speed_options: string[];
  transcript: ListeningLine[];
  questions: ListeningQuestion[];
}

export interface ReviewQuestion {
  id: number;
  lesson_id: number;
  type: string;
  question: string;
  options: string[];
  answer: string;
  explanation_vi: string | null;
}

export interface UserProgress {
  id: number;
  lesson_id: number;
  status: string;
  score: number;
  total_questions: number;
  completed_at: string | null;
}
