'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import EmptyState from '@/components/EmptyState';
import LoadingState from '@/components/LoadingState';

// --- Interfaces ---
interface Student {
  id: number;
  name: string;
  email: string;
  phone: string | null;
}

interface Ticket {
  id: number;
  protocol: string;
  student_id: number;
  assigned_to_id: number | null;
  status: string;
  category: string;
  priority: string;
  subject: string | null;
  sla_deadline: string;
  created_at: string;
  student: Student;
  assigned_to: { id: number; name: string } | null;
}

// --- Constantes Visuais ---
const statusLabels: Record<string, string> = {
  open: 'Aberto',
  in_progress: 'Em Andamento',
  waiting_student: 'Aguardando Aluno',
  resolved: 'Resolvido',
  closed: 'Fechado',
};

const statusColors: Record<string, string> = {
  open: 'bg-amber-100 text-amber-800',
  in_progress: 'bg-[#CCE4F4] text-[#2A658F]',
  waiting_student: 'bg-purple-100 text-purple-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-600',
};

const categoryLabels: Record<string, string> = {
  financial: 'Financeiro',
  academic: 'Acadêmico',
  technical: 'Técnico',
  administrative: 'Administrativo',
  other: 'Outro',
};

const priorityLabels: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
};

const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-[#CCE4F4] text-[#2A658F]',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800',
};

// --- Helpers ---
function getSlaStatus(slaDeadline: string, status: string): { label: string; color: string } {
  if (['resolved', 'closed'].includes(status)) {
    return { label: 'Finalizado', color: 'bg-gray-100 text-gray-500' };
  }

  const now = new Date();
  const deadline = new Date(slaDeadline);
  const hoursLeft = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursLeft < 0) return { label: 'Atrasado', color: 'bg-red-500 text-white font-bold' };
  if (hoursLeft < 4) return { label: `${Math.round(hoursLeft)}h restam`, color: 'bg-red-100 text-red-800' };
  if (hoursLeft < 24) return { label: `${Math.round(hoursLeft)}h`, color: 'bg-amber-100 text-amber-800' };
  
  const daysLeft = Math.round(hoursLeft / 24);
  return { label: `${daysLeft} dias`, color: 'bg-green-100 text-green-800' };
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
};

// --- Componente Mobile ---
function MobileTicketCard({ 
  ticket, 
  onNavigate, 
  onAssign, 
  assigningId 
}: { 
  ticket: Ticket; 
  onNavigate: () => void; 
  onAssign: (e: React.MouseEvent) => void;
  assigningId: number | null;
}) {
  const sla = getSlaStatus(ticket.sla_deadline, ticket.status);
  
  return (
    <div 
      onClick={onNavigate}
      className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-3 active:scale-[0.98] transition-transform cursor-pointer"
    >
      {/* Cabeçalho do Card: Protocolo e Status */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <span className="font-mono text-xs font-bold text-[#2A658F] bg-blue-50 px-1.5 py-0.5 rounded">
            #{ticket.protocol}
          </span>
          <p className="text-xs text-gray-400 mt-1">{formatDate(ticket.created_at)}</p>
        </div>
        <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded-full ${statusColors[ticket.status]}`}>
          {statusLabels[ticket.status]}
        </span>
      </div>

      {/* Corpo: Aluno e Assunto */}
      <div className="mb-4">
        <h3 className="font-semibold text-[#27273D] text-sm mb-0.5">{ticket.student.name}</h3>
        <p className="text-sm text-gray-600 line-clamp-2 leading-snug">
          {ticket.subject || <span className="italic text-gray-400">Sem assunto</span>}
        </p>
        <p className="text-xs text-gray-400 mt-1">{categoryLabels[ticket.category]}</p>
      </div>

      {/* Rodapé: Badges e Ação */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-50">
        <div className="flex gap-2">
           <span className={`px-2 py-1 text-[10px] font-medium rounded-full ${priorityColors[ticket.priority]}`}>
             {priorityLabels[ticket.priority]}
           </span>
           <span className={`px-2 py-1 text-[10px] font-medium rounded-full ${sla.color}`}>
             {sla.label}
           </span>
        </div>

        {!ticket.assigned_to_id ? (
          <button
            onClick={(e) => { e.stopPropagation(); onAssign(e); }}
            disabled={assigningId === ticket.id}
            className="text-xs font-medium text-[#2A658F] border border-[#2A658F] px-3 py-1.5 rounded-md active:bg-blue-50"
          >
            {assigningId === ticket.id ? '...' : 'Assumir'}
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
             <div className="h-5 w-5 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600">
                {ticket.assigned_to?.name.charAt(0)}
             </div>
             <span className="text-xs text-gray-500 max-w-[80px] truncate">
                {ticket.assigned_to?.name}
             </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TicketsPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  const [loadError, setLoadError] = useState(false);
  const [assigningId, setAssigningId] = useState<number | null>(null);

  useEffect(() => {
    fetchTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, categoryFilter]);

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      if (!searchTerm) return true;
      const lowerTerm = searchTerm.toLowerCase();
      return (
        t.protocol.toLowerCase().includes(lowerTerm) ||
        t.student.name.toLowerCase().includes(lowerTerm) ||
        (t.subject && t.subject.toLowerCase().includes(lowerTerm))
      );
    });
  }, [tickets, searchTerm]);

  const fetchTickets = async () => {
    setLoadingTickets(true);
    setLoadError(false);

    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (categoryFilter) params.append('category', categoryFilter);

      const res = await api.get(`/tickets?${params.toString()}`);
      setTickets(res.data);
    } catch (err) {
      console.error('Erro ao buscar tickets:', err);
      setTickets([]);
      setLoadError(true);
      toast.error('Erro ao carregar lista de tickets');
    } finally {
      setLoadingTickets(false);
    }
  };

  const handleAssign = async (e: React.MouseEvent, ticketId: number) => {
    e.stopPropagation();
    setAssigningId(ticketId);
    try {
      await api.patch(`/tickets/${ticketId}/assign`);
      
      setTickets(prev => prev.map(t => 
        t.id === ticketId ? { ...t, assigned_to_id: 999, assigned_to: { id: 999, name: 'Você' } } : t
      ));
      
      toast.success('Ticket assumido!', {
        description: `Você agora é responsável pelo protocolo #${tickets.find(t => t.id === ticketId)?.protocol}`
      });

      await fetchTickets(); 
    } catch (err) {
      console.error('Erro ao assumir ticket:', err);
      toast.error('Não foi possível assumir o ticket');
    } finally {
      setAssigningId(null);
    }
  };

  const clearFilters = () => {
    setStatusFilter('');
    setCategoryFilter('');
    setSearchTerm('');
  };

  const hasFilters = statusFilter || categoryFilter || searchTerm;

  return (
    <AppLayout>
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#27273D]">Tickets</h1>
          <p className="text-gray-600 mt-1">Gerencie a fila de atendimento aos alunos</p>
        </div>
        
        <button 
          onClick={fetchTickets}
          className="text-sm text-[#2A658F] hover:text-[#27273D] flex items-center gap-2 font-medium transition-colors"
        >
          <svg className={`w-4 h-4 ${loadingTickets ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Atualizar lista
        </button>
      </div>

      {/* Área de Controles */}
      <div className="bg-white p-4 rounded-xl shadow-sm mb-6 flex flex-col lg:flex-row gap-4 lg:items-end">
        
        <div className="flex-1">
          <label className="block text-sm font-medium text-[#27273D] mb-1">Buscar</label>
          <div className="relative">
            <input
              type="text"
              placeholder="Protocolo, nome ou assunto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border border-gray-300 rounded-md pl-9 pr-3 py-2 text-sm focus:ring-[#2A658F] focus:border-[#2A658F] transition-all"
            />
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:flex lg:gap-4 gap-4">
            <div className="w-full lg:w-48">
            <label className="block text-sm font-medium text-[#27273D] mb-1">Status</label>
            <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-[#2A658F] focus:border-[#2A658F] bg-white cursor-pointer"
            >
                <option value="">Todos</option>
                <option value="open">Aberto</option>
                <option value="in_progress">Em Andamento</option>
                <option value="waiting_student">Aguardando Aluno</option>
                <option value="resolved">Resolvido</option>
                <option value="closed">Fechado</option>
            </select>
            </div>

            <div className="w-full lg:w-48">
            <label className="block text-sm font-medium text-[#27273D] mb-1">Categoria</label>
            <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-[#2A658F] focus:border-[#2A658F] bg-white cursor-pointer"
            >
                <option value="">Todas</option>
                <option value="financial">Financeiro</option>
                <option value="academic">Acadêmico</option>
                <option value="technical">Técnico</option>
                <option value="administrative">Administrativo</option>
                <option value="other">Outro</option>
            </select>
            </div>
        </div>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="px-4 py-2 rounded-md border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors whitespace-nowrap"
          >
            Limpar filtros
          </button>
        )}
      </div>

      <div className="bg-transparent md:bg-white md:rounded-xl md:shadow-sm overflow-hidden min-h-[400px]">
        {loadingTickets ? (
          <LoadingState label="Carregando tickets..." />
        ) : loadError ? (
          <div className="py-20 flex flex-col items-center justify-center text-center bg-white rounded-xl">
            <EmptyState
              title="Não foi possível carregar os tickets"
              description="Verifique sua conexão e tente novamente."
            />
            <button
              onClick={fetchTickets}
              className="mt-4 px-4 py-2 rounded-md bg-[#2A658F] text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Tentar novamente
            </button>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="py-10 bg-white rounded-xl">
             <EmptyState
              title="Nenhum ticket encontrado"
              description={hasFilters ? "Tente ajustar ou limpar os filtros de busca." : "Não há tickets na fila no momento."}
            />
             {hasFilters && (
                <div className="flex justify-center mt-4">
                   <button onClick={clearFilters} className="text-[#2A658F] hover:underline text-sm">Limpar todos os filtros</button>
                </div>
             )}
          </div>
        ) : (
          <>
            {/* VERSÃO MOBILE: Cards */}
            <div className="md:hidden space-y-3">
              {filteredTickets.map((ticket) => (
                <MobileTicketCard
                  key={ticket.id}
                  ticket={ticket}
                  onNavigate={() => router.push(`/tickets/${ticket.id}`)}
                  onAssign={(e) => handleAssign(e, ticket.id)}
                  assigningId={assigningId}
                />
              ))}
            </div>

            {/* VERSÃO DESKTOP: Tabela */}
            <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-[#CCE4F4]">
                    <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-[#27273D] uppercase tracking-wider">Protocolo</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-[#27273D] uppercase tracking-wider">Aluno</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-[#27273D] uppercase tracking-wider">Assunto</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-[#27273D] uppercase tracking-wider">Prioridade</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-[#27273D] uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-[#27273D] uppercase tracking-wider">SLA</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-[#27273D] uppercase tracking-wider">Responsável</th>
                    </tr>
                </thead>

                <tbody className="bg-white divide-y divide-gray-200">
                    {filteredTickets.map((ticket) => {
                    const sla = getSlaStatus(ticket.sla_deadline, ticket.status);
                    return (
                        <tr 
                        key={ticket.id} 
                        onClick={() => router.push(`/tickets/${ticket.id}`)}
                        className="hover:bg-[#E2ECF4] cursor-pointer transition-colors group"
                        title={`Criado em: ${formatDate(ticket.created_at)}`}
                        >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#2A658F]">
                            <span className="group-hover:underline decoration-1 underline-offset-2">
                            {ticket.protocol}
                            </span>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-[#27273D]">{ticket.student.name}</div>
                            <div className="text-xs text-gray-500">{ticket.student.email}</div>
                        </td>

                        <td className="px-6 py-4 text-sm text-gray-600 max-w-xs">
                            <div className="truncate" title={ticket.subject || ''}>
                            {ticket.subject || <span className="italic text-gray-400">Sem assunto</span>}
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">{categoryLabels[ticket.category]}</div>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${priorityColors[ticket.priority]}`}>
                            {priorityLabels[ticket.priority]}
                            </span>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[ticket.status]}`}>
                            {statusLabels[ticket.status]}
                            </span>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col">
                                <span className={`px-2 py-1 text-xs font-medium rounded-full text-center w-max ${sla.color}`}>
                                    {sla.label}
                                </span>
                            </div>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-sm" onClick={(e) => e.stopPropagation()}>
                            {!ticket.assigned_to_id ? (
                            <button
                                onClick={(e) => handleAssign(e, ticket.id)}
                                disabled={assigningId === ticket.id}
                                className="text-[#2A658F] hover:text-[#27273D] hover:bg-blue-50 px-3 py-1.5 rounded-md font-medium text-xs border border-transparent hover:border-blue-100 transition-all disabled:opacity-50"
                            >
                                {assigningId === ticket.id ? 'Assumindo...' : 'Assumir Ticket'}
                            </button>
                            ) : (
                            <div className="flex items-center gap-2">
                                <div className="h-6 w-6 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-600 font-bold">
                                    {ticket.assigned_to?.name.charAt(0)}
                                </div>
                                <span className="text-gray-600 text-sm truncate max-w-[100px]" title={ticket.assigned_to?.name}>
                                    {ticket.assigned_to?.name}
                                </span>
                            </div>
                            )}
                        </td>
                        </tr>
                    );
                    })}
                </tbody>
                </table>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}