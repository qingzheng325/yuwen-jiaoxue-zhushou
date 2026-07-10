import { useState, useMemo } from "react";
import { useStore } from "@/store/useStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { exportToExcel, formatDate, todayStr } from "@/lib/io";
import { FileText, Plus, Trash2, Download, BarChart3, AlertCircle } from "lucide-react";

// 统计量辅助函数
function medianOf(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
// 前 80% 平均分：降序取前 80% 学生再求平均（用于剔除末端、反映主体水平）
function top80AvgOf(values: number[]): number {
  if (values.length === 0) return 0;
  const desc = [...values].sort((a, b) => b - a);
  const k = Math.max(1, Math.ceil(desc.length * 0.8));
  const slice = desc.slice(0, k);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

// 折合分值（满分100换算分，不带%）：绝对分值 / 满分 * 100
function toConverted(score: number, total: number): number {
  return total > 0 ? (score / total) * 100 : 0;
}
// 折合分值徽章配色：>80 优秀(绿)，>60 及格(蓝)，否则不及格(红)
function convertedBadgeClass(v: number): string {
  if (v >= 80) return "bg-green-100 text-green-700 hover:bg-green-100";
  if (v >= 60) return "bg-blue-100 text-blue-700 hover:bg-blue-100";
  return "bg-red-100 text-red-700 hover:bg-red-100";
}

export function ScoresModule() {
  const { data, addExam, deleteExam, upsertScore, batchImportScores } = useStore();
  const [newExamName, setNewExamName] = useState("");
  const [newExamDate, setNewExamDate] = useState(todayStr());
  const [newExamTotal, setNewExamTotal] = useState("100");
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"entry" | "stats" | "compare">("entry");
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [importText, setImportText] = useState("");
  const [importOpen, setImportOpen] = useState(false);

  const classes = useMemo(() => {
    const set = new Set(data.students.map((s) => (s.class || "").trim()).filter(Boolean));
    return Array.from(set).sort();
  }, [data.students]);

  const filteredStudents = useMemo(() => {
    if (selectedClass === "all") return data.students;
    return data.students.filter((s) => (s.class || "") === selectedClass);
  }, [data.students, selectedClass]);

  const selectedExam = data.exams.find((e) => e.id === selectedExamId);

  const handleAddExam = () => {
    if (!newExamName.trim() || !newExamTotal) return;
    const id = addExam({ name: newExamName.trim(), date: newExamDate, totalScore: parseInt(newExamTotal) });
    setSelectedExamId(id);
    setNewExamName("");
    setNewExamTotal("100");
  };

  const handleBatchImport = () => {
    if (!selectedExamId) return;
    const lines = importText.trim().split("\n");
    const scores: { studentId: string; score: number }[] = [];
    for (const line of lines) {
      const parts = line.trim().split(/[,，\t\s]+/);
      if (parts.length >= 2) {
        const name = parts[0];
        const score = parseFloat(parts[1]);
        const student = data.students.find((s) => s.name === name);
        if (student && !isNaN(score)) {
          scores.push({ studentId: student.id, score });
        }
      }
    }
    if (scores.length > 0) {
      batchImportScores(selectedExamId, scores);
      setImportText("");
      setImportOpen(false);
    } else {
      alert("未能匹配到任何学生，请检查格式：姓名,绝对分值");
    }
  };

  const handleExport = () => {
    if (!selectedExam) return;
    const records = data.scoreRecords.filter((r) => r.examId === selectedExam.id);
    const rows = data.students.map((s) => {
      const rec = records.find((r) => r.studentId === s.id);
      const score = rec?.score;
      const conv = score != null ? toConverted(score, selectedExam.totalScore).toFixed(1) : "";
      return {
        班级: s.class || "",
        学号: s.studentNo || "",
        姓名: s.name,
        绝对分值: score ?? "",
        折合分值: conv !== "" ? conv : "",
      };
    });
    exportToExcel([{ name: selectedExam.name, data: rows }], `成绩_${selectedExam.name}_${formatDate(selectedExam.date)}.xlsx`);
  };

  // 单次考试统计（受班级筛选影响）—— 平均分/中位数/前80%等用「绝对分值」；优秀率/及格率基于「折合分值」
  const examStats = useMemo(() => {
    if (!selectedExam) return null;
    const classStudentIds = new Set(filteredStudents.map((s) => s.id));
    const records = data.scoreRecords.filter(
      (r) => r.examId === selectedExam.id && classStudentIds.has(r.studentId)
    );
    const scores = records.map((r) => r.score);
    if (scores.length === 0) return null;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const max = Math.max(...scores);
    const min = Math.min(...scores);
    const avgPct = toConverted(avg, selectedExam.totalScore);
    // 及格率：折合分值 >= 60 的人数占比
    const passCount = scores.filter((s) => toConverted(s, selectedExam.totalScore) >= 60).length;
    const passRate = (passCount / scores.length) * 100;
    // 优秀率：折合分值 >= 80 的人数占比
    const excellentRate = (scores.filter((s) => toConverted(s, selectedExam.totalScore) >= 80).length / scores.length) * 100;
    // 中位数 / 前80%平均分（单次考试用「绝对分值」）
    const median = medianOf(scores);
    const top80Avg = top80AvgOf(scores);

    // 分数段分布（按折合分值）
    const ranges = [
      { label: "0-39", min: 0, max: 39, count: 0 },
      { label: "40-59", min: 40, max: 59, count: 0 },
      { label: "60-69", min: 60, max: 69, count: 0 },
      { label: "70-79", min: 70, max: 79, count: 0 },
      { label: "80-89", min: 80, max: 89, count: 0 },
      { label: "90-100", min: 90, max: 100, count: 0 },
    ];
    for (const s of scores) {
      const pct = toConverted(s, selectedExam.totalScore);
      for (const r of ranges) {
        if (pct >= r.min && pct <= r.max) { r.count++; break; }
      }
    }
    return { avg, max, min, avgPct, passRate, excellentRate, median, top80Avg, count: scores.length, ranges, total: selectedExam.totalScore };
  }, [selectedExam, data.scoreRecords, filteredStudents]);

  return (
    <div className="space-y-4">
      {/* 班级筛选 */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-slate-500">班级</span>
        <Select value={selectedClass} onValueChange={setSelectedClass}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="全部班级" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部班级</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {classes.length === 0 && (
          <span className="text-xs text-slate-400">（在「学生名单」中给学生设置班级后，即可按班级查看与分析）</span>
        )}
      </div>

      <div className="border-t pt-4">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="h-5 w-5 text-slate-500" />
          <h3 className="text-sm font-medium">试卷管理</h3>
        </div>

        <div className="flex gap-2 mb-3 flex-wrap">
          <Input
            value={newExamName}
            onChange={(e) => setNewExamName(e.target.value)}
            placeholder="试卷名称，如：期中考试"
            className="flex-1 min-w-[150px]"
          />
          <Input
            type="date"
            value={newExamDate}
            onChange={(e) => setNewExamDate(e.target.value)}
            className="w-[150px]"
          />
          <Input
            type="number"
            value={newExamTotal}
            onChange={(e) => setNewExamTotal(e.target.value)}
            placeholder="满分"
            className="w-[90px]"
          />
          <Button onClick={handleAddExam} disabled={!newExamName.trim()}>
            <Plus className="h-4 w-4 mr-1" /> 添加
          </Button>
        </div>

        {data.exams.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">暂无试卷，请添加</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.exams.map((exam) => (
              <div
                key={exam.id}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 cursor-pointer transition-colors ${
                  selectedExamId === exam.id ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:border-slate-300"
                }`}
                onClick={() => { setSelectedExamId(exam.id); setViewMode("entry"); }}
              >
                <span className="text-sm">{exam.name}</span>
                <Badge variant="outline" className="text-xs">{exam.totalScore}分</Badge>
                <span className="text-xs text-slate-400">{exam.date}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteExam(exam.id); if (selectedExamId === exam.id) setSelectedExamId(null); }}
                  className="text-slate-300 hover:text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedExam && (
        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="text-sm font-medium">{selectedExam.name}（满分{selectedExam.totalScore}分）</h3>
            <div className="flex gap-2">
              <Button size="sm" variant={viewMode === "entry" ? "default" : "outline"} onClick={() => setViewMode("entry")}>录入</Button>
              <Button size="sm" variant={viewMode === "stats" ? "default" : "outline"} onClick={() => setViewMode("stats")}>
                <BarChart3 className="h-4 w-4 mr-1" /> 统计
              </Button>
              <Button size="sm" variant={viewMode === "compare" ? "default" : "outline"} onClick={() => setViewMode("compare")}>
                <BarChart3 className="h-4 w-4 mr-1" /> 班级对比
              </Button>
              <Dialog open={importOpen} onOpenChange={setImportOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-1" /> 批量导入
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>批量导入成绩 — {selectedExam.name}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-2">
                    <Label>每行格式：姓名,绝对分值</Label>
                    <Textarea
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      placeholder={"张三,56\n李四,63\n王五,48"}
                      rows={8}
                    />
                    <p className="text-xs text-slate-400">注意：姓名需与名单中一致，将覆盖已有成绩。折合分值将按「绝对分值 ÷ 满分 × 100」自动计算。</p>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setImportOpen(false)}>取消</Button>
                    <Button onClick={handleBatchImport} disabled={!importText.trim()}>导入</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button size="sm" variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-1" /> 导出
              </Button>
            </div>
          </div>

          {viewMode === "entry" && (
            <ScoreEntryTable
              examId={selectedExam.id}
              totalScore={selectedExam.totalScore}
              students={filteredStudents}
              records={data.scoreRecords.filter((r) => r.examId === selectedExam.id)}
              onSave={upsertScore}
            />
          )}

          {viewMode === "stats" && examStats && (
            <ExamStats stats={examStats} />
          )}
          {viewMode === "stats" && !examStats && (
            <p className="text-sm text-slate-400 text-center py-8">暂无成绩数据</p>
          )}

          {viewMode === "compare" && selectedExam && (
            <ClassCompare exam={selectedExam} students={data.students} scoreRecords={data.scoreRecords} />
          )}
        </div>
      )}
    </div>
  );
}

function ScoreEntryTable({
  examId,
  totalScore,
  students,
  records,
  onSave,
}: {
  examId: string;
  totalScore: number;
  students: { id: string; name: string; studentNo?: string; class?: string }[];
  records: { id: string; examId: string; studentId: string; score: number }[];
  onSave: (examId: string, studentId: string, score: number) => void;
}) {
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const handleSave = (studentId: string) => {
    const val = editValues[studentId];
    if (val === undefined || val === "") return;
    const score = parseFloat(val);
    if (!isNaN(score)) {
      onSave(examId, studentId, score);
      setEditValues((prev) => {
        const next = { ...prev };
        delete next[studentId];
        return next;
      });
    }
  };

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-slate-50">
            <th className="text-left px-3 py-2 font-medium text-slate-600">班级</th>
            <th className="text-left px-3 py-2 font-medium text-slate-600">学号</th>
            <th className="text-left px-3 py-2 font-medium text-slate-600">姓名</th>
            <th className="text-center px-3 py-2 font-medium text-slate-600">绝对分值</th>
            <th className="text-center px-3 py-2 font-medium text-slate-600">折合分值</th>
            <th className="text-center px-3 py-2 font-medium text-slate-600">操作</th>
          </tr>
        </thead>
        <tbody>
          {students.map((student) => {
            const rec = records.find((r) => r.studentId === student.id);
            const editVal = editValues[student.id];
            const displayScore = editVal !== undefined ? editVal : rec?.score?.toString() ?? "";
            const conv = rec ? toConverted(rec.score, totalScore) : null;
            return (
              <tr key={student.id} className="border-b last:border-0 hover:bg-slate-50">
                <td className="px-3 py-2 text-slate-400">{student.class || "-"}</td>
                <td className="px-3 py-2 text-slate-500">{student.studentNo || "-"}</td>
                <td className="px-3 py-2 font-medium">{student.name}</td>
                <td className="px-3 py-2 text-center">
                  <Input
                    type="number"
                    value={displayScore}
                    onChange={(e) => setEditValues((prev) => ({ ...prev, [student.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && handleSave(student.id)}
                    className="w-20 text-center"
                    placeholder="—"
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  {conv != null && (
                    <Badge className={convertedBadgeClass(conv)}>
                      {conv.toFixed(1)}
                    </Badge>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  <Button size="sm" variant="ghost" className="h-7" onClick={() => handleSave(student.id)} disabled={editVal === undefined || editVal === ""}>
                    保存
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {students.length === 0 && <p className="text-sm text-slate-400 text-center py-4">请先在「学生名单」模块添加学生</p>}
    </div>
  );
}

function ExamStats({ stats }: {
  stats: {
    avg: number; max: number; min: number; avgPct: number; passRate: number; excellentRate: number;
    median: number; top80Avg: number;
    count: number; total: number;
    ranges: { label: string; count: number }[];
  };
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border p-3 text-center">
          <div className="text-xl font-bold text-slate-700">{stats.count}</div>
          <div className="text-xs text-slate-500">参考人数</div>
        </div>
        <div className="rounded-lg border p-3 text-center bg-blue-50">
          <div className="text-xl font-bold text-blue-600">{stats.avg.toFixed(1)}</div>
          <div className="text-xs text-slate-500">平均分（绝对分值）</div>
        </div>
        <div className="rounded-lg border p-3 text-center bg-cyan-50">
          <div className="text-xl font-bold text-cyan-600">{stats.median.toFixed(1)}</div>
          <div className="text-xs text-slate-500">中位数（绝对分值）</div>
        </div>
        <div className="rounded-lg border p-3 text-center bg-teal-50">
          <div className="text-xl font-bold text-teal-600">{stats.top80Avg.toFixed(1)}</div>
          <div className="text-xs text-slate-500">前80%平均分</div>
        </div>
        <div className="rounded-lg border p-3 text-center bg-green-50">
          <div className="text-xl font-bold text-green-600">{stats.max}</div>
          <div className="text-xs text-slate-500">最高分</div>
        </div>
        <div className="rounded-lg border p-3 text-center bg-red-50">
          <div className="text-xl font-bold text-red-500">{stats.min}</div>
          <div className="text-xs text-slate-500">最低分</div>
        </div>
        <div className="rounded-lg border p-3 text-center bg-emerald-50">
          <div className="text-xl font-bold text-emerald-600">{stats.excellentRate.toFixed(1)}%</div>
          <div className="text-xs text-slate-500">优秀率（折合分值≥80）</div>
        </div>
        <div className="rounded-lg border p-3 text-center bg-amber-50">
          <div className="text-xl font-bold text-amber-600">{stats.passRate.toFixed(1)}%</div>
          <div className="text-xs text-slate-500">及格率（折合分值≥60）</div>
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <h4 className="text-sm font-medium mb-3">分数段分布（折合分值）</h4>
        <div className="space-y-2">
          {stats.ranges.map((r) => {
            const maxCount = Math.max(...stats.ranges.map((x) => x.count), 1);
            const width = (r.count / maxCount) * 100;
            return (
              <div key={r.label} className="flex items-center gap-3">
                <span className="text-xs text-slate-500 w-16 text-right">{r.label}</span>
                <div className="flex-1 h-6 rounded bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded transition-all ${
                      r.label.startsWith("9") || r.label.startsWith("8") ? "bg-green-500"
                      : r.label.startsWith("7") || r.label.startsWith("6") ? "bg-blue-500"
                      : "bg-red-400"
                    }`}
                    style={{ width: `${width}%` }}
                  />
                </div>
                <span className="text-xs text-slate-600 w-8">{r.count}人</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">平均折合分值</span>
          <span className="text-sm font-bold text-blue-600">{stats.avgPct.toFixed(1)}</span>
        </div>
        <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${stats.avgPct}%` }} />
        </div>
      </div>
    </div>
  );
}

// 班级对比：仅展示本次考试的班级汇总（班级 / 参加人数 / 优秀率 / 及格率 / 绝对分值平均分 / 最高分 / 最低分）
function ClassCompare({
  exam,
  students,
  scoreRecords,
}: {
  exam: { id: string; name: string; date: string; totalScore: number };
  students: { id: string; name: string; class?: string }[];
  scoreRecords: { id: string; examId: string; studentId: string; score: number }[];
}) {
  const classList = useMemo(() => {
    const set = new Set(students.map((s) => (s.class || "").trim()).filter(Boolean));
    return Array.from(set).sort();
  }, [students]);

  const studentById = useMemo(() => {
    const m: Record<string, { id: string; name: string; class?: string }> = {};
    students.forEach((s) => (m[s.id] = s));
    return m;
  }, [students]);

  const classSummary = useMemo(() => {
    return classList.map((c) => {
      const recs = scoreRecords.filter(
        (r) => r.examId === exam.id && (studentById[r.studentId]?.class || "") === c
      );
      const participants = recs.length;
      if (participants === 0) {
        return { class: c, participants: 0, excellentRate: 0, passRate: 0, avgScore: 0, maxScore: 0, minScore: 0 };
      }
      const scores = recs.map((r) => r.score);
      const converted = recs.map((r) => toConverted(r.score, exam.totalScore));
      const excellentRate = (converted.filter((v) => v >= 80).length / participants) * 100;
      const passRate = (converted.filter((v) => v >= 60).length / participants) * 100;
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      const maxScore = Math.max(...scores);
      const minScore = Math.min(...scores);
      return {
        class: c,
        participants,
        excellentRate: parseFloat(excellentRate.toFixed(1)),
        passRate: parseFloat(passRate.toFixed(1)),
        avgScore: parseFloat(avgScore.toFixed(1)),
        maxScore,
        minScore,
      };
    });
  }, [classList, exam, scoreRecords, studentById]);

  if (classList.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 rounded-lg p-4">
        <AlertCircle className="h-4 w-4 flex-shrink-0" />
        暂无班级数据。请先在「学生名单」中给学生设置班级，即可在此对比各班成绩。
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border">
        <div className="px-3 py-2 border-b bg-slate-50 text-sm font-medium">
          班级汇总 — {exam.name}（满分{exam.totalScore}分，优秀率=折合分值≥80，及格率=折合分值≥60）
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left px-3 py-2 font-medium text-slate-600">班级</th>
                <th className="text-center px-3 py-2 font-medium text-slate-600">参加人数</th>
                <th className="text-center px-3 py-2 font-medium text-slate-600">优秀率</th>
                <th className="text-center px-3 py-2 font-medium text-slate-600">及格率</th>
                <th className="text-center px-3 py-2 font-medium text-slate-600">绝对分值平均分</th>
                <th className="text-center px-3 py-2 font-medium text-slate-600">绝对分值最高分</th>
                <th className="text-center px-3 py-2 font-medium text-slate-600">绝对分值最低分</th>
              </tr>
            </thead>
            <tbody>
              {classSummary.map((row) => (
                <tr key={row.class} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium">{row.class}</td>
                  <td className="px-3 py-2 text-center">{row.participants}</td>
                  <td className="px-3 py-2 text-center">{row.excellentRate}%</td>
                  <td className="px-3 py-2 text-center">{row.passRate}%</td>
                  <td className="px-3 py-2 text-center font-medium">{row.avgScore}</td>
                  <td className="px-3 py-2 text-center text-green-600">{row.maxScore}</td>
                  <td className="px-3 py-2 text-center text-red-500">{row.minScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
