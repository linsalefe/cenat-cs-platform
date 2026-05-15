'use client';

import { useEffect, useState } from 'react';
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
  GraduationCap,
  X,
  Clock,
  XCircle,
  Plus,
  MessageCircle,
  Eye,
  Upload,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

interface MetaTemplate {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
  body: string;
  param_count: number;
}

interface StudentPreview {
  id: number;
  name: string;
  email: string;
  phone: string;
  primary_course_name: string | null;
  financial_status: string | null;
}

interface CourseOption {
  id: number;
  name: string;
  count: number;
}

type SendMode = 'all' | 'course' | 'individual' | 'csv';

const statusStyles: Record<string, { label: string; color: string; icon: any }> = {
  APPROVED: { label: 'Aprovado', color: 'bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
  PENDING: { label: 'Pendente', color: 'bg-amber-50 text-amber-700', icon: Clock },
  REJECTED: { label: 'Rejeitado', color: 'bg-red-50 text-red-700', icon: XCircle },
};

const variableMap: Record<number, string> = {
  1: '{{primeiro_nome}}',
  2: '{{curso}}',
};

export default function NewBroadcastPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);

  // Canais
  const [channels, setChannels] = useState<{slug: string; name: string}[]>([]);
  const [selectedChannel, setSelectedChannel] = useState('cs');

  // Templates
  const [templates, setTemplates] = useState<MetaTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [showBody, setShowBody] = useState<string | null>(null);

  // Criar template
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newCategory, setNewCategory] = useState('MARKETING');
  const [creating, setCreating] = useState(false);

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

  // CSV
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<{
    headers: string[];
    rows: string[][];
    totalRows: number;
    validRows: number;
    invalidRows: number;
    phoneColumnIdx: number;
    nameColumnIdx: number | null;
    error: string | null;
  } | null>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (!authLoading && !user) router.push('/login'); }, [user, authLoading, router]);
  useEffect(() => { if (user) { loadCourses(); loadChannels(); } }, [user]);
  useEffect(() => {
    if (user && selectedChannel) {
      loadTemplates(selectedChannel);
      setSelectedTemplate('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedChannel]);

  /* ─── CSV helpers ─── */

  const PHONE_ALIASES_NORM = ['numero', 'telefone', 'phone', 'whatsapp', 'celular'];
  const NAME_ALIASES_NORM = ['nome', 'name'];

  const normalizeHeader = (h: string): string => {
    if (!h) return '';
    return h
      .trim()
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\s\-.]+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
  };

  const parseCsvClient = async (file: File) => {
    let text: string;
    try {
      text = await file.text();
    } catch {
      setCsvPreview({
        headers: [], rows: [], totalRows: 0, validRows: 0, invalidRows: 0,
        phoneColumnIdx: -1, nameColumnIdx: null,
        error: 'Não foi possível ler o arquivo',
      });
      return;
    }

    // BOM
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

    const lines = text.split(/\r?\n/).map(l => l.trimEnd()).filter(l => l.length > 0);
    if (lines.length < 2) {
      setCsvPreview({
        headers: [], rows: [], totalRows: 0, validRows: 0, invalidRows: 0,
        phoneColumnIdx: -1, nameColumnIdx: null,
        error: 'CSV precisa ter cabeçalho e ao menos 1 linha de dados',
      });
      return;
    }

    // Sniff: ; vence , se aparecer mais vezes no header
    const headerLine = lines[0];
    const commaCount = (headerLine.match(/,/g) || []).length;
    const semiCount = (headerLine.match(/;/g) || []).length;
    const delim = semiCount > commaCount ? ';' : ',';

    const headers = headerLine.split(delim).map(h => h.trim());
    const headersNorm = headers.map(normalizeHeader);

    const phoneColumnIdx = headersNorm.findIndex(h => PHONE_ALIASES_NORM.includes(h));
    const nameColumnIdx = headersNorm.findIndex(h => NAME_ALIASES_NORM.includes(h));

    if (phoneColumnIdx === -1) {
      setCsvPreview({
        headers, rows: [], totalRows: lines.length - 1, validRows: 0, invalidRows: 0,
        phoneColumnIdx: -1, nameColumnIdx: null,
        error: `Nenhuma coluna de telefone. Use uma destas no cabeçalho: ${PHONE_ALIASES_NORM.join(', ')}`,
      });
      return;
    }

    const dataLines = lines.slice(1);
    if (dataLines.length > 5000) {
      setCsvPreview({
        headers, rows: [], totalRows: dataLines.length, validRows: 0, invalidRows: 0,
        phoneColumnIdx, nameColumnIdx: nameColumnIdx === -1 ? null : nameColumnIdx,
        error: `CSV excede o limite de 5000 linhas (${dataLines.length} encontradas)`,
      });
      return;
    }

    const rows = dataLines.map(l => l.split(delim).map(c => c.trim()));
    let validRows = 0;
    for (const r of rows) {
      const raw = r[phoneColumnIdx] || '';
      const digits = raw.replace(/\D+/g, '');
      if (digits.length >= 8) validRows++;
    }

    setCsvPreview({
      headers,
      rows: rows.slice(0, 5),
      totalRows: rows.length,
      validRows,
      invalidRows: rows.length - validRows,
      phoneColumnIdx,
      nameColumnIdx: nameColumnIdx === -1 ? null : nameColumnIdx,
      error: null,
    });
  };

  const handleCsvSelect = (file: File | null) => {
    setCsvFile(file);
    setCsvPreview(null);
    setShowPreview(false);
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Arquivo maior que 5 MB');
        setCsvFile(null);
        return;
      }
      parseCsvClient(file);
    }
  };

  const loadTemplates = async (channel?: string) => {
    try {
      const ch = channel || selectedChannel || 'cs';
      const res = await api.get('/whatsapp/templates', { params: { channel: ch } });
      setTemplates(res.data);
    } catch {
      toast.error('Erro ao carregar templates');
    } finally {
      setLoadingTemplates(false);
    }
  };

  const loadCourses = async () => {
    try {
      const res = await api.get('/students/courses');
      setCourses(res.data);
    } catch {}
  };

  const loadChannels = async () => {
    try {
      const res = await api.get('/whatsapp/channels');
      setChannels(res.data);
      if (res.data.length > 0) setSelectedChannel(res.data[0].slug);
    } catch {}
  };

  const handleCreateTemplate = async () => {
    if (!newName.trim()) { toast.error('Informe o nome do template'); return; }
    if (!newBody.trim()) { toast.error('Informe o corpo da mensagem'); return; }

    setCreating(true);
    try {
      await api.post('/whatsapp/templates', {
        name: newName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
        category: newCategory,
        language: 'pt_BR',
        body: newBody,
      });
      toast.success('Template enviado para aprovação da Meta!');
      setShowCreateForm(false);
      setNewName('');
      setNewBody('');
      loadTemplates(selectedChannel);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Erro ao criar template');
    } finally {
      setCreating(false);
    }
  };

  const searchStudents = async (term: string) => {
    if (term.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await api.get(`/broadcasts/preview?search=${encodeURIComponent(term)}&limit=10`);
      setSearchResults(res.data.data || []);
    } catch {} finally { setSearching(false); }
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
    } catch { toast.error('Erro ao carregar preview'); }
    finally { setLoadingPreview(false); }
  };

  const handleSend = async () => {
    const tpl = templates.find(t => t.name === selectedTemplate);
    if (!tpl) { toast.error('Selecione um template'); return; }
    if (tpl.status !== 'APPROVED') { toast.error('Só é possível enviar templates aprovados'); return; }
    if (sendMode === 'individual' && selectedStudents.length === 0) { toast.error('Selecione pelo menos um aluno'); return; }
    if (sendMode === 'course' && !selectedCourseId) { toast.error('Selecione um curso'); return; }
    if (sendMode === 'csv' && (!csvFile || !csvPreview || csvPreview.error || csvPreview.validRows === 0)) {
      toast.error('Selecione um CSV válido antes de disparar');
      return;
    }

    // Branch CSV — usa endpoint próprio (multipart)
    if (sendMode === 'csv' && csvFile && csvPreview) {
      const templateParams: string[] = [];
      for (let i = 1; i <= tpl.param_count; i++) {
        templateParams.push(variableMap[i] || '{{primeiro_nome}}');
      }
      const broadcastName = `${tpl.name} — CSV (${csvFile.name})`;

      if (!confirm(`Disparar para ${csvPreview.validRows} destinatário(s) válido(s)? (${csvPreview.invalidRows} sem telefone serão pulados)`)) return;

      setSaving(true);
      try {
        const fd = new FormData();
        fd.append('file', csvFile);
        fd.append('name', broadcastName);
        fd.append('channel', selectedChannel);
        fd.append('template_name', tpl.name);
        fd.append('template_language', tpl.language);
        fd.append('template_params', JSON.stringify(templateParams));

        const res = await api.post('/broadcasts/upload-csv', fd);
        await api.post(`/broadcasts/${res.data.id}/send`);
        toast.success(`Disparo iniciado! ${res.data.valid_recipients} destinatário(s) receberão.`);
        router.push(`/broadcasts/${res.data.id}`);
      } catch (error: any) {
        toast.error(error.response?.data?.detail || 'Erro ao enviar CSV');
      } finally { setSaving(false); }
      return;
    }

    const courseName = sendMode === 'course' ? courses.find(c => c.id === selectedCourseId)?.name || '' : '';
    const confirmMsg = sendMode === 'individual'
      ? `Enviar "${tpl.name}" para ${selectedStudents.length} aluno(s)?`
      : `Enviar "${tpl.name}" para ${totalStudents} alunos?`;
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

      // Monta params automáticos baseado no param_count
      const templateParams: string[] = [];
      for (let i = 1; i <= tpl.param_count; i++) {
        templateParams.push(variableMap[i] || `{{primeiro_nome}}`);
      }

      const broadcastName = sendMode === 'individual'
        ? `${tpl.name} — ${selectedStudents.map(s => s.name.split(' ')[0]).join(', ')}`
        : sendMode === 'course'
        ? `${tpl.name} — ${courseName}`
        : `${tpl.name} — Todos`;

      const res = await api.post('/broadcasts', {
        name: broadcastName,
        channel: selectedChannel,
        filters,
        template_name: tpl.name,
        template_language: tpl.language,
        template_params: templateParams,
      });

      await api.post(`/broadcasts/${res.data.id}/send`);
      toast.success(`Disparo iniciado! ${res.data.total_students} aluno(s) receberão a mensagem.`);
      router.push(`/broadcasts/${res.data.id}`);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Erro ao criar disparo');
    } finally { setSaving(false); }
  };

  const selectedTpl = templates.find(t => t.name === selectedTemplate);
  const canPreview = selectedTemplate && selectedTpl?.status === 'APPROVED' && (
    sendMode === 'all' ||
    (sendMode === 'course' && selectedCourseId) ||
    (sendMode === 'individual' && selectedStudents.length > 0) ||
    (sendMode === 'csv' && csvFile !== null && csvPreview !== null && csvPreview.error === null && csvPreview.validRows > 0)
  );

  if (authLoading) return null;

  return (
    <AppLayout>
      <div className={`max-w-3xl mx-auto space-y-6 transition-all duration-700 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        {/* Header */}
        <div>
          <button onClick={() => router.push('/broadcasts')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-4">
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
          <h1 className="text-2xl font-semibold text-foreground">Novo Disparo</h1>
          <p className="text-sm text-muted-foreground mt-1">Envie mensagens pelo WhatsApp para seus alunos</p>
        </div>

        {/* PASSO 1 — Selecionar Template */}
        <div className="bg-card rounded-2xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
              <h2 className="text-lg font-semibold text-foreground">Escolha a mensagem</h2>
            </div>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary bg-primary/10 hover:bg-primary/15 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Criar novo
            </button>
          </div>

          {/* Criar template */}
          {showCreateForm && (
            <div className="mb-5 p-4 bg-muted/50 rounded-xl space-y-3 border border-border">
              <h3 className="text-sm font-semibold text-foreground">Criar novo template</h3>
              <p className="text-xs text-muted-foreground">O template será enviado para aprovação da Meta. Pode levar de minutos a 24h.</p>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome (sem espaços ou acentos)</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="ex: aviso_matricula"
                  className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Categoria</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:border-primary outline-none"
                >
                  <option value="MARKETING">Marketing</option>
                  <option value="UTILITY">Utilidade</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Canal</label>
                <select
                  value={selectedChannel}
                  onChange={(e) => setSelectedChannel(e.target.value)}
                  className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:border-primary outline-none"
                >
                  {channels.map((ch) => (
                    <option key={ch.slug} value={ch.slug}>{ch.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Mensagem</label>
                <textarea
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  placeholder={"Olá, {{1}}! Aqui é do CENAT...\n\nUse {{1}}, {{2}} para variáveis"}
                  rows={5}
                  className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none resize-none"
                />
                <p className="text-[10px] text-muted-foreground/70 mt-1">Use {'{{1}}'} para nome, {'{{2}}'} para curso, etc.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowCreateForm(false)} className="px-4 py-2 text-sm text-muted-foreground bg-muted rounded-lg hover:bg-muted-foreground/20 transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={handleCreateTemplate}
                  disabled={creating}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-[#1e4f72] transition-colors disabled:opacity-50"
                >
                  {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Enviar para aprovação
                </button>
              </div>
            </div>
          )}

          {/* Lista de templates */}
          {loadingTemplates ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-muted-foreground/70 animate-spin" />
            </div>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground/70 text-center py-8">Nenhum template encontrado</p>
          ) : (
            <div className="space-y-2">
              {templates.map((t) => {
                const isSelected = selectedTemplate === t.name;
                const st = statusStyles[t.status] || statusStyles.PENDING;
                const StIcon = st.icon;
                const isApproved = t.status === 'APPROVED';

                return (
                  <div key={t.id}>
                    <button
                      onClick={() => { if (isApproved) setSelectedTemplate(isSelected ? '' : t.name); }}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                        isSelected
                          ? 'border-primary bg-primary/10 shadow-md'
                          : isApproved
                          ? 'border-border hover:border-border hover:shadow-sm'
                          : 'border-border opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isSelected ? 'bg-primary/10' : 'bg-muted/50'}`}>
                            <MessageCircle className={`w-5 h-5 ${isSelected ? 'text-primary' : 'text-muted-foreground/70'}`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className={`font-medium ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                                {t.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </h3>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full ${st.color}`}>
                                <StIcon className="w-3 h-3" />
                                {st.label}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground/70 mt-0.5">
                              {t.category} · {t.param_count} parâmetro(s) · {t.language}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); setShowBody(showBody === t.name ? null : t.name); }}
                            className="p-1.5 text-muted-foreground/70 hover:text-primary hover:bg-muted rounded-lg transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {isSelected && <CheckCircle2 className="w-5 h-5 text-primary" />}
                        </div>
                      </div>
                    </button>

                    {/* Preview do body */}
                    {showBody === t.name && (
                      <div className="mt-1 ml-14 p-3 bg-muted/50 rounded-xl text-sm text-muted-foreground whitespace-pre-wrap border border-border">
                        {t.body || 'Sem conteúdo'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* PASSO 2 — Para quem enviar */}
        {selectedTemplate && selectedTpl?.status === 'APPROVED' && (
          <div className="bg-card rounded-2xl border border-border p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
              <h2 className="text-lg font-semibold text-foreground">Para quem enviar?</h2>
            </div>

            {channels.length > 1 && (
              <div className="mb-4">
                <label className="text-sm font-medium text-foreground/90 mb-2 block">Canal de envio</label>
                <div className="flex gap-2">
                  {channels.map((ch) => (
                    <button
                      key={ch.slug}
                      onClick={() => setSelectedChannel(ch.slug)}
                      className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        selectedChannel === ch.slug
                          ? 'bg-primary text-white'
                          : 'bg-muted/50 text-muted-foreground border border-border hover:border-border'
                      }`}
                    >
                      {ch.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {([
                { key: 'all' as SendMode, label: 'Todos os alunos', icon: Users, desc: 'Enviar para todos' },
                { key: 'course' as SendMode, label: 'Por curso', icon: GraduationCap, desc: 'Filtrar por curso' },
                { key: 'individual' as SendMode, label: 'Individual', icon: User, desc: 'Escolher alunos' },
                { key: 'csv' as SendMode, label: 'Upload CSV', icon: Upload, desc: 'Subir lista própria' },
              ]).map((mode) => {
                const Icon = mode.icon;
                const isSelected = sendMode === mode.key;
                return (
                  <button
                    key={mode.key}
                    onClick={() => { setSendMode(mode.key); setShowPreview(false); }}
                    className={`text-center p-4 rounded-xl border-2 transition-all duration-200 ${
                      isSelected ? 'border-primary bg-primary/10' : 'border-border hover:border-border'
                    }`}
                  >
                    <Icon className={`w-5 h-5 mx-auto mb-2 ${isSelected ? 'text-primary' : 'text-muted-foreground/70'}`} />
                    <p className={`text-sm font-medium ${isSelected ? 'text-primary' : 'text-foreground/90'}`}>{mode.label}</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">{mode.desc}</p>
                  </button>
                );
              })}
            </div>

            {sendMode === 'course' && (
              <div className="mb-4">
                <label className="text-sm font-medium text-foreground/90 mb-2 block">Selecione o curso</label>
                <select
                  value={selectedCourseId || ''}
                  onChange={(e) => { setSelectedCourseId(e.target.value ? Number(e.target.value) : null); setShowPreview(false); }}
                  className="w-full px-4 py-3 border border-border rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                >
                  <option value="">Selecione...</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.count} alunos)</option>
                  ))}
                </select>
              </div>
            )}

            {sendMode === 'individual' && (
              <div className="mb-4">
                <label className="text-sm font-medium text-foreground/90 mb-2 block">Buscar aluno por nome ou email</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Digite o nome ou email..."
                    className="w-full pl-10 pr-4 py-3 border border-border rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                  />
                  {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 animate-spin" />}
                </div>

                {searchResults.length > 0 && (
                  <div className="mt-2 border border-border rounded-xl overflow-hidden bg-card shadow-lg">
                    {searchResults.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => addStudent(s)}
                        disabled={!!selectedStudents.find(ss => ss.id === s.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors border-b border-gray-50 last:border-0 disabled:opacity-40"
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {s.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                          <p className="text-xs text-muted-foreground/70 truncate">{s.phone} · {s.primary_course_name || 'Sem curso'}</p>
                        </div>
                        {selectedStudents.find(ss => ss.id === s.id) ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        ) : (
                          <span className="text-xs text-primary font-medium flex-shrink-0">Adicionar</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {selectedStudents.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-muted-foreground mb-2">{selectedStudents.length} aluno(s) selecionado(s)</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedStudents.map((s) => (
                        <span key={s.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary text-sm font-medium rounded-full">
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

            {sendMode === 'csv' && (
              <div className="mb-4 space-y-4">
                {/* Drop zone */}
                {!csvFile ? (
                  <label className="block cursor-pointer">
                    <div className="border-2 border-dashed border-border hover:border-primary/50 rounded-2xl px-6 py-10 text-center transition-colors bg-muted/30 hover:bg-primary/5">
                      <Upload className="w-8 h-8 mx-auto text-muted-foreground/70 mb-3" />
                      <p className="text-sm font-medium text-foreground">Clique para selecionar um CSV</p>
                      <p className="text-[11px] text-muted-foreground/70 mt-1">
                        Aceita .csv com colunas <code>numero, nome, curso</code> (e outras livres). Até 5 MB / 5000 linhas.
                      </p>
                    </div>
                    <input
                      type="file"
                      accept=".csv,.txt,text/csv"
                      className="hidden"
                      onChange={(e) => handleCsvSelect(e.target.files?.[0] || null)}
                    />
                  </label>
                ) : (
                  <div className="border border-border rounded-xl p-4 bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{csvFile.name}</p>
                        <p className="text-[11px] text-muted-foreground/70">
                          {(csvFile.size / 1024).toFixed(1)} KB
                          {csvPreview && !csvPreview.error && (
                            <> · {csvPreview.totalRows} linha(s) · <span className="text-emerald-600 font-medium">{csvPreview.validRows} válida(s)</span>
                            {csvPreview.invalidRows > 0 && <> · <span className="text-amber-600 font-medium">{csvPreview.invalidRows} sem telefone</span></>}</>
                          )}
                        </p>
                      </div>
                      <button
                        onClick={() => handleCsvSelect(null)}
                        className="p-1.5 text-muted-foreground/70 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                        aria-label="Remover arquivo"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Erro de parse */}
                    {csvPreview?.error && (
                      <div className="mt-3 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-red-700">{csvPreview.error}</p>
                      </div>
                    )}

                    {/* Preview das 5 primeiras linhas */}
                    {csvPreview && !csvPreview.error && csvPreview.rows.length > 0 && (
                      <div className="mt-4">
                        <p className="text-[11px] font-medium text-muted-foreground mb-2">Prévia (primeiras 5 linhas)</p>
                        <div className="overflow-x-auto border border-border rounded-lg">
                          <table className="w-full text-xs">
                            <thead className="bg-muted/50">
                              <tr>
                                {csvPreview.headers.map((h, i) => (
                                  <th key={i} className={`px-3 py-2 text-left font-semibold whitespace-nowrap ${i === csvPreview.phoneColumnIdx ? 'text-primary' : 'text-foreground'}`}>
                                    {h}
                                    {i === csvPreview.phoneColumnIdx && <span className="ml-1 text-[9px] text-primary/70">📱</span>}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {csvPreview.rows.map((row, ri) => (
                                <tr key={ri} className={`border-t border-border ${(row[csvPreview.phoneColumnIdx] || '').replace(/\D+/g, '').length < 8 ? 'bg-amber-50/50' : ''}`}>
                                  {csvPreview.headers.map((_, ci) => (
                                    <td key={ci} className="px-3 py-1.5 text-foreground/80 whitespace-nowrap truncate max-w-[180px]">
                                      {row[ci] || <span className="text-muted-foreground/40 italic">vazio</span>}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <p className="text-[10px] text-muted-foreground/70 mt-1.5">
                          Linhas em <span className="text-amber-700">amarelo</span> serão puladas (sem telefone válido).
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {sendMode !== 'individual' && sendMode !== 'csv' && (
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Status financeiro</label>
                  <select
                    value={financialStatus}
                    onChange={(e) => { setFinancialStatus(e.target.value); setShowPreview(false); }}
                    className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                  >
                    <option value="">Todos</option>
                    <option value="em_dia">Em dia</option>
                    <option value="pendente">Pendente</option>
                    <option value="inadimplente">Inadimplente</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Acesso ao Moodle</label>
                  <select
                    value={loginStatus}
                    onChange={(e) => { setLoginStatus(e.target.value); setShowPreview(false); }}
                    className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                  >
                    <option value="">Todos</option>
                    <option value="logged">Já acessou</option>
                    <option value="never_logged">Nunca acessou</option>
                  </select>
                </div>
              </div>
            )}

            {sendMode === 'csv' ? (
              <button
                onClick={handleSend}
                disabled={!canPreview || saving}
                className="w-full flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-semibold text-white bg-gradient-to-r from-primary to-primary/80 rounded-xl hover:shadow-lg hover:shadow-[#2A658F]/30 transition-all disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {csvPreview && !csvPreview.error
                  ? `Disparar para ${csvPreview.validRows} destinatário(s)`
                  : 'Selecione um CSV válido'}
              </button>
            ) : (
              <button
                onClick={loadPreview}
                disabled={!canPreview || loadingPreview}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-primary bg-primary/10 hover:bg-primary/15 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loadingPreview ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                Ver quantos alunos receberão
              </button>
            )}
          </div>
        )}

        {/* PASSO 3 — Confirmar */}
        {showPreview && (
          <div className="bg-card rounded-2xl border border-border p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
              <h2 className="text-lg font-semibold text-foreground">Confirmar envio</h2>
            </div>

            <div className="bg-gradient-to-r from-primary to-[#2A658F] rounded-xl p-5 text-white mb-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-white/60 text-xs mb-1">Mensagem</p>
                  <p className="font-medium">{selectedTpl?.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                </div>
                <div>
                  <p className="text-white/60 text-xs mb-1">Destinatários</p>
                  <p className="text-2xl font-bold">{totalStudents}</p>
                </div>
              </div>
            </div>

            {previewStudents.length > 0 && (
              <div className="max-h-60 overflow-y-auto mb-5 border border-border rounded-xl">
                {previewStudents.map((s, i) => (
                  <div key={s.id} className={`flex items-center gap-3 px-4 py-2.5 ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                      {s.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                    </div>
                    <span className="text-xs text-muted-foreground/70 flex-shrink-0">{s.phone}</span>
                  </div>
                ))}
                {totalStudents > 50 && (
                  <div className="px-4 py-2 text-center text-xs text-muted-foreground/70 border-t border-gray-50">
                    Mostrando 50 de {totalStudents} alunos
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleSend}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-semibold text-white bg-gradient-to-r from-primary to-primary/80 rounded-xl hover:shadow-lg hover:shadow-[#2A658F]/30 transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Enviar para {totalStudents} aluno(s)
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}