'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import AppLayout from '@/components/AppLayout';
import {
  Send,
  Plus,
  Search,
  Trash2,
  Eye,
  PlayCircle,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

interface BroadcastType {
  id: number;
  name: string;
  description: string | null;
  channel: string;
  template_name: string;
  status: string;
  total_students: number;
  sent_count: number;
  failed_count: number;
  pending_count: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: 'Rascunho', color: 'bg-gray-100 text-gray-700', icon: Clock },
  sending: { label: 'Enviando...', color: 'bg-blue-50 text-blue-700', icon: Loader2 },
  completed: { label: 'Concluído', color: 'bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
  partial: { label: 'Parcial', color: 'bg-amber-50 text-amber-700', icon: AlertCircle },
  failed: { label: 'Falhou', color: 'bg-red-50 text-red-700', icon: XCircle },
  cancelled: { label: 'Cancelado', color: 'bg-gray-100 text-gray-500', icon: XCircle },
};

const channelLabels: Record<string, string> = {
  cs: 'CS',
  secretaria: 'Secretaria',
  financeiro: 'Financeiro',
  pedagogico: 'Pedagógico',
};

export default function BroadcastsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [broadcasts, setBroadcasts] = useState<BroadcastType[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) loadBroadcasts();
  }, [user]);

  const loadBroadcasts = async () => {
    try {
      const res = await api.get('/broadcasts');
      setBroadcasts(res.data.data || []);
    } catch (error) {
      console.error('Erro ao carregar disparos:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteBroadcast = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Tem certeza que deseja excluir este disparo?')) return;
    try {
      await api.delete(`/broadcasts/${id}`);
      setBroadcasts((prev) => prev.filter((b) => b.id !== id));
      toast.success('Disparo removido');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Erro ao remover');
    }
  };

  const sendBroadcast = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Iniciar o envio? As mensagens serão enviadas para todos os alunos filtrados.')) return;
    try {
      await api.post(`/broadcasts/${id}/send`);
      toast.success('Disparo iniciado!');
      loadBroadcasts();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Erro ao iniciar disparo');
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filtered = broadcasts.filter((b) => {
    const matchSearch = b.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || b.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: broadcasts.length,
    draft: broadcasts.filter((b) => b.status === 'draft').length,
    completed: broadcasts.filter((b) => b.status === 'completed').length,
    totalSent: broadcasts.reduce((acc, b) => acc + b.sent_count, 0),
  };

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="animate-pulse space-y-8">
          <div className="h-8 bg-gray-100 rounded-lg w-48"></div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-100 rounded-2xl"></div>
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className={`flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 transition-all duration-700 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
          <div>
            <p className="text-sm font-medium text-[#2A658F] mb-1">WhatsApp em Massa</p>
            <h1 className="text-3xl font-semibold text-[#27273D] tracking-tight">Disparos</h1>
          </div>
          <button
            onClick={() => router.push('/broadcasts/new')}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-[#2A658F] to-[#3d7ba8] rounded-xl hover:shadow-lg hover:shadow-[#2A658F]/30 hover:-translate-y-0.5 transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            Novo Disparo
          </button>
        </div>

        {/* Stats */}
        <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 transition-all duration-700 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '100ms' }}>
          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mb-2">
              <Send className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-2xl font-semibold text-[#27273D]">{stats.total}</p>
            <p className="text-sm text-gray-500">Total de disparos</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center mb-2">
              <Clock className="w-5 h-5 text-gray-600" />
            </div>
            <p className="text-2xl font-semibold text-[#27273D]">{stats.draft}</p>
            <p className="text-sm text-gray-500">Rascunhos</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center mb-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-2xl font-semibold text-[#27273D]">{stats.completed}</p>
            <p className="text-sm text-gray-500">Concluídos</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center mb-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-2xl font-semibold text-[#27273D]">{stats.totalSent}</p>
            <p className="text-sm text-gray-500">Mensagens enviadas</p>
          </div>
        </div>

        {/* Filters */}
        <div className={`flex flex-col sm:flex-row gap-4 transition-all duration-700 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '200ms' }}>
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar disparo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:border-[#2A658F] focus:ring-4 focus:ring-[#2A658F]/10 transition-all outline-none"
            />
          </div>
          <div className="flex gap-2">
            {['all', 'draft', 'sending', 'completed', 'partial', 'failed'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  statusFilter === s
                    ? 'bg-[#2A658F] text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                }`}
              >
                {s === 'all' ? 'Todos' : statusConfig[s]?.label || s}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className={`space-y-3 transition-all duration-700 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '300ms' }}>
          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Send className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Nenhum disparo</h3>
              <p className="text-gray-500 mb-4">Crie seu primeiro disparo em massa</p>
              <button
                onClick={() => router.push('/broadcasts/new')}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#2A658F] bg-[#E2ECF4] hover:bg-[#CCE4F4] rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Criar disparo
              </button>
            </div>
          ) : (
            filtered.map((broadcast) => {
              const status = statusConfig[broadcast.status] || statusConfig.draft;
              const StatusIcon = status.icon;
              const progress = broadcast.total_students > 0
                ? Math.round(((broadcast.sent_count + broadcast.failed_count) / broadcast.total_students) * 100)
                : 0;

              return (
                <div
                  key={broadcast.id}
                  onClick={() => router.push(`/broadcasts/${broadcast.id}`)}
                  className="group bg-white rounded-xl border border-gray-100 p-5 cursor-pointer hover:shadow-lg hover:shadow-gray-100/50 hover:border-gray-200 transition-all duration-300"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-[#2A658F] to-[#3d7ba8]">
                      <Send className="w-6 h-6 text-white" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-[#27273D] group-hover:text-[#2A658F] transition-colors">
                          {broadcast.name}
                        </h3>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full ${status.color}`}>
                          <StatusIcon className={`w-3 h-3 ${broadcast.status === 'sending' ? 'animate-spin' : ''}`} />
                          {status.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-500">
                        <span>Canal: {channelLabels[broadcast.channel] || broadcast.channel}</span>
                        <span className="text-gray-300">•</span>
                        <span>Template: {broadcast.template_name}</span>
                        <span className="text-gray-300">•</span>
                        <span>{broadcast.total_students} alunos</span>
                      </div>

                      {broadcast.status !== 'draft' && (
                        <div className="mt-2 flex items-center gap-3">
                          <div className="flex-1 max-w-xs bg-gray-100 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                broadcast.status === 'completed' ? 'bg-emerald-500' :
                                broadcast.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'
                              }`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">
                            {broadcast.sent_count} enviados · {broadcast.failed_count} falhas
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {broadcast.status === 'draft' && (
                        <>
                          <button
                            onClick={(e) => sendBroadcast(broadcast.id, e)}
                            className="p-2 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                            title="Enviar"
                          >
                            <PlayCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => deleteBroadcast(broadcast.id, e)}
                            className="p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#2A658F] transition-colors" />
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-gray-400 ml-16">
                    Criado em {formatDate(broadcast.created_at)}
                    {broadcast.completed_at && ` · Finalizado em ${formatDate(broadcast.completed_at)}`}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </AppLayout>
  );
}
