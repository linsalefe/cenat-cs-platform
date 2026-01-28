'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import api from '@/lib/api';

interface Message {
  id: number;
  ticket_id: number;
  sender_type: string;
  sender_user_id: number | null;
  content: string;
  created_at: string;
}

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
  messages: Message[];
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

export default function TicketDetailPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const params = useParams();
  const ticketId = params.id;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && ticketId) {
      fetchTicket();
    }
  }, [user, ticketId]);

  const fetchTicket = async () => {
    try {
      const res = await api.get(`/tickets/${ticketId}`);
      setTicket(res.data);
    } catch (err) {
      console.error('Erro ao buscar ticket:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setSending(true);
    try {
      await api.post(`/tickets/${ticketId}/messages`, { content: newMessage });
      setNewMessage('');
      fetchTicket();
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
    } finally {
      setSending(false);
    }
  };

  const handleChangeStatus = async (newStatus: string) => {
    try {
      await api.patch(`/tickets/${ticketId}/status?status=${newStatus}`);
      fetchTicket();
    } catch (err) {
      console.error('Erro ao alterar status:', err);
    }
  };

  const handleAssign = async () => {
    try {
      await api.patch(`/tickets/${ticketId}/assign?user_id=${user?.id}`);
      fetchTicket();
    } catch (err) {
      console.error('Erro ao assumir ticket:', err);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#E2ECF4]">
        <p className="text-[#2A658F]">Carregando...</p>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#E2ECF4]">
        <p className="text-red-600">Ticket não encontrado</p>
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
            <a href="/tickets" className="text-[#CCE4F4] hover:text-white">Tickets</a>
            <span className="text-[#CCE4F4]">{user?.name}</span>
            <button onClick={logout} className="text-red-400 hover:text-red-300 text-sm">Sair</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna principal - Chat */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-lg font-semibold text-[#27273D]">{ticket.protocol}</h2>
                    <p className="text-gray-600 text-sm">{ticket.subject || 'Sem assunto'}</p>
                  </div>
                  <span className={`px-3 py-1 text-sm rounded-full ${statusColors[ticket.status]}`}>
                    {statusLabels[ticket.status]}
                  </span>
                </div>
              </div>

              {/* Mensagens */}
              <div className="p-4 h-96 overflow-y-auto space-y-4 bg-[#E2ECF4]">
                {ticket.messages.length === 0 ? (
                  <p className="text-center text-gray-500">Nenhuma mensagem ainda</p>
                ) : (
                  ticket.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender_type === 'student' ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                          msg.sender_type === 'student'
                            ? 'bg-white text-[#27273D]'
                            : 'bg-[#2A658F] text-white'
                        }`}
                      >
                        <p className="text-sm">{msg.content}</p>
                        <p className={`text-xs mt-1 ${msg.sender_type === 'student' ? 'text-gray-400' : 'text-[#CCE4F4]'}`}>
                          {new Date(msg.created_at).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Input de mensagem */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Digite sua mensagem..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2A658F]"
                  />
                  <button
                    type="submit"
                    disabled={sending || !newMessage.trim()}
                    className="px-4 py-2 bg-[#2A658F] text-white rounded-md hover:bg-[#27273D] disabled:opacity-50"
                  >
                    {sending ? '...' : 'Enviar'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Sidebar - Info do ticket */}
          <div className="space-y-4">
            {/* Dados do aluno */}
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold text-[#27273D] mb-3">Aluno</h3>
              <div className="space-y-2 text-sm">
                <p><span className="text-gray-500">Nome:</span> {ticket.student.name}</p>
                <p><span className="text-gray-500">Email:</span> {ticket.student.email}</p>
                <p><span className="text-gray-500">Telefone:</span> {ticket.student.phone || '-'}</p>
              </div>
            </div>

            {/* Dados do ticket */}
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold text-[#27273D] mb-3">Detalhes</h3>
              <div className="space-y-2 text-sm">
                <p><span className="text-gray-500">Categoria:</span> {categoryLabels[ticket.category]}</p>
                <p><span className="text-gray-500">Criado em:</span> {new Date(ticket.created_at).toLocaleString('pt-BR')}</p>
                <p><span className="text-gray-500">SLA:</span> {new Date(ticket.sla_deadline).toLocaleString('pt-BR')}</p>
                <p>
                  <span className="text-gray-500">Responsável:</span>{' '}
                  {ticket.assigned_to?.name || 'Não atribuído'}
                </p>
              </div>
            </div>

            {/* Ações */}
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold text-[#27273D] mb-3">Ações</h3>
              <div className="space-y-2">
                {!ticket.assigned_to_id && (
                  <button
                    onClick={handleAssign}
                    className="w-full px-3 py-2 bg-[#2A658F] text-white rounded-md hover:bg-[#27273D] text-sm"
                  >
                    Assumir Ticket
                  </button>
                )}
                
                <select
                  value={ticket.status}
                  onChange={(e) => handleChangeStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-[#2A658F]"
                >
                  <option value="open">Aberto</option>
                  <option value="in_progress">Em Andamento</option>
                  <option value="waiting_student">Aguardando Aluno</option>
                  <option value="resolved">Resolvido</option>
                  <option value="closed">Fechado</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
