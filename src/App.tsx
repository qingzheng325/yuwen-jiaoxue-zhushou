import { useState } from "react";
import { StoreProvider, useStore } from "@/store/useStore";
import { RecitationModule } from "@/modules/recitation/RecitationModule";
import { ScoresModule } from "@/modules/scores/ScoresModule";
import { QuestionBankModule } from "@/modules/questionbank/QuestionBankModule";
import { StudentRosterModule } from "@/modules/student/StudentRosterModule";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { BookOpen, TrendingUp, Library, Users, Database, Download, Upload, RotateCcw } from "lucide-react";
import type { AppData } from "@/types";
import { ConfirmDialog } from "@/modules/common/ConfirmDialog";

type Tab = "students" | "recitation" | "scores" | "questionbank";

const tabs: { key: Tab; label: string; icon: typeof BookOpen; desc: string }[] = [
  { key: "students", label: "学生名单", icon: Users, desc: "学生档案与综合统计" },
  { key: "recitation", label: "背默标记", icon: BookOpen, desc: "背诵默写考核管理" },
  { key: "scores", label: "成绩记录", icon: TrendingUp, desc: "考试成绩与趋势分析" },
  { key: "questionbank", label: "题库", icon: Library, desc: "题目分类检索与导出" },
];

function DataManagement() {
  const { exportAllData, importAllData, resetAll, data } = useStore();
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [resetConfirm, setResetConfirm] = useState(false);

  const handleImport = () => {
    try {
      const parsed = JSON.parse(importText) as AppData;
      importAllData(parsed);
      setImportText("");
      setImportOpen(false);
      alert("数据导入成功！");
    } catch {
      alert("数据格式错误，请检查JSON文件内容");
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as AppData;
        importAllData(parsed);
        alert("数据导入成功！");
      } catch {
        alert("数据格式错误");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const dataCounts = [
    { label: "学生", count: data.students.length },
    { label: "背诵内容", count: data.recitationItems.length },
    { label: "试卷", count: data.exams.length },
    { label: "题目", count: data.questions.length },
  ];

  return (
    <>
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-slate-500">
          <Database className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>数据管理</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {dataCounts.map((d) => (
              <div key={d.label} className="rounded-lg border p-2 text-center">
                <div className="text-lg font-bold text-slate-700">{d.count}</div>
                <div className="text-xs text-slate-500">{d.label}</div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Button variant="outline" className="w-full" onClick={exportAllData}>
              <Download className="h-4 w-4 mr-2" /> 导出全部数据（JSON备份）
            </Button>

            <Dialog open={importOpen} onOpenChange={setImportOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  <Upload className="h-4 w-4 mr-2" /> 从JSON文本导入
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>导入数据</DialogTitle>
                </DialogHeader>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="粘贴JSON备份数据..."
                  rows={6}
                  className="w-full rounded-md border p-2 text-sm"
                />
                <DialogFooter>
                  <Button variant="outline" onClick={() => setImportOpen(false)}>取消</Button>
                  <Button onClick={handleImport} disabled={!importText.trim()}>导入</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <div>
              <Label className="text-sm">或选择备份文件</Label>
              <input
                type="file"
                accept=".json"
                onChange={handleFileImport}
                className="block w-full text-sm text-slate-500 mt-1 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
              />
            </div>

            <div className="border-t pt-2">
              <Button
                variant="ghost"
                className="w-full text-red-500 hover:text-red-600"
                onClick={() => setResetConfirm(true)}
              >
                <RotateCcw className="h-4 w-4 mr-2" /> 重置所有数据
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <ConfirmDialog
      open={resetConfirm}
      title="重置所有数据"
      description="将清除全部学生、背默、成绩、题库数据，且无法恢复。建议先导出备份。"
      confirmText="重置"
      onConfirm={() => {
        resetAll();
        setResetConfirm(false);
      }}
      onCancel={() => setResetConfirm(false)}
    />
  </>
  );
}

function Label({ className, children }: { className?: string; children: React.ReactNode }) {
  return <label className={`text-sm font-medium text-slate-700 ${className || ""}`}>{children}</label>;
}

function AppContent() {
  const [tab, setTab] = useState<Tab>("students");

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-sm">
              语
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-800">语文教学助手</h1>
              <p className="text-xs text-slate-400 hidden sm:block">学生档案 · 背默管理 · 成绩记录 · 题库检索</p>
            </div>
          </div>
          <DataManagement />
        </div>

        {/* Tab navigation */}
        <div className="mx-auto max-w-5xl px-4">
          <div className="flex gap-1 -mb-px">
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    active
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-5xl px-4 py-4 pb-20">
        {tab === "students" && <StudentRosterModule />}
        {tab === "recitation" && <RecitationModule />}
        {tab === "scores" && <ScoresModule />}
        {tab === "questionbank" && <QuestionBankModule />}
      </main>

      {/* Footer hint */}
      <footer className="fixed bottom-0 left-0 right-0 border-t bg-white/90 backdrop-blur px-4 py-2 text-center text-xs text-slate-400">
        数据保存在本地浏览器中，请定期使用「数据管理」导出备份
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <AppContent />
    </StoreProvider>
  );
}
