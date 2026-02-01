'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import AppLayout from '@/components/AppLayout';
import { Avatar } from '@/components/ui';
import {
  Search,
  MessageCircle,
  Send,
  Phone,
  User,
  Clock,
  CheckCheck,
  Circle,
  Filter,
  ArrowLeft,
  UserPlus,
  XCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

interface Conversation {
  id: number;
  contact_phone: string;
  contact_name: string | null;
  student_id: number | null;
  assigned_to_id: number | null;
  assigned_to: { id: number; name: string } | null;
  status: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  created_at: string;
}

interface Message {
  id: number;
  conversation_id: number;
  direction: string;
  sender_type: string;
  sender_user_id: number | null;
  content: string;
  message_sid: string | null;
  status: string;
  created_at: string;
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: 'Aberto', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-100' },
  in_progress: { label: 'Em Atendimento', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-100' },
  resolved: { label: 'Resolvido', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-100' },
  closed: { label: 'Fechado', color: 'text-gray-600', bg: 'bg-gray-100 border-gray-200' },
};

export default function ConversationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [newMessage, setNewMessage] = useState('');
  const [showMobileChat, setShowMobileChat] = useState(false);

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
      loadConversations();
      const interval = setInterval(loadConversations, 10000);
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadConversations = async () => {
    try {
      const res = await api.get('/conversations');
      setConversations(res.data);
    } catch (error) {
      console.error('Erro ao carregar conversas:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectConversation = async (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setShowMobileChat(true);
    setLoadingMessages(true);

    try {
      const res = await api.get(`/conversations/${conversation.id}/messages`);
      setMessages(res.data);

      if (conversation.unread_count > 0) {
        await api.patch(`/conversations/${conversation.id}/read`);
        loadConversations();
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    } finally {
      setLoadingMessages(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || sending) return;

    setSending(true);
    const content = newMessage;
    setNewMessage('');

    // Otimista: adiciona mensagem local antes da resposta
    const optimisticMessage: Message = {
      id: Date.now(),
      conversation_id: selectedConversation.id,
      direction: 'outbound',
      sender_type: 'agent',
      sender_user_id: user?.id || null,
      content,
      message_sid: null,
      status: 'sending',
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      await api.post(`/conversations/${selectedConversation.id}/messages`, { content });
      // Recarrega mensagens para pegar dados reais
      const res = await api.get(`/conversations/${selectedConversation.id}/messages`);
      setMessages(res.data);
      loadConversations();
    } catch (error) {
      toast.error('Erro ao enviar mensagem');
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id));
      setNewMessage(content);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const assignToMe = async () => {
    if (!selectedConversation || !user) return;
    try {
      await api.patch(`/conversations/${selectedConversation.id}/assign`, { user_id: user.id });
      toast.success('Conversa atribuída a você');
      loadConversations();
      setSelectedConversation((prev) => prev ? { ...prev, assigned_to_id: user.id } : null);
    } catch (error) {
      toast.error('Erro ao atribuir conversa');
    }
  };

  const changeStatus = async (newStatus: string) => {
    if (!selectedConversation) return;
    try {
      await api.patch(`/conversations/${selectedConversation.id}/status`, { status: newStatus });
      toast.success('Status atualizado');
      loadConversations();
      setSelectedConversation((prev) => prev ? { ...prev, status: newStatus } : null);
    } catch (error) {
      toast.error('Erro ao atualizar status');
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return 'Hoje';
    if (d.toDateString() === yesterday.toDateString()) return 'Ontem';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  };

  const formatPhone = (phone: string) => {
    const clean = phone.replace(/\D/g, '');
    if (clean.length === 13) {
      return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
    }
    if (clean.length === 11) {
      return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
    }
    return phone;
  };

  const filteredConversations = conversations.filter((c) => {
    const matchesSearch =
      (c.contact_name || '').toLowerCase().includes(search.toLowerCase()) ||
      c.contact_phone.includes(search);
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalUnread = conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0);

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-100 rounded-lg w-48"></div>
          <div className="h-[calc(100vh-180px)] bg-gray-100 rounded-2xl"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div
        className={`transition-all duration-700 ease-out ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
        }`}
      >
        {/* Header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <p className="text-sm font-medium text-[#2A658F] mb-1">Atendimento</p>
            <h1 className="text-3xl font-semibold text-[#27273D] tracking-tight">
              Conversas
              {totalUnread > 0 && (
                <span className="ml-3 inline-flex items-center justify-center px-2.5 py-0.5 text-sm font-semibold text-white bg-red-500 rounded-full">
                  {totalUnread}
                </span>
              )}
            </h1>
          </div>
        </div>

        {/* Main Container */}
        <div
          className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
          style={{ height: 'calc(100vh - 200px)' }}
        >
          <div className="flex h-full">
            {/* Sidebar - Lista de Conversas */}
            <div
              className={`w-full md:w-96 border-r border-gray-100 flex flex-col ${
                showMobileChat ? 'hidden md:flex' : 'flex'
              }`}
            >
              {/* Search & Filters */}
              <div className="p-4 border-b border-gray-100 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar conversa..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm
                      focus:border-[#2A658F] focus:ring-4 focus:ring-[#2A658F]/10
                      transition-all duration-200 outline-none"
                  />
                </div>
                <div className="flex gap-2">
                  {['all', 'open', 'in_progress', 'resolved'].map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                        statusFilter === s
                          ? 'bg-[#2A658F] text-white'
                          : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {s === 'all' ? 'Todos' : statusConfig[s]?.label || s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Conversations List */}
              <div className="flex-1 overflow-y-auto">
                {filteredConversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-6">
                    <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                      <MessageCircle className="w-7 h-7 text-gray-400" />
                    </div>
                    <p className="text-sm font-medium text-gray-900">Nenhuma conversa</p>
                    <p className="text-xs text-gray-500 mt-1">As conversas aparecerão aqui quando receberem mensagens</p>
                  </div>
                ) : (
                  filteredConversations.map((conversation) => (
                    <div
                      key={conversation.id}
                      onClick={() => selectConversation(conversation)}
                      className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-all duration-200 border-b border-gray-50
                        ${
                          selectedConversation?.id === conversation.id
                            ? 'bg-[#E2ECF4] border-l-2 border-l-[#2A658F]'
                            : 'hover:bg-gray-50'
                        }
                        ${conversation.unread_count > 0 ? 'bg-blue-50/30' : ''}
                      `}
                    >
                      <div className="relative">
                        <Avatar name={conversation.contact_name || conversation.contact_phone} size="md" />
                        {conversation.status === 'open' && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3
                            className={`text-sm truncate ${
                              conversation.unread_count > 0 ? 'font-semibold text-[#27273D]' : 'font-medium text-gray-700'
                            }`}
                          >
                            {conversation.contact_name || formatPhone(conversation.contact_phone)}
                          </h3>
                          <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
                            {conversation.last_message_at ? formatDate(conversation.last_message_at) : ''}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <p
                            className={`text-xs truncate ${
                              conversation.unread_count > 0 ? 'text-gray-700 font-medium' : 'text-gray-500'
                            }`}
                          >
                            {conversation.last_message_preview || 'Sem mensagens'}
                          </p>
                          {conversation.unread_count > 0 && (
                            <span className="ml-2 flex-shrink-0 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold text-white bg-[#2A658F] rounded-full">
                              {conversation.unread_count}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Chat Area */}
            <div
              className={`flex-1 flex flex-col ${
                !showMobileChat ? 'hidden md:flex' : 'flex'
              }`}
            >
              {selectedConversation ? (
                <>
                  {/* Chat Header */}
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setShowMobileChat(false)}
                        className="md:hidden p-1 hover:bg-gray-100 rounded-lg"
                      >
                        <ArrowLeft className="w-5 h-5 text-gray-600" />
                      </button>
                      <Avatar name={selectedConversation.contact_name || selectedConversation.contact_phone} size="md" />
                      <div>
                        <h2 className="font-semibold text-[#27273D]">
                          {selectedConversation.contact_name || formatPhone(selectedConversation.contact_phone)}
                        </h2>
                        <div className="flex items-center gap-2">
                          <Phone className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-500">{formatPhone(selectedConversation.contact_phone)}</span>
                          <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full border ${statusConfig[selectedConversation.status]?.bg} ${statusConfig[selectedConversation.status]?.color}`}>
                            {statusConfig[selectedConversation.status]?.label}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!selectedConversation.assigned_to_id && (
                        <button
                          onClick={assignToMe}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#2A658F] bg-[#E2ECF4] hover:bg-[#CCE4F4] rounded-lg transition-colors"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          Assumir
                        </button>
                      )}
                      {selectedConversation.status !== 'resolved' && (
                        <button
                          onClick={() => changeStatus('resolved')}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Resolver
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto px-6 py-4 bg-[#f0f2f5]">
                    {loadingMessages ? (
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center">
                        <MessageCircle className="w-12 h-12 text-gray-300 mb-3" />
                        <p className="text-sm text-gray-500">Nenhuma mensagem ainda</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {messages.map((msg, index) => {
                          const isOutbound = msg.direction === 'outbound';
                          const showDate =
                            index === 0 ||
                            new Date(msg.created_at).toDateString() !== new Date(messages[index - 1].created_at).toDateString();

                          return (
                            <div key={msg.id}>
                              {showDate && (
                                <div className="flex justify-center my-4">
                                  <span className="px-3 py-1 text-[11px] font-medium text-gray-500 bg-white rounded-lg shadow-sm">
                                    {formatDate(msg.created_at)}
                                  </span>
                                </div>
                              )}
                              <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                                <div
                                  className={`max-w-[70%] px-3.5 py-2 rounded-2xl shadow-sm ${
                                    isOutbound
                                      ? 'bg-[#d9fdd3] rounded-tr-md'
                                      : 'bg-white rounded-tl-md'
                                  }`}
                                >
                                  {isOutbound && msg.sender_type === 'agent' && (
                                    <p className="text-[10px] font-semibold text-[#2A658F] mb-0.5">
                                      {msg.sender_type === 'bot' ? '🤖 Bot' : 'Atendente'}
                                    </p>
                                  )}
                                  <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{msg.content}</p>
                                  <div className={`flex items-center gap-1 mt-1 ${isOutbound ? 'justify-end' : ''}`}>
                                    <span className="text-[10px] text-gray-500">{formatTime(msg.created_at)}</span>
                                    {isOutbound && (
                                      <CheckCheck
                                        className={`w-3.5 h-3.5 ${
                                          msg.status === 'sending' ? 'text-gray-400' : 'text-blue-500'
                                        }`}
                                      />
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </div>

                  {/* Input */}
                  <div className="px-4 py-3 bg-[#f0f2f5] border-t border-gray-200">
                    <div className="flex items-center gap-3">
                      <input
                        ref={inputRef}
                        type="text"
                        placeholder="Digite uma mensagem..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={sending}
                        className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm
                          focus:border-[#2A658F] focus:ring-4 focus:ring-[#2A658F]/10
                          transition-all duration-200 outline-none
                          disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <button
                        onClick={sendMessage}
                        disabled={!newMessage.trim() || sending}
                        className="flex items-center justify-center w-11 h-11 rounded-xl
                          bg-[#2A658F] text-white hover:bg-[#1e4f72]
                          transition-all duration-200
                          disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {sending ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Send className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                /* Empty State */
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-[#f0f2f5]">
                  <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm">
                    <MessageCircle className="w-10 h-10 text-gray-300" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">Multiatendimento WhatsApp</h3>
                  <p className="text-sm text-gray-500 max-w-sm">
                    Selecione uma conversa ao lado para visualizar e responder as mensagens dos alunos.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
