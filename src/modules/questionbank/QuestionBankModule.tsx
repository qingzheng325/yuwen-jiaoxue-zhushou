import { useState, useMemo, useRef } from "react";
import { useStore } from "@/store/useStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { exportToExcel } from "@/lib/io";
import * as XLSX from "xlsx";
import type { Question } from "@/types";
import { ConfirmDialog } from "@/modules/common/ConfirmDialog";
import { Library, Plus, Trash2, Download, Upload, Filter, Tag, X, ChevronDown, ChevronRight, Search, Pencil } from "lucide-react";

export function QuestionBankModule() {
  const { data, addQuestion, addQuestions, updateQuestion, deleteQuestion, addTag, removeTag } = useStore();
  const [selectedExamPoints, setSelectedExamPoints] = useState<string[]>([]);
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [searchText, setSearchText] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [tagMgrOpen, setTagMgrOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [deleteQuestionTarget, setDeleteQuestionTarget] = useState<Question | null>(null);

  const allTypes = useMemo(() => {
    const types = new Set(data.questions.map((q) => q.type).filter(Boolean));
    return Array.from(types);
  }, [data.questions]);

  const filteredQuestions = useMemo(() => {
    return data.questions.filter((q) => {
      // Search text
      if (searchText.trim()) {
        const text = searchText.toLowerCase();
        const matchContent = q.content.toLowerCase().includes(text);
        const matchAnswer = q.answer?.toLowerCase().includes(text);
        const matchAnalysis = q.analysis?.toLowerCase().includes(text);
        const matchSource = q.source?.toLowerCase().includes(text);
        if (!matchContent && !matchAnswer && !matchAnalysis && !matchSource) return false;
      }
      // Type filter
      if (selectedType !== "all" && q.type !== selectedType) return false;
      // Exam point filter (AND: must have all selected)
      if (selectedExamPoints.length > 0) {
        if (!selectedExamPoints.every((t) => q.examPoints.includes(t))) return false;
      }
      // Theme filter (AND: must have all selected)
      if (selectedThemes.length > 0) {
        if (!selectedThemes.every((t) => q.themes.includes(t))) return false;
      }
      return true;
    });
  }, [data.questions, searchText, selectedType, selectedExamPoints, selectedThemes]);

  const toggleExamPoint = (tag: string) => {
    setSelectedExamPoints((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  };
  const toggleTheme = (tag: string) => {
    setSelectedThemes((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  };

  const handleExport = () => {
    if (filteredQuestions.length === 0) return;
    exportToExcel(
      [{
        name: "题目",
        data: filteredQuestions.map((q) => ({
          题目内容: q.content,
          题型: q.type,
          考点: q.examPoints.join("、"),
          主题: q.themes.join("、"),
          答案: q.answer || "",
          解析: q.analysis || "",
          来源: q.source || "",
        })),
      }],
      `题库导出_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
      const questions: Omit<Question, "id">[] = rows.map((row) => {
        const content = String(row["题目内容"] || row["题目"] || row["content"] || "").trim();
        const type = String(row["题型"] || row["type"] || "其他").trim();
        const examPoints = String(row["考点"] || "").split(/[、,，;；\s]+/).filter(Boolean);
        const themes = String(row["主题"] || "").split(/[、,，;；\s]+/).filter(Boolean);
        const answer = String(row["答案"] || row["answer"] || "").trim() || undefined;
        const analysis = String(row["解析"] || row["analysis"] || "").trim() || undefined;
        const source = String(row["来源"] || row["source"] || "").trim() || undefined;
        return { content, type, examPoints, themes, answer, analysis, source };
      }).filter((q) => q.content);
      if (questions.length > 0) {
        // Auto-add new tags
        for (const q of questions) {
          for (const t of q.examPoints) addTag("考点", t);
          for (const t of q.themes) addTag("主题", t);
        }
        addQuestions(questions);
        alert(`成功导入 ${questions.length} 道题目`);
      } else {
        alert("未找到有效题目，请检查Excel格式");
      }
    } catch (err) {
      console.error(err);
      alert("文件解析失败");
    }
    if (fileRef.current) fileRef.current.value = "";
    setImportOpen(false);
  };

  const handleSaveQuestion = (qData: Omit<Question, "id">) => {
    // Auto-add new tags
    for (const t of qData.examPoints) addTag("考点", t);
    for (const t of qData.themes) addTag("主题", t);

    if (editingQuestion) {
      updateQuestion(editingQuestion.id, qData);
    } else {
      addQuestion(qData);
    }
    setEditOpen(false);
    setEditingQuestion(null);
  };

  const examPointGroup = data.tagGroups.find((g) => g.name === "考点");
  const themeGroup = data.tagGroups.find((g) => g.name === "主题");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Library className="h-5 w-5 text-slate-500" />
          <h3 className="text-sm font-medium">题库管理 ({data.questions.length}题)</h3>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { setEditingQuestion(null); setEditOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> 添加题目
          </Button>
          <Dialog open={importOpen} onOpenChange={setImportOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Upload className="h-4 w-4 mr-1" /> 导入
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>从 Excel 导入题目</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                <Label>上传 Excel 文件</Label>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileImport}
                  className="block w-full text-sm text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                />
                <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-500 space-y-1">
                  <p className="font-medium text-slate-600">Excel 列格式：</p>
                  <p>题目内容 | 题型 | 考点 | 主题 | 答案 | 解析 | 来源</p>
                  <p>考点和主题可用"、"分隔多个标签</p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Button size="sm" variant="outline" onClick={handleExport} disabled={filteredQuestions.length === 0}>
            <Download className="h-4 w-4 mr-1" /> 导出 ({filteredQuestions.length})
          </Button>
          <Button size="sm" variant="outline" onClick={() => setTagMgrOpen(true)}>
            <Tag className="h-4 w-4 mr-1" /> 标签管理
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-lg border p-3 space-y-3 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-600">筛选</span>
          {(selectedExamPoints.length > 0 || selectedThemes.length > 0 || selectedType !== "all" || searchText) && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs text-slate-400"
              onClick={() => { setSelectedExamPoints([]); setSelectedThemes([]); setSelectedType("all"); setSearchText(""); }}
            >
              清除筛选
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="搜索题目内容、答案、解析..."
            className="pl-8"
          />
        </div>

        {/* Type filter */}
        {allTypes.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-500 w-12">题型</span>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="h-7 w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                {allTypes.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Exam point tags */}
        {examPointGroup && examPointGroup.tags.length > 0 && (
          <div className="flex items-start gap-2">
            <span className="text-xs text-slate-500 w-12 mt-1.5">考点</span>
            <div className="flex flex-wrap gap-1.5 flex-1">
              {examPointGroup.tags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleExamPoint(tag)}
                  className={`rounded-md px-2 py-1 text-xs transition-colors ${
                    selectedExamPoints.includes(tag)
                      ? "bg-blue-500 text-white"
                      : "bg-white border border-slate-200 text-slate-600 hover:border-blue-300"
                  }`}
                >
                  {tag}
                  {selectedExamPoints.includes(tag) && <span className="ml-1">✓</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Theme tags */}
        {themeGroup && themeGroup.tags.length > 0 && (
          <div className="flex items-start gap-2">
            <span className="text-xs text-slate-500 w-12 mt-1.5">主题</span>
            <div className="flex flex-wrap gap-1.5 flex-1">
              {themeGroup.tags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTheme(tag)}
                  className={`rounded-md px-2 py-1 text-xs transition-colors ${
                    selectedThemes.includes(tag)
                      ? "bg-purple-500 text-white"
                      : "bg-white border border-slate-200 text-slate-600 hover:border-purple-300"
                  }`}
                >
                  {tag}
                  {selectedThemes.includes(tag) && <span className="ml-1">✓</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Selected filters summary */}
        {(selectedExamPoints.length > 0 || selectedThemes.length > 0) && (
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <span className="text-xs text-slate-400">已选标签：</span>
            {selectedExamPoints.map((t) => (
              <Badge key={`ep-${t}`} className="bg-blue-100 text-blue-700 hover:bg-blue-100 gap-1">
                考点:{t}
                <button onClick={() => toggleExamPoint(t)}><X className="h-3 w-3" /></button>
              </Badge>
            ))}
            {selectedThemes.map((t) => (
              <Badge key={`th-${t}`} className="bg-purple-100 text-purple-700 hover:bg-purple-100 gap-1">
                主题:{t}
                <button onClick={() => toggleTheme(t)}><X className="h-3 w-3" /></button>
              </Badge>
            ))}
            <span className="text-xs text-slate-400">（同类别为"且"关系，多类别叠加筛选）</span>
          </div>
        )}
      </div>

      {/* Question list */}
      <div className="space-y-2">
        {filteredQuestions.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">
            {data.questions.length === 0 ? "暂无题目，请添加或导入" : "无匹配题目"}
          </p>
        ) : (
          filteredQuestions.map((q, idx) => (
            <QuestionCard
              key={q.id}
              question={q}
              index={idx + 1}
              onEdit={() => { setEditingQuestion(q); setEditOpen(true); }}
              onDelete={() => setDeleteQuestionTarget(q)}
            />
          ))
        )}
      </div>

      {/* Edit dialog */}
      <QuestionEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        question={editingQuestion}
        onSave={handleSaveQuestion}
        examPointTags={examPointGroup?.tags || []}
        themeTags={themeGroup?.tags || []}
        onAddExamPointTag={(t) => addTag("考点", t)}
        onAddThemeTag={(t) => addTag("主题", t)}
      />

      {/* Tag manager */}
      <TagManagerDialog
        open={tagMgrOpen}
        onOpenChange={setTagMgrOpen}
        examPointTags={examPointGroup?.tags || []}
        themeTags={themeGroup?.tags || []}
        onAddExamPointTag={(t) => addTag("考点", t)}
        onAddThemeTag={(t) => addTag("主题", t)}
        onRemoveExamPointTag={(t) => removeTag("考点", t)}
        onRemoveThemeTag={(t) => removeTag("主题", t)}
      />

      <ConfirmDialog
        open={!!deleteQuestionTarget}
        title="确认删除题目"
        description={deleteQuestionTarget ? `将删除第 ${deleteQuestionTarget.id.slice(-4)} 号题目，此操作不可恢复。` : ""}
        confirmText="删除"
        onConfirm={() => {
          if (deleteQuestionTarget) deleteQuestion(deleteQuestionTarget.id);
          setDeleteQuestionTarget(null);
        }}
        onCancel={() => setDeleteQuestionTarget(null)}
      />
    </div>
  );
}

function QuestionCard({
  question,
  index,
  onEdit,
  onDelete,
}: {
  question: Question;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border p-3 hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3">
        <span className="text-xs text-slate-400 mt-0.5 whitespace-nowrap">#{index}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            {question.type && <Badge variant="outline" className="text-xs">{question.type}</Badge>}
            <p className={`text-sm flex-1 ${expanded ? "" : "line-clamp-2"}`}>{question.content}</p>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1 mt-2">
            {question.examPoints.map((t) => (
              <span key={t} className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-600">{t}</span>
            ))}
            {question.themes.map((t) => (
              <span key={t} className="rounded bg-purple-50 px-1.5 py-0.5 text-xs text-purple-600">{t}</span>
            ))}
            {question.source && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">来源: {question.source}</span>
            )}
          </div>

          {/* Answer & Analysis (expandable) */}
          {expanded && (question.answer || question.analysis) && (
            <div className="mt-2 space-y-1.5 border-t pt-2">
              {question.answer && (
                <div className="text-sm">
                  <span className="text-xs font-medium text-green-600">答案：</span>
                  <span className="text-slate-700">{question.answer}</span>
                </div>
              )}
              {question.analysis && (
                <div className="text-sm">
                  <span className="text-xs font-medium text-slate-500">解析：</span>
                  <span className="text-slate-600">{question.analysis}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 mt-2">
            {(question.answer || question.analysis) && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-slate-400 hover:text-slate-600 flex items-center"
              >
                {expanded ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {expanded ? "收起" : "展开"}
              </button>
            )}
            <button onClick={onEdit} className="text-xs text-blue-500 hover:text-blue-600 flex items-center">
              <Pencil className="h-3 w-3 mr-0.5" /> 编辑
            </button>
            <button onClick={onDelete} className="text-xs text-red-400 hover:text-red-500 flex items-center">
              <Trash2 className="h-3 w-3 mr-0.5" /> 删除
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuestionEditDialog({
  open,
  onOpenChange,
  question,
  onSave,
  examPointTags,
  themeTags,
  onAddExamPointTag,
  onAddThemeTag,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question: Question | null;
  onSave: (q: Omit<Question, "id">) => void;
  examPointTags: string[];
  themeTags: string[];
  onAddExamPointTag: (t: string) => void;
  onAddThemeTag: (t: string) => void;
}) {
  const [content, setContent] = useState("");
  const [type, setType] = useState("其他");
  const [answer, setAnswer] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [source, setSource] = useState("");
  const [examPoints, setExamPoints] = useState<string[]>([]);
  const [themes, setThemes] = useState<string[]>([]);
  const [newExamPoint, setNewExamPoint] = useState("");
  const [newTheme, setNewTheme] = useState("");

  // Sync when dialog opens
  useMemo(() => {
    if (open) {
      setContent(question?.content || "");
      setType(question?.type || "其他");
      setAnswer(question?.answer || "");
      setAnalysis(question?.analysis || "");
      setSource(question?.source || "");
      setExamPoints(question?.examPoints || []);
      setThemes(question?.themes || []);
      setNewExamPoint("");
      setNewTheme("");
    }
  }, [open, question]);

  const handleSave = () => {
    if (!content.trim()) return;
    onSave({
      content: content.trim(),
      type: type.trim() || "其他",
      answer: answer.trim() || undefined,
      analysis: analysis.trim() || undefined,
      source: source.trim() || undefined,
      examPoints,
      themes,
    });
  };

  const toggleArr = (arr: string[], val: string, setter: (v: string[]) => void) => {
    setter(arr.includes(val) ? arr.filter((t) => t !== val) : [...arr, val]);
  };

  const handleAddNewExamPoint = () => {
    const t = newExamPoint.trim();
    if (t && !examPoints.includes(t)) {
      setExamPoints([...examPoints, t]);
      onAddExamPointTag(t);
      setNewExamPoint("");
    }
  };

  const handleAddNewTheme = () => {
    const t = newTheme.trim();
    if (t && !themes.includes(t)) {
      setThemes([...themes, t]);
      onAddThemeTag(t);
      setNewTheme("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{question ? "编辑题目" : "添加题目"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>题目内容 *</Label>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4} className="mt-1" placeholder="输入题目内容" />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <Label>题型</Label>
              <Input value={type} onChange={(e) => setType(e.target.value)} className="mt-1" placeholder="如：选择题、填空题" />
            </div>
            <div className="flex-1">
              <Label>来源</Label>
              <Input value={source} onChange={(e) => setSource(e.target.value)} className="mt-1" placeholder="如：2024年中考真题" />
            </div>
          </div>
          <div>
            <Label>答案</Label>
            <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={2} className="mt-1" placeholder="参考答案" />
          </div>
          <div>
            <Label>解析</Label>
            <Textarea value={analysis} onChange={(e) => setAnalysis(e.target.value)} rows={2} className="mt-1" placeholder="题目解析" />
          </div>

          {/* Exam points */}
          <div>
            <Label>考点标签</Label>
            <div className="flex flex-wrap gap-1.5 mt-1 mb-2">
              {examPoints.map((t) => (
                <Badge key={t} className="bg-blue-500 text-white hover:bg-blue-500 gap-1">
                  {t}
                  <button onClick={() => setExamPoints(examPoints.filter((x) => x !== t))}><X className="h-3 w-3" /></button>
                </Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-1 mb-2">
              {examPointTags.filter((t) => !examPoints.includes(t)).map((t) => (
                <button
                  key={t}
                  onClick={() => toggleArr(examPoints, t, setExamPoints)}
                  className="rounded-md border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:border-blue-300"
                >
                  + {t}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              <Input
                value={newExamPoint}
                onChange={(e) => setNewExamPoint(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddNewExamPoint()}
                placeholder="输入新考点标签"
                className="h-8 text-sm"
              />
              <Button size="sm" variant="outline" onClick={handleAddNewExamPoint}>添加</Button>
            </div>
          </div>

          {/* Themes */}
          <div>
            <Label>主题标签</Label>
            <div className="flex flex-wrap gap-1.5 mt-1 mb-2">
              {themes.map((t) => (
                <Badge key={t} className="bg-purple-500 text-white hover:bg-purple-500 gap-1">
                  {t}
                  <button onClick={() => setThemes(themes.filter((x) => x !== t))}><X className="h-3 w-3" /></button>
                </Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-1 mb-2">
              {themeTags.filter((t) => !themes.includes(t)).map((t) => (
                <button
                  key={t}
                  onClick={() => toggleArr(themes, t, setThemes)}
                  className="rounded-md border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:border-purple-300"
                >
                  + {t}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              <Input
                value={newTheme}
                onChange={(e) => setNewTheme(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddNewTheme()}
                placeholder="输入新主题标签"
                className="h-8 text-sm"
              />
              <Button size="sm" variant="outline" onClick={handleAddNewTheme}>添加</Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSave} disabled={!content.trim()}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TagManagerDialog({
  open,
  onOpenChange,
  examPointTags,
  themeTags,
  onAddExamPointTag,
  onAddThemeTag,
  onRemoveExamPointTag,
  onRemoveThemeTag,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  examPointTags: string[];
  themeTags: string[];
  onAddExamPointTag: (t: string) => void;
  onAddThemeTag: (t: string) => void;
  onRemoveExamPointTag: (t: string) => void;
  onRemoveThemeTag: (t: string) => void;
}) {
  const [newEP, setNewEP] = useState("");
  const [newTH, setNewTH] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>标签管理</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>考点标签</Label>
            <div className="flex flex-wrap gap-1.5 mt-2 mb-2">
              {examPointTags.map((t) => (
                <Badge key={t} className="bg-blue-100 text-blue-700 hover:bg-blue-100 gap-1">
                  {t}
                  <button onClick={() => onRemoveExamPointTag(t)}><X className="h-3 w-3" /></button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-1">
              <Input value={newEP} onChange={(e) => setNewEP(e.target.value)} onKeyDown={(e) => e.key === "Enter" && newEP.trim() && (onAddExamPointTag(newEP.trim()), setNewEP(""))} placeholder="新考点标签" className="h-8" />
              <Button size="sm" variant="outline" onClick={() => { if (newEP.trim()) { onAddExamPointTag(newEP.trim()); setNewEP(""); } }}>添加</Button>
            </div>
          </div>
          <div>
            <Label>主题标签</Label>
            <div className="flex flex-wrap gap-1.5 mt-2 mb-2">
              {themeTags.map((t) => (
                <Badge key={t} className="bg-purple-100 text-purple-700 hover:bg-purple-100 gap-1">
                  {t}
                  <button onClick={() => onRemoveThemeTag(t)}><X className="h-3 w-3" /></button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-1">
              <Input value={newTH} onChange={(e) => setNewTH(e.target.value)} onKeyDown={(e) => e.key === "Enter" && newTH.trim() && (onAddThemeTag(newTH.trim()), setNewTH(""))} placeholder="新主题标签" className="h-8" />
              <Button size="sm" variant="outline" onClick={() => { if (newTH.trim()) { onAddThemeTag(newTH.trim()); setNewTH(""); } }}>添加</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
