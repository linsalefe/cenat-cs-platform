'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import AppLayout from '@/components/AppLayout';
import PageHeader from '@/components/PageHeader';
import KpiCard from '@/components/KpiCard';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Workflow as WorkflowIcon,
  Plus,
  Play,
  Pause,
  Pencil,
  Trash2,
  MoreVertical,
  Zap,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

interface WorkflowItem {
  id: number;
  name: string;
  description: string | null;
  status: 'draft' | 'active' | 'paused';
  nodes_count: number;
  edges_count: number;
  runs_count: number;
  last_run_at: string | null;
  updated_at: string;
}

const statusConfig: Record<
  WorkflowItem['status'],
  { label: string; className: string }
> = {
  draft: {
    label: 'Rascunho',
    className:
      'bg-muted text-muted-foreground border-border',
  },
  active: {
    label: 'Ativo',
    className:
      'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
  },
  paused: {
    label: 'Pausado',
    className:
      'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
  },
};

export default function WorkflowsPage() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WorkflowItem | null>(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get('/workflows');
      setWorkflows(res.data);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao carregar workflows');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast.error('Informe um nome');
      return;
    }
    try {
      setCreating(true);
      const res = await api.post('/workflows', {
        name: newName.trim(),
        description: newDescription.trim() || null,
      });
      toast.success('Workflow criado');
      setCreateOpen(false);
      setNewName('');
      setNewDescription('');
      router.push(`/workflows/${res.data.id}`);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao criar workflow');
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (w: WorkflowItem) => {
    try {
      await api.patch(`/workflows/${w.id}/toggle`);
      toast.success(
        w.status === 'active' ? 'Workflow pausado' : 'Workflow ativado'
      );
      load();
    } catch (e) {
      console.error(e);
      toast.error('Erro ao alterar status');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/workflows/${deleteTarget.id}`);
      toast.success('Workflow removido');
      setDeleteTarget(null);
      load();
    } catch (e) {
      console.error(e);
      toast.error('Erro ao remover');
    }
  };

  // KPIs
  const total = workflows.length;
  const active = workflows.filter((w) => w.status === 'active').length;
  const drafts = workflows.filter((w) => w.status === 'draft').length;
  const totalRuns = workflows.reduce((acc, w) => acc + (w.runs_count || 0), 0);

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Automação"
          title="Workflows"
          description="Automatize jornadas de retenção com triggers, condições, delays e ações."
          actions={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Novo Workflow
            </Button>
          }
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Total"
            value={total}
            icon={WorkflowIcon}
            tone="primary"
            subtitle="Workflows criados"
            loading={loading}
          />
          <KpiCard
            label="Ativos"
            value={active}
            icon={Play}
            tone="success"
            subtitle="Em execução"
            loading={loading}
          />
          <KpiCard
            label="Rascunhos"
            value={drafts}
            icon={Pencil}
            tone="default"
            subtitle="Não publicados"
            loading={loading}
          />
          <KpiCard
            label="Execuções"
            value={totalRuns}
            icon={Zap}
            tone="info"
            subtitle="Total acumulado"
            loading={loading}
          />
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : workflows.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <WorkflowIcon className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">
              Nenhum workflow ainda
            </h3>
            <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto">
              Crie seu primeiro workflow para automatizar ações de retenção
              baseadas em gatilhos de risco, tickets, pagamento e engajamento.
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Criar primeiro workflow
            </Button>
          </Card>
        ) : (
          <div className="space-y-2">
            {workflows.map((w) => {
              const sc = statusConfig[w.status];
              return (
                <Card
                  key={w.id}
                  className="p-4 flex items-center gap-4 group hover:ring-foreground/15 transition-all"
                >
                  <Link
                    href={`/workflows/${w.id}`}
                    className="flex items-center gap-4 flex-1 min-w-0"
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <WorkflowIcon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-foreground truncate">
                          {w.name}
                        </h3>
                        <span
                          className={cn(
                            'text-[10px] font-semibold px-1.5 py-0.5 rounded border uppercase tracking-wide',
                            sc.className
                          )}
                        >
                          {sc.label}
                        </span>
                      </div>
                      {w.description && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {w.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <WorkflowIcon className="w-3 h-3" />
                          {w.nodes_count} nós · {w.edges_count} conexões
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          {w.runs_count} exec.
                        </span>
                        {w.last_run_at && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            última:{' '}
                            {new Date(w.last_run_at).toLocaleDateString(
                              'pt-BR'
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggle(w)}
                      title={w.status === 'active' ? 'Pausar' : 'Ativar'}
                    >
                      {w.status === 'active' ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/workflows/${w.id}`}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Editar
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setDeleteTarget(w)}
                          className="text-destructive focus:text-destructive focus:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Workflow</DialogTitle>
            <DialogDescription>
              Crie um workflow vazio. Você vai configurar gatilhos e ações no
              editor visual.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Nome
              </label>
              <Input
                placeholder="Ex: Recuperar aluno inativo há 7 dias"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Descrição <span className="text-muted-foreground/60">(opcional)</span>
              </label>
              <Input
                placeholder="Qual problema este workflow resolve?"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? 'Criando...' : 'Criar e abrir editor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir workflow?</DialogTitle>
            <DialogDescription>
              Esta ação é permanente. O workflow{' '}
              <span className="font-medium text-foreground">
                {deleteTarget?.name}
              </span>{' '}
              será removido.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
