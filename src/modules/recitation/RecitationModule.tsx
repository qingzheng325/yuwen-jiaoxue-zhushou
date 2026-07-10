import { useState, useMemo } from "react";
import { useStore } from "@/store/useStore";
import { ConfirmDialog } from "@/modules/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { exportToExcel, formatDate, todayStr } from "@/lib/io";
import type { RecitationType, RecitationStatus, RecitationItem, RecitationRound } from "@/types";
import {
  BookOpen, Plus, Trash2, Download, Calendar,
  FileText, Users, CheckCircle2, XCircle, MinusCircle,
} from "lucide-react";

type ViewMode = "byItem" | "byStudent";

export function RecitationModule() {
  const { data, addRecitationItem, deleteRecitationItem } = useStore();
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemType, setNewItemType] = useState<RecitationType>("诗歌");
  const [viewMode, setViewMode] = useState<ViewMode>("byItem");
  const [deleteItemTarget, setDeleteItemTarget] = useState<RecitationItem | null>(null);

  const handleAddItem = () => {
    if (!newItemTitle.trim()) return;
    addRecitationItem({ title: newItemTitle.trim(), type: newItemType });
    setNewItemTitle("");
  };

  return (
    <div className="space-y-4">
      {/* 篇目管理 */}
      <div className="border-t pt-4">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="h-5 w-5 text-slate-500" />
          <h3 className="text-sm font-medium">篇目管理</h3>
        </div>

        <div className="flex gap-2 mb-3 flex-wrap">
          <Input
            value={newItemTitle}
            onChange={(e) => setNewItemTitle(e.target.value)}
            placeholder="输入篇目名称，如：《静夜思》"
            className="flex-1 min-w-[200px]"
            onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
          />
          <Select value={newItemType} onValueChange={(v) => setNewItemType(v as RecitationType)}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="诗歌">诗歌</SelectItem>
              <SelectItem value="文言文原文">文言文原文</SelectItem>
              <SelectItem value="文言文注释">文言文注释</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleAddItem} disabled={!newItemTitle.trim()}>
            <Plus className="h-4 w-4 mr-1" /> 添加
          </Button>
        </div>

        {data.recitationItems.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {data.recitationItems.map((item) => (
              <div
                key={item.id}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5"
              >
                <Badge className={item.type === "诗歌" ? "bg-purple-100 text-purple-700 hover:bg-purple-100 text-xs" : item.type === "文言文原文" ? "bg-blue-100 text-blue-700 hover:bg-blue-100 text-xs" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-xs"}>
                  {item.type}
                </Badge>
                <span className="text-sm">{item.title}</span>
                <button
                  onClick={() => setDeleteItemTarget(item)}
                  className="text-slate-400 hover:text-red-500"
                  title="删除篇目"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 视图切换 */}
      {data.recitationItems.length > 0 && data.students.length > 0 && (
        <div className="border-t pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Button
              size="sm"
              variant={viewMode === "byItem" ? "default" : "outline"}
              onClick={() => setViewMode("byItem")}
            >
              <FileText className="h-4 w-4 mr-1" /> 按篇目分
            </Button>
            <Button
              size="sm"
              variant={viewMode === "byStudent" ? "default" : "outline"}
              onClick={() => setViewMode("byStudent")}
            >
              <Users className="h-4 w-4 mr-1" /> 按学生分
            </Button>
          </div>

          {viewMode === "byItem" ? <ByItemView /> : <ByStudentView />}
        </div>
      )}

      {data.recitationItems.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-4 border-t">请先添加篇目</p>
      )}
      {data.recitationItems.length > 0 && data.students.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-4 border-t">请先在「学生名单」模块添加学生</p>
      )}

      <ConfirmDialog
        open={!!deleteItemTarget}
        title="确认删除篇目"
        description={
          deleteItemTarget
            ? `将删除「${deleteItemTarget.title}」及其所有遍次与标记记录，此操作不可恢复。`
            : ""
        }
        confirmText="删除"
        onConfirm={() => {
          if (deleteItemTarget) deleteRecitationItem(deleteItemTarget.id);
          setDeleteItemTarget(null);
        }}
        onCancel={() => setDeleteItemTarget(null)}
      />
    </div>
  );
}

// ============ 按篇目分 ============
function ByItemView() {
  const { data, addRecitationRound, deleteRecitationRound, updateRecitationRoundDate, setRecitationMark, batchSetMarks } = useStore();
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [markingRoundId, setMarkingRoundId] = useState<string | null>(null);
  const [newRoundDate, setNewRoundDate] = useState(todayStr());
  const [deleteRoundTarget, setDeleteRoundTarget] = useState<RecitationRound | null>(null);

  const selectedItem = data.recitationItems.find((i) => i.id === selectedItemId);
  const itemRounds = useMemo(() => {
    if (!selectedItem) return [];
    return data.recitationRounds
      .filter((r) => r.itemId === selectedItem.id)
      .sort((a, b) => a.roundNumber - b.roundNumber);
  }, [selectedItem, data.recitationRounds]);

  // 统计每个遍次的人数
  const roundStats = useMemo(() => {
    return itemRounds.map((round) => {
      const marks = data.recitationMarks.filter((m) => m.roundId === round.id);
      const passed = marks.filter((m) => m.status === "过关").length;
      const retest = marks.filter((m) => m.status === "重默").length;
      const untested = data.students.length - passed - retest;
      return { round, passed, retest, untested, total: data.students.length };
    });
  }, [itemRounds, data.recitationMarks, data.students]);

  const handleAddRound = () => {
    if (!selectedItem) return;
    addRecitationRound(selectedItem.id, newRoundDate);
  };

  const handleExport = () => {
    if (!selectedItem) return;
    const rows = data.students.map((s) => {
      const row: Record<string, unknown> = { 学号: s.studentNo || "", 姓名: s.name };
      for (const round of itemRounds) {
        const mark = data.recitationMarks.find((m) => m.roundId === round.id && m.studentId === s.id);
        row[`第${round.roundNumber}遍(${round.date})`] = mark?.status || "未测";
      }
      return row;
    });
    exportToExcel([{ name: selectedItem.title, data: rows }], `背默记录_${selectedItem.title}_${formatDate(new Date().toISOString())}.xlsx`);
  };

  const markingRound = itemRounds.find((r) => r.id === markingRoundId);

  return (
    <div className="space-y-3">
      {/* 篇目选择 */}
      <Select value={selectedItemId || ""} onValueChange={setSelectedItemId}>
        <SelectTrigger className="w-full max-w-xs">
          <SelectValue placeholder="选择篇目" />
        </SelectTrigger>
        <SelectContent>
          {data.recitationItems.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {item.type} · {item.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedItem && (
        <>
          {/* 添加遍次 */}
          <div className="flex gap-2 items-center flex-wrap">
            <Input
              type="date"
              value={newRoundDate}
              onChange={(e) => setNewRoundDate(e.target.value)}
              className="w-[160px]"
            />
            <Button size="sm" onClick={handleAddRound}>
              <Plus className="h-4 w-4 mr-1" /> 添加遍次
            </Button>
            <Button size="sm" variant="outline" onClick={handleExport} disabled={itemRounds.length === 0}>
              <Download className="h-4 w-4 mr-1" /> 导出
            </Button>
          </div>

          {/* 遍次统计表 */}
          {itemRounds.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">暂无遍次，请添加</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="text-left px-3 py-2 font-medium text-slate-600">遍次</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">日期</th>
                    <th className="text-center px-3 py-2 font-medium text-green-600">过关</th>
                    <th className="text-center px-3 py-2 font-medium text-red-500">重默</th>
                    <th className="text-center px-3 py-2 font-medium text-slate-400">未测</th>
                    <th className="text-center px-3 py-2 font-medium text-slate-600">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {roundStats.map(({ round, passed, retest, untested, total }) => (
                    <tr key={round.id} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium">第 {round.roundNumber} 遍</td>
                      <td className="px-3 py-2">
                        <input
                          type="date"
                          value={round.date}
                          onChange={(e) => updateRecitationRoundDate(round.id, e.target.value)}
                          className="border-0 bg-transparent text-slate-600 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1"
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="font-medium text-green-600">{passed}</span>
                        <span className="text-slate-300 text-xs">/{total}</span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="font-medium text-red-500">{retest}</span>
                        <span className="text-slate-300 text-xs">/{total}</span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="font-medium text-slate-400">{untested}</span>
                        <span className="text-slate-300 text-xs">/{total}</span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Button size="sm" variant="ghost" className="h-7" onClick={() => setMarkingRoundId(round.id)}>
                          <Calendar className="h-3.5 w-3.5 mr-1" /> 标记
                        </Button>
                        <button
                          onClick={() => setDeleteRoundTarget(round)}
                          className="text-slate-400 hover:text-red-500 ml-1"
                          title="删除该遍次"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 进度条概览 */}
          {roundStats.length > 0 && (
            <div className="space-y-1.5">
              {roundStats.map(({ round, passed, retest, untested, total }) => {
                const pPct = total > 0 ? (passed / total) * 100 : 0;
                const rPct = total > 0 ? (retest / total) * 100 : 0;
                return (
                  <div key={round.id} className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 w-16 whitespace-nowrap">第{round.roundNumber}遍</span>
                    <div className="flex-1 h-5 rounded-full overflow-hidden flex bg-slate-100">
                      <div className="h-full bg-green-500 flex items-center justify-center text-xs text-white" style={{ width: `${pPct}%` }}>
                        {pPct > 10 ? passed : ""}
                      </div>
                      <div className="h-full bg-red-400 flex items-center justify-center text-xs text-white" style={{ width: `${rPct}%` }}>
                        {rPct > 10 ? retest : ""}
                      </div>
                      <div className="h-full bg-slate-200 flex items-center justify-center text-xs text-slate-400" style={{ width: `${100 - pPct - rPct}%` }}>
                        {100 - pPct - rPct > 10 ? untested : ""}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 标记弹窗 */}
          <MarkingDialog
            open={!!markingRoundId}
            onOpenChange={(open) => !open && setMarkingRoundId(null)}
            round={markingRound || null}
            itemName={selectedItem.title}
            students={data.students}
            marks={data.recitationMarks.filter((m) => m.roundId === markingRoundId)}
            onMark={setRecitationMark}
            onBatch={batchSetMarks}
          />

          <ConfirmDialog
            open={!!deleteRoundTarget}
            title="确认删除遍次"
            description={
              deleteRoundTarget
                ? `将删除第 ${deleteRoundTarget.roundNumber} 遍及其所有学生标记，此操作不可恢复。`
                : ""
            }
            confirmText="删除"
            onConfirm={() => {
              if (deleteRoundTarget) deleteRecitationRound(deleteRoundTarget.id);
              setDeleteRoundTarget(null);
            }}
            onCancel={() => setDeleteRoundTarget(null)}
          />
        </>
      )}
    </div>
  );
}

// ============ 标记弹窗 ============
function MarkingDialog({
  open,
  onOpenChange,
  round,
  itemName,
  students,
  marks,
  onMark,
  onBatch,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  round: { id: string; roundNumber: number; date: string } | null;
  itemName: string;
  students: { id: string; name: string; studentNo?: string }[];
  marks: { id: string; roundId: string; studentId: string; status: RecitationStatus }[];
  onMark: (roundId: string, studentId: string, status: RecitationStatus) => void;
  onBatch: (roundId: string, studentIds: string[], status: RecitationStatus) => void;
}) {
  if (!round) return null;

  const getMark = (studentId: string): RecitationStatus => {
    return marks.find((m) => m.studentId === studentId)?.status || "未测";
  };

  const passedCount = marks.filter((m) => m.status === "过关").length;
  const retestCount = marks.filter((m) => m.status === "重默").length;
  const untestedCount = students.length - passedCount - retestCount;

  const handleBatch = (status: RecitationStatus) => {
    const untestedIds = students.filter((s) => getMark(s.id) === "未测").map((s) => s.id);
    if (untestedIds.length > 0) {
      onBatch(round.id, untestedIds, status);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{itemName} — 第{round.roundNumber}遍（{round.date}）</DialogTitle>
        </DialogHeader>

        {/* 统计概览 + 批量操作 */}
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">过关 {passedCount}</Badge>
          <Badge className="bg-red-100 text-red-700 hover:bg-red-100">重默 {retestCount}</Badge>
          <Badge className="bg-slate-100 text-slate-500 hover:bg-slate-100">未测 {untestedCount}</Badge>
          <div className="ml-auto flex gap-1">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleBatch("过关")}>
              全部未测→过关
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleBatch("重默")}>
              全部未测→重默
            </Button>
          </div>
        </div>

        {/* 学生列表 */}
        <div className="space-y-1 max-h-[50vh] overflow-y-auto">
          {students.map((s) => {
            const status = getMark(s.id);
            return (
              <div key={s.id} className="flex items-center gap-2 rounded-md border p-2">
                <span className="text-sm flex-1">
                  {s.studentNo && <span className="text-slate-400 text-xs mr-1">{s.studentNo}</span>}
                  {s.name}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => onMark(round.id, s.id, "过关")}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                      status === "过关"
                        ? "bg-green-500 text-white"
                        : "bg-green-50 text-green-600 hover:bg-green-100"
                    }`}
                  >
                    过关
                  </button>
                  <button
                    onClick={() => onMark(round.id, s.id, "重默")}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                      status === "重默"
                        ? "bg-red-500 text-white"
                        : "bg-red-50 text-red-500 hover:bg-red-100"
                    }`}
                  >
                    重默
                  </button>
                  <button
                    onClick={() => onMark(round.id, s.id, "未测")}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                      status === "未测"
                        ? "bg-slate-400 text-white"
                        : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    未测
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-slate-400">提示：点击与当前状态相同的按钮可取消标记（恢复为未测）</p>
      </DialogContent>
    </Dialog>
  );
}

// ============ 按学生分 ============
function ByStudentView() {
  const { data } = useStore();
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const selectedStudent = data.students.find((s) => s.id === selectedStudentId);

  // 获取所有篇目及其遍次
  const itemData = useMemo(() => {
    return data.recitationItems.map((item) => {
      const rounds = data.recitationRounds
        .filter((r) => r.itemId === item.id)
        .sort((a, b) => a.roundNumber - b.roundNumber);
      return { item, rounds };
    });
  }, [data.recitationItems, data.recitationRounds]);

  const maxRounds = useMemo(() => {
    return Math.max(1, ...itemData.map((d) => d.rounds.length));
  }, [itemData]);

  const getStudentStatus = (roundId: string): RecitationStatus => {
    if (!selectedStudentId) return "未测";
    return data.recitationMarks.find(
      (m) => m.roundId === roundId && m.studentId === selectedStudentId
    )?.status || "未测";
  };

  // 统计该学生总体情况
  const studentSummary = useMemo(() => {
    if (!selectedStudentId) return null;
    let passed = 0, retest = 0, untested = 0;
    for (const { rounds } of itemData) {
      for (const round of rounds) {
        const status = data.recitationMarks.find(
          (m) => m.roundId === round.id && m.studentId === selectedStudentId
        )?.status || "未测";
        if (status === "过关") passed++;
        else if (status === "重默") retest++;
        else untested++;
      }
    }
    return { passed, retest, untested };
  }, [selectedStudentId, itemData, data.recitationMarks]);

  const handleExport = () => {
    if (!selectedStudent) return;
    const rows = itemData.map(({ item, rounds }) => {
      const row: Record<string, unknown> = { 篇目: item.title, 类型: item.type };
      rounds.forEach((round) => {
        const status = data.recitationMarks.find(
          (m) => m.roundId === round.id && m.studentId === selectedStudentId
        )?.status || "未测";
        row[`第${round.roundNumber}遍(${round.date})`] = status;
      });
      return row;
    });
    exportToExcel([{ name: selectedStudent.name, data: rows }], `背默记录_${selectedStudent.name}_${formatDate(new Date().toISOString())}.xlsx`);
  };

  return (
    <div className="space-y-3">
      {/* 学生选择 */}
      <div className="flex gap-2 items-center flex-wrap">
        <Select value={selectedStudentId || ""} onValueChange={setSelectedStudentId}>
          <SelectTrigger className="w-full max-w-xs">
            <SelectValue placeholder="选择学生" />
          </SelectTrigger>
          <SelectContent>
            {data.students.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.studentNo ? `${s.studentNo} ` : ""}{s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedStudent && (
          <Button size="sm" variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" /> 导出
          </Button>
        )}
      </div>

      {selectedStudent && studentSummary && (
        <>
          {/* 学生统计概览 */}
          <div className="flex gap-2 flex-wrap">
            <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
              <CheckCircle2 className="h-3 w-3 mr-1" /> 过关 {studentSummary.passed}
            </Badge>
            <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
              <XCircle className="h-3 w-3 mr-1" /> 重默 {studentSummary.retest}
            </Badge>
            <Badge className="bg-slate-100 text-slate-500 hover:bg-slate-100">
              <MinusCircle className="h-3 w-3 mr-1" /> 未测 {studentSummary.untested}
            </Badge>
          </div>

          {/* 篇目×遍次 明细表 */}
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left px-3 py-2 font-medium text-slate-600 whitespace-nowrap">篇目</th>
                  {Array.from({ length: maxRounds }, (_, i) => (
                    <th key={i} className="text-center px-3 py-2 font-medium text-slate-600 whitespace-nowrap">
                      第{i + 1}遍
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {itemData.map(({ item, rounds }) => (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <Badge className={item.type === "诗歌" ? "bg-purple-100 text-purple-700 hover:bg-purple-100 text-xs mr-1" : item.type === "文言文原文" ? "bg-blue-100 text-blue-700 hover:bg-blue-100 text-xs mr-1" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-xs mr-1"}>
                        {item.type}
                      </Badge>
                      <span className="text-sm">{item.title}</span>
                    </td>
                    {Array.from({ length: maxRounds }, (_, i) => {
                      const round = rounds[i];
                      if (!round) {
                        return <td key={i} className="px-3 py-2 text-center text-slate-200">—</td>;
                      }
                      const status = getStudentStatus(round.id);
                      return (
                        <td key={i} className="px-3 py-2 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                              status === "过关" ? "bg-green-100 text-green-700"
                              : status === "重默" ? "bg-red-100 text-red-600"
                              : "bg-slate-100 text-slate-400"
                            }`}>
                              {status}
                            </span>
                            <span className="text-xs text-slate-400">{round.date.slice(5)}</span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!selectedStudent && (
        <p className="text-sm text-slate-400 text-center py-6">请选择学生查看明细</p>
      )}
    </div>
  );
}
