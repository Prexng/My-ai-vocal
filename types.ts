
export type Gender = 'der' | 'die' | 'das' | 'none';

export interface ExampleSentence {
  german: string;
  vietnamese: string;
}

export interface VerbForms {
  praeteritum: string;
  partizipII: string;
}

export interface GermanWord {
  id: string;
  word: string;
  ipa?: string; // Phiên âm quốc tế
  gender: Gender;
  plural: string;
  meaning: string;
  synonyms: string[];
  examples: ExampleSentence[];
  partOfSpeech: string;
  verbForms?: VerbForms; // Chỉ dành cho động từ
  createdAt: number;
  masteryLevel: number; // 0-100
}

export interface QuizQuestion {
  type: 'mcq' | 'write';
  question: string;
  correctAnswer: string;
  options?: string[];
  wordId: string;
  hint?: string;
}

export enum AppTab {
  SEARCH = 'search',
  COLLECTION = 'collection',
  LEARN = 'learn',
  QUIZ = 'quiz',
  LISTENING = 'listening',
  STATS = 'stats'
}
