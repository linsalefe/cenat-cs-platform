'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import AppLayout from '@/components/AppLayout';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent, DragOverEvent } from '@dnd-kit/core';
import {
  UserPlus,
  Send,
  FileWarning,
  FileCheck,
  GraduationCap,
  CheckCircle2,
  Search,
  Phone,
  MessageCircle,
  Loader2,
  Users,
  Plus,
  X,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

interface StudentItem {
  id: number;
  name: string;
  email: string;
  phone: string;
  primary_course_name: string | null;
  onboarding_status: string;
  moodle_first_access: string | null;
  documents_count: number;
  documents_total: number;
  created_at: string | null;
}

const columns = [
  { id: 'novo', label: 'Novo', color: 'text-blue-700', bg: 'bg-blue-50', headerBg: 'bg-blue-500', icon: UserPlus },
  { id: 'em_contato', label: 'Em contato', color: 'text-teal-700', bg: 'bg-teal-50', headerBg: 'bg-teal-500', icon: Send },
  { id: 'em_andamento', label: 'Em andamento', color: 'text-amber-700', bg: 'bg-amber-50', headerBg: 'bg-amber-500', icon: Loader2 },
  { id: 'aguardando_doc', label: 'Aguardando doc.', color: 'text-purple-700', bg: 'bg-purple-50', headerBg: 'bg-purple-500', icon: FileWarning },
  { id: 'follow_up', label: 'Follow-up', color: 'text-orange-700', bg: 'bg-orange-50', headerBg: 'bg-orange-500', icon: MessageCircle },
  { id: 'concluido', label: 'Concluído', color: 'text-foreground/90', bg: 'bg-muted/50', headerBg: 'bg-muted/500', icon: CheckCircle2 },
];

function DraggableCard({
  student,
  onSendWelcome,
  sendingId,
}: {
  student: StudentItem;
  onSendWelcome: (id: number) => void;
  sendingId: number | null;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `student-${student.id}`,
    data: { student },
  });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: isDragging ? 999 : undefined }
    : undefined;

  const isSending = sendingId === student.id;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`bg-card rounded-xl border border-border p-3.5 cursor-grab active:cursor-grabbing
        hover:border-border hover:shadow-md transition-shadow duration-200 touch-none
        ${isDragging ? 'opacity-50 shadow-xl' : ''}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
          {student.name?.charAt(0)?.toUpperCase() || '?'}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-medium text-foreground truncate">{student.name}</h4>
          <p className="text-[10px] text-muted-foreground/70 truncate">{student.email}</p>
        </div>
      </div>

      {student.primary_course_name && (
        <p className="text-[11px] text-primary font-medium mb-2 line-clamp-1">
          {student.primary_course_name}
        </p>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-gray-50">
        <div className="flex items-center gap-2">
          {student.phone && (
            <span className="text-[10px] text-muted-foreground/70 flex items-center gap-0.5">
              <Phone className="w-3 h-3" />
              {student.phone.slice(-4)}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground/70">
            Docs: {student.documents_count}/{student.documents_total}
          </span>
        </div>

        {student.onboarding_status === 'novo' && student.phone && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onSendWelcome(student.id);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            disabled={isSending}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-teal-700
              bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors disabled:opacity-50"
          >
            {isSending ? <Loader2 className="w-3 h-3 animate-spin" /> : <MessageCircle className="w-3 h-3" />}
            Boas-vindas
          </button>
        )}
      </div>
    </div>
  );
}

function CardOverlay({ student }: { student: StudentItem }) {
  return (
    <div className="bg-card rounded-xl border-2 border-primary p-3.5 shadow-2xl w-72 rotate-2">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white text-xs font-bold">
          {student.name?.charAt(0)?.toUpperCase() || '?'}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-medium text-foreground truncate">{student.name}</h4>
          <p className="text-[10px] text-muted-foreground/70 truncate">{student.email}</p>
        </div>
      </div>
      {student.primary_course_name && (
        <p className="text-[11px] text-primary font-medium line-clamp-1">{student.primary_course_name}</p>
      )}
    </div>
  );
}

function KanbanColumn({
  column,
  students,
  isOver,
  onSendWelcome,
  sendingId,
  onBulkWelcome,
  bulkSending,
}: {
  column: (typeof columns)[0];
  students: StudentItem[];
  isOver: boolean;
  onSendWelcome: (id: number) => void;
  sendingId: number | null;
  onBulkWelcome: () => void;
  bulkSending: boolean;
}) {
  const Icon = column.icon;
  const { setNodeRef } = useDroppable({ id: column.id });

  const showBulk = column.id === 'novo' && students.filter((s) => s.phone).length > 0;

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-2xl min-w-[270px] w-[270px] max-h-full transition-all duration-200 ${
        isOver ? 'bg-blue-50/80 ring-2 ring-primary/30 scale-[1.01]' : 'bg-muted/50/80'
      }`}
    >
      <div className="px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${column.headerBg}`} />
          <h3 className={`text-sm font-semibold ${column.color}`}>{column.label}</h3>
        </div>
        <span
          className={`inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 text-[11px] font-bold rounded-full ${column.bg} ${column.color}`}
        >
          {students.length}
        </span>
      </div>

      {showBulk && (
        <div className="px-3 pb-2">
          <button
            onClick={onBulkWelcome}
            disabled={bulkSending}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium
              text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200
              rounded-lg transition-colors disabled:opacity-50"
          >
            {bulkSending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            Enviar em massa ({students.filter((s) => s.phone).length})
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2.5 min-h-[200px]">
        {students.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Icon className="w-8 h-8 text-muted-foreground/50 mb-2" />
            <p className="text-xs text-muted-foreground/70">{isOver ? 'Solte aqui' : 'Nenhum aluno'}</p>
          </div>
        ) : (
          students.map((student) => (
            <DraggableCard
              key={student.id}
              student={student}
              onSendWelcome={onSendWelcome}
              sendingId={sendingId}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default function OnboardingKanbanPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newCourse, setNewCourse] = useState('');
  const [creating, setCreating] = useState(false);
  const [availableCourses, setAvailableCourses] = useState<string[]>([]);
  const [activeStudent, setActiveStudent] = useState<StudentItem | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [bulkSending, setBulkSending] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (!authLoading && !user) router.push('/login'); }, [user, authLoading, router]);
  useEffect(() => { if (user) loadStudents(); }, [user]);

  useEffect(() => {
    if (!newOpen) return;
    let alive = true;
    api.get('/onboarding/courses')
      .then((res) => {
        if (!alive) return;
        const data = Array.isArray(res.data) ? res.data : [];
        setAvailableCourses(data);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [newOpen]);

  const loadStudents = async () => {
    try {
      const res = await api.get('/onboarding/students');
      setStudents(res.data);
    } catch (error) {
      console.error('Erro ao carregar alunos:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = useMemo(() => {
    if (!search) return students;
    const s = search.toLowerCase();
    return students.filter(
      (st) =>
        st.name.toLowerCase().includes(s) ||
        st.email.toLowerCase().includes(s) ||
        (st.primary_course_name || '').toLowerCase().includes(s)
    );
  }, [students, search]);

  const studentsByStatus = useMemo(() => {
    const grouped: Record<string, StudentItem[]> = {};
    columns.forEach((col) => {
      grouped[col.id] = filteredStudents.filter((s) => s.onboarding_status === col.id);
    });
    return grouped;
  }, [filteredStudents]);

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.student) setActiveStudent(data.student);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (!over) { setOverColumnId(null); return; }
    const isColumn = columns.some((c) => c.id === over.id.toString());
    if (isColumn) setOverColumnId(over.id.toString());
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveStudent(null);
    setOverColumnId(null);
    if (!over) return;

    const data = active.data.current;
    const student = data?.student as StudentItem | undefined;
    if (!student) return;

    const source = student.onboarding_status;
    const target = over.id.toString();
    const isColumn = columns.some((c) => c.id === target);

    if (!isColumn || source === target) return;

    setStudents((prev) =>
      prev.map((s) => (s.id === student.id ? { ...s, onboarding_status: target } : s))
    );

    try {
      await api.patch(`/onboarding/students/${student.id}/status?status=${target}`);
      toast.success(`Aluno movido para "${columns.find((c) => c.id === target)?.label}"`);
    } catch {
      toast.error('Erro ao mover aluno');
      loadStudents();
    }
  };

  const handleSendWelcome = async (studentId: number) => {
    setSendingId(studentId);
    try {
      const res = await api.post(`/onboarding/students/${studentId}/welcome`);
      if (res.data.status === 'sent') {
        toast.success('Boas-vindas enviada!');
        setStudents((prev) =>
          prev.map((s) => (s.id === studentId ? { ...s, onboarding_status: 'boas_vindas_enviada' } : s))
        );
      } else {
        toast.error(res.data.error || 'Erro ao enviar');
      }
    } catch {
      toast.error('Erro ao enviar boas-vindas');
    } finally {
      setSendingId(null);
    }
  };

  const handleBulkWelcome = async () => {
    const novos = (studentsByStatus['novo'] || []).filter((s) => s.phone);
    if (novos.length === 0) return;

    setBulkSending(true);
    let sent = 0;
    let failed = 0;

    for (const student of novos) {
      try {
        const res = await api.post(`/onboarding/students/${student.id}/welcome`);
        if (res.data.status === 'sent') {
          sent++;
          setStudents((prev) =>
            prev.map((s) => (s.id === student.id ? { ...s, onboarding_status: 'em_contato' } : s))
          );
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    setBulkSending(false);
    toast.success(`Envio concluído: ${sent} enviadas, ${failed} falhas`);
  };

  const handleCreate = async () => {
    if (!newName.trim() || !newEmail.trim() || !newPhone.trim()) {
      toast.error('Preencha nome, email e telefone');
      return;
    }
    try {
      setCreating(true);
      const res = await api.post('/onboarding/students', {
        name: newName.trim(),
        email: newEmail.trim(),
        phone: newPhone.trim(),
        course: newCourse.trim() || null,
        status: 'novo',
      });
      toast.success(`Aluno ${res.data.name} criado`);
      setStudents((prev) => [res.data, ...prev]);
      setNewOpen(false);
      setNewName('');
      setNewEmail('');
      setNewPhone('');
      setNewCourse('');
    } catch (e) {
      const err = e as { response?: { status?: number; data?: { detail?: string } } };
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      if (status === 409) {
        toast.error(detail || 'Já existe aluno com esse email');
      } else if (status === 400) {
        toast.error(typeof detail === 'string' ? detail : 'Dados inválidos — confira nome, email e telefone');
      } else {
        toast.error(detail || 'Erro ao criar aluno — tente novamente');
      }
      console.error('[Novo aluno]', status, detail);
    } finally {
      setCreating(false);
    }
  };

  const totalByStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    columns.forEach((c) => { counts[c.id] = students.filter((s) => s.onboarding_status === c.id).length; });
    return counts;
  }, [students]);

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded-lg w-48" />
          <div className="flex gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="w-[270px] h-96 bg-muted rounded-2xl flex-shrink-0" />
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className={`transition-all duration-700 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-6">
          <div className="min-w-0">
            <p className="text-sm font-medium text-primary mb-1">Gestão de Alunos</p>
            <h1 className="text-3xl font-semibold text-foreground tracking-tight">Onboarding</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap lg:justify-end w-full lg:w-auto">
            <div className="relative flex-1 sm:flex-initial min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
              <input
                type="text"
                placeholder="Buscar aluno..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm w-full sm:w-56
                  focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all duration-200 outline-none"
              />
            </div>
            <div className="flex items-center gap-2 px-3 py-2.5 bg-card border border-border rounded-xl whitespace-nowrap flex-shrink-0">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">{students.length}</span>
              <span className="text-xs text-muted-foreground/70">alunos</span>
            </div>
            <button
              onClick={() => setNewOpen(true)}
              className="inline-flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm whitespace-nowrap flex-shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Novo aluno</span>
              <span className="sm:hidden">Novo</span>
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
          {columns.map((col) => {
            const Icon = col.icon;
            return (
              <div key={col.id} className="bg-card rounded-xl border border-border p-3 text-center">
                <Icon className={`w-4 h-4 mx-auto mb-1 ${col.color}`} />
                <p className="text-lg font-semibold text-foreground">{totalByStatus[col.id] || 0}</p>
                <p className="text-[10px] text-muted-foreground truncate">{col.label}</p>
              </div>
            );
          })}
        </div>

        {/* Kanban */}
        <div className="overflow-x-auto pb-4" style={{ height: 'calc(100vh - 310px)' }}>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4 h-full min-w-max">
              {columns.map((column) => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  students={studentsByStatus[column.id] || []}
                  isOver={overColumnId === column.id}
                  onSendWelcome={handleSendWelcome}
                  sendingId={sendingId}
                  onBulkWelcome={handleBulkWelcome}
                  bulkSending={bulkSending}
                />
              ))}
            </div>
            <DragOverlay dropAnimation={null}>
              {activeStudent ? <CardOverlay student={activeStudent} /> : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>

      {/* Modal: Novo aluno */}
      {newOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => !creating && setNewOpen(false)}
        >
          <div
            className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Novo aluno</h2>
              <button
                onClick={() => !creating && setNewOpen(false)}
                className="p-1 rounded-md hover:bg-muted text-muted-foreground"
                disabled={creating}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground mb-4">
              Cria um aluno diretamente no Kanban, sem passar pelo formulário público.
              Workflows com gatilho &quot;Entrou no onboarding&quot; serão disparados.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1.5">
                  Nome <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nome completo do aluno"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground block mb-1.5">
                  Email <span className="text-destructive">*</span>
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="aluno@exemplo.com"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground block mb-1.5">
                  Telefone <span className="text-destructive">*</span>
                </label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="(11) 98765-4321"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground block mb-1.5">
                  Curso <span className="text-muted-foreground/60">(opcional)</span>
                </label>
                {availableCourses.length > 0 ? (
                  <select
                    value={newCourse}
                    onChange={(e) => setNewCourse(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                  >
                    <option value="">Selecione um curso…</option>
                    {availableCourses.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={newCourse}
                    onChange={(e) => setNewCourse(e.target.value)}
                    placeholder="Nome do curso (lista de cursos indisponível)"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                onClick={() => setNewOpen(false)}
                disabled={creating}
                className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
              >
                {creating ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Criando...</>
                ) : (
                  <>Criar aluno</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}