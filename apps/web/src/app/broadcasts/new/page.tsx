'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import AppLayout from '@/components/AppLayout';
import {
  ArrowLeft,
  Send,
  Users,
  Filter,
  Eye,
  Loader2,
  Save,
  CheckCircle2,
  Search,
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

const channelOptions = [
  { key: 'cs', label: 'CS' },
  { key: 'secretaria', label: 'Secretaria' },
  { key: 'financeiro', label: 'Financeiro' },
  { key: 'pedagogico', label: 'Pedagógico' },
];

const financialOptions = [
  { key: '', label: 'Todos' },
  { key: 'em_dia', label: 'Em dia' },
  { key: 'pendente', label: 'Pendente' },
  { key: 'inadimplente', label: 'Inadimplente' },
];

const loginOptions = [
  { key: '', label: 'Todos' },
  { key: 'logged', label: 'Já acessou' },
  { key: 'never_logged', label: 'Nunca acessou' },
];

const docsOptions = [
  { key: '', label: 'Todos' },
  { key: 'complete', label: 'Completa' },
  { key: 'incomplete', label: 'Incompleta' },
  { key: 'none', label: 'Nenhum doc' },
];

export default function NewBroadcastPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(1);

  // Step 1 - Info
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [channel, setChannel] = useState('cs');

  // Step 2 - Filters
  const [loginStatus, setLoginStatus] = useState('');
  const [docsStatus, setDocsStatus] = useState('');
  const [financialStatus, setFinancialStatus] = useState('');
  const [courseId, setCourseId] = useState<number | null>(null);
  const [courses, setCourses] = useState<CourseOption[]>([]);

  // Step 3 - Preview
  const [students, setStudents] = useState<StudentPreview[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Step 4 - Template
  const [templateName, setTemplateName] = useState('');
  const [templateParams, setTemplateParams] = useState<string[]>([]);
  const [templateLanguage, setTemplateLanguage] = useState('pt_BR');

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) loadCourses();
  }, [user]);

  const loadCourses = async () => {
    try {
      const res = await api.get('/students/courses');
      setCourses(res.data);
    } catch {}
  };

  const loadPreview = async () => {
    setLoadingPreview(true);
    try {
      const params = new URLSearchParams();
      if (loginStatus) params.append('login_status', loginStatus);
      if (docsStatus) params.append('docs_status', docsStatus);
      if (financialStatus) params.append('financial_status', financialStatus);
      if (courseId) params.append('course_id', String(courseId));
      params.append('limit', '50');

      const res = await api.get(`/broadcasts/preview?${params.toString()}`);
      setStudents(res.data.data || []);
      setTotalStudents(res.data.total || 0);
    } catch {
      toast.error('Erro ao carregar preview');
    } finally {
      setLoadingPreview(false);
    }
  };

  useEffect(() => {
    if (step === 3) loadPreview();
  }, [step]);

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Informe o nome do disparo'); return; }
    if (!templateName.trim()) { toast.error('Informe o nome do template'); return; }
    if (totalStudents === 0) { toast.error('Nenhum aluno será impactado'); return; }

    setSaving(true);
    try {
      const filters: Record<string, any> = {};
      if (loginStatus) filters.login_status = loginStatus;
      if (docsStatus) filters.docs_status = docsStatus;
      if (financialStatus) filters.financial_status = financialStatus;
      if (courseId) filters.course_id = courseId;

      const res = await api.post('/broadcasts', {
        name,
        description: description || null,
        channel,
        filters,
        template_name: templateName,
        template_language: templateLanguage,
        template_params: templateParams.filter(p => p.trim()),
      });

      toast.success(`Disparo criado! ${res.data.total_students} alunos serão impactados.`);
      router.push('/broadcasts');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Erro ao criar disparo');
    } finally {
      setSaving(false);
    }
  };

  const addParam = () => setTemplateParams([...templateParams, '']);
  const removeParam = (idx: number) => setTemplateParams(templateParams.filter((_, i) => i !== idx));
  const updateParam = (idx: number, value: string) => {
    const updated = [...templateParams];
    updated[idx] = value;
    setTemplateParams(updated);
  };

  if (authLoading) return null;

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className={`transition-all duration-700 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
          <button onClick={() => router.push('/broadcasts')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#2A658F] transition-colors mb-4">
            <ArrowLeft className="w-4 h-4" />
            Voltar para Disparos
          </button>
          <p className="text-sm font-medium text-[#2A658F] mb-1">Novo Disparo</p>
          <h1 className="text-2xl font-semibold text-[#27273D] tracking-tight">Criar Disparo em Massa</h1>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-2">
          {[
            { n: 1, label: 'Info' },
            { n: 2, label: 'Filtros' },
            { n: 3, label: 'Preview' },
            { n: 4, label: 'Template' },
          ].map((s) => (
            <button
              key={s.n}
              onClick={() => setStep(s.n)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                step === s.n
                  ? 'bg-[#2A658F] text-white shadow-md'
                  : step > s.n
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-white text-gray-500 border border-gray-200'
              }`}
            >
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                step === s.n ? 'bg-white/20 text-white' : step > s.n ? 'bg-emerald-200 text-emerald-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {step > s.n ? <CheckCircle2 className="w-4 h-4" /> : s.n}
              </span>
              {s.label}
            </button>
          ))}
        </div>

        {/* Step 1 - Info */}
        {step === 1 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
            <h2 className="text-lg font-semibold text-[#27273D]">Informações do Disparo</h2>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Nome do disparo *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Lembrete inadimplentes - Janeiro" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-[#2A658F] focus:ring-4 focus:ring-[#2A658F]/10 transition-all outline-none" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Descrição (opcional)</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Breve descrição" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-[#2A658F] focus:ring-4 focus:ring-[#2A658F]/10 transition-all outline-none" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Canal de envio</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {channelOptions.map((ch) => (
                  <button key={ch.key} onClick={() => setChannel(ch.key)} className={`p-3 rounded-xl border text-sm font-medium transition-all ${channel === ch.key ? 'bg-[#2A658F] text-white border-[#2A658F]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                    {ch.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={() => { if (!name.trim()) { toast.error('Informe o nome'); return; } setStep(2); }} className="px-6 py-2.5 text-sm font-medium text-white bg-[#2A658F] rounded-xl hover:bg-[#1e4f72] transition-all">
                Próximo →
              </button>
            </div>
          </div>
        )}

        {/* Step 2 - Filters */}
        {step === 2 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
            <h2 className="text-lg font-semibold text-[#27273D] flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-400" />
              Filtrar Alunos
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Status de Login</label>
                <select value={loginStatus} onChange={(e) => setLoginStatus(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-[#2A658F] focus:ring-4 focus:ring-[#2A658F]/10 transition-all outline-none">
                  {loginOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Documentação</label>
                <select value={docsStatus} onChange={(e) => setDocsStatus(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-[#2A658F] focus:ring-4 focus:ring-[#2A658F]/10 transition-all outline-none">
                  {docsOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Status Financeiro</label>
                <select value={financialStatus} onChange={(e) => setFinancialStatus(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-[#2A658F] focus:ring-4 focus:ring-[#2A658F]/10 transition-all outline-none">
                  {financialOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Curso</label>
                <select value={courseId || ''} onChange={(e) => setCourseId(e.target.value ? Number(e.target.value) : null)} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-[#2A658F] focus:ring-4 focus:ring-[#2A658F]/10 transition-all outline-none">
                  <option value="">Todos os cursos</option>
                  {courses.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.count})</option>)}
                </select>
              </div>
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep(1)} className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all">
                ← Voltar
              </button>
              <button onClick={() => setStep(3)} className="px-6 py-2.5 text-sm font-medium text-white bg-[#2A658F] rounded-xl hover:bg-[#1e4f72] transition-all">
                Ver Preview →
              </button>
            </div>
          </div>
        )}

        {/* Step 3 - Preview */}
        {step === 3 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#27273D] flex items-center gap-2">
                <Users className="w-5 h-5 text-gray-400" />
                Preview — {totalStudents} alunos serão impactados
              </h2>
              <button onClick={loadPreview} disabled={loadingPreview} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#2A658F] bg-[#E2ECF4] rounded-lg hover:bg-[#CCE4F4] transition-colors">
                {loadingPreview ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                Atualizar
              </button>
            </div>

            <div className="bg-gradient-to-r from-[#2A658F] to-[#3d7ba8] rounded-xl p-4 text-white">
              <p className="text-3xl font-bold">{totalStudents}</p>
              <p className="text-white/70 text-sm">alunos receberão a mensagem</p>
            </div>

            {loadingPreview ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
              </div>
            ) : (
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr className="text-left text-xs font-medium text-gray-500 uppercase">
                      <th className="px-4 py-2">Nome</th>
                      <th className="px-4 py-2">Telefone</th>
                      <th className="px-4 py-2">Curso</th>
                      <th className="px-4 py-2">Financeiro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {students.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium text-gray-800">{s.name}</td>
                        <td className="px-4 py-2 text-gray-600">{s.phone}</td>
                        <td className="px-4 py-2 text-gray-600 max-w-xs truncate">{s.primary_course_name || '-'}</td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            s.financial_status === 'em_dia' ? 'bg-emerald-50 text-emerald-700' :
                            s.financial_status === 'inadimplente' ? 'bg-red-50 text-red-700' :
                            s.financial_status === 'pendente' ? 'bg-amber-50 text-amber-700' :
                            'bg-gray-100 text-gray-500'
                          }`}>
                            {s.financial_status || 'N/A'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {totalStudents > 50 && (
                  <p className="text-xs text-gray-400 text-center py-2">Mostrando 50 de {totalStudents} alunos</p>
                )}
              </div>
            )}

            <div className="flex justify-between">
              <button onClick={() => setStep(2)} className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all">
                ← Filtros
              </button>
              <button onClick={() => setStep(4)} className="px-6 py-2.5 text-sm font-medium text-white bg-[#2A658F] rounded-xl hover:bg-[#1e4f72] transition-all">
                Configurar Template →
              </button>
            </div>
          </div>
        )}

        {/* Step 4 - Template */}
        {step === 4 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
            <h2 className="text-lg font-semibold text-[#27273D]">Template Meta (aprovado)</h2>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm">
              ⚠️ Use apenas templates aprovados pela Meta. O nome deve ser exatamente igual ao cadastrado no Business Manager.
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Nome do template *</label>
              <input type="text" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Ex: boas_vindas, lembrete_acesso" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-[#2A658F] focus:ring-4 focus:ring-[#2A658F]/10 transition-all outline-none" />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Idioma do template *</label>
              <select value={templateLanguage} onChange={(e) => setTemplateLanguage(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-[#2A658F] focus:ring-4 focus:ring-[#2A658F]/10 transition-all outline-none">
                <option value="pt_BR">Português (BR)</option>
                <option value="en_US">English (US)</option>
                <option value="en">English</option>
                <option value="es">Español</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Parâmetros do template</label>
                <button onClick={addParam} className="text-sm text-[#2A658F] hover:underline">+ Adicionar parâmetro</button>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Use variáveis: <code className="bg-gray-100 px-1 rounded">{'{{nome}}'}</code> <code className="bg-gray-100 px-1 rounded">{'{{primeiro_nome}}'}</code> <code className="bg-gray-100 px-1 rounded">{'{{curso}}'}</code> <code className="bg-gray-100 px-1 rounded">{'{{email}}'}</code> <code className="bg-gray-100 px-1 rounded">{'{{status_financeiro}}'}</code>
              </p>

              {templateParams.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Nenhum parâmetro (template sem variáveis)</p>
              ) : (
                <div className="space-y-2">
                  {templateParams.map((param, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-16">{`{{${idx + 1}}}`}</span>
                      <input type="text" value={param} onChange={(e) => updateParam(idx, e.target.value)} placeholder={`Ex: {{primeiro_nome}}`} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#2A658F] focus:ring-4 focus:ring-[#2A658F]/10 transition-all outline-none" />
                      <button onClick={() => removeParam(idx)} className="text-red-400 hover:text-red-600 text-sm">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="bg-gradient-to-r from-[#27273D] to-[#2A658F] rounded-xl p-5 text-white">
              <h3 className="text-sm font-medium text-white/70 mb-2">Resumo do disparo</h3>
              <div className="space-y-1 text-sm">
                <p><span className="text-white/60">Nome:</span> {name || '-'}</p>
                <p><span className="text-white/60">Canal:</span> {channelOptions.find(c => c.key === channel)?.label}</p>
                <p><span className="text-white/60">Alunos:</span> <span className="font-bold text-lg">{totalStudents}</span></p>
                <p><span className="text-white/60">Template:</span> {templateName || '-'}</p>
                {templateParams.length > 0 && (
                  <p><span className="text-white/60">Params:</span> {templateParams.join(', ')}</p>
                )}
              </div>
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep(3)} className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all">
                ← Preview
              </button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-[#2A658F] to-[#3d7ba8] rounded-xl hover:shadow-lg transition-all disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Criar Disparo
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}