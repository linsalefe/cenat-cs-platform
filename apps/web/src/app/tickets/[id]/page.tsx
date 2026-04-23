'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import AppLayout from '@/components/AppLayout';
import { Avatar } from '@/components/ui';
import {
  ArrowLeft,
  Clock,
  User,
  Send,
  AlertCircle,
  CheckCircle2,
  Timer,
  Inbox,
  XCircle,
  Tag,
  Calendar,
  UserCheck,
  MessageSquare,
} from 'lucide-react';
import api from '@/lib/api';

interface Message {
  id: number;
  content: string;
  sender_type: string;
  created_at: string;
  sender_user?: { name: string };
}

interface TicketDetail {
  id: number;
  protocol: string;
  subject: string;
  status: string;
  category: string;
  priority: string;
  sla_deadline: string;
  created_at: string;
  resolved_at: string | null;
  student: { id: number; name: string; email: string; phone: string };
  assigned_to: { id: number; name: string } | null;
  messages: Message[];
}

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  open: { label: 'Aberto', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: Inbox },
  in_progress: { label: 'Em Andamento', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: Timer },
  waiting_student: { label: 'Aguardando Aluno', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', icon: Clock },
  resolved: { label: 'Resolvido', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
  closed: { label: 'Fechado', color: 'text-muted-foreground', bg: 'bg-muted border-border', icon: XCircle },
};

const categoryLabels: Record<string, string> = {
  financial: 'Financeiro',
  academic: 'Acadêmico',
  technical: 'Técnico',
  administrative: 'Administrativo',
  other: 'Outro',
};

const priorityConfig: Record<string, { label: string; color: string; bg: string }> = {
  low: { label: 'Baixa', color: 'text-muted-foreground', bg: 'bg-muted' },
  medium: { label: 'Média', color: 'text-amber-600', bg: 'bg-amber-50' },
  high: { label: 'Alta', color: 'text-orange-600', bg: 'bg-orange-50' },
  urgent: { label: 'Urgente', color: 'text-red-600', bg: 'bg-red-50' },
};

export default function TicketDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const ticketId = params.id;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && ticketId) {
      loadTicket();
    }
  }, [user, ticketId]);

  useEffect(() => {
    scrollToBottom();
  }, [ticket?.messages]);

  const loadTicket = async () => {
    try {
      const res = await api.get(`/tickets/${ticketId}`);
      setTicket(res.data);
    } catch (error) {
      console.error('Erro ao carregar ticket:', error);
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      await api.post(`/tickets/${ticketId}/messages`, {
        content: newMessage,
        sender_type: 'agent',
      });
      setNewMessage('');
      await loadTicket();
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setUpdating(true);
    try {
      await api.patch(`/tickets/${ticketId}/status?status=${newStatus}`);
      await loadTicket();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
    } finally {
      setUpdating(false);
    }
  };

  const handleAssignToMe = async () => {
    setUpdating(true);
    try {
      await api.patch(`/tickets/${ticketId}/assign?user_id=${user?.id}`);
      await loadTicket();
    } catch (error) {
      console.error('Erro ao atribuir ticket:', error);
    } finally {
      setUpdating(false);
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

  const formatMessageTime = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));

    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `${minutes}min`;
    if (hours < 24) return `${hours}h`;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const isOverdue = ticket && new Date(ticket.sla_deadline) < new Date() && !['resolved', 'closed'].includes(ticket.status);

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded-lg w-48"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-96 bg-muted rounded-2xl"></div>
            <div className="h-96 bg-muted rounded-2xl"></div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!ticket) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Ticket não encontrado</p>
        </div>
      </AppLayout>
    );
  }

  const status = statusConfig[ticket.status] || statusConfig.open;
  const StatusIcon = status.icon;
  const priority = priorityConfig[ticket.priority] || priorityConfig.medium;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div
          className={`transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
          }`}
        >
          <button
            onClick={() => router.push('/tickets')}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para tickets
          </button>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-semibold text-foreground">{ticket.protocol}</h1>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full border ${status.bg} ${status.color}`}>
                  <StatusIcon className="w-3.5 h-3.5" />
                  {status.label}
                </span>
                {isOverdue && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 bg-red-50 rounded-full animate-pulse">
                    <AlertCircle className="w-3.5 h-3.5" />
                    SLA Vencido
                  </span>
                )}
              </div>
              <p className="text-muted-foreground">{ticket.subject}</p>
            </div>

            {!ticket.assigned_to && (
              <button
                onClick={handleAssignToMe}
                disabled={updating}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl
                  hover:bg-primary transition-colors disabled:opacity-50"
              >
                <UserCheck className="w-4 h-4" />
                Assumir ticket
              </button>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chat */}
          <div
            className={`lg:col-span-2 bg-card rounded-2xl border border-border flex flex-col h-[600px]
              transition-all duration-700 ease-out ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
            style={{ transitionDelay: '100ms' }}
          >
            {/* Chat Header */}
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-foreground">Conversação</h2>
                <span className="text-sm text-muted-foreground/70">({ticket.messages.length} mensagens)</span>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {ticket.messages.map((msg) => {
                const isStudent = msg.sender_type === 'student';
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isStudent ? 'justify-start' : 'justify-end'}`}
                  >
                    <div className={`flex gap-3 max-w-[80%] ${isStudent ? 'flex-row' : 'flex-row-reverse'}`}>
                      <Avatar
                        name={isStudent ? ticket.student.name : (msg.sender_user?.name || user?.name || 'Agente')}
                        size="sm"
                      />
                      <div>
                        <div
                          className={`rounded-2xl px-4 py-3 ${
                            isStudent
                              ? 'bg-muted text-foreground rounded-tl-md'
                              : 'bg-primary text-white rounded-tr-md'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        </div>
                        <p className={`text-xs text-muted-foreground/70 mt-1 ${isStudent ? 'text-left' : 'text-right'}`}>
                          {isStudent ? ticket.student.name : (msg.sender_user?.name || 'Você')} • {formatMessageTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            {!['resolved', 'closed'].includes(ticket.status) && (
              <form onSubmit={handleSendMessage} className="p-4 border-t border-border">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Digite sua mensagem..."
                    className="flex-1 px-4 py-3 bg-muted/50 border border-border rounded-xl
                      focus:bg-card focus:border-primary focus:ring-4 focus:ring-primary/10
                      transition-all duration-200 outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim() || sending}
                    className="px-4 py-3 bg-primary text-white rounded-xl hover:bg-primary
                      transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className={`w-5 h-5 ${sending ? 'animate-pulse' : ''}`} />
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Sidebar */}
          <div
            className={`space-y-4 transition-all duration-700 ease-out ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
            style={{ transitionDelay: '200ms' }}
          >
            {/* Student Info */}
            <div className="bg-card rounded-2xl border border-border p-5">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Aluno</h3>
              <div className="flex items-center gap-3 mb-4">
                <Avatar name={ticket.student.name} size="lg" />
                <div>
                  <p className="font-semibold text-foreground">{ticket.student.name}</p>
                  <p className="text-sm text-muted-foreground">{ticket.student.email}</p>
                </div>
              </div>
              {ticket.student.phone && (
                <a
                  href={`https://wa.me/${ticket.student.phone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 text-sm font-medium
                    text-green-600 bg-green-50 hover:bg-green-100 rounded-xl transition-colors"
                >
                  WhatsApp
                </a>
              )}
            </div>

            {/* Ticket Info */}
            <div className="bg-card rounded-2xl border border-border p-5">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Detalhes</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <Tag className="w-4 h-4" />
                    Categoria
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {categoryLabels[ticket.category] || ticket.category}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Prioridade
                  </span>
                  <span className={`text-sm font-medium px-2 py-0.5 rounded ${priority.bg} ${priority.color}`}>
                    {priority.label}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Criado em
                  </span>
                  <span className="text-sm text-foreground">{formatDate(ticket.created_at)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    SLA
                  </span>
                  <span className={`text-sm font-medium ${isOverdue ? 'text-red-600' : 'text-foreground'}`}>
                    {formatDate(ticket.sla_deadline)}
                  </span>
                </div>
                {ticket.assigned_to && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Atribuído
                    </span>
                    <span className="text-sm font-medium text-foreground">{ticket.assigned_to.name}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="bg-card rounded-2xl border border-border p-5">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Alterar Status</h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(statusConfig).map(([key, config]) => {
                  const Icon = config.icon;
                  const isActive = ticket.status === key;
                  return (
                    <button
                      key={key}
                      onClick={() => handleStatusChange(key)}
                      disabled={updating || isActive}
                      className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg
                        border transition-all duration-200 disabled:cursor-not-allowed
                        ${isActive 
                          ? `${config.bg} ${config.color} border-current` 
                          : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
                        }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {config.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
