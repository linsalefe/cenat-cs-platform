'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import AppLayout from '@/components/AppLayout';
import { Avatar } from '@/components/ui';
import {
  Search,
  Ticket,
  Clock,
  AlertCircle,
  CheckCircle2,
  User,
  Filter,
  ChevronRight,
  Inbox,
  XCircle,
  Timer,
  ArrowRight,
} from 'lucide-react';
import api from '@/lib/api';

interface TicketItem {
  id: number;
  protocol: string;
  subject: string;
  status: string;
  category: string;
  priority: string;
  sla_deadline: string;
  created_at: string;
  student: { id: number; name: string; email: string };
  assigned_to: { id: number; name: string } | null;
}

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  open: { label: 'Aberto', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-100', icon: Inbox },
  in_progress: { label: 'Em Andamento', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-100', icon: Timer },
  waiting_student: { label: 'Aguardando', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-100', icon: Clock },
  resolved: { label: 'Resolvido', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-100', icon: CheckCircle2 },
  closed: { label: 'Fechado', color: 'text-gray-600', bg: 'bg-gray-100 border-gray-200', icon: XCircle },
};

const categoryLabels: Record<string, string> = {
  financial: 'Financeiro',
  academic: 'Acadêmico',
  technical: 'Técnico',
  administrative: 'Administrativo',
  other: 'Outro',
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  low: { label: 'Baixa', color: 'text-gray-500' },
  medium: { label: 'Média', color: 'text-amber-600' },
  high: { label: 'Alta', color: 'text-orange-600' },
  urgent: { label: 'Urgente', color: 'text-red-600' },
};

export default function TicketsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      loadTickets();
    }
  }, [user]);

  const loadTickets = async () => {
    try {
      const res = await api.get('/tickets');
      setTickets(res.data);
    } catch (error) {
      console.error('Erro ao carregar tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTickets = tickets.filter((t) => {
    const matchesSearch =
      t.protocol.toLowerCase().includes(search.toLowerCase()) ||
      t.subject.toLowerCase().includes(search.toLowerCase()) ||
      t.student.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const stats = {
    total: tickets.length,
    open: tickets.filter((t) => t.status === 'open').length,
    inProgress: tickets.filter((t) => t.status === 'in_progress').length,
    unassigned: tickets.filter((t) => !t.assigned_to && t.status !== 'closed' && t.status !== 'resolved').length,
  };

  const isOverdue = (deadline: string) => new Date(deadline) < new Date();

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
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
          <div className="h-12 bg-gray-100 rounded-xl"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-xl"></div>
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
        <div
          className={`transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
          }`}
        >
          <p className="text-sm font-medium text-[#2A658F] mb-1">Atendimento</p>
          <h1 className="text-3xl font-semibold text-[#27273D] tracking-tight">Tickets</h1>
        </div>

        {/* Stats */}
        <div
          className={`grid grid-cols-2 lg:grid-cols-4 gap-4 transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '100ms' }}
        >
          <button
            onClick={() => setStatusFilter('all')}
            className={`bg-white rounded-2xl p-5 border transition-all duration-300 text-left
              ${statusFilter === 'all' ? 'border-[#2A658F] shadow-lg shadow-blue-100' : 'border-gray-100 hover:border-gray-200'}`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center">
                <Ticket className="w-5 h-5 text-slate-600" />
              </div>
              {statusFilter === 'all' && <div className="w-2 h-2 bg-[#2A658F] rounded-full" />}
            </div>
            <p className="text-2xl font-semibold text-[#27273D]">{stats.total}</p>
            <p className="text-sm text-gray-500">Total</p>
          </button>

          <button
            onClick={() => setStatusFilter('open')}
            className={`bg-white rounded-2xl p-5 border transition-all duration-300 text-left
              ${statusFilter === 'open' ? 'border-blue-400 shadow-lg shadow-blue-100' : 'border-gray-100 hover:border-gray-200'}`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <Inbox className="w-5 h-5 text-blue-600" />
              </div>
              {statusFilter === 'open' && <div className="w-2 h-2 bg-blue-500 rounded-full" />}
            </div>
            <p className="text-2xl font-semibold text-[#27273D]">{stats.open}</p>
            <p className="text-sm text-gray-500">Abertos</p>
          </button>

          <button
            onClick={() => setStatusFilter('in_progress')}
            className={`bg-white rounded-2xl p-5 border transition-all duration-300 text-left
              ${statusFilter === 'in_progress' ? 'border-amber-400 shadow-lg shadow-amber-100' : 'border-gray-100 hover:border-gray-200'}`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                <Timer className="w-5 h-5 text-amber-600" />
              </div>
              {statusFilter === 'in_progress' && <div className="w-2 h-2 bg-amber-500 rounded-full" />}
            </div>
            <p className="text-2xl font-semibold text-[#27273D]">{stats.inProgress}</p>
            <p className="text-sm text-gray-500">Em andamento</p>
          </button>

          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
                <User className="w-5 h-5 text-orange-600" />
              </div>
            </div>
            <p className="text-2xl font-semibold text-[#27273D]">{stats.unassigned}</p>
            <p className="text-sm text-gray-500">Não atribuídos</p>
          </div>
        </div>

        {/* Filters */}
        <div
          className={`flex flex-col sm:flex-row gap-4 transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '200ms' }}
        >
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por protocolo, assunto ou aluno..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl
                focus:border-[#2A658F] focus:ring-4 focus:ring-[#2A658F]/10 
                transition-all duration-200 outline-none"
            />
          </div>

          <div className="flex gap-3">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm
                focus:border-[#2A658F] focus:ring-4 focus:ring-[#2A658F]/10 
                transition-all duration-200 outline-none"
            >
              <option value="all">Todas categorias</option>
              <option value="financial">Financeiro</option>
              <option value="academic">Acadêmico</option>
              <option value="technical">Técnico</option>
              <option value="administrative">Administrativo</option>
              <option value="other">Outro</option>
            </select>
          </div>
        </div>

        {/* Tickets List */}
        <div
          className={`transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '300ms' }}
        >
          {filteredTickets.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Ticket className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Nenhum ticket encontrado</h3>
              <p className="text-gray-500">Tente ajustar os filtros ou aguarde novos tickets</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTickets.map((ticket, index) => {
                const status = statusConfig[ticket.status] || statusConfig.open;
                const StatusIcon = status.icon;
                const overdue = isOverdue(ticket.sla_deadline) && !['resolved', 'closed'].includes(ticket.status);

                return (
                  <div
                    key={ticket.id}
                    onClick={() => router.push(`/tickets/${ticket.id}`)}
                    className="group bg-white rounded-xl border border-gray-100 p-5 
                      hover:border-gray-200 hover:shadow-lg hover:shadow-gray-100/50 
                      transition-all duration-300 cursor-pointer"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-start gap-4">
                      <Avatar name={ticket.student.name} size="md" />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-[#2A658F]">{ticket.protocol}</span>
                              <span className={`text-xs font-medium ${priorityConfig[ticket.priority]?.color || 'text-gray-500'}`}>
                                • {priorityConfig[ticket.priority]?.label || ticket.priority}
                              </span>
                            </div>
                            <h3 className="font-medium text-[#27273D] group-hover:text-[#2A658F] transition-colors">
                              {ticket.subject}
                            </h3>
                            <p className="text-sm text-gray-500 mt-0.5">
                              {ticket.student.name} • {categoryLabels[ticket.category] || ticket.category}
                            </p>
                          </div>

                          <div className="flex flex-col items-end gap-2">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border ${status.bg} ${status.color}`}>
                              <StatusIcon className="w-3.5 h-3.5" />
                              {status.label}
                            </span>
                            
                            {overdue && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 animate-pulse">
                                <AlertCircle className="w-3.5 h-3.5" />
                                SLA vencido
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                          <div className="flex items-center gap-4 text-xs text-gray-400">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {formatDate(ticket.created_at)}
                            </span>
                            {ticket.assigned_to && (
                              <span className="flex items-center gap-1">
                                <User className="w-3.5 h-3.5" />
                                {ticket.assigned_to.name}
                              </span>
                            )}
                          </div>
                          <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-[#2A658F] group-hover:translate-x-1 transition-all" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Results count */}
        {filteredTickets.length > 0 && (
          <p className="text-sm text-gray-500 text-center">
            Mostrando {filteredTickets.length} de {tickets.length} tickets
          </p>
        )}
      </div>
    </AppLayout>
  );
}
