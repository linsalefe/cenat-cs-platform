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
  Paperclip,
  FileText,
  Image as ImageIcon,
  Mic,
  X,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

interface Conversation {
  id: number;
  contact_phone: string;
  contact_name: string | null;
  channel: string;
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
  message_type: string;
  message_sid: string | null;
  status: string;
  created_at: string;
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: 'Aberto', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-100' },
  in_progress: { label: 'Em Atendimento', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-100' },
  resolved: { label: 'Resolvido', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-100' },
  closed: { label: 'Fechado', color: 'text-muted-foreground', bg: 'bg-muted border-border' },
};

export default function ConversationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sendingRef = useRef(false);
  const lastMsgIdRef = useRef<number | null>(null);
  const prevUnreadRef = useRef(0);
  const notifReadyRef = useRef(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

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
      const interval = setInterval(loadConversations, 5000);
      return () => clearInterval(interval);
    }
  }, [user, channelFilter]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // mantém um ref espelhando `sending` (pra ler dentro do polling sem recriar o intervalo)
  useEffect(() => {
    sendingRef.current = sending;
  }, [sending]);

  // Polling de mensagens da conversa aberta (3s) — só atualiza quando muda
  useEffect(() => {
    if (!selectedConversation) return;
    const convId = selectedConversation.id;

    const poll = async () => {
      if (sendingRef.current) return; // não atropela envio otimista
      try {
        const res = await api.get(`/conversations/${convId}/messages`);
        const data: Message[] = res.data;
        const lastId = data.length ? data[data.length - 1].id : null;

        setMessages((prev) => {
          const prevLast = prev.length ? prev[prev.length - 1].id : null;
          if (prevLast === lastId && prev.length === data.length) return prev;
          return data;
        });

        // se a última mensagem é nova e é recebida, marca como lida
        if (lastId && lastId !== lastMsgIdRef.current) {
          const last = data[data.length - 1];
          if (last && last.direction === 'inbound') {
            api.patch(`/conversations/${convId}/read`).then(() => loadConversations()).catch(() => {});
          }
          lastMsgIdRef.current = lastId;
        }
      } catch {
        // silencioso: tenta de novo no próximo ciclo
      }
    };

    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [selectedConversation]);

  // Som + título da aba conforme não-lidas (exclui a conversa aberta)
  useEffect(() => {
    const openId = selectedConversation?.id;
    const totalUnread = conversations.reduce(
      (sum, c) => sum + (c.id === openId ? 0 : (c.unread_count || 0)),
      0,
    );

    document.title = totalUnread > 0 ? `(${totalUnread}) Conversas · CENAT` : 'Conversas · CENAT';

    if (notifReadyRef.current && totalUnread > prevUnreadRef.current) {
      playNotification();
    }
    prevUnreadRef.current = totalUnread;
    notifReadyRef.current = true;
  }, [conversations, selectedConversation]);

  // Restaura o título ao sair da página
  useEffect(() => {
    return () => {
      document.title = 'CENAT';
    };
  }, []);

  const loadConversations = async () => {
    try {
      const params: any = {};
      if (channelFilter !== 'all') params.channel = channelFilter;
      const res = await api.get('/conversations', { params });
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

  const handleFileUpload = async (file: File, type: 'image' | 'document' | 'audio') => {
    if (!selectedConversation || sending) return;
    const limits: Record<string, number> = {
      image: 5 * 1024 * 1024,
      audio: 16 * 1024 * 1024,
      document: 20 * 1024 * 1024,
    };
    if (file.size > (limits[type] || limits.document)) {
      toast.error('Arquivo muito grande');
      return;
    }
    setShowAttachMenu(false);
    setSending(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', type);
      await api.post(`/conversations/${selectedConversation.id}/media`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const res = await api.get(`/conversations/${selectedConversation.id}/messages`);
      setMessages(res.data);
      loadConversations();
    } catch (e) {
      toast.error('Erro ao enviar arquivo');
    } finally {
      setSending(false);
    }
  };

  const pickAudioMime = () => {
    const candidates = ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
    for (const c of candidates) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c;
    }
    return '';
  };

  const formatRecordingTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    if (!selectedConversation || sending) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickAudioMime();
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = recorder.mimeType || 'audio/webm';
        const ext = type.includes('ogg') ? 'ogg' : type.includes('mp4') ? 'm4a' : 'webm';
        const blob = new Blob(audioChunksRef.current, { type });
        if (blob.size > 0) {
          const file = new File([blob], `audio.${ext}`, { type });
          await handleFileUpload(file, 'audio');
        }
      };

      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => setRecordingTime((p) => p + 1), 1000);
    } catch (err) {
      toast.error('Não foi possível acessar o microfone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    setRecordingTime(0);
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = () => {
        mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    setRecordingTime(0);
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

  const playNotification = () => {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.32);
      osc.onended = () => ctx.close();
    } catch {
      // ignora se o navegador bloquear
    }
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

  const mediaUrl = (content: string, channel: string) => {
    const mediaId = content.split('|')[0].replace('media:', '');
    return `/api/conversations/media/${mediaId}?channel=${channel || 'cs'}`;
  };

  const renderContent = (msg: Message) => {
    const ch = selectedConversation?.channel || 'cs';
    const isMedia = msg.content.startsWith('media:');
    if (isMedia && msg.message_type === 'image') {
      const url = mediaUrl(msg.content, ch);
      return (
        <img src={url} alt="imagem" className="max-w-[240px] rounded-lg cursor-pointer"
          onClick={() => window.open(url, '_blank')} />
      );
    }
    if (isMedia && msg.message_type === 'audio') {
      return (
        <audio controls className="max-w-[240px]">
          <source src={mediaUrl(msg.content, ch)} type={msg.content.split('|')[1] || 'audio/ogg'} />
        </audio>
      );
    }
    if (isMedia && msg.message_type === 'video') {
      return (
        <video controls className="max-w-[240px] rounded-lg">
          <source src={mediaUrl(msg.content, ch)} type={msg.content.split('|')[1] || 'video/mp4'} />
        </video>
      );
    }
    if (isMedia && msg.message_type === 'document') {
      const fname = msg.content.split('|')[2] || 'documento';
      return (
        <a href={mediaUrl(msg.content, ch)} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-primary underline">
          <FileText className="w-4 h-4" /> {fname}
        </a>
      );
    }
    return <p className="text-sm text-foreground whitespace-pre-wrap break-words">{msg.content}</p>;
  };

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded-lg w-48"></div>
          <div className="h-[calc(100vh-180px)] bg-muted rounded-2xl"></div>
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
            <p className="text-sm font-medium text-primary mb-1">Atendimento</p>
            <h1 className="text-3xl font-semibold text-foreground tracking-tight">
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
          className="bg-card rounded-2xl border border-border overflow-hidden"
          style={{ height: 'calc(100vh - 200px)' }}
        >
          <div className="flex h-full">
            {/* Sidebar - Lista de Conversas */}
            <div
              className={`w-full md:w-96 border-r border-border flex flex-col ${
                showMobileChat ? 'hidden md:flex' : 'flex'
              }`}
            >
              {/* Channel Tabs */}
              <div className="flex border-b border-border">
                {[
                  { key: 'all', label: 'Todos' },
                  { key: 'cs', label: '💬 CS' },
                  { key: 'financeiro', label: '💰 Financeiro' },
                ].map((ch) => (
                  <button
                    key={ch.key}
                    onClick={() => { setChannelFilter(ch.key); setSelectedConversation(null); }}
                    className={`flex-1 px-3 py-3 text-xs font-semibold transition-all border-b-2 ${
                      channelFilter === ch.key
                        ? 'text-primary border-primary bg-primary/10/30'
                        : 'text-muted-foreground border-transparent hover:text-foreground/90 hover:bg-muted/50'
                    }`}
                  >
                    {ch.label}
                  </button>
                ))}
              </div>

              {/* Search & Filters */}
              <div className="p-4 border-b border-border space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
                  <input
                    type="text"
                    placeholder="Buscar conversa..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm
                      focus:border-primary focus:ring-4 focus:ring-primary/10
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
                          ? 'bg-primary text-white'
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted'
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
                    <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-3">
                      <MessageCircle className="w-7 h-7 text-muted-foreground/70" />
                    </div>
                    <p className="text-sm font-medium text-foreground">Nenhuma conversa</p>
                    <p className="text-xs text-muted-foreground mt-1">As conversas aparecerão aqui quando receberem mensagens</p>
                  </div>
                ) : (
                  filteredConversations.map((conversation) => (
                    <div
                      key={conversation.id}
                      onClick={() => selectConversation(conversation)}
                      className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-all duration-200 border-b border-gray-50
                        ${
                          selectedConversation?.id === conversation.id
                            ? 'bg-primary/10 border-l-2 border-l-[#2A658F]'
                            : 'hover:bg-muted/50'
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
                              conversation.unread_count > 0 ? 'font-semibold text-foreground' : 'font-medium text-foreground/90'
                            }`}
                          >
                            {conversation.contact_name || formatPhone(conversation.contact_phone)}
                          </h3>
                          <span className="text-xs text-muted-foreground/70 ml-2 flex-shrink-0">
                            {conversation.last_message_at ? formatDate(conversation.last_message_at) : ''}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <p
                            className={`text-xs truncate ${
                              conversation.unread_count > 0 ? 'text-foreground/90 font-medium' : 'text-muted-foreground'
                            }`}
                          >
                            {conversation.last_message_preview || 'Sem mensagens'}
                          </p>
                          {conversation.unread_count > 0 && (
                            <span className="ml-2 flex-shrink-0 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold text-white bg-primary rounded-full">
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
                  <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setShowMobileChat(false)}
                        className="md:hidden p-1 hover:bg-muted rounded-lg"
                      >
                        <ArrowLeft className="w-5 h-5 text-muted-foreground" />
                      </button>
                      <Avatar name={selectedConversation.contact_name || selectedConversation.contact_phone} size="md" />
                      <div>
                        <h2 className="font-semibold text-foreground">
                          {selectedConversation.contact_name || formatPhone(selectedConversation.contact_phone)}
                        </h2>
                        <div className="flex items-center gap-2">
                          <Phone className="w-3 h-3 text-muted-foreground/70" />
                          <span className="text-xs text-muted-foreground">{formatPhone(selectedConversation.contact_phone)}</span>
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
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/15 rounded-lg transition-colors"
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
                        <Loader2 className="w-6 h-6 text-muted-foreground/70 animate-spin" />
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center">
                        <MessageCircle className="w-12 h-12 text-muted-foreground/50 mb-3" />
                        <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda</p>
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
                                  <span className="px-3 py-1 text-[11px] font-medium text-muted-foreground bg-card rounded-lg shadow-sm">
                                    {formatDate(msg.created_at)}
                                  </span>
                                </div>
                              )}
                              <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                                <div
                                  className={`max-w-[70%] px-3.5 py-2 rounded-2xl shadow-sm ${
                                    isOutbound
                                      ? 'bg-[#d9fdd3] rounded-tr-md'
                                      : 'bg-card rounded-tl-md'
                                  }`}
                                >
                                  {isOutbound && msg.sender_type === 'agent' && (
                                    <p className="text-[10px] font-semibold text-primary mb-0.5">
                                      {(msg.sender_type as string) === 'bot' ? '🤖 Bot' : 'Atendente'}
                                    </p>
                                  )}
                                  {renderContent(msg)}
                                  <div className={`flex items-center gap-1 mt-1 ${isOutbound ? 'justify-end' : ''}`}>
                                    <span className="text-[10px] text-muted-foreground">{formatTime(msg.created_at)}</span>
                                    {isOutbound && (
                                      <CheckCheck
                                        className={`w-3.5 h-3.5 ${
                                          msg.status === 'sending' ? 'text-muted-foreground/70' : 'text-blue-500'
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
                  <div className="px-4 py-3 bg-[#f0f2f5] border-t border-border">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <button
                          onClick={() => setShowAttachMenu(!showAttachMenu)}
                          disabled={sending}
                          className="flex items-center justify-center w-11 h-11 rounded-xl bg-card border border-border text-muted-foreground hover:bg-muted transition-all disabled:opacity-50"
                        >
                          <Paperclip className="w-5 h-5" />
                        </button>
                        {showAttachMenu && (
                          <div className="absolute bottom-full left-0 mb-2 bg-card rounded-xl border border-border shadow-lg overflow-hidden z-10 min-w-[160px]">
                            <button onClick={() => imageInputRef.current?.click()} className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted text-left text-sm">
                              <ImageIcon className="w-4 h-4 text-primary" /> Imagem
                            </button>
                            <button onClick={() => documentInputRef.current?.click()} className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted text-left text-sm">
                              <FileText className="w-4 h-4 text-primary" /> Documento
                            </button>
                            <button onClick={() => audioInputRef.current?.click()} className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted text-left text-sm">
                              <Mic className="w-4 h-4 text-primary" /> Áudio
                            </button>
                          </div>
                        )}
                        <input ref={imageInputRef} type="file" accept="image/*" className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, 'image'); e.target.value = ''; }} />
                        <input ref={documentInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.csv" className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, 'document'); e.target.value = ''; }} />
                        <input ref={audioInputRef} type="file" accept="audio/*" className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, 'audio'); e.target.value = ''; }} />
                      </div>
                      {isRecording ? (
                        <div className="flex-1 flex items-center justify-between px-4 py-3 bg-card border border-red-200 rounded-xl">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                            <span className="text-sm font-medium text-red-600 tabular-nums">{formatRecordingTime(recordingTime)}</span>
                            <span className="text-xs text-muted-foreground">Gravando…</span>
                          </div>
                          <button onClick={cancelRecording} className="text-muted-foreground hover:text-red-500 transition-colors">
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      ) : (
                        <input
                          ref={inputRef}
                          type="text"
                          placeholder="Digite uma mensagem..."
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyDown={handleKeyDown}
                          disabled={sending}
                          className="flex-1 px-4 py-3 bg-card border border-border rounded-xl text-sm
                            focus:border-primary focus:ring-4 focus:ring-primary/10
                            transition-all duration-200 outline-none
                            disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      )}
                      {isRecording ? (
                        <button
                          onClick={stopRecording}
                          className="flex items-center justify-center w-11 h-11 rounded-xl bg-green-600 text-white hover:bg-green-700 transition-all duration-200"
                          title="Enviar áudio"
                        >
                          <Send className="w-5 h-5" />
                        </button>
                      ) : sending ? (
                        <button
                          disabled
                          className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary text-white opacity-50"
                        >
                          <Loader2 className="w-5 h-5 animate-spin" />
                        </button>
                      ) : newMessage.trim() ? (
                        <button
                          onClick={sendMessage}
                          className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary text-white hover:bg-[#1e4f72] transition-all duration-200"
                        >
                          <Send className="w-5 h-5" />
                        </button>
                      ) : (
                        <button
                          onClick={startRecording}
                          className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary text-white hover:bg-[#1e4f72] transition-all duration-200"
                          title="Gravar áudio"
                        >
                          <Mic className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                /* Empty State */
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-[#f0f2f5]">
                  <div className="w-20 h-20 bg-card rounded-full flex items-center justify-center mb-4 shadow-sm">
                    <MessageCircle className="w-10 h-10 text-muted-foreground/50" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground/90 mb-2">Multiatendimento WhatsApp</h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
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
