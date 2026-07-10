// ===== 学生 =====
export interface Student {
  id: string;
  name: string;
  studentNo?: string;
  class?: string; // 班级，如「一班」「二班」
}

// ===== 背默标记 =====
export type RecitationType = "诗歌" | "文言文原文" | "文言文注释" | "字词";
export type RecitationStatus = "过关" | "重默" | "未测";

export interface RecitationItem {
  id: string;
  title: string;
  type: RecitationType;
  createdAt: string;
}

// 遍次：一个篇目的一次考核轮次
export interface RecitationRound {
  id: string;
  itemId: string;
  roundNumber: number; // 1, 2, 3...
  date: string;
}

// 标记：某个学生在某遍次的状态
export interface RecitationMark {
  id: string;
  roundId: string;
  studentId: string;
  status: RecitationStatus;
}

// ===== 成绩记录 =====
export interface Exam {
  id: string;
  name: string;
  date: string;
  totalScore: number;
}

export interface ScoreRecord {
  id: string;
  examId: string;
  studentId: string;
  score: number;
}

// ===== 题库 =====
export interface Question {
  id: string;
  content: string;
  answer?: string;
  examPoints: string[]; // 考点
  techniques: string[]; // 手法
  themes: string[]; // 主题
  source?: string;
  wrongBy?: string[]; // 标记该题常错的学生 id 列表
}

export interface TagGroup {
  name: string;
  tags: string[];
}

// ===== 全局数据 =====
export interface AppData {
  students: Student[];
  recitationItems: RecitationItem[];
  recitationRounds: RecitationRound[];
  recitationMarks: RecitationMark[];
  exams: Exam[];
  scoreRecords: ScoreRecord[];
  questions: Question[];
  tagGroups: TagGroup[];
}
