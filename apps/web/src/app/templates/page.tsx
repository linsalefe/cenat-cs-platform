'use client';

import { useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';
import AppLayout from '@/components/AppLayout';
import PageHeader from '@/components/PageHeader';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  MessageSquareText,
  Plus,
  Trash2,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  Info,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

interface MetaTemplate {
  name: string;
  language: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | string;
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION' | string;
  components: Array<{
    type: string;
    text?: string;
    format?: string;
    example?: { body_text?: string[][] };
  }>;
  id?: string;
  rejected_reason?: string;
}

interface Channel {
  slug: string;
  name: string;
  phone_number?: string;
}

const STATUS_META: Record<string, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  APPROVED: { label: 'Aprovado', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30', icon: CheckCircle2 },
  PENDING:  { label: 'Em revisão', cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30', icon: Clock },
  REJECTED: { label: 'Rejeitado', cls: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30', icon: XCircle },
};

const CATEGORY_LABEL: Record<string, string> = {
  UTILITY: 'Transacional',
  MARKETING: 'Marketing',
  AUTHENTICATION: 'Autenticação',
};

function getBody(t: MetaTemplate): string {
  return t.components?.find((c) => c.type === 'BODY')?.text || '';
}

function countVariables(body: string): number {
  const matches = body.match(/\{\{\d+\}\}/g);
  return matches ? new Set(matches).size : 0;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<MetaTemplate[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeChannel, setActiveChannel] = useState<string>('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [selected, setSelected] = useState<MetaTemplate | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [cName, setCName] = useState('');
  const [cCategory, setCCategory] = useState<'UTILITY' | 'MARKETING'>('UTILITY');
  const [cBody, setCBody] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<MetaTemplate | null>(null);

  const loadChannels = async () => {
    try {
      const res = await api.get('/whatsapp/channels');
      const list: Channel[] = res.data || [];
      setChannels(list);
      if (list.length > 0 && !activeChannel) {
        setActiveChannel(list[0].slug);
      }
    } catch (e) {
      console.error(e);
      toast.error('Erro ao carregar canais');
    }
  };

  const loadTemplates = async () => {
    if (!activeChannel) return;
    try {
      setLoading(true);
      const res = await api.get('/whatsapp/templates', { params: { channel: activeChannel } });
      setTemplates(Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []));
    } catch (e) {
      console.error(e);
      toast.error('Erro ao carregar templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChannels();
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [activeChannel]);

  const filtered = useMemo(() => {
    return templates.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [templates, search, statusFilter]);

  const counts = useMemo(() => {
    const c = { all: templates.length, APPROVED: 0, PENDING: 0, REJECTED: 0 };
    for (const t of templates) {
      if (t.status === 'APPROVED') c.APPROVED++;
      else if (t.status === 'PENDING') c.PENDING++;
      else if (t.status === 'REJECTED') c.REJECTED++;
    }
    return c;
  }, [templates]);

  const handleCreate = async () => {
    if (!/^[a-z0-9_]+$/.test(cName)) {
      toast.error('Nome inválido — apenas letras minúsculas, números e underline');
      return;
    }
    if (cName.length < 3 || cName.length > 60) {
      toast.error('Nome deve ter entre 3 e 60 caracteres');
      return;
    }
    if (!cBody.trim() || cBody.length > 1024) {
      toast.error('Corpo da mensagem é obrigatório (até 1024 caracteres)');
      return;
    }
    if (!activeChannel) {
      toast.error('Selecione um canal');
      return;
    }

    try {
      setCreating(true);
      await api.post('/whatsapp/templates', {
        channel: activeChannel,
        name: cName,
        category: cCategory,
        language: 'pt_BR',
        body: cBody,
      });
      toast.success('Template enviado pra Meta. Aguardando aprovação.');
      setCreateOpen(false);
      setCName('');
      setCBody('');
      setCCategory('UTILITY');
      loadTemplates();
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string } } };
      toast.error(err?.response?.data?.detail || 'Erro ao criar template');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/whatsapp/templates/${deleteTarget.name}`, {
        params: { channel: activeChannel },
      });
      toast.success('Template removido');
      setDeleteTarget(null);
      if (selected?.name === deleteTarget.name) setSelected(null);
      loadTemplates();
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string } } };
      toast.error(err?.response?.data?.detail || 'Erro ao remover');
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Comunicação"
          title="Templates WhatsApp"
          description="Templates aprovados pela Meta para envio de mensagens iniciais ou fora da janela de 24h."
          actions={
            <div className="flex items-center gap-2">
              {channels.length > 1 && (
                <Select value={activeChannel} onValueChange={setActiveChannel}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {channels.map((c) => (
                      <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-1" />
                Novo template
              </Button>
            </div>
          }
        />

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-60 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome..."
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            {[
              { v: 'all', label: `Todos (${counts.all})` },
              { v: 'APPROVED', label: `Aprovados (${counts.APPROVED})` },
              { v: 'PENDING', label: `Em revisão (${counts.PENDING})` },
              { v: 'REJECTED', label: `Rejeitados (${counts.REJECTED})` },
            ].map((opt) => (
              <button
                key={opt.v}
                onClick={() => setStatusFilter(opt.v)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                  statusFilter === opt.v
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <MessageSquareText className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">
              {templates.length === 0 ? 'Nenhum template ainda' : 'Nenhum resultado'}
            </h3>
            <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto">
              {templates.length === 0
                ? 'Crie um template pra começar a enviar mensagens iniciais via WhatsApp.'
                : 'Ajuste os filtros ou a busca.'}
            </p>
            {templates.length === 0 && (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-1" />
                Criar primeiro template
              </Button>
            )}
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((t) => {
              const sm = STATUS_META[t.status] || STATUS_META.PENDING;
              const StatusIcon = sm.icon;
              const body = getBody(t);
              const vars = countVariables(body);
              return (
                <Card
                  key={t.name + t.language}
                  onClick={() => setSelected(t)}
                  className={cn(
                    'p-3 cursor-pointer hover:border-primary/50 transition-colors flex items-center gap-3',
                    selected?.name === t.name && 'border-primary'
                  )}
                >
                  <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <MessageSquareText className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="text-sm font-semibold text-foreground truncate font-mono">
                        {t.name}
                      </h3>
                      <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border uppercase inline-flex items-center gap-1', sm.cls)}>
                        <StatusIcon className="w-3 h-3" />
                        {sm.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{CATEGORY_LABEL[t.category] || t.category}</span>
                      <span>·</span>
                      <span>{t.language}</span>
                      {vars > 0 && (
                        <>
                          <span>·</span>
                          <span>{vars} variável{vars > 1 ? 'is' : ''}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(t); }}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                    title="Remover"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Detalhe lateral */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="font-mono">{selected.name}</DialogTitle>
                <DialogDescription>
                  {CATEGORY_LABEL[selected.category] || selected.category} · {selected.language}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Status</p>
                  {(() => {
                    const sm = STATUS_META[selected.status] || STATUS_META.PENDING;
                    const Icon = sm.icon;
                    return (
                      <span className={cn('text-xs font-semibold px-2 py-1 rounded border uppercase inline-flex items-center gap-1.5', sm.cls)}>
                        <Icon className="w-3.5 h-3.5" />
                        {sm.label}
                      </span>
                    );
                  })()}
                  {selected.status === 'REJECTED' && selected.rejected_reason && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                      Motivo: {selected.rejected_reason}
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Corpo da mensagem</p>
                  <div className="bg-muted rounded-lg p-3 text-sm whitespace-pre-wrap font-mono">
                    {getBody(selected) || '—'}
                  </div>
                </div>

                {countVariables(getBody(selected)) > 0 && (
                  <div className="text-xs text-muted-foreground inline-flex items-start gap-2">
                    <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>
                      As variáveis {`{{1}}, {{2}}...`} são substituídas pelos valores reais
                      no momento do envio (nome do aluno, curso etc).
                    </span>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelected(null)}>
                  Fechar
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => { setDeleteTarget(selected); setSelected(null); }}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Remover
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Criar template */}
      <Dialog open={createOpen} onOpenChange={(o) => !o && !creating && setCreateOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo template</DialogTitle>
            <DialogDescription>
              O template será enviado para a Meta para aprovação. Pode levar de minutos a 24h.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">
                Nome <span className="text-destructive">*</span>
              </label>
              <Input
                value={cName}
                onChange={(e) => setCName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                placeholder="ex: lembrete_pagamento"
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Apenas letras minúsculas, números e underscore. 3-60 caracteres.
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">
                Categoria <span className="text-destructive">*</span>
              </label>
              <Select value={cCategory} onValueChange={(v) => setCCategory(v as 'UTILITY' | 'MARKETING')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTILITY">Transacional (lembrete, notificação, pagamento)</SelectItem>
                  <SelectItem value="MARKETING">Marketing (promoção, novidade)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">
                Corpo da mensagem <span className="text-destructive">*</span>
              </label>
              <textarea
                value={cBody}
                onChange={(e) => setCBody(e.target.value)}
                rows={6}
                placeholder="Olá {{1}}, sua mensalidade do curso {{2}} vence amanhã."
                maxLength={1024}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none resize-none font-mono"
              />
              <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                <span>Use {'{{1}}, {{2}}...'} para variáveis dinâmicas.</span>
                <span>{cBody.length} / 1024</span>
              </div>
            </div>

            {cBody && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Preview</p>
                <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-lg p-3 text-sm whitespace-pre-wrap">
                  {cBody.replace(/\{\{1\}\}/g, 'João').replace(/\{\{2\}\}/g, 'Psicologia Clínica').replace(/\{\{(\d+)\}\}/g, 'valor$1')}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              Enviar pra Meta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar delete */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover template?</DialogTitle>
            <DialogDescription>
              O template <span className="font-mono font-medium text-foreground">{deleteTarget?.name}</span> será
              removido da Meta. Essa ação é definitiva — workflows e automações que usem esse template vão falhar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Remover definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
