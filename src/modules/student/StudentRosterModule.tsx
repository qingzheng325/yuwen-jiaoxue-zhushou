import { useState, useMemo } from "react";
import { useStore } from "@/store/useStore";
import { StudentManager } from "@/modules/common/StudentManager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import {
  Users, BookOpen, TrendingUp, AlertCircle, Plus, Search, Trash2, School,
  CheckCircle2, XCircle, MinusCircle, HelpCircle,
} from "lucide-react";

const statusClass = (s: string) =>
  s === "过关"
    ? "bg-green-100 text-green-700"
    : s === "重默"
    ? "bg-red-100 text-red-600"
    : "bg-slate-100 text-slate-400";

// 折合分值（满分100换算分，不带%）：绝对分值 / 满分 * 100
function toConverted(score: number, total: number): number {
  return total > 0 ? (score / total) * 100 : 0;
}
// 折合分值徽章配色：≥80 优秀(绿)，≥60 及格(蓝)，否则不及格(红)
function convertedBadgeClass(v: number): string {
  if (v >= 80) return "bg-green-100 text-green-700 hover:bg-green-100";
  if (v >= 60) return "bg-blue-100 text-blue-700 hover:bg-blue-100";
  return "bg-red-100 text-red-700 hover:bg-red-100";
}

export function StudentRosterModule() {
  const { data, toggleQuestionWrongStudent } = useStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeView, setActiveView] = useState<"student" | "class">("student");
  const [classSelected, setClassSelected] = useState<string | null>(null);
  // 趋势图横轴：可点选对比的试卷（排除集，空=全部）
  const [studentExcluded, setStudentExcluded] = useState<string[]>([]);
  const [classExcluded, setClassExcluded] = useState<string[]>([]);

  const selected = data.students.find((s) => s.id === selectedId) || null;

  const classes = useMemo(() => {
    const set = new Set(data.students.map((s) => (s.class || "").trim()).filter(Boolean));
    return Array.from(set).sort();
  }, [data.students]);

  const studentById = useMemo(() => {
    const m: Record<string, { id: string; name: string; class?: string }> = {};
    data.students.forEach((s) => (m[s.id] = s));
    return m;
  }, [data.students]);

  const sortedExams = useMemo(
    () => [...data.exams].sort((a, b) => a.date.localeCompare(b.date)),
    [data.exams]
  );

  // ===== 背默统计 =====
  const recSummary = useMemo(() => {
    if (!selectedId) return null;
    const marks = data.recitationMarks.filter((m) => m.studentId === selectedId);
    const passed = marks.filter((m) => m.status === "过关").length;
    const retest = marks.filter((m) => m.status === "重默").length;
    const untested = marks.filter((m) => m.status === "未测").length;
    const tested = passed + retest;
    const passRate = tested > 0 ? (passed / tested) * 100 : 0;
    return { passed, retest, untested, total: marks.length, passRate };
  }, [selectedId, data.recitationMarks]);

  const recByItem = useMemo(() => {
    if (!selectedId) return [];
    return data.recitationItems
      .map((item) => {
        const rounds = data.recitationRounds
          .filter((r) => r.itemId === item.id)
          .sort((a, b) => a.roundNumber - b.roundNumber)
          .map((round) => ({
            round,
            status:
              data.recitationMarks.find(
                (m) => m.roundId === round.id && m.studentId === selectedId
              )?.status || "未测",
          }));
        return { item, rounds };
      })
      .filter((d) => d.rounds.length > 0);
  }, [selectedId, data.recitationItems, data.recitationRounds, data.recitationMarks]);

  // ===== 成绩统计（学生档案）：各次考试的绝对分值 / 折合分值 / 本场班级排名 =====
  const scoreRows = useMemo(() => {
    if (!selectedId || !selected) return [];
    const myClass = (selected.class || "").trim();
    return sortedExams
      .map((exam) => {
        const rec = data.scoreRecords.find(
          (r) => r.examId === exam.id && r.studentId === selectedId
        );
        if (!rec) return null;
        const converted = toConverted(rec.score, exam.totalScore);
        let rank: number | null = null;
        let total: number | null = null;
        if (myClass) {
          const classRecs = data.scoreRecords.filter(
            (r) => r.examId === exam.id && (studentById[r.studentId]?.class || "") === myClass
          );
          if (classRecs.length > 0) {
            const ranked = classRecs
              .map((r) => ({ id: r.studentId, v: toConverted(r.score, exam.totalScore) }))
              .sort((a, b) => b.v - a.v);
            total = ranked.length;
            rank = ranked.findIndex((x) => x.id === selectedId) + 1;
          }
        }
        return { examId: exam.id, name: exam.name, date: exam.date, score: rec.score, examTotal: exam.totalScore, converted, rank, total };
      })
      .filter(Boolean) as {
        examId: string; name: string; date: string; score: number; examTotal: number; converted: number;
        rank: number | null; total: number | null;
      }[];
  }, [selectedId, selected, sortedExams, data.scoreRecords, studentById]);

  const scoreSummary = useMemo(() => {
    if (scoreRows.length === 0) return null;
    const scores = scoreRows.map((p) => p.score);
    const converted = scoreRows.map((p) => p.converted);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const avgConverted = converted.reduce((a, b) => a + b, 0) / converted.length;
    const max = Math.max(...converted);
    const min = Math.min(...converted);
    const passRate = (converted.filter((v) => v >= 60).length / converted.length) * 100;
    return { avg, avgConverted, max, min, passRate, count: scores.length };
  }, [scoreRows]);

  // ===== 班级排名（跨多场考试，按平均折合分值排名）=====
  const classRank = useMemo(() => {
    if (!selected || !(selected.class || "").trim()) return null;
    const myClass = (selected.class || "").trim();
    const ranked = data.students
      .filter((s) => (s.class || "").trim() === myClass)
      .map((s) => {
        const recs = data.scoreRecords.filter((r) => r.studentId === s.id);
        if (recs.length === 0) return null;
        const avg =
          recs.reduce((acc, r) => {
            const exam = data.exams.find((e) => e.id === r.examId);
            return acc + (exam ? toConverted(r.score, exam.totalScore) : 0);
          }, 0) / recs.length;
        return { id: s.id, avgConverted: avg };
      })
      .filter((x): x is { id: string; avgConverted: number } => x !== null)
      .sort((a, b) => b.avgConverted - a.avgConverted);
    if (ranked.length === 0) return null;
    const pos = ranked.findIndex((r) => r.id === selected.id);
    if (pos < 0) return null;
    return { rank: pos + 1, total: ranked.length };
  }, [selected, data.students, data.scoreRecords, data.exams]);

  // ===== 班级档案：各班逐场考试统计 =====
  const classExamRows = useMemo(() => {
    if (!classSelected) return [];
    return sortedExams
      .map((exam) => {
        const recs = data.scoreRecords.filter(
          (r) => r.examId === exam.id && (studentById[r.studentId]?.class || "") === classSelected
        );
        if (recs.length === 0) return null;
        const scores = recs.map((r) => r.score);
        const converted = recs.map((r) => toConverted(r.score, exam.totalScore));
        const excellentRate = (converted.filter((v) => v >= 80).length / recs.length) * 100;
        const passRate = (converted.filter((v) => v >= 60).length / recs.length) * 100;
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        const avgConverted = converted.reduce((a, b) => a + b, 0) / converted.length;
        return {
          examId: exam.id,
          name: exam.name,
          date: exam.date,
          participants: recs.length,
          excellentRate: parseFloat(excellentRate.toFixed(1)),
          passRate: parseFloat(passRate.toFixed(1)),
          avgScore: parseFloat(avgScore.toFixed(1)),
          avgConverted: parseFloat(avgConverted.toFixed(1)),
          maxScore: Math.max(...scores),
          minScore: Math.min(...scores),
        };
      })
      .filter(Boolean) as {
        examId: string; name: string; date: string; participants: number;
        excellentRate: number; passRate: number; avgScore: number; avgConverted: number;
        maxScore: number; minScore: number;
      }[];
  }, [classSelected, sortedExams, data.scoreRecords, studentById]);

  const classSummaryCards = useMemo(() => {
    if (classExamRows.length === 0) return null;
    const n = classExamRows.length;
    const avgParticipants = classExamRows.reduce((a, r) => a + r.participants, 0) / n;
    const avgExcellent = classExamRows.reduce((a, r) => a + r.excellentRate, 0) / n;
    const avgPass = classExamRows.reduce((a, r) => a + r.passRate, 0) / n;
    return { exams: n, participants: parseFloat(avgParticipants.toFixed(1)), excellent: parseFloat(avgExcellent.toFixed(1)), pass: parseFloat(avgPass.toFixed(1)) };
  }, [classExamRows]);

  // 趋势图横轴：按排除集筛选试卷
  const studentChartRows = useMemo(
    () => scoreRows.filter((p) => !studentExcluded.includes(p.examId)),
    [scoreRows, studentExcluded]
  );
  const classChartRows = useMemo(
    () => classExamRows.filter((r) => !classExcluded.includes(r.examId)),
    [classExamRows, classExcluded]
  );
  const toggleStudentExam = (id: string) =>
    setStudentExcluded((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleClassExam = (id: string) =>
    setClassExcluded((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // ===== 常错题目 =====
  const wrongQuestions = useMemo(() => {
    if (!selectedId) return [];
    return data.questions.filter((q) => (q.wrongBy || []).includes(selectedId));
  }, [selectedId, data.questions]);

  const addCandidates = useMemo(() => {
    const kw = search.trim().toLowerCase();
    return data.questions.filter((q) => {
      if (!selectedId) return false;
      if ((q.wrongBy || []).includes(selectedId)) return false;
      if (!kw) return true;
      return (
        q.content.toLowerCase().includes(kw) ||
        q.examPoints.join("").toLowerCase().includes(kw) ||
        q.themes.join("").toLowerCase().includes(kw)
      );
    });
  }, [search, selectedId, data.questions]);

  const handleToggleWrong = (questionId: string) => {
    if (selectedId) toggleQuestionWrongStudent(questionId, selectedId);
  };

  return (
    <div className="space-y-4">
      <StudentManager />

      {data.students.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 rounded-lg p-3">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          请先在上方导入或添加学生名单
        </div>
      ) : (
        <>
          {/* 视图切换 */}
          <div className="border-t pt-4 flex gap-2">
            <Button
              size="sm"
              variant={activeView === "student" ? "default" : "outline"}
              onClick={() => setActiveView("student")}
            >
              <Users className="h-4 w-4 mr-1" /> 学生档案
            </Button>
            <Button
              size="sm"
              variant={activeView === "class" ? "default" : "outline"}
              onClick={() => setActiveView("class")}
            >
              <School className="h-4 w-4 mr-1" /> 班级档案
            </Button>
          </div>

          {/* ============ 学生档案 ============ */}
          {activeView === "student" && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-5 w-5 text-slate-500" />
                  <h3 className="text-sm font-medium">学生档案</h3>
                </div>
                <Select value={selectedId || ""} onValueChange={setSelectedId}>
                  <SelectTrigger className="w-full max-w-xs">
                    <SelectValue placeholder="选择学生查看档案" />
                  </SelectTrigger>
                  <SelectContent>
                    {data.students.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.studentNo ? `${s.studentNo} ` : ""}
                        {s.name}
                        {s.class ? `（${s.class}）` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!selected ? (
                <p className="text-sm text-slate-400 text-center py-6">请选择一名学生查看其背默、成绩与常错题目</p>
              ) : (
                <div className="space-y-4">
                  {/* 概览卡片 */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg border p-3 text-center">
                      <div className="text-xl font-bold text-green-600">
                        {recSummary ? `${recSummary.passRate.toFixed(0)}%` : "—"}
                      </div>
                      <div className="text-xs text-slate-500">背默通过率</div>
                    </div>
                    <div className="rounded-lg border p-3 text-center">
                      <div className="text-xl font-bold text-blue-600">
                        {scoreSummary ? scoreSummary.avgConverted.toFixed(0) : "—"}
                      </div>
                      <div className="text-xs text-slate-500">平均折合分值</div>
                    </div>
                    <div className="rounded-lg border p-3 text-center">
                      <div className="text-xl font-bold text-purple-600">{wrongQuestions.length}</div>
                      <div className="text-xs text-slate-500">常错题目</div>
                    </div>
                  </div>

                  {/* 背默情况统计 */}
                  <div className="rounded-lg border">
                    <div className="flex items-center gap-2 px-3 py-2 border-b bg-slate-50">
                      <BookOpen className="h-4 w-4 text-slate-500" />
                      <span className="text-sm font-medium">背默情况</span>
                    </div>
                    <div className="p-3 space-y-3">
                      {recSummary && recSummary.total === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-4">暂无背默记录</p>
                      ) : recSummary ? (
                        <>
                          <div className="flex gap-2 flex-wrap">
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> 过关 {recSummary.passed}
                            </Badge>
                            <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                              <XCircle className="h-3 w-3 mr-1" /> 重默 {recSummary.retest}
                            </Badge>
                            <Badge className="bg-slate-100 text-slate-500 hover:bg-slate-100">
                              <MinusCircle className="h-3 w-3 mr-1" /> 未测 {recSummary.untested}
                            </Badge>
                            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                              通过率 {recSummary.passRate.toFixed(1)}%
                            </Badge>
                          </div>

                          {/* 各篇目遍次明细 */}
                          <div className="overflow-x-auto rounded border">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b bg-slate-50">
                                  <th className="text-left px-3 py-2 font-medium text-slate-600 whitespace-nowrap">篇目</th>
                                  {recByItem[0]?.rounds.map((r) => (
                                    <th key={r.round.id} className="text-center px-2 py-2 font-medium text-slate-600 whitespace-nowrap">
                                      第{r.round.roundNumber}遍
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {recByItem.map(({ item, rounds }) => (
                                  <tr key={item.id} className="border-b last:border-0 hover:bg-slate-50">
                                    <td className="px-3 py-2 whitespace-nowrap">
                                      <Badge
                                        className={
                                          item.type === "诗歌"
                                            ? "bg-purple-100 text-purple-700 hover:bg-purple-100 text-xs mr-1"
                                            : item.type === "文言文原文"
                                            ? "bg-blue-100 text-blue-700 hover:bg-blue-100 text-xs mr-1"
                                            : "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-xs mr-1"
                                        }
                                      >
                                        {item.type}
                                      </Badge>
                                      <span className="text-sm">{item.title}</span>
                                    </td>
                                    {rounds.map(({ round, status }) => (
                                      <td key={round.id} className="px-2 py-2 text-center">
                                        <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${statusClass(status)}`}>
                                          {status}
                                        </span>
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {/* 成绩统计 */}
                  <div className="rounded-lg border">
                    <div className="flex items-center gap-2 px-3 py-2 border-b bg-slate-50">
                      <TrendingUp className="h-4 w-4 text-slate-500" />
                      <span className="text-sm font-medium">成绩统计</span>
                    </div>
                    {classRank ? (
                      <div className="px-3 py-2 bg-violet-50 border-b flex items-center justify-between">
                        <span className="text-sm font-medium text-violet-700">班级排名（{selected?.class}）</span>
                        <span className="text-sm">
                          <span className="text-lg font-bold text-violet-700">第 {classRank.rank} 名</span>
                          <span className="text-violet-500"> / 共 {classRank.total} 人</span>
                          <span className="text-xs text-violet-400 ml-1">（按平均折合分值）</span>
                        </span>
                      </div>
                    ) : (
                      <div className="px-3 py-2 bg-slate-50 border-b text-xs text-slate-400">
                        {selected?.class ? "本班暂无足够成绩数据计算排名" : "该学生未设置班级，无法计算班级排名（可在「学生名单」编辑班级）"}
                      </div>
                    )}
                    <div className="p-3 space-y-3">
                      {scoreSummary ? (
                        <>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <div className="rounded-lg border p-2 text-center bg-blue-50">
                              <div className="text-lg font-bold text-blue-600">{scoreSummary.avg.toFixed(1)}</div>
                              <div className="text-xs text-slate-500">绝对分值平均分</div>
                            </div>
                            <div className="rounded-lg border p-2 text-center bg-indigo-50">
                              <div className="text-lg font-bold text-indigo-600">{scoreSummary.avgConverted.toFixed(1)}</div>
                              <div className="text-xs text-slate-500">折合分值平均分</div>
                            </div>
                            <div className="rounded-lg border p-2 text-center bg-green-50">
                              <div className="text-lg font-bold text-green-600">{scoreSummary.max.toFixed(1)}</div>
                              <div className="text-xs text-slate-500">折合分值最高分</div>
                            </div>
                            <div className="rounded-lg border p-2 text-center bg-red-50">
                              <div className="text-lg font-bold text-red-500">{scoreSummary.min.toFixed(1)}</div>
                              <div className="text-xs text-slate-500">折合分值最低分</div>
                            </div>
                          </div>

                          {/* 对比试卷选择（点选加入/取消，影响下方趋势图横轴） */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-slate-500">对比试卷（点选）：</span>
                            {sortedExams.map((ex) => (
                              <button
                                key={ex.id}
                                onClick={() => toggleStudentExam(ex.id)}
                                className={`rounded-full px-2.5 py-1 text-xs border transition-colors ${
                                  studentExcluded.includes(ex.id)
                                    ? "border-slate-200 text-slate-400 bg-slate-50"
                                    : "border-blue-300 text-blue-700 bg-blue-50"
                                }`}
                              >
                                {ex.name}
                              </button>
                            ))}
                          </div>

                          {/* 折线图：折合分值趋势 */}
                          <div className="rounded-lg border p-3">
                            <div className="text-sm font-medium mb-2">{selected.name} 的折合分值趋势</div>
                            <ResponsiveContainer width="100%" height={220}>
                              <LineChart data={studentChartRows}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                                <Tooltip
                                  content={({ active, payload }) => {
                                    if (!active || !payload?.length) return null;
                                    const p = payload[0].payload as { name: string; date: string; score: number; examTotal: number; converted: number };
                                    return (
                                      <div className="rounded-lg border bg-white p-2 shadow text-sm">
                                        <div className="font-medium">{p.name}</div>
                                        <div className="text-slate-500 text-xs">{p.date}</div>
                                        <div>绝对分值：{p.score}/{p.examTotal}</div>
                                        <div>折合分值：{p.converted.toFixed(1)}</div>
                                      </div>
                                    );
                                  }}
                                />
                                <ReferenceLine y={60} stroke="#ef4444" strokeDasharray="5 5" label={{ value: "及格线(60)", position: "right", style: { fontSize: 10, fill: "#ef4444" } }} />
                                <ReferenceLine y={80} stroke="#22c55e" strokeDasharray="5 5" label={{ value: "优秀线(80)", position: "right", style: { fontSize: 10, fill: "#22c55e" } }} />
                                <Line type="monotone" dataKey="converted" stroke="#3b82f6" strokeWidth={2} dot={{ fill: "#3b82f6", r: 4 }} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>

                          {/* 各次成绩表 */}
                          <div className="rounded-lg border">
                            <div className="px-3 py-2 border-b bg-slate-50 text-sm font-medium">各次成绩</div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b">
                                    <th className="text-left px-3 py-2 font-medium text-slate-600">试卷</th>
                                    <th className="text-left px-3 py-2 font-medium text-slate-600">日期</th>
                                    <th className="text-center px-3 py-2 font-medium text-slate-600">绝对分值</th>
                                    <th className="text-center px-3 py-2 font-medium text-slate-600">折合分值</th>
                                    <th className="text-center px-3 py-2 font-medium text-slate-600">班级排名</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {scoreRows.map((p, i) => (
                                    <tr key={i} className="border-b last:border-0 hover:bg-slate-50">
                                      <td className="px-3 py-2">{p.name}</td>
                                      <td className="px-3 py-2 text-slate-500">{p.date}</td>
                                      <td className="px-3 py-2 text-center">{p.score}</td>
                                      <td className="px-3 py-2 text-center">
                                        <Badge className={convertedBadgeClass(p.converted)}>{p.converted.toFixed(1)}</Badge>
                                      </td>
                                      <td className="px-3 py-2 text-center">
                                        {p.rank ? `第${p.rank}名 / 共${p.total}人` : (selected.class ? "—" : "未分班")}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-slate-400 text-center py-4">暂无成绩记录</p>
                      )}
                    </div>
                  </div>

                  {/* 常错题目 */}
                  <div className="rounded-lg border">
                    <div className="flex items-center justify-between px-3 py-2 border-b bg-slate-50">
                      <div className="flex items-center gap-2">
                        <HelpCircle className="h-4 w-4 text-slate-500" />
                        <span className="text-sm font-medium">常错题目</span>
                        <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">{wrongQuestions.length}</Badge>
                      </div>
                      <Dialog open={addOpen} onOpenChange={setAddOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" disabled={data.questions.length === 0}>
                            <Plus className="h-4 w-4 mr-1" /> 添加
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>添加常错题目 — {selected.name}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-3">
                            <div className="relative">
                              <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-slate-400" />
                              <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="搜索题目内容 / 考点 / 主题"
                                className="pl-8"
                              />
                            </div>
                            {addCandidates.length === 0 ? (
                              <p className="text-sm text-slate-400 text-center py-6">
                                {data.questions.length === 0 ? "题库暂无题目" : "没有可添加的题目"}
                              </p>
                            ) : (
                              <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
                                {addCandidates.map((q) => (
                                  <button
                                    key={q.id}
                                    onClick={() => handleToggleWrong(q.id)}
                                    className="w-full text-left rounded-md border p-2 hover:bg-slate-50 transition-colors"
                                  >
                                    <div className="flex items-start gap-2">
                                      <Plus className="h-3.5 w-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                                      <div className="min-w-0">
                                        <div className="text-sm line-clamp-2">{q.content}</div>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {q.examPoints.map((t) => (
                                            <span key={t} className="text-xs bg-orange-50 text-orange-600 rounded px-1.5 py-0.5">
                                              {t}
                                            </span>
                                          ))}
                                          {q.themes.map((t) => (
                                            <span key={t} className="text-xs bg-teal-50 text-teal-600 rounded px-1.5 py-0.5">
                                              {t}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => { setSearch(""); setAddOpen(false); }}>
                              完成
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>

                    <div className="p-3">
                      {wrongQuestions.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-4">暂无标记的常错题目，点击右上角「添加」</p>
                      ) : (
                        <div className="space-y-2">
                          {wrongQuestions.map((q) => (
                            <div key={q.id} className="rounded-md border p-2.5">
                              <div className="flex items-start gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm">{q.content}</div>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {q.techniques.map((t) => (
                                      <span key={t} className="text-xs bg-cyan-50 text-cyan-600 rounded px-1.5 py-0.5">
                                        {t}
                                      </span>
                                    ))}
                                    {q.examPoints.map((t) => (
                                      <span key={t} className="text-xs bg-orange-50 text-orange-600 rounded px-1.5 py-0.5">
                                        {t}
                                      </span>
                                    ))}
                                    {q.themes.map((t) => (
                                      <span key={t} className="text-xs bg-teal-50 text-teal-600 rounded px-1.5 py-0.5">
                                        {t}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleToggleWrong(q.id)}
                                  className="text-slate-300 hover:text-red-500 flex-shrink-0"
                                  title="移除"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                              {q.answer && (
                                <div className="mt-1.5 text-xs text-slate-500">
                                  <span className="font-medium">答案：</span>
                                  {q.answer}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============ 班级档案 ============ */}
          {activeView === "class" && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <School className="h-5 w-5 text-slate-500" />
                  <h3 className="text-sm font-medium">班级档案</h3>
                </div>
                {classes.length === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 rounded-lg p-3">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    请在「学生名单」中给学生设置班级后，即可查看班级档案
                  </div>
                ) : (
                  <Select value={classSelected || ""} onValueChange={setClassSelected}>
                    <SelectTrigger className="w-full max-w-xs">
                      <SelectValue placeholder="选择班级查看档案" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {classes.length > 0 && !classSelected ? (
                <p className="text-sm text-slate-400 text-center py-6">请选择班级查看档案</p>
              ) : classExamRows.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">该班级暂无成绩记录</p>
              ) : (
                <div className="space-y-4">
                  {/* 概览卡片 */}
                  {classSummaryCards && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div className="rounded-lg border p-3 text-center">
                        <div className="text-xl font-bold text-slate-700">{classSummaryCards.exams}</div>
                        <div className="text-xs text-slate-500">参考考试数</div>
                      </div>
                      <div className="rounded-lg border p-3 text-center bg-blue-50">
                        <div className="text-xl font-bold text-blue-600">{classSummaryCards.participants}</div>
                        <div className="text-xs text-slate-500">平均参加人数</div>
                      </div>
                      <div className="rounded-lg border p-3 text-center bg-emerald-50">
                        <div className="text-xl font-bold text-emerald-600">{classSummaryCards.excellent}%</div>
                        <div className="text-xs text-slate-500">平均优秀率</div>
                      </div>
                      <div className="rounded-lg border p-3 text-center bg-amber-50">
                        <div className="text-xl font-bold text-amber-600">{classSummaryCards.pass}%</div>
                        <div className="text-xs text-slate-500">平均及格率</div>
                      </div>
                    </div>
                  )}

                  {/* 对比试卷选择（点选加入/取消，影响下方趋势图与趋势表横轴） */}
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="text-xs text-slate-500">对比试卷（点选）：</span>
                    {sortedExams.map((ex) => (
                      <button
                        key={ex.id}
                        onClick={() => toggleClassExam(ex.id)}
                        className={`rounded-full px-2.5 py-1 text-xs border transition-colors ${
                          classExcluded.includes(ex.id)
                            ? "border-slate-200 text-slate-400 bg-slate-50"
                            : "border-blue-300 text-blue-700 bg-blue-50"
                        }`}
                      >
                        {ex.name}
                      </button>
                    ))}
                  </div>

                  {/* 趋势图：优秀率 / 及格率 / 折合分值平均分 */}
                  <div className="rounded-lg border p-3">
                    <div className="text-sm font-medium mb-2">班级趋势（优秀率 · 及格率 · 折合分值平均分）</div>
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={classChartRows}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Legend />
                        <ReferenceLine y={60} stroke="#ef4444" strokeDasharray="5 5" />
                        <ReferenceLine y={80} stroke="#22c55e" strokeDasharray="5 5" />
                        <Line type="monotone" dataKey="excellentRate" name="优秀率" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="passRate" name="及格率" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="avgConverted" name="折合分值平均分" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* 趋势表：优秀率、及格率、折合分值平均分 */}
                  <div className="rounded-lg border">
                    <div className="px-3 py-2 border-b bg-slate-50 text-sm font-medium">变化趋势（优秀率 · 及格率 · 折合分值平均分）</div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left px-3 py-2 font-medium text-slate-600">试卷</th>
                            <th className="text-left px-3 py-2 font-medium text-slate-600">日期</th>
                            <th className="text-center px-3 py-2 font-medium text-slate-600">优秀率</th>
                            <th className="text-center px-3 py-2 font-medium text-slate-600">及格率</th>
                            <th className="text-center px-3 py-2 font-medium text-slate-600">折合分值平均分</th>
                          </tr>
                        </thead>
                        <tbody>
                          {classChartRows.map((r, i) => (
                            <tr key={i} className="border-b last:border-0 hover:bg-slate-50">
                              <td className="px-3 py-2">{r.name}</td>
                              <td className="px-3 py-2 text-slate-500">{r.date}</td>
                              <td className="px-3 py-2 text-center">{r.excellentRate}%</td>
                              <td className="px-3 py-2 text-center">{r.passRate}%</td>
                              <td className="px-3 py-2 text-center">{r.avgConverted}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 各次成绩表 */}
                  <div className="rounded-lg border">
                    <div className="px-3 py-2 border-b bg-slate-50 text-sm font-medium">各次成绩</div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left px-3 py-2 font-medium text-slate-600">试卷</th>
                            <th className="text-left px-3 py-2 font-medium text-slate-600">日期</th>
                            <th className="text-center px-3 py-2 font-medium text-slate-600">参加人数</th>
                            <th className="text-center px-3 py-2 font-medium text-slate-600">优秀率</th>
                            <th className="text-center px-3 py-2 font-medium text-slate-600">及格率</th>
                            <th className="text-center px-3 py-2 font-medium text-slate-600">绝对分值平均分</th>
                            <th className="text-center px-3 py-2 font-medium text-slate-600">绝对分值最高分</th>
                            <th className="text-center px-3 py-2 font-medium text-slate-600">绝对分值最低分</th>
                          </tr>
                        </thead>
                        <tbody>
                          {classExamRows.map((r, i) => (
                            <tr key={i} className="border-b last:border-0 hover:bg-slate-50">
                              <td className="px-3 py-2">{r.name}</td>
                              <td className="px-3 py-2 text-slate-500">{r.date}</td>
                              <td className="px-3 py-2 text-center">{r.participants}</td>
                              <td className="px-3 py-2 text-center">{r.excellentRate}%</td>
                              <td className="px-3 py-2 text-center">{r.passRate}%</td>
                              <td className="px-3 py-2 text-center font-medium">{r.avgScore}</td>
                              <td className="px-3 py-2 text-center text-green-600">{r.maxScore}</td>
                              <td className="px-3 py-2 text-center text-red-500">{r.minScore}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
