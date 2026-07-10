import { useState, useRef } from "react";
import { useStore } from "@/store/useStore";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { parseStudentList, parseExcelStudents } from "@/lib/io";
import { ConfirmDialog } from "@/modules/common/ConfirmDialog";
import { Users, Upload, Plus, Trash2, AlertCircle } from "lucide-react";

export function StudentManager() {
  const { data, addStudents, updateStudent, deleteStudent, clearStudents } = useStore();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [clearConfirm, setClearConfirm] = useState(false);
  const [singleName, setSingleName] = useState("");
  const [singleNo, setSingleNo] = useState("");
  const [singleClass, setSingleClass] = useState("");
  const [editTarget, setEditTarget] = useState<{ id: string; no: string; cls: string } | null>(null);
  const [editNo, setEditNo] = useState("");
  const [editClass, setEditClass] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleTextImport = () => {
    const students = parseStudentList(text);
    if (students.length > 0) {
      addStudents(students);
      setText("");
      setOpen(false);
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const students = await parseExcelStudents(file);
      if (students.length > 0) {
        addStudents(students);
      }
    } catch (err) {
      console.error(err);
      alert("文件解析失败，请检查格式");
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleAddSingle = () => {
    if (singleName.trim()) {
      addStudents([{ name: singleName.trim(), studentNo: singleNo.trim() || undefined, class: singleClass.trim() || undefined }]);
      setSingleName("");
      setSingleNo("");
      setSingleClass("");
    }
  };

  const openEdit = (id: string, no: string, cls: string) => {
    setEditTarget({ id, no, cls });
    setEditNo(no || "");
    setEditClass(cls || "");
  };

  const handleSaveEdit = () => {
    if (!editTarget) return;
    updateStudent(editTarget.id, { studentNo: editNo.trim() || undefined, class: editClass.trim() || undefined });
    setEditTarget(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-slate-500" />
          <span className="text-sm font-medium">学生名单 ({data.students.length}人)</span>
        </div>
        <div className="flex gap-2">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Upload className="h-4 w-4 mr-1" /> 导入名单
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>导入学生名单</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>粘贴文本（每行一个，支持列：姓名 / 学号,姓名 / 姓名,学号,班级）</Label>
                  <Textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={"张三\n李四,1002,一班\n王五,1003,二班"}
                    rows={6}
                    className="mt-1"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-xs text-slate-400">或</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>
                <div>
                  <Label>上传 Excel 文件（建议表头：姓名 / 学号 / 班级）</Label>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileImport}
                    className="mt-1 block w-full text-sm text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
                <Button onClick={handleTextImport} disabled={!text.trim()}>导入</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" /> 添加
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>添加单个学生</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>姓名</Label>
                  <Input value={singleName} onChange={(e) => setSingleName(e.target.value)} placeholder="学生姓名" />
                </div>
                <div>
                  <Label>学号（可选）</Label>
                  <Input value={singleNo} onChange={(e) => setSingleNo(e.target.value)} placeholder="学号" />
                </div>
                <div>
                  <Label>班级（可选）</Label>
                  <Input value={singleClass} onChange={(e) => setSingleClass(e.target.value)} placeholder="如：一班" />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddSingle} disabled={!singleName.trim()}>添加</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {data.students.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="text-red-500 hover:text-red-600"
              onClick={() => setClearConfirm(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {data.students.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 rounded-lg p-3">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          请先导入学生名单
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {data.students.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700 group"
            >
              {s.studentNo ? `${s.studentNo} ` : ""}{s.name}
              {s.class && (
                <span className="rounded bg-violet-100 text-violet-700 px-1">{s.class}</span>
              )}
              <button
                onClick={() => openEdit(s.id, s.studentNo || "", s.class || "")}
                className="text-slate-300 hover:text-blue-500 ml-0.5"
                title="编辑"
              >
                ✎
              </button>
              <button
                onClick={() => deleteStudent(s.id)}
                className="text-slate-300 hover:text-red-500 ml-0.5"
                title="删除"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>编辑学生信息</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>学号（可选）</Label>
              <Input value={editNo} onChange={(e) => setEditNo(e.target.value)} placeholder="学号" />
            </div>
            <div>
              <Label>班级（可选）</Label>
              <Input value={editClass} onChange={(e) => setEditClass(e.target.value)} placeholder="如：一班" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>取消</Button>
            <Button onClick={handleSaveEdit}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={clearConfirm}
        title="确认清空学生名单"
        description="将删除所有学生及其相关记录，此操作不可恢复。"
        confirmText="清空"
        onConfirm={() => {
          clearStudents();
          setClearConfirm(false);
        }}
        onCancel={() => setClearConfirm(false)}
      />
    </div>
  );
}
