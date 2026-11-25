export type UserRole = 'admin' | 'teacher' | 'student';
export type UserStatus = 'active' | 'inactive';

export interface ClassRef {
  _id: string;
  name: string;
  academicYear?: string;
}

export interface SubjectRef {
  _id: string;
  name: string;
  code: string;
}

export interface User {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  studentId?: string | null;
  teacherId?: string | null;
  phone?: string;
  profileImage?: string;
  classId?: ClassRef | string | null;
  assignedSubjects?: (SubjectRef | string)[];
  assignedClasses?: (ClassRef | string)[];
  status: UserStatus;
  createdAt?: string;
}

export interface ClassItem {
  _id: string;
  name: string;
  academicYear: string;
  description: string;
  status: 'active' | 'archived';
  studentCount?: number;
  subjectCount?: number;
  teachers?: { _id: string; name: string; email: string; teacherId?: string }[];
  createdAt?: string;
}

export interface SubjectItem {
  _id: string;
  name: string;
  code: string;
  description: string;
  classId: ClassRef | string;
  teacherId?: { _id: string; name: string; email: string; teacherId?: string } | string | null;
  status: 'active' | 'archived';
  questionCount?: number;
  examCount?: number;
  createdAt?: string;
}

export type QuestionType = 'mcq' | 'true_false' | 'short_answer' | 'essay';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export interface QuestionItem {
  _id: string;
  questionText: string;
  questionType: QuestionType;
  options: string[];
  correctAnswer?: string;
  expectedAnswer?: string;
  marks: number;
  subjectId: SubjectRef | string;
  topic: string;
  difficulty: DifficultyLevel;
  explanation?: string;
  teacherId?: { _id: string; name: string } | string;
  createdAt?: string;
}

export type ExamType = 'quiz' | 'test' | 'midterm' | 'final' | 'practice';
export type ExamStatus = 'draft' | 'scheduled' | 'published' | 'active' | 'completed' | 'archived';

export interface ExamItem {
  _id: string;
  title: string;
  description: string;
  subjectId: SubjectRef | string;
  classId: ClassRef | string;
  teacherId?: { _id: string; name: string; email: string } | string;
  examType: ExamType;
  questions?: (QuestionItem | string)[];
  randomSelection?: {
    enabled: boolean;
    count: number;
    difficulty: string;
  };
  startDate: string;
  endDate: string;
  duration: number;
  totalMarks: number;
  passingMarks: number;
  instructions: string;
  attemptsAllowed: number;
  status: ExamStatus;
  questionCount?: number;
  submissionCount?: number;
  myAttemptCount?: number;
  inProgressAttemptId?: string | null;
  latestAttemptStatus?: string | null;
  createdAt?: string;
}

export interface AttemptAnswer {
  questionId: string;
  answer: string;
  flagged: boolean;
  savedAt: string;
  marksAwarded: number;
  isCorrect: boolean;
  graded: boolean;
  teacherFeedback: string;
}

export interface ExamAttemptItem {
  _id: string;
  studentId: User | string;
  examId: ExamItem | string;
  assignedQuestionIds: string[];
  answers: AttemptAnswer[];
  startedAt: string;
  expiresAt: string;
  submittedAt?: string;
  score: number;
  totalMarks: number;
  percentage: number;
  grade: string;
  passed: boolean;
  status: 'in_progress' | 'submitted' | 'graded' | 'expired';
  attemptNumber: number;
}

export interface ResultItem {
  _id: string;
  studentId: User | string;
  examId: ExamItem | string;
  attemptId: ExamAttemptItem | string;
  marksObtained: number;
  totalMarks: number;
  percentage: number;
  grade: string;
  passed: boolean;
  feedback: string;
  gradingStatus: 'pending' | 'graded';
  published: boolean;
  publishedAt?: string;
  createdAt: string;
}

export interface GradingScaleBand {
  grade: string;
  minPercentage: number;
  maxPercentage: number;
  label: string;
}

export interface SystemSettings {
  institutionName: string;
  academicYear: string;
  defaultExamDuration: number;
  allowSelfRegistration: boolean;
  gradingScale: GradingScaleBand[];
}
