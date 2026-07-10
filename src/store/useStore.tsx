import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type {
  AppData,
  Student,
  RecitationItem,
  RecitationStatus,
  Exam,
  Question,
} from "@/types";

const STORAGE_KEY = "chinese-teacher-assistant";

const emptyData: AppData = {
  students: [],
  recitationItems: [],
  recitationRounds: [],
  recitationMarks: [],
  exams: [],
  scoreRecords: [],
  questions: [],
  tagGroups: [
    { name: "考点", tags: ["修辞手法", "表达方式", "标题作用", "人物形象", "环境描写", "主旨情感", "结构技巧", "词语赏析", "句段作用"] },
    { name: "手法", tags: ["比喻", "拟人", "以小见大", "议论", "抒情", "线索"] },
    { name: "主题", tags: ["家国情怀", "自然风光", "亲情友情", "成长感悟", "历史文化", "品格修养", "社会生活", "哲理思辨"] },
  ],
};

const TECHNIQUE_DEFAULTS = ["比喻", "拟人", "以小见大", "议论", "抒情", "线索"];
const EXAM_POINT_REQUIRED = ["修辞手法", "表达方式", "标题作用"];

function migrateTagGroups(existing: { name: string; tags: string[] }[] | undefined): { name: string; tags: string[] }[] {
  const groups = (existing || []).map((g) => ({ name: g.name, tags: [...g.tags] }));
  const ensureGroup = (name: string, defaults: string[]) => {
    let g = groups.find((x) => x.name === name);
    if (!g) {
      g = { name, tags: [] };
      groups.push(g);
    }
    for (const t of defaults) {
      if (!g.tags.includes(t)) g.tags.push(t);
    }
  };
  // 手法 为新增字段，确保老数据也存在；考点 补充用户指定的示例标签
  ensureGroup("手法", TECHNIQUE_DEFAULTS);
  ensureGroup("考点", EXAM_POINT_REQUIRED);
  return groups;
}

function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Migration: remove old fields, add new ones
      const clean: AppData = {
        students: parsed.students || [],
        recitationItems: parsed.recitationItems || [],
        recitationRounds: parsed.recitationRounds || [],
        recitationMarks: parsed.recitationMarks || [],
        exams: parsed.exams || [],
        scoreRecords: parsed.scoreRecords || [],
        questions: (parsed.questions || []).map((q: any) => ({
          id: q.id,
          content: q.content,
          answer: q.answer,
          source: q.source,
          examPoints: q.examPoints || [],
          techniques: q.techniques || [],
          themes: q.themes || [],
          wrongBy: q.wrongBy || [],
        })),
        tagGroups: migrateTagGroups(parsed.tagGroups),
      };
      return clean;
    }
  } catch (e) {
    console.error("Failed to load data", e);
  }
  return emptyData;
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

interface StoreContextValue {
  data: AppData;
  // Student
  addStudents: (students: Omit<Student, "id">[]) => void;
  updateStudent: (id: string, patch: Partial<Student>) => void;
  deleteStudent: (id: string) => void;
  clearStudents: () => void;
  // Recitation items
  addRecitationItem: (item: Omit<RecitationItem, "id" | "createdAt">) => void;
  deleteRecitationItem: (id: string) => void;
  // Recitation rounds (遍次)
  addRecitationRound: (itemId: string, date: string) => void;
  deleteRecitationRound: (roundId: string) => void;
  updateRecitationRoundDate: (roundId: string, date: string) => void;
  // Recitation marks
  setRecitationMark: (roundId: string, studentId: string, status: RecitationStatus) => void;
  batchSetMarks: (roundId: string, studentIds: string[], status: RecitationStatus) => void;
  // Exam & Scores
  addExam: (exam: Omit<Exam, "id">) => string;
  deleteExam: (id: string) => void;
  upsertScore: (examId: string, studentId: string, score: number) => void;
  batchImportScores: (examId: string, scores: { studentId: string; score: number }[]) => void;
  // Questions
  addQuestion: (q: Omit<Question, "id">) => void;
  addQuestions: (qs: Omit<Question, "id">[]) => void;
  updateQuestion: (id: string, patch: Partial<Question>) => void;
  deleteQuestion: (id: string) => void;
  toggleQuestionWrongStudent: (questionId: string, studentId: string) => void;
  // Tags
  addTag: (groupName: string, tag: string) => void;
  removeTag: (groupName: string, tag: string) => void;
  addTagGroup: (name: string) => void;
  // Utils
  exportAllData: () => void;
  importAllData: (data: AppData) => void;
  resetAll: () => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(loadData);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error("Failed to save data", e);
    }
  }, [data]);

  const value: StoreContextValue = {
    data,

    addStudents: (students) => {
      setData((prev) => {
        const byName = new Map<string, (typeof prev.students)[number]>();
        // 保留已有学生（按姓名去重，避免重复导入产生重复记录）
        for (const s of prev.students) byName.set(s.name.trim().toLowerCase(), s);
        for (const s of students) {
          const key = s.name.trim().toLowerCase();
          const existing = byName.get(key);
          if (existing) {
            // 用新导入的信息补全缺失的 学号 / 班级
            byName.set(key, {
              ...existing,
              studentNo: existing.studentNo || s.studentNo,
              class: existing.class || s.class,
            });
          } else {
            byName.set(key, { ...s, id: uid() });
          }
        }
        return { ...prev, students: Array.from(byName.values()) };
      });
    },

    deleteStudent: (id) => {
      setData((prev) => ({
        ...prev,
        students: prev.students.filter((s) => s.id !== id),
        recitationMarks: prev.recitationMarks.filter((r) => r.studentId !== id),
        scoreRecords: prev.scoreRecords.filter((r) => r.studentId !== id),
      }));
    },

    updateStudent: (id, patch) => {
      setData((prev) => ({
        ...prev,
        students: prev.students.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      }));
    },

    clearStudents: () => {
      setData((prev) => ({ ...prev, students: [], recitationMarks: [], scoreRecords: [] }));
    },

    addRecitationItem: (item) => {
      setData((prev) => ({
        ...prev,
        recitationItems: [...prev.recitationItems, { ...item, id: uid(), createdAt: new Date().toISOString() }],
      }));
    },

    deleteRecitationItem: (id) => {
      setData((prev) => {
        const roundIds = prev.recitationRounds.filter((r) => r.itemId === id).map((r) => r.id);
        return {
          ...prev,
          recitationItems: prev.recitationItems.filter((i) => i.id !== id),
          recitationRounds: prev.recitationRounds.filter((r) => r.itemId !== id),
          recitationMarks: prev.recitationMarks.filter((m) => !roundIds.includes(m.roundId)),
        };
      });
    },

    addRecitationRound: (itemId, date) => {
      setData((prev) => {
        const existingRounds = prev.recitationRounds.filter((r) => r.itemId === itemId);
        const nextNumber = existingRounds.length > 0
          ? Math.max(...existingRounds.map((r) => r.roundNumber)) + 1
          : 1;
        return {
          ...prev,
          recitationRounds: [...prev.recitationRounds, { id: uid(), itemId, roundNumber: nextNumber, date }],
        };
      });
    },

    deleteRecitationRound: (roundId) => {
      setData((prev) => {
        const round = prev.recitationRounds.find((r) => r.id === roundId);
        if (!round) return prev;
        // Renumber remaining rounds for this item
        const remaining = prev.recitationRounds
          .filter((r) => r.id !== roundId && r.itemId === round.itemId)
          .sort((a, b) => a.roundNumber - b.roundNumber)
          .map((r, idx) => ({ ...r, roundNumber: idx + 1 }));
        const otherRounds = prev.recitationRounds.filter((r) => r.itemId !== round.itemId);
        return {
          ...prev,
          recitationRounds: [...otherRounds, ...remaining],
          recitationMarks: prev.recitationMarks.filter((m) => m.roundId !== roundId),
        };
      });
    },

    updateRecitationRoundDate: (roundId, date) => {
      setData((prev) => ({
        ...prev,
        recitationRounds: prev.recitationRounds.map((r) =>
          r.id === roundId ? { ...r, date } : r
        ),
      }));
    },

    setRecitationMark: (roundId, studentId, status) => {
      setData((prev) => {
        const existing = prev.recitationMarks.find(
          (m) => m.roundId === roundId && m.studentId === studentId
        );
        if (existing) {
          // If same status, toggle to 未测 (remove)
          if (existing.status === status) {
            return {
              ...prev,
              recitationMarks: prev.recitationMarks.filter((m) => m.id !== existing.id),
            };
          }
          return {
            ...prev,
            recitationMarks: prev.recitationMarks.map((m) =>
              m.id === existing.id ? { ...m, status } : m
            ),
          };
        }
        return {
          ...prev,
          recitationMarks: [...prev.recitationMarks, { id: uid(), roundId, studentId, status }],
        };
      });
    },

    batchSetMarks: (roundId, studentIds, status) => {
      setData((prev) => {
        const existingForRound = prev.recitationMarks.filter(
          (m) => m.roundId === roundId && studentIds.includes(m.studentId)
        );
        const existingIds = new Set(existingForRound.map((m) => m.studentId));
        const updated = prev.recitationMarks.map((m) =>
          m.roundId === roundId && studentIds.includes(m.studentId)
            ? { ...m, status }
            : m
        );
        const newMarks = studentIds
          .filter((id) => !existingIds.has(id))
          .map((id) => ({ id: uid(), roundId, studentId: id, status }));
        return { ...prev, recitationMarks: [...updated, ...newMarks] };
      });
    },

    addExam: (exam) => {
      const id = uid();
      setData((prev) => ({ ...prev, exams: [...prev.exams, { ...exam, id }] }));
      return id;
    },

    deleteExam: (id) => {
      setData((prev) => ({
        ...prev,
        exams: prev.exams.filter((e) => e.id !== id),
        scoreRecords: prev.scoreRecords.filter((r) => r.examId !== id),
      }));
    },

    upsertScore: (examId, studentId, score) => {
      setData((prev) => {
        const existing = prev.scoreRecords.find(
          (r) => r.examId === examId && r.studentId === studentId
        );
        if (existing) {
          return {
            ...prev,
            scoreRecords: prev.scoreRecords.map((r) =>
              r.id === existing.id ? { ...r, score } : r
            ),
          };
        }
        return {
          ...prev,
          scoreRecords: [...prev.scoreRecords, { id: uid(), examId, studentId, score }],
        };
      });
    },

    batchImportScores: (examId, scores) => {
      setData((prev) => {
        const newRecords = scores.map((s) => ({
          id: uid(),
          examId,
          studentId: s.studentId,
          score: s.score,
        }));
        const filtered = prev.scoreRecords.filter((r) => r.examId !== examId);
        return { ...prev, scoreRecords: [...filtered, ...newRecords] };
      });
    },

    addQuestion: (q) => {
      setData((prev) => ({ ...prev, questions: [...prev.questions, { ...q, id: uid() }] }));
    },

    addQuestions: (qs) => {
      setData((prev) => ({
        ...prev,
        questions: [...prev.questions, ...qs.map((q) => ({ ...q, id: uid() }))],
      }));
    },

    updateQuestion: (id, patch) => {
      setData((prev) => ({
        ...prev,
        questions: prev.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)),
      }));
    },

    deleteQuestion: (id) => {
      setData((prev) => ({ ...prev, questions: prev.questions.filter((q) => q.id !== id) }));
    },

    toggleQuestionWrongStudent: (questionId, studentId) => {
      setData((prev) => ({
        ...prev,
        questions: prev.questions.map((q) => {
          if (q.id !== questionId) return q;
          const arr = q.wrongBy || [];
          return arr.includes(studentId)
            ? { ...q, wrongBy: arr.filter((id) => id !== studentId) }
            : { ...q, wrongBy: [...arr, studentId] };
        }),
      }));
    },

    addTag: (groupName, tag) => {
      setData((prev) => ({
        ...prev,
        tagGroups: prev.tagGroups.map((g) =>
          g.name === groupName && !g.tags.includes(tag)
            ? { ...g, tags: [...g.tags, tag] }
            : g
        ),
      }));
    },

    removeTag: (groupName, tag) => {
      setData((prev) => ({
        ...prev,
        tagGroups: prev.tagGroups.map((g) =>
          g.name === groupName ? { ...g, tags: g.tags.filter((t) => t !== tag) } : g
        ),
        questions: prev.questions.map((q) => {
          if (groupName === "考点") return { ...q, examPoints: q.examPoints.filter((t) => t !== tag) };
          if (groupName === "手法") return { ...q, techniques: q.techniques.filter((t) => t !== tag) };
          if (groupName === "主题") return { ...q, themes: q.themes.filter((t) => t !== tag) };
          return q;
        }),
      }));
    },

    addTagGroup: (name) => {
      setData((prev) => {
        if (prev.tagGroups.some((g) => g.name === name)) return prev;
        return { ...prev, tagGroups: [...prev.tagGroups, { name, tags: [] }] };
      });
    },

    exportAllData: () => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `语文教学助手_数据备份_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },

    importAllData: (imported) => {
      setData({ ...emptyData, ...imported });
    },

    resetAll: () => {
      setData(emptyData);
    },
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
