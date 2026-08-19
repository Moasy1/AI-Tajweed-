export interface User {
  id: string;
  name: string;
  avatar: string;
  points: number;
  badges: string[];
}

export interface TajweedMistake {
  word: string;
  mistakeType: 'مد' | 'غنة' | 'إدغام' | 'تشكيل';
  correction: string;
  color: string;
}

export interface IjazahApplication {
  id: string;
  status: 'pending' | 'ai_approved' | 'sheikh_review' | 'approved' | 'rejected';
  surah: string;
  accuracy: number;
  date: string;
}
