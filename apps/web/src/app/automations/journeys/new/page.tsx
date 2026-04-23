'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import AppLayout from '@/components/AppLayout';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Loader2,
  CheckCircle2,
  GitBranch,
  Clock,
  MessageSquare,
  MousePointerClick,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

interface StepForm {
  step_order: number;
  delay_days: number;
  delay_hours: number;
  template_name: string;
  template_language: string;
  template_params: string[];
  buttons: { id: string; text: string; action: string }[];
  title: string;
}

const triggerOptions = [
  { key: 'new_enrollment', label: 'Matrícula nova' },
  { key: 'first_login', label: 'Primeiro login no Moodle' },
  { key: 'payment_overdue', label: 'Pagamento atrasado' },
  { key: 'days_without_access', label: 'Dias sem acesso' },
];

const channelOptions = [
  { key: 'cs', label: 'CS' },
  { key: 'secretaria', label: 'Secretaria' },
  { key: 'financeiro', label: 'Financeiro' },
  { key: 'pedagogico', label: 'Pedagógico' },
];

const replyOptions = [
  { key: 'pause', label: 'Pausar e direcionar para humano' },
  { key: 'continue', label: 'Continuar normalmente' },
  { key: 'stop', label: 'Parar a régua' },
];

const buttonActions = [
  { key: 'continue', label: 'Continuar régua' },
  { key: 'stop', label: 'Parar régua (objetivo cumprido)' },
  { key: 'handoff', label: 'Direcionar para humano' },
];

const emptyStep = (): StepForm => ({
  step_order: 1,
  delay_days: 0,
  delay_hours: 0,
  template_name: '',
  template_language: 'pt_BR',
  template_params: [],
  buttons: [],
  title: '',
});

export default function NewJourneyPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(1); // wizard step

  // Step 1 - Info
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState('new_enrollment');
  const [channel, setChannel] = useState('cs');
  const [onReply, setOnReply] = useState('pause');

  // Step 2 - Journey Steps
  const [steps, setSteps] = useState<StepForm[]>([
    { ...emptyStep(), step_order: 1, delay_days: 0, title: 'Mensagem 1' },
  ]);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  const addStep = () => {
    if (steps.length >= 10) { toast.error('Máximo 10 steps'); return; }
    const lastStep = steps[steps.length - 1];
    setSteps([...steps, {
      ...emptyStep(),
      step_order: steps.length + 1,
      delay_days: lastStep ? lastStep.delay_days + 3 : 0,
      title: `Mensagem ${steps.length + 1}`,
    }]);
  };

  const removeStep = (idx: number) => {
    if (steps.length <= 1) { toast.error('Precisa de pelo menos 1 step'); return; }
    const updated = steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, step_order: i + 1 }));
    setSteps(updated);
  };

  const updateStep = (idx: number, field: string, value: any) => {
    const updated = [...steps];
    (updated[idx] as any)[field] = value;
    setSteps(updated);
  };

  const addButton = (stepIdx: number) => {
    if (steps[stepIdx].buttons.length >= 3) { toast.error('Máximo 3 botões'); return; }
    const updated = [...steps];
    const btnNum = updated[stepIdx].buttons.length + 1;
    updated[stepIdx].buttons.push({ id: `btn_${Date.now()}`, text: '', action: 'continue' });
    setSteps(updated);
  };

  const removeButton = (stepIdx: number, btnIdx: number) => {
    const updated = [...steps];
    updated[stepIdx].buttons = updated[stepIdx].buttons.filter((_, i) => i !== btnIdx);
    setSteps(updated);
  };

  const updateButton = (stepIdx: number, btnIdx: number, field: string, value: string) => {
    const updated = [...steps];
    (updated[stepIdx].buttons[btnIdx] as any)[field] = value;
    setSteps(updated);
  };

  const addParam = (stepIdx: number) => {
    const updated = [...steps];
    updated[stepIdx].template_params.push('');
    setSteps(updated);
  };

  const removeParam = (stepIdx: number, paramIdx: number) => {
    const updated = [...steps];
    updated[stepIdx].template_params = updated[stepIdx].template_params.filter((_, i) => i !== paramIdx);
    setSteps(updated);
  };

  const updateParam = (stepIdx: number, paramIdx: number, value: string) => {
    const updated = [...steps];
    updated[stepIdx].template_params[paramIdx] = value;
    setSteps(updated);
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Informe o nome da régua'); return; }
    if (steps.some(s => !s.template_name.trim())) { toast.error('Informe o template em todos os steps'); return; }

    setSaving(true);
    try {
      const res = await api.post('/journeys', {
        name,
        description: description || null,
        trigger_type: triggerType,
        channel,
        on_reply: onReply,
        steps: steps.map(s => ({
          ...s,
          template_params: s.template_params.filter(p => p.trim()),
          buttons: s.buttons.filter(b => b.text.trim()),
        })),
      });
      toast.success(res.data.message);
      router.push('/automations');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Erro ao criar régua');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) return null;

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className={`transition-all duration-700 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
          <button onClick={() => router.push('/automations')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-4">
            <ArrowLeft className="w-4 h-4" />
            Voltar para Automações
          </button>
          <p className="text-sm font-medium text-indigo-600 mb-1">Nova Régua</p>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Criar Régua de Jornada</h1>
        </div>

        {/* Wizard Steps */}
        <div className="flex items-center gap-2">
          {[{ n: 1, label: 'Configuração' }, { n: 2, label: 'Mensagens' }, { n: 3, label: 'Resumo' }].map((s) => (
            <button key={s.n} onClick={() => setStep(s.n)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                step === s.n ? 'bg-indigo-600 text-white shadow-md'
                : step > s.n ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-card text-muted-foreground border border-border'
              }`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                step === s.n ? 'bg-card/20 text-white' : step > s.n ? 'bg-emerald-200 text-emerald-700' : 'bg-muted text-muted-foreground'
              }`}>
                {step > s.n ? <CheckCircle2 className="w-4 h-4" /> : s.n}
              </span>
              {s.label}
            </button>
          ))}
        </div>

        {/* Step 1 - Config */}
        {step === 1 && (
          <div className="bg-card rounded-2xl border border-border p-6 space-y-5">
            <h2 className="text-lg font-semibold text-foreground">Configuração da Régua</h2>

            <div>
              <label className="text-sm font-medium text-foreground/90 mb-1.5 block">Nome da régua *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Onboarding - Matrícula Nova"
                className="w-full px-4 py-3 border border-border rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none" />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground/90 mb-1.5 block">Descrição (opcional)</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Breve descrição"
                className="w-full px-4 py-3 border border-border rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none" />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground/90 mb-2 block">Gatilho — O que inicia a régua?</label>
              <div className="grid grid-cols-2 gap-3">
                {triggerOptions.map((t) => (
                  <button key={t.key} onClick={() => setTriggerType(t.key)}
                    className={`p-3 rounded-xl border text-sm font-medium transition-all text-left ${
                      triggerType === t.key ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-card text-muted-foreground border-border hover:border-border'
                    }`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground/90 mb-2 block">Canal de envio</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {channelOptions.map((ch) => (
                  <button key={ch.key} onClick={() => setChannel(ch.key)}
                    className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                      channel === ch.key ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-card text-muted-foreground border-border hover:border-border'
                    }`}>
                    {ch.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground/90 mb-2 block">Quando o aluno responder...</label>
              <div className="space-y-2">
                {replyOptions.map((r) => (
                  <button key={r.key} onClick={() => setOnReply(r.key)}
                    className={`w-full p-3 rounded-xl border text-sm font-medium transition-all text-left ${
                      onReply === r.key ? 'bg-indigo-50 text-indigo-700 border-indigo-300' : 'bg-card text-muted-foreground border-border hover:border-border'
                    }`}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={() => { if (!name.trim()) { toast.error('Informe o nome'); return; } setStep(2); }}
                className="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-all">
                Próximo →
              </button>
            </div>
          </div>
        )}

        {/* Step 2 - Messages */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Timeline de Mensagens</h2>
              <button onClick={addStep}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors">
                <Plus className="w-4 h-4" /> Adicionar Step
              </button>
            </div>

            {/* Timeline */}
            <div className="relative">
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-indigo-100"></div>

              {steps.map((s, idx) => (
                <div key={idx} className="relative pl-14 pb-6">
                  {/* Timeline dot */}
                  <div className={`absolute left-4 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold
                    ${idx === 0 ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-card border-indigo-300 text-indigo-600'}`}>
                    {idx + 1}
                  </div>

                  <div className="bg-card rounded-xl border border-border p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <h3 className="font-medium text-foreground">Step {idx + 1}</h3>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Clock className="w-3.5 h-3.5" />
                          {idx === 0 ? 'Imediato' : `${s.delay_days}d ${s.delay_hours}h após step anterior`}
                        </div>
                      </div>
                      {steps.length > 1 && (
                        <button onClick={() => removeStep(idx)} className="p-1.5 text-muted-foreground/70 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Título do step</label>
                        <input type="text" value={s.title} onChange={(e) => updateStep(idx, 'title', e.target.value)}
                          placeholder="Ex: Boas-vindas"
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none" />
                      </div>
                      {idx > 0 && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">Dias depois</label>
                            <input type="number" min="0" value={s.delay_days} onChange={(e) => updateStep(idx, 'delay_days', Number(e.target.value))}
                              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none" />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">Horas</label>
                            <input type="number" min="0" max="23" value={s.delay_hours} onChange={(e) => updateStep(idx, 'delay_hours', Number(e.target.value))}
                              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none" />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Template Meta *</label>
                        <input type="text" value={s.template_name} onChange={(e) => updateStep(idx, 'template_name', e.target.value)}
                          placeholder="nome_do_template"
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Idioma</label>
                        <select value={s.template_language} onChange={(e) => updateStep(idx, 'template_language', e.target.value)}
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none">
                          <option value="pt_BR">Português (BR)</option>
                          <option value="en_US">English (US)</option>
                          <option value="en">English</option>
                        </select>
                      </div>
                    </div>

                    {/* Params */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-muted-foreground">Parâmetros</label>
                        <button onClick={() => addParam(idx)} className="text-xs text-indigo-600 hover:underline">+ Param</button>
                      </div>
                      <p className="text-[11px] text-muted-foreground/70 mb-2">
                        Variáveis: {'{{primeiro_nome}}'} {'{{nome}}'} {'{{curso}}'} {'{{email}}'}
                      </p>
                      {s.template_params.map((p, pIdx) => (
                        <div key={pIdx} className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-muted-foreground/70 w-12">{`{{${pIdx + 1}}}`}</span>
                          <input type="text" value={p} onChange={(e) => updateParam(idx, pIdx, e.target.value)}
                            placeholder="{{primeiro_nome}}"
                            className="flex-1 px-2 py-1.5 border border-border rounded-lg text-sm focus:border-indigo-500 outline-none" />
                          <button onClick={() => removeParam(idx, pIdx)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                        </div>
                      ))}
                    </div>

                    {/* Buttons */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          <MousePointerClick className="w-3.5 h-3.5" /> Botões interativos
                        </label>
                        <button onClick={() => addButton(idx)} className="text-xs text-indigo-600 hover:underline">+ Botão</button>
                      </div>
                      {s.buttons.length === 0 ? (
                        <p className="text-xs text-muted-foreground/70 italic">Sem botões (mensagem simples)</p>
                      ) : (
                        <div className="space-y-2">
                          {s.buttons.map((btn, bIdx) => (
                            <div key={bIdx} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                              <input type="text" value={btn.text} onChange={(e) => updateButton(idx, bIdx, 'text', e.target.value)}
                                placeholder="Texto do botão"
                                className="flex-1 px-2 py-1.5 border border-border rounded-lg text-sm focus:border-indigo-500 outline-none" />
                              <select value={btn.action} onChange={(e) => updateButton(idx, bIdx, 'action', e.target.value)}
                                className="px-2 py-1.5 border border-border rounded-lg text-xs focus:border-indigo-500 outline-none">
                                {buttonActions.map((a) => (
                                  <option key={a.key} value={a.key}>{a.label}</option>
                                ))}
                              </select>
                              <button onClick={() => removeButton(idx, bIdx)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep(1)} className="px-6 py-2.5 text-sm font-medium text-foreground/90 bg-muted rounded-xl hover:bg-muted-foreground/20 transition-all">
                ← Voltar
              </button>
              <button onClick={() => setStep(3)} className="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-all">
                Ver Resumo →
              </button>
            </div>
          </div>
        )}

        {/* Step 3 - Summary */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white">
              <h2 className="text-lg font-semibold mb-4">Resumo da Régua</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-white/60">Nome</p>
                  <p className="font-medium">{name}</p>
                </div>
                <div>
                  <p className="text-white/60">Gatilho</p>
                  <p className="font-medium">{triggerOptions.find(t => t.key === triggerType)?.label}</p>
                </div>
                <div>
                  <p className="text-white/60">Canal</p>
                  <p className="font-medium">{channelOptions.find(c => c.key === channel)?.label}</p>
                </div>
                <div>
                  <p className="text-white/60">Ao responder</p>
                  <p className="font-medium">{replyOptions.find(r => r.key === onReply)?.label}</p>
                </div>
                <div>
                  <p className="text-white/60">Total de mensagens</p>
                  <p className="text-3xl font-bold">{steps.length}</p>
                </div>
              </div>
            </div>

            {/* Timeline Preview */}
            <div className="bg-card rounded-2xl border border-border p-6">
              <h3 className="font-medium text-foreground mb-4">Timeline</h3>
              <div className="relative">
                <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-indigo-100"></div>
                {steps.map((s, idx) => (
                  <div key={idx} className="relative pl-10 pb-4 last:pb-0">
                    <div className="absolute left-1.5 w-4 h-4 rounded-full bg-indigo-600 flex items-center justify-center">
                      <span className="text-[9px] text-white font-bold">{idx + 1}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                        {idx === 0 ? 'Dia 0' : `Dia ${s.delay_days}`}
                      </span>
                      <span className="text-sm font-medium text-foreground">{s.title || s.template_name}</span>
                      <span className="text-xs text-muted-foreground/70">{s.template_name}</span>
                    </div>
                    {s.buttons.length > 0 && (
                      <div className="flex gap-2 mt-1 ml-0">
                        {s.buttons.map((btn, bIdx) => (
                          <span key={bIdx} className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground">
                            {btn.text} → {btn.action}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep(2)} className="px-6 py-2.5 text-sm font-medium text-foreground/90 bg-muted rounded-xl hover:bg-muted-foreground/20 transition-all">
                ← Mensagens
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl hover:shadow-lg transition-all disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Criar Régua
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}