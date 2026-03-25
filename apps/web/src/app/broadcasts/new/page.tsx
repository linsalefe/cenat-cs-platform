'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import AppLayout from '@/components/AppLayout';
import {
  ArrowLeft,
  Send,
  Users,
  User,
  Loader2,
  CheckCircle2,
  Search,
  MessageCircle,
  GraduationCap,
  CreditCard,
  BarChart3,
  X,
  ChevronDown,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

interface StudentPreview {
  id: number;
  name: string;
  email: string;
  phone: string;
  primary_course_name: string | null;
  financial_status: string | null;
  documents_count: number;
  documents_total: number;
  moodle_first_access: string | null;
}

interface CourseOption {
  id: number;
  name: string;
  count: number;
}

const templates = [
  {
    name: 'boas_vindas',
    label: 'Boas-vindas',
    description: 'Mensagem de boas-vindas para novos alunos',
    icon: MessageCircle,
    color: 'bg-teal-50 text-teal-700 border-teal-200',
    iconColor: 'text-teal-600',
    params: ['{{primeiro_nome}}', '{{curso}}'],
    paramsLabel: ['Nome do aluno', 'Curso'],
  },
  {
    name: 'lembrete_acesso',
    label: 'Lembrete de Acesso',
    description: 'Lembrete para alunos que não acessaram o Moodle',
    icon: GraduationCap,
    color: 'bg-purple-50 text-purple-700 border-purple-200',
    iconColor: 'text-purple-600',
    params: ['{{primeiro_nome}}'],
    paramsLabel: ['Nome do aluno'],
  },
  {
    name: 'lembrete_pagamento',
    label: 'Lembrete de Pagamento',
    description: 'Lembrete para alunos com pagamento pendente',
    icon: CreditCard,
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    iconColor: 'text-amber-600',
    params: ['{{primeiro_nome}}'],
    paramsLabel: ['Nome do aluno'],
  },
  {
    name: 'pesquisa_nps',
    label: 'Pesquisa NPS',
    description: 'Pesquisa de satisfação para alunos ativos',
    icon: BarChart3,
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    iconColor: 'text-blue-600',
    params: ['{{primeiro_nome}}'],
    paramsLabel: ['Nome do aluno'],
  },
];

type SendMode = 'all' | 'course' | 'individual';

export default function NewBroadcastPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);

  // Template
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  // Send mode
  const [sendMode, setSendMode] = useState<SendMode>('all');

  // Course filter
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);

  // Individual
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<StudentPreview[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<StudentPreview[]>([]);
  const [searching, setSearching] = useState(false);

  // Filters extras
  const [financialStatus, setFinancialStatus] = useState('');
  const [loginStatus, setLoginStatus] = useState('');

  // Preview
  const [previewStudents, setPreviewStudents] = useState<StudentPreview[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (!authLoading && !user) router.push('/login'); }, [user, authLoading, router]);
  useEffect(() => { if (user) loadCourses(); }, [user]);

  const loadCourses = async () => {
    try {
      const res = await api.get('/students/courses');
      setCourses(res.data);
    } catch {}
  };

  const searchStudents = async (term: string) => {
    if (term.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await api.get(`/broadcasts/preview?search=${encodeURIComponent(term)}&limit=10`);
      setSearchResults(res.data.data || []);
    } catch {} finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => searchStudents(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const addStudent = (student: StudentPreview) => {
    if (!selectedStudents.find(s => s.id === student.id)) {
      setSelectedStudents(prev => [...prev, student]);
    }
    setSearchTerm('');
    setSearchResults([]);
  };

  const removeStudent = (id: number) => {
    setSelectedStudents(prev => prev.filter(s => s.id !== id));
  };

  const loadPreview = async () => {
    if (sendMode === 'individual') {
      setPreviewStudents(selectedStudents);
      setTotalStudents(selectedStudents.length);
      setShowPreview(true);
      return;
    }

    setLoadingPreview(true);
    try {
      const params = new URLSearchParams();
      if (sendMode === 'course' && selectedCourseId) params.append('course_id', String(selectedCourseId));
      if (financialStatus) params.append('financial_status', financialStatus);
      if (loginStatus) params.append('login_status', loginStatus);
      params.append('limit', '50');

      const res = await api.get(`/broadcasts/preview?${params.toString()}`);
      setPreviewStudents(res.data.data || []);
      setTotalStudents(res.data.total || 0);
      setShowPreview(true);
    } catch {
      toast.error('Erro ao carregar preview');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleSend = async () => {
    if (!selectedTemplate) { toast.error('Selecione um modelo de mensagem'); return; }

    const template = templates.find(t => t.name === selectedTemplate);
    if (!template) return;

    if (sendMode === 'individual' && selectedStudents.length === 0) {
      toast.error('Selecione pelo menos um aluno');
      return;
    }
    if (sendMode === 'course' && !selectedCourseId) {
      toast.error('Selecione um curso');
      return;
    }

    const courseName = sendMode === 'course'
      ? courses.find(c => c.id === selectedCourseId)?.name || ''
      : sendMode === 'all' ? 'Todos' : 'Individual';

    const confirmMsg = sendMode === 'individual'
      ? `Enviar "${template.label}" para ${selectedStudents.length} aluno(s)?`
      : `Enviar "${template.label}" para ${totalStudents} alunos${sendMode === 'course' ? ` do curso "${courseName}"` : ''}?`;

    if (!confirm(confirmMsg)) return;

    setSaving(true);
    try {
      const filters: Record<string, any> = {};
      if (sendMode === 'course' && selectedCourseId) filters.course_id = selectedCourseId;
      if (financialStatus) filters.financial_status = financialStatus;
      if (loginStatus) filters.login_status = loginStatus;
      if (sendMode === 'individual') {
        filters.search = selectedStudents.map(s => s.email).join('||');
      }

      const broadcastName = sendMode === 'individual'
        ? `${template.label} — ${selectedStudents.map(s => s.name.split(' ')[0]).join(', ')}`
        : sendMode === 'course'
        ? `${template.label} — ${courseName}`
        : `${template.label} — Todos`;

      // Cria o disparo
      const res = await api.post('/broadcasts', {
        name: broadcastName,
        description: null,
        channel: 'cs',
        filters,
        template_name: template.name,
        template_language: 'pt_BR',
        template_params: template.params,
      });

      // Inicia envio automaticamente
      await api.post(`/broadcasts/${res.data.id}/send`);
      toast.success(`Disparo iniciado! ${res.data.total_students} aluno(s) receberão a mensagem.`);
      router.push(`/broadcasts/${res.data.id}`);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Erro ao criar disparo');
    } finally {
      setSaving(false);
    }
  };

  const selectedTemplateDef = templates.find(t => t.name === selectedTemplate);

  const canPreview = selectedTemplate && (
    sendMode === 'all' ||
    (sendMode === 'course' && selectedCourseId) ||
    (sendMode === 'individual' && selectedStudents.length > 0)
  );

  if (authLoading) return null;

  return (
    <AppLayout>
      <div className={`max-w-3xl mx-auto space-y-6 transition-all duration-700 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        {/* Header */}
        <div>
          <button onClick={() => router.push('/broadcasts')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#2A658F] transition-colors mb-4">
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
          <h1 className="text-2xl font-semibold text-[#27273D]">Novo Disparo</h1>
          <p className="text-sm text-gray-500 mt-1">Envie mensagens pelo WhatsApp para seus alunos</p>
        </div>

        {/* PASSO 1 — Modelo de Mensagem */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-[#2A658F] text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
            <h2 className="text-lg font-semibold text-[#27273D]">O que enviar?</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {templates.map((t) => {
              const Icon = t.icon;
              const isSelected = selectedTemplate === t.name;
              return (
                <button
                  key={t.name}
                  onClick={() => setSelectedTemplate(t.name)}
                  className={`relative text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                    isSelected
                      ? 'border-[#2A658F] bg-[#E2ECF4] shadow-md'
                      : 'border-gray-100 hover:border-gray-200 hover:shadow-sm'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-3 right-3">
                      <CheckCircle2 className="w-5 h-5 text-[#2A658F]" />
                    </div>
                  )}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${isSelected ? 'bg-[#2A658F]/10' : 'bg-gray-50'}`}>
                    <Icon className={`w-5 h-5 ${isSelected ? 'text-[#2A658F]' : t.iconColor}`} />
                  </div>
                  <h3 className={`font-medium mb-1 ${isSelected ? 'text-[#2A658F]' : 'text-[#27273D]'}`}>{t.label}</h3>
                  <p className="text-xs text-gray-500">{t.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* PASSO 2 — Para quem enviar */}
        {selectedTemplate && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-[#2A658F] text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
              <h2 className="text-lg font-semibold text-[#27273D]">Para quem enviar?</h2>
            </div>

            {/* Modo de envio */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { key: 'all' as SendMode, label: 'Todos os alunos', icon: Users, desc: 'Enviar para todos' },
                { key: 'course' as SendMode, label: 'Por curso', icon: GraduationCap, desc: 'Filtrar por curso' },
                { key: 'individual' as SendMode, label: 'Individual', icon: User, desc: 'Escolher alunos' },
              ].map((mode) => {
                const Icon = mode.icon;
                const isSelected = sendMode === mode.key;
                return (
                  <button
                    key={mode.key}
                    onClick={() => { setSendMode(mode.key); setShowPreview(false); }}
                    className={`text-center p-4 rounded-xl border-2 transition-all duration-200 ${
                      isSelected
                        ? 'border-[#2A658F] bg-[#E2ECF4]'
                        : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <Icon className={`w-5 h-5 mx-auto mb-2 ${isSelected ? 'text-[#2A658F]' : 'text-gray-400'}`} />
                    <p className={`text-sm font-medium ${isSelected ? 'text-[#2A658F]' : 'text-gray-700'}`}>{mode.label}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{mode.desc}</p>
                  </button>
                );
              })}
            </div>

            {/* Filtros por curso */}
            {sendMode === 'course' && (
              <div className="mb-4">
                <label className="text-sm font-medium text-gray-700 mb-2 block">Selecione o curso</label>
                <select
                  value={selectedCourseId || ''}
                  onChange={(e) => { setSelectedCourseId(e.target.value ? Number(e.target.value) : null); setShowPreview(false); }}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-[#2A658F] focus:ring-4 focus:ring-[#2A658F]/10 transition-all outline-none"
                >
                  <option value="">Selecione...</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.count} alunos)</option>
                  ))}
                </select>
              </div>
            )}

            {/* Busca individual */}
            {sendMode === 'individual' && (
              <div className="mb-4">
                <label className="text-sm font-medium text-gray-700 mb-2 block">Buscar aluno por nome ou email</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Digite o nome ou email..."
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:border-[#2A658F] focus:ring-4 focus:ring-[#2A658F]/10 transition-all outline-none"
                  />
                  {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />}
                </div>

                {/* Resultados da busca */}
                {searchResults.length > 0 && (
                  <div className="mt-2 border border-gray-200 rounded-xl overflow-hidden bg-white shadow-lg">
                    {searchResults.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => addStudent(s)}
                        disabled={!!selectedStudents.find(ss => ss.id === s.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 disabled:opacity-40"
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2A658F] to-[#3d7ba8] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {s.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-800 truncate">{s.name}</p>
                          <p className="text-xs text-gray-400 truncate">{s.phone} · {s.primary_course_name || 'Sem curso'}</p>
                        </div>
                        {selectedStudents.find(ss => ss.id === s.id) ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        ) : (
                          <span className="text-xs text-[#2A658F] font-medium flex-shrink-0">Adicionar</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* Alunos selecionados */}
                {selectedStudents.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-gray-500 mb-2">{selectedStudents.length} aluno(s) selecionado(s)</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedStudents.map((s) => (
                        <span
                          key={s.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#E2ECF4] text-[#2A658F] text-sm font-medium rounded-full"
                        >
                          {s.name.split(' ')[0]}
                          <button onClick={() => removeStudent(s.id)} className="hover:text-red-500 transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Filtros extras (para todos e por curso) */}
            {sendMode !== 'individual' && (
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Status financeiro</label>
                  <select
                    value={financialStatus}
                    onChange={(e) => { setFinancialStatus(e.target.value); setShowPreview(false); }}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-[#2A658F] focus:ring-4 focus:ring-[#2A658F]/10 transition-all outline-none"
                  >
                    <option value="">Todos</option>
                    <option value="em_dia">Em dia</option>
                    <option value="pendente">Pendente</option>
                    <option value="inadimplente">Inadimplente</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Acesso ao Moodle</label>
                  <select
                    value={loginStatus}
                    onChange={(e) => { setLoginStatus(e.target.value); setShowPreview(false); }}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-[#2A658F] focus:ring-4 focus:ring-[#2A658F]/10 transition-all outline-none"
                  >
                    <option value="">Todos</option>
                    <option value="logged">Já acessou</option>
                    <option value="never_logged">Nunca acessou</option>
                  </select>
                </div>
              </div>
            )}

            {/* Botão preview */}
            <button
              onClick={loadPreview}
              disabled={!canPreview || loadingPreview}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-[#2A658F] bg-[#E2ECF4] hover:bg-[#CCE4F4] rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loadingPreview ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
              Ver quantos alunos receberão
            </button>
          </div>
        )}

        {/* PASSO 3 — Preview e Confirmar */}
        {showPreview && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-[#2A658F] text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
              <h2 className="text-lg font-semibold text-[#27273D]">Confirmar envio</h2>
            </div>

            {/* Resumo */}
            <div className="bg-gradient-to-r from-[#27273D] to-[#2A658F] rounded-xl p-5 text-white mb-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-white/60 text-xs mb-1">Mensagem</p>
                  <p className="font-medium">{selectedTemplateDef?.label}</p>
                </div>
                <div>
                  <p className="text-white/60 text-xs mb-1">Destinatários</p>
                  <p className="text-2xl font-bold">{totalStudents}</p>
                </div>
              </div>
            </div>

            {/* Lista */}
            {previewStudents.length > 0 && (
              <div className="max-h-60 overflow-y-auto mb-5 border border-gray-100 rounded-xl">
                {previewStudents.map((s, i) => (
                  <div key={s.id} className={`flex items-center gap-3 px-4 py-2.5 ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#2A658F] to-[#3d7ba8] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                      {s.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">{s.name}</p>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">{s.phone}</span>
                  </div>
                ))}
                {totalStudents > 50 && (
                  <div className="px-4 py-2 text-center text-xs text-gray-400 border-t border-gray-50">
                    Mostrando 50 de {totalStudents} alunos
                  </div>
                )}
              </div>
            )}

            {/* Botão enviar */}
            <button
              onClick={handleSend}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-semibold text-white bg-gradient-to-r from-[#2A658F] to-[#3d7ba8] rounded-xl hover:shadow-lg hover:shadow-[#2A658F]/30 transition-all disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Enviar para {totalStudents} aluno(s)
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}