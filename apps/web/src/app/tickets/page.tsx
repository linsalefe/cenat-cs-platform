'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import api from '@/lib/api';

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

function getSlaStatus(slaDeadline: string): { label: string; color: string } {
  const now = new Date();
  const deadline = new Date(slaDeadline);
  const hoursLeft = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursLeft < 0) {
    return { label: 'Estourado', color: 'bg-red-500 text-white' };
  } else if (hoursLeft < 4) {
    return { label: `${Math.round(hoursLeft)}h`, color: 'bg-red-100 text-red-800' };
  } else if (hoursLeft < 12) {
    return { label: `${Math.round(hoursLeft)}h`, color: 'bg-amber-100 text-amber-800' };
  } else {
    return { label: `${Math.round(hoursLeft)}h`, color: 'bg-green-100 text-green-800' };
  }
}

export default function TicketsPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      fetchTickets();
    }
  }, [user, statusFilter, categoryFilter]);

  const fetchTickets = async () => {
    setLoadingTickets(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (categoryFilter) params.append('category', categoryFilter);
      
      const res = await api.get(`/tickets?${params.toString()}`);
      setTickets(res.data);
    } catch (err) {
      console.error('Erro ao buscar tickets:', err);
    } finally {
      setLoadingTickets(false);
    }
  };

  const handleAssign = async (ticketId: number) => {
    try {
      await api.patch(`/tickets/${ticketId}/assign?user_id=${user?.id}`);
      fetchTickets();
    } catch (err) {
      console.error('Erro ao assumir ticket:', err);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#E2ECF4]">
        <p className="text-[#2A658F]">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E2ECF4]">
      <header className="bg-[#27273D] shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-white tracking-wider">CENAT</h1>
          <div className="flex items-center gap-4">
            <a href="/" className="text-[#CCE4F4] hover:text-white">Dashboard</a>
            <span className="text-[#CCE4F4]">{user.name}</span>
            <span className="text-xs bg-[#2A658F] text-white px-2 py-1 rounded">{user.role}</span>
            <button onClick={logout} className="text-red-400 hover:text-red-300 text-sm">Sair</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-[#27273D]">Fila de Tickets</h2>
        </div>

        <div className="bg-white p-4 rounded-lg shadow mb-6 flex gap-4">
          <div>
            <label className="block text-sm font-medium text-[#27273D] mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-[#2A658F] focus:border-[#2A658F]"
            >
              <option value="">Todos</option>
              <option value="open">Aberto</option>
              <option value="in_progress">Em Andamento</option>
              <option value="waiting_student">Aguardando Aluno</option>
              <option value="resolved">Resolvido</option>
              <option value="closed">Fechado</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#27273D] mb-1">Categoria</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-[#2A658F] focus:border-[#2A658F]"
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

        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loadingTickets ? (
            <div className="p-8 text-center text-[#2A658F]">Carregando...</div>
          ) : tickets.length === 0 ? (
            <div className="p-8 text-center text-gray-500">Nenhum ticket encontrado</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-[#CCE4F4]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#27273D] uppercase">Protocolo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#27273D] uppercase">Aluno</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#27273D] uppercase">Assunto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#27273D] uppercase">Categoria</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#27273D] uppercase">Prioridade</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#27273D] uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#27273D] uppercase">SLA</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#27273D] uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tickets.map((ticket) => {
                  const sla = getSlaStatus(ticket.sla_deadline);
                  return (
                    <tr key={ticket.id} className="hover:bg-[#E2ECF4]">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#2A658F]">
                        <a href={`/tickets/${ticket.id}`} className="hover:underline">{ticket.protocol}</a>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[#27273D]">
                        {ticket.student.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {ticket.subject || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {categoryLabels[ticket.category]}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${priorityColors[ticket.priority]}`}>
                          {priorityLabels[ticket.priority]}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${statusColors[ticket.status]}`}>
                          {statusLabels[ticket.status]}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${sla.color}`}>
                          {sla.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {!ticket.assigned_to_id ? (
                          <button
                            onClick={() => handleAssign(ticket.id)}
                            className="text-[#2A658F] hover:text-[#27273D] font-medium"
                          >
                            Assumir
                          </button>
                        ) : (
                          <span className="text-gray-500">{ticket.assigned_to?.name}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
