'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import AppLayout from '@/components/AppLayout';
import {
  Send,
  ArrowLeft,
  PlayCircle,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Users,
  RefreshCw,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

interface BroadcastDetail {
  id: number;
  name: string;
  description: string | null;
  channel: string;
  filters: Record<string, any>;
  template_name: string;
  template_language: string;
  template_params: string[];
  status: string;
  total_students: number;
  sent_count: number;
  failed_count: number;
  pending_count: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  logs: LogEntry[];
}

interface LogEntry {
  id: number;
  student_id: number;
  student_name: string;
  phone: string;
  status: string;
  message_id: string | null;
  error: string | null;
  sent_at: string | null;
}

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  draft: { label: 'Rascunho', color: 'text-foreground/90', bg: 'bg-muted', icon: Clock },
  sending: { label: 'Enviando...', color: 'text-blue-700', bg: 'bg-blue-50', icon: Loader2 },
  completed: { label: 'Concluído', color: 'text-emerald-700', bg: 'bg-emerald-50', icon: CheckCircle2 },
  partial: { label: 'Parcial', color: 'text-amber-700', bg: 'bg-amber-50', icon: AlertCircle },
  failed: { label: 'Falhou', color: 'text-red-700', bg: 'bg-red-50', icon: XCircle },
  cancelled: { label: 'Cancelado', color: 'text-muted-foreground', bg: 'bg-muted', icon: XCircle },
};

const logStatusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendente', color: 'bg-muted text-muted-foreground' },
  sent: { label: 'Enviado', color: 'bg-emerald-50 text-emerald-700' },
  delivered: { label: 'Entregue', color: 'bg-blue-50 text-blue-700' },
  read: { label: 'Lido', color: 'bg-purple-50 text-purple-700' },
  failed: { label: 'Falhou', color: 'bg-red-50 text-red-700' },
};

const channelLabels: Record<string, string> = {
  cs: 'CS',
  secretaria: 'Secretaria',
  financeiro: 'Financeiro',
  pedagogico: 'Pedagógico',
};

export default function BroadcastDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const broadcastId = params.id;

  const [broadcast, setBroadcast] = useState<BroadcastDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && broadcastId) loadBroadcast();
  }, [user, broadcastId]);

  const loadBroadcast = async () => {
    try {
      const res = await api.get(`/broadcasts/${broadcastId}`);
      setBroadcast(res.data);
    } catch {
      toast.error('Erro ao carregar disparo');
      router.push('/broadcasts');
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!confirm('Iniciar o envio? As mensagens serão enviadas para todos os alunos.')) return;
    try {
      await api.post(`/broadcasts/${broadcastId}/send`);
      toast.success('Disparo iniciado!');
      loadBroadcast();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Erro ao iniciar');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Excluir este disparo?')) return;
    try {
      await api.delete(`/broadcasts/${broadcastId}`);
      toast.success('Disparo removido');
      router.push('/broadcasts');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Erro ao excluir');
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded-lg w-64"></div>
          <div className="h-48 bg-muted rounded-2xl"></div>
        </div>
      </AppLayout>
    );
  }

  if (!broadcast) return null;

  const status = statusConfig[broadcast.status] || statusConfig.draft;
  const StatusIcon = status.icon;
  const progress = broadcast.total_students > 0
    ? Math.round(((broadcast.sent_count + broadcast.failed_count) / broadcast.total_students) * 100)
    : 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className={`transition-all duration-700 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
          <button onClick={() => router.push('/broadcasts')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-4">
            <ArrowLeft className="w-4 h-4" />
            Voltar para Disparos
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-primary to-primary/80">
                <Send className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-foreground">{broadcast.name}</h1>
                {broadcast.description && <p className="text-sm text-muted-foreground">{broadcast.description}</p>}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {broadcast.status === 'sending' && (
                <button onClick={loadBroadcast} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-primary bg-primary/10 rounded-xl hover:bg-primary/15 transition-all">
                  <RefreshCw className="w-4 h-4" />
                  Atualizar
                </button>
              )}
              {broadcast.status === 'draft' && (
                <>
                  <button onClick={handleSend} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all">
                    <PlayCircle className="w-4 h-4" />
                    Enviar Agora
                  </button>
                  <button onClick={handleDelete} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className={`grid grid-cols-2 lg:grid-cols-5 gap-4 transition-all duration-700 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '100ms' }}>
          <div className="bg-card rounded-2xl p-5 border border-border">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full ${status.bg} ${status.color}`}>
              <StatusIcon className={`w-3.5 h-3.5 ${broadcast.status === 'sending' ? 'animate-spin' : ''}`} />
              {status.label}
            </span>
            <p className="text-sm text-muted-foreground mt-2">Status</p>
          </div>
          <div className="bg-card rounded-2xl p-5 border border-border">
            <p className="text-2xl font-semibold text-foreground">{broadcast.total_students}</p>
            <p className="text-sm text-muted-foreground">Total</p>
          </div>
          <div className="bg-card rounded-2xl p-5 border border-border">
            <p className="text-2xl font-semibold text-emerald-600">{broadcast.sent_count}</p>
            <p className="text-sm text-muted-foreground">Enviados</p>
          </div>
          <div className="bg-card rounded-2xl p-5 border border-border">
            <p className="text-2xl font-semibold text-red-600">{broadcast.failed_count}</p>
            <p className="text-sm text-muted-foreground">Falhas</p>
          </div>
          <div className="bg-card rounded-2xl p-5 border border-border">
            <p className="text-2xl font-semibold text-blue-600">{broadcast.pending_count}</p>
            <p className="text-sm text-muted-foreground">Pendentes</p>
          </div>
        </div>

        {/* Progress bar */}
        {broadcast.status !== 'draft' && (
          <div className="bg-card rounded-2xl border border-border p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground/90">Progresso</span>
              <span className="text-sm text-muted-foreground">{progress}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-3">
              <div className={`h-3 rounded-full transition-all duration-500 ${broadcast.status === 'completed' ? 'bg-emerald-500' : broadcast.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {/* Details */}
        <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 transition-all duration-700 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '200ms' }}>
          <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Configuração</h2>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-sm text-muted-foreground">Canal</span>
                <span className="text-sm font-medium">{channelLabels[broadcast.channel] || broadcast.channel}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-sm text-muted-foreground">Template</span>
                <span className="text-sm font-medium font-mono">{broadcast.template_name}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-sm text-muted-foreground">Idioma</span>
                <span className="text-sm font-medium">{broadcast.template_language}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-sm text-muted-foreground">Criado em</span>
                <span className="text-sm text-foreground/90">{formatDate(broadcast.created_at)}</span>
              </div>
              {broadcast.started_at && (
                <div className="flex justify-between py-2 border-b border-gray-50">
                  <span className="text-sm text-muted-foreground">Iniciado em</span>
                  <span className="text-sm text-foreground/90">{formatDate(broadcast.started_at)}</span>
                </div>
              )}
              {broadcast.completed_at && (
                <div className="flex justify-between py-2">
                  <span className="text-sm text-muted-foreground">Finalizado em</span>
                  <span className="text-sm text-foreground/90">{formatDate(broadcast.completed_at)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border p-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">Filtros aplicados</h2>
            {Object.keys(broadcast.filters || {}).length === 0 ? (
              <p className="text-sm text-muted-foreground/70 italic">Sem filtros (todos os alunos com telefone)</p>
            ) : (
              <pre className="bg-muted/50 rounded-xl p-4 text-xs font-mono text-foreground/90 overflow-x-auto">
                {JSON.stringify(broadcast.filters, null, 2)}
              </pre>
            )}
            {broadcast.template_params && broadcast.template_params.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-foreground/90 mb-2">Parâmetros</h3>
                <div className="space-y-1">
                  {broadcast.template_params.map((p: string, i: number) => (
                    <p key={i} className="text-sm text-muted-foreground">
                      <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{`{{${i + 1}}}`}</code> → {p}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Logs */}
        <div className={`bg-card rounded-2xl border border-border transition-all duration-700 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '300ms' }}>
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Users className="w-5 h-5 text-muted-foreground/70" />
              Log de Envios ({broadcast.logs?.length || 0})
            </h2>
          </div>

          {!broadcast.logs || broadcast.logs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground">Nenhum envio registrado ainda</p>
              {broadcast.status === 'draft' && (
                <p className="text-xs text-muted-foreground/70 mt-1">Os logs aparecerão após iniciar o envio</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <th className="px-6 py-3">Aluno</th>
                    <th className="px-6 py-3">Telefone</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Enviado em</th>
                    <th className="px-6 py-3">Erro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {broadcast.logs.map((log) => {
                    const ls = logStatusConfig[log.status] || logStatusConfig.pending;
                    return (
                      <tr key={log.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-6 py-3 text-sm font-medium text-foreground">{log.student_name}</td>
                        <td className="px-6 py-3 text-sm text-muted-foreground">{log.phone}</td>
                        <td className="px-6 py-3">
                          <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ${ls.color}`}>
                            {ls.label}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-sm text-muted-foreground">
                          {log.sent_at ? formatDate(log.sent_at) : '-'}
                        </td>
                        <td className="px-6 py-3 text-xs text-red-500 max-w-xs truncate">
                          {log.error || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
