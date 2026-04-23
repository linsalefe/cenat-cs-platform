'use client';

import { useEffect, useState } from 'react';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronRight,
  UserCircle,
  History,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  workflowId: number | null;
  workflowName: string;
}

interface RunItem {
  id: number;
  status:
    | 'pending'
    | 'running'
    | 'completed'
    | 'failed'
    | 'skipped'
    | 'waiting_delay';
  trigger_node_id: string | null;
  triggered_by: string;
  student: { id: number; name: string } | null;
  executed_nodes_count: number;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
}

interface RunDetail extends RunItem {
  executed_nodes: string[];
  result: Record<string, Record<string, unknown>>;
}

const STATUS_META: Record<
  RunItem['status'],
  { label: string; icon: typeof CheckCircle2; className: string; bg: string }
> = {
  pending: {
    label: 'Pendente',
    icon: Clock,
    className: 'text-muted-foreground',
    bg: 'bg-muted/30',
  },
  running: {
    label: 'Executando',
    icon: Loader2,
    className: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-500/10',
  },
  completed: {
    label: 'Concluído',
    icon: CheckCircle2,
    className: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
  },
  failed: {
    label: 'Falhou',
    icon: XCircle,
    className: 'text-destructive',
    bg: 'bg-red-50 dark:bg-red-500/10',
  },
  skipped: {
    label: 'Ignorado',
    icon: AlertTriangle,
    className: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-500/10',
  },
  waiting_delay: {
    label: 'Aguardando atraso',
    icon: Clock,
    className: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-500/10',
  },
};

const TRIGGERED_BY_LABEL: Record<string, string> = {
  manual: 'Manual',
  risk_updated: 'Scheduler · Risco',
  payment_overdue: 'Scheduler · Financeiro',
  moodle_inactive: 'Scheduler · Moodle',
  nps_low: 'Scheduler · NPS',
  ticket_opened: 'Evento · Ticket',
};

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `há ${diffMin} min`;
  if (diffMin < 60 * 24) return `há ${Math.floor(diffMin / 60)} h`;
  return d.toLocaleDateString('pt-BR');
}

export default function RunsHistoryDialog({
  open,
  onClose,
  workflowId,
  workflowName,
}: Props) {
  const [runs, setRuns] = useState<RunItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detailCache, setDetailCache] = useState<Record<number, RunDetail>>({});

  useEffect(() => {
    if (!open || !workflowId) return;
    (async () => {
      try {
        setLoading(true);
        const res = await api.get(`/workflows/${workflowId}/runs`, {
          params: { limit: 30 },
        });
        setRuns(res.data || []);
      } catch (e) {
        console.error(e);
        toast.error('Erro ao carregar histórico');
      } finally {
        setLoading(false);
      }
    })();
  }, [open, workflowId]);

  useEffect(() => {
    if (!open) {
      setRuns([]);
      setExpandedId(null);
      setDetailCache({});
    }
  }, [open]);

  const toggle = async (runId: number) => {
    if (expandedId === runId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(runId);

    if (!detailCache[runId] && workflowId) {
      try {
        // O endpoint /workflows/{id}/runs não retorna executed_nodes/result.
        // Mas /workflows/{id}/trigger retorna tudo. Então guardamos no POST do teste.
        // Aqui: buscar via run individual (fallback: não expõe detalhe completo).
        // Vamos fazer um fetch: GET /workflows/{wf_id} traria o workflow;
        // o detalhe da run vem de um endpoint que não existe. Solução:
        // exibir só os metadados (count, status, erro) sem JSON expandido.
        // Setamos placeholder com o que temos.
        const item = runs.find((r) => r.id === runId);
        if (item) {
          setDetailCache((c) => ({
            ...c,
            [runId]: {
              ...item,
              executed_nodes: [],
              result: {},
            },
          }));
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Histórico de execuções
          </DialogTitle>
          <DialogDescription>
            Últimas 30 execuções de{' '}
            <span className="font-medium text-foreground">{workflowName}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))
          ) : runs.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              Nenhuma execução ainda. Dispare manualmente (botão ▷) ou aguarde
              o scheduler.
            </div>
          ) : (
            runs.map((run) => {
              const meta = STATUS_META[run.status];
              const StatusIcon = meta.icon;
              const expanded = expandedId === run.id;
              const triggeredByLabel =
                TRIGGERED_BY_LABEL[run.triggered_by] || run.triggered_by;

              return (
                <div
                  key={run.id}
                  className={cn(
                    'border rounded-lg overflow-hidden transition-colors',
                    expanded && 'ring-1 ring-foreground/15'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggle(run.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
                  >
                    <span
                      className={cn(
                        'w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0',
                        meta.bg
                      )}
                    >
                      <StatusIcon
                        className={cn(
                          'w-4 h-4',
                          meta.className,
                          run.status === 'running' && 'animate-spin'
                        )}
                      />
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs">
                        <span className={cn('font-semibold', meta.className)}>
                          {meta.label}
                        </span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-foreground truncate inline-flex items-center gap-1">
                          <UserCircle className="w-3 h-3" />
                          {run.student?.name || 'Aluno removido'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                        <span>{triggeredByLabel}</span>
                        <span>·</span>
                        <span>{run.executed_nodes_count} nós</span>
                        <span>·</span>
                        <span>{formatRelativeTime(run.started_at)}</span>
                      </div>
                    </div>

                    {expanded ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>

                  {expanded && (
                    <div className="px-3 py-2 border-t bg-muted/30 text-xs space-y-1.5">
                      <div>
                        <span className="text-muted-foreground">ID:</span>{' '}
                        <span className="font-mono text-foreground">{run.id}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Iniciado em:
                        </span>{' '}
                        <span className="text-foreground">
                          {new Date(run.started_at).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      {run.finished_at && (
                        <div>
                          <span className="text-muted-foreground">
                            Finalizado em:
                          </span>{' '}
                          <span className="text-foreground">
                            {new Date(run.finished_at).toLocaleString('pt-BR')}
                          </span>
                        </div>
                      )}
                      {run.error_message && (
                        <div className="mt-2 p-2 rounded bg-destructive/10 text-destructive text-[11px] leading-snug">
                          {run.error_message}
                        </div>
                      )}
                      <p className="text-[11px] text-muted-foreground pt-1 italic">
                        Dica: para ver o JSON completo do result, consulte o banco:
                        <br />
                        <code className="text-[10px]">
                          SELECT result FROM workflow_runs WHERE id = {run.id};
                        </code>
                      </p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
