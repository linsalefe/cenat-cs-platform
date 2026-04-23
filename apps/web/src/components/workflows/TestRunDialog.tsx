'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Search,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  workflowId: number | null;
  workflowName: string;
  onRunCompleted?: () => void; // callback para recarregar listagem
}

interface StudentLite {
  id: number;
  name: string;
  email?: string;
}

interface WorkflowGraph {
  id: number;
  name: string;
  nodes: Array<{ id: string; type: string; data?: Record<string, unknown> }>;
}

interface RunResponse {
  id: number;
  status:
    | 'pending'
    | 'running'
    | 'completed'
    | 'failed'
    | 'skipped'
    | 'waiting_delay';
  trigger_node_id: string | null;
  executed_nodes: string[];
  result: Record<string, Record<string, unknown>>;
  error_message: string | null;
  resume_at: string | null;
  started_at: string;
  finished_at: string | null;
}

// Labels legíveis dos tipos de node
const NODE_TYPE_LABELS: Record<string, string> = {
  'trigger.risk_critical': 'Gatilho: Aluno em risco',
  'trigger.inactive_moodle': 'Gatilho: Inativo no Moodle',
  'trigger.ticket_opened': 'Gatilho: Ticket aberto',
  'trigger.payment_overdue': 'Gatilho: Pagamento vencido',
  'trigger.nps_low': 'Gatilho: NPS baixo',
  'condition.course_is': 'Condição: Curso do aluno',
  'condition.risk_level': 'Condição: Nível de risco',
  'delay.wait': 'Atraso: Aguardar',
  'action.send_whatsapp': 'Ação: Enviar WhatsApp',
  'action.create_ticket': 'Ação: Criar ticket',
  'action.assign_user': 'Ação: Atribuir responsável',
  'action.set_onboarding_status': 'Ação: Mudar onboarding',
};

function labelFor(type: string): string {
  return NODE_TYPE_LABELS[type] || type;
}

const STATUS_META: Record<
  RunResponse['status'],
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  pending: {
    label: 'Pendente',
    icon: Clock,
    className: 'text-muted-foreground',
  },
  running: {
    label: 'Executando',
    icon: Loader2,
    className: 'text-blue-600 dark:text-blue-400',
  },
  completed: {
    label: 'Concluído',
    icon: CheckCircle2,
    className: 'text-emerald-600 dark:text-emerald-400',
  },
  failed: {
    label: 'Falhou',
    icon: XCircle,
    className: 'text-destructive',
  },
  skipped: {
    label: 'Ignorado',
    icon: AlertTriangle,
    className: 'text-amber-600 dark:text-amber-400',
  },
  waiting_delay: {
    label: 'Aguardando atraso',
    icon: Clock,
    className: 'text-amber-600 dark:text-amber-400',
  },
};

export default function TestRunDialog({
  open,
  onClose,
  workflowId,
  workflowName,
  onRunCompleted,
}: Props) {
  const [students, setStudents] = useState<StudentLite[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<string>('');

  const [graph, setGraph] = useState<WorkflowGraph | null>(null);
  const [selectedTrigger, setSelectedTrigger] = useState<string>('');

  const [running, setRunning] = useState(false);
  const [run, setRun] = useState<RunResponse | null>(null);

  // Carrega grafo do workflow (pra listar os triggers disponíveis)
  useEffect(() => {
    if (!open || !workflowId) return;
    (async () => {
      try {
        const res = await api.get(`/workflows/${workflowId}`);
        setGraph(res.data);
        // Seleciona o primeiro trigger por padrão
        const firstTrigger = (res.data.nodes || []).find((n: { type?: string }) =>
          n.type?.startsWith('trigger.')
        );
        if (firstTrigger) setSelectedTrigger(firstTrigger.id);
      } catch (e) {
        console.error(e);
        toast.error('Erro ao carregar workflow');
      }
    })();
  }, [open, workflowId]);

  // Carrega alunos (busca simples)
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setStudentsLoading(true);
    api
      .get('/students', { params: { limit: 50, search: studentSearch || undefined } })
      .then((res) => {
        if (!alive) return;
        const items = Array.isArray(res.data) ? res.data : (res.data?.data || res.data?.items || []);
        setStudents(items);
      })
      .catch((e) => console.error(e))
      .finally(() => alive && setStudentsLoading(false));
    return () => {
      alive = false;
    };
  }, [open, studentSearch]);

  // Reset quando fecha
  useEffect(() => {
    if (!open) {
      setRun(null);
      setSelectedStudent('');
      setSelectedTrigger('');
      setStudentSearch('');
      setGraph(null);
    }
  }, [open]);

  const triggers = useMemo(
    () => (graph?.nodes || []).filter((n) => n.type?.startsWith('trigger.')),
    [graph]
  );

  const handleRun = async () => {
    if (!workflowId || !selectedStudent) {
      toast.error('Selecione um aluno');
      return;
    }
    if (triggers.length > 1 && !selectedTrigger) {
      toast.error('Selecione qual gatilho disparar');
      return;
    }

    try {
      setRunning(true);
      setRun(null);
      const res = await api.post(`/workflows/${workflowId}/trigger`, {
        student_id: Number(selectedStudent),
        trigger_node_id: selectedTrigger || undefined,
      });
      setRun(res.data);

      const statusLabel = STATUS_META[res.data.status as RunResponse['status']]
        ?.label;
      if (res.data.status === 'completed') {
        toast.success(`Execução concluída — ${statusLabel}`);
      } else if (res.data.status === 'failed') {
        toast.error(`Execução falhou — ${res.data.error_message}`);
      } else {
        toast.message(`Execução: ${statusLabel}`);
      }

      onRunCompleted?.();
    } catch (e: unknown) {
      console.error(e);
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || 'Erro ao disparar workflow';
      toast.error(msg);
    } finally {
      setRunning(false);
    }
  };

  const statusMeta = run ? STATUS_META[run.status] : null;
  const StatusIcon = statusMeta?.icon;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Testar workflow</DialogTitle>
          <DialogDescription>
            Dispara <span className="font-medium text-foreground">{workflowName}</span>{' '}
            manualmente para um aluno. Nada é enviado via WhatsApp (stub). Tickets
            e atribuições são criados de verdade.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Aluno */}
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">
              Aluno <span className="text-destructive">*</span>
            </label>
            <div className="relative mb-2">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar aluno por nome ou email..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {studentsLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : students.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-1">
                Nenhum aluno encontrado.
              </p>
            ) : (
              <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um aluno" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                      {s.email ? ` — ${s.email}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Trigger (se houver mais de um) */}
          {triggers.length > 1 && (
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">
                Gatilho de entrada
              </label>
              <Select value={selectedTrigger} onValueChange={setSelectedTrigger}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o gatilho" />
                </SelectTrigger>
                <SelectContent>
                  {triggers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {labelFor(t.type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Resultado */}
          {run && statusMeta && (
            <div className="border rounded-lg overflow-hidden">
              <div
                className={cn(
                  'px-3 py-2 flex items-center gap-2 border-b bg-muted/50'
                )}
              >
                {StatusIcon && (
                  <StatusIcon
                    className={cn(
                      'w-4 h-4',
                      statusMeta.className,
                      run.status === 'running' && 'animate-spin'
                    )}
                  />
                )}
                <span className={cn('text-sm font-medium', statusMeta.className)}>
                  {statusMeta.label}
                </span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {run.executed_nodes?.length || 0} nós executados
                </span>
              </div>

              {run.error_message && (
                <div className="px-3 py-2 bg-destructive/10 text-destructive text-xs border-b">
                  {run.error_message}
                </div>
              )}

              <div className="max-h-64 overflow-y-auto divide-y">
                {(run.executed_nodes || []).map((nodeId) => {
                  const detail = run.result?.[nodeId] || {};
                  const type = (detail as { type?: string })?.type || '?';
                  const kind = (detail as { kind?: string })?.kind || '';
                  const status = (detail as { status?: string })?.status || '';
                  const matched = (detail as { matched?: boolean })?.matched;

                  return (
                    <div key={nodeId} className="px-3 py-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">
                          {labelFor(type)}
                        </span>
                        {kind === 'condition' && matched !== undefined && (
                          <span
                            className={cn(
                              'text-[10px] font-semibold px-1.5 py-0.5 rounded border uppercase',
                              matched
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30'
                                : 'bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30'
                            )}
                          >
                            {matched ? 'Sim' : 'Não'}
                          </span>
                        )}
                        {status && kind !== 'condition' && (
                          <span className="text-[10px] text-muted-foreground uppercase">
                            {status}
                          </span>
                        )}
                      </div>
                      <pre className="mt-1 text-[10px] text-muted-foreground bg-muted/30 p-1.5 rounded overflow-x-auto leading-snug">
                        {JSON.stringify(detail, null, 2)}
                      </pre>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={running}>
            Fechar
          </Button>
          <Button onClick={handleRun} disabled={running || !selectedStudent}>
            {running ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Executando...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-1" />
                Disparar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
