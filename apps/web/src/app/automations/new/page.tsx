'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import AppLayout from '@/components/AppLayout';
import {
  ArrowLeft,
  Zap,
  Clock,
  MessageSquare,
  Mail,
  Ticket,
  Bell,
  Users,
  BookOpen,
  Activity,
  GraduationCap,
  Lock,
  RotateCcw,
  Loader2,
  Save,
  Eye,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

const journeyPhases = [
  { key: 'onboarding', label: 'Onboarding', icon: Users, color: 'bg-blue-50 text-blue-600 border-blue-200' },
  { key: 'first_classes', label: 'Primeiras Aulas', icon: BookOpen, color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  { key: 'mid_course', label: 'Meio de Curso', icon: Activity, color: 'bg-amber-50 text-amber-600 border-amber-200' },
  { key: 'conclusion', label: 'Conclusão', icon: GraduationCap, color: 'bg-purple-50 text-purple-600 border-purple-200' },
  { key: 'lock', label: 'Trancamento', icon: Lock, color: 'bg-red-50 text-red-600 border-red-200' },
  { key: 're_enrollment', label: 'Rematrícula', icon: RotateCcw, color: 'bg-cyan-50 text-cyan-600 border-cyan-200' },
];

const triggerTypes = [
  {
    key: 'days_without_access',
    label: 'Dias sem acesso',
    description: 'Dispara quando o aluno não acessa o Moodle há X dias',
    fields: [{ key: 'days', label: 'Dias sem acesso', type: 'number', placeholder: '7' }],
  },
  {
    key: 'days_after_enrollment',
    label: 'Dias após matrícula',
    description: 'Dispara X dias após a matrícula do aluno',
    fields: [{ key: 'days', label: 'Dias após matrícula', type: 'number', placeholder: '3' }],
  },
  {
    key: 'first_login',
    label: 'Primeiro login',
    description: 'Dispara quando o aluno faz o primeiro acesso ao Moodle',
    fields: [],
  },
  {
    key: 'assignment_due_soon',
    label: 'Prazo de atividade',
    description: 'Dispara X dias antes do prazo de uma atividade',
    fields: [{ key: 'days_before', label: 'Dias antes do prazo', type: 'number', placeholder: '3' }],
  },
  {
    key: 'nps_response',
    label: 'Resposta NPS',
    description: 'Dispara quando o aluno responde NPS em determinada faixa',
    fields: [
      { key: 'nps_min', label: 'NPS mínimo', type: 'number', placeholder: '0' },
      { key: 'nps_max', label: 'NPS máximo', type: 'number', placeholder: '6' },
    ],
  },
  {
    key: 'module_completed',
    label: 'Módulo concluído',
    description: 'Dispara quando o aluno conclui um módulo do curso',
    fields: [],
  },
  {
    key: 'inactive_student',
    label: 'Aluno inativo',
    description: 'Dispara quando o aluno fica inativo por X dias',
    fields: [{ key: 'days', label: 'Dias inativo', type: 'number', placeholder: '20' }],
  },
];

const actionTypes = [
  {
    key: 'send_whatsapp',
    label: 'Enviar WhatsApp',
    icon: MessageSquare,
    color: 'bg-green-50 text-green-600 border-green-200',
    hasTemplate: true,
  },
  {
    key: 'send_email',
    label: 'Enviar E-mail',
    icon: Mail,
    color: 'bg-blue-50 text-blue-600 border-blue-200',
    hasTemplate: true,
  },
  {
    key: 'create_ticket',
    label: 'Criar Ticket',
    icon: Ticket,
    color: 'bg-amber-50 text-amber-600 border-amber-200',
    hasTemplate: false,
  },
  {
    key: 'notify_team',
    label: 'Notificar Equipe',
    icon: Bell,
    color: 'bg-purple-50 text-purple-600 border-purple-200',
    hasTemplate: false,
  },
];

const templateVars = [
  { var: '{name}', desc: 'Nome do aluno' },
  { var: '{email}', desc: 'E-mail do aluno' },
  { var: '{course}', desc: 'Nome do curso' },
  { var: '{days}', desc: 'Dias (sem acesso, após matrícula, etc.)' },
  { var: '{assignment}', desc: 'Nome da atividade' },
  { var: '{deadline}', desc: 'Data do prazo' },
];

const whatsappTemplates = [
  {
    name: 'boas_vindas',
    label: 'Boas-vindas',
    params: [
      { key: 0, label: 'Nome do aluno', placeholder: '{name}', default: '{name}' },
      { key: 1, label: 'Nome do curso', placeholder: '{course}', default: '{course}' },
    ],
    preview: `Olá, {{1}}! Como vai? 😊

É um prazer te receber nessa nova etapa da sua vida acadêmica!

Sou a Luiza, e meu papel aqui no CENAT é te acompanhar durante toda a sua jornada de aprendizado.

Boas-vindas à {{2}}!

📌 *Informações importantes:*
- A documentação de matrícula já pode ser enviada pelo portal do aluno.
- Seu acesso à plataforma Moodle está ativo.
- As orientações de login foram enviadas por e-mail.

📞 *Dúvidas? Fale com a gente:*
WhatsApp: 84 9193-4068
secretaria@cenatcursos.com.br

Abraços,
Luiza Eder – CENAT`,
  },
  {
    name: 'lembrete_acesso',
    label: 'Lembrete de Acesso',
    params: [
      { key: 0, label: 'Nome do aluno', placeholder: '{name}', default: '{name}' },
      { key: 1, label: 'Nome do curso', placeholder: '{course}', default: '{course}' },
    ],
    preview: `Olá, {{1}}! Tudo bem? 😊

Notamos que faz um tempinho que você não acessa a plataforma do seu curso {{2}}.

Sabemos que a rotina pode ser corrida, mas estamos aqui pra te ajudar a manter o ritmo!

📚 Acesse sua área de estudos e continue de onde parou.

Precisa de ajuda? Estou à disposição!

Abraços,
Luiza Eder – CENAT`,
  },
  {
    name: 'lembrete_pagamento',
    label: 'Lembrete de Pagamento',
    params: [
      { key: 0, label: 'Nome do aluno', placeholder: '{name}', default: '{name}' },
      { key: 1, label: 'Nome do curso', placeholder: '{course}', default: '{course}' },
    ],
    preview: `Olá, {{1}}! 😊

Passando pra lembrar que identificamos uma pendência financeira no seu curso {{2}}.

Sabemos que imprevistos acontecem! Se precisar de ajuda pra regularizar, entre em contato com a gente:

📞 WhatsApp: 84 9193-4068
📧 secretaria@cenatcursos.com.br

Estamos aqui pra te ajudar!

Abraços,
Equipe Financeira – CENAT`,
  },
  {
    name: 'pesquisa_nps',
    label: 'Pesquisa NPS',
    params: [
      { key: 0, label: 'Nome do aluno', placeholder: '{name}', default: '{name}' },
    ],
    preview: `Olá, {{1}}! 😊

Sua opinião é muito importante pra gente!

De 0 a 10, o quanto você recomendaria o CENAT para um colega?

Responda com um número de 0 a 10 aqui mesmo nessa conversa.

Agradecemos seu tempo!

Abraços,
Equipe CENAT`,
  },
];

export default function NewAutomationPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [journeyPhase, setJourneyPhase] = useState('');
  const [triggerType, setTriggerType] = useState('');
  const [triggerConfig, setTriggerConfig] = useState<Record<string, any>>({});
  const [actionType, setActionType] = useState('');
  const [actionConfig, setActionConfig] = useState<Record<string, any>>({ template: '' });
  const [error, setError] = useState('');

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  const selectedTrigger = triggerTypes.find((t) => t.key === triggerType);
  const selectedAction = actionTypes.find((a) => a.key === actionType);

  const handleSave = async () => {
    setError('');

    if (!name.trim()) { setError('Informe o nome da automação'); return; }
    if (!triggerType) { setError('Selecione um gatilho'); return; }
    if (!actionType) { setError('Selecione uma ação'); return; }

    try {
      setSaving(true);
      await api.post('/automations', {
        name,
        description: description || null,
        trigger_type: triggerType,
        trigger_config: triggerConfig,
        conditions: {},
        action_type: actionType,
        action_config: actionConfig,
        journey_phase: journeyPhase || null,
        is_active: true,
      });
      toast.success('Automação criada com sucesso!');
      router.push('/automations');
    } catch {
      setError('Erro ao criar automação');
    } finally {
      setSaving(false);
    }
  };

  const insertVariable = (varName: string) => {
    setActionConfig((prev) => ({
      ...prev,
      template: (prev.template || '') + varName,
    }));
  };

  if (authLoading) return null;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div
          className={`transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
          }`}
        >
          <button
            onClick={() => router.push('/automations')}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#2A658F] transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para Automações
          </button>
          <p className="text-sm font-medium text-[#2A658F] mb-1">Nova Régua</p>
          <h1 className="text-2xl font-semibold text-[#27273D] tracking-tight">Criar Automação</h1>
        </div>

        {/* Step 1: Info */}
        <div
          className={`bg-white rounded-2xl border border-gray-100 p-6 transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '100ms' }}
        >
          <h2 className="text-sm font-semibold text-[#27273D] mb-4 flex items-center gap-2">
            <span className="w-6 h-6 bg-[#2A658F] text-white rounded-full flex items-center justify-center text-xs">1</span>
            Informações
          </h2>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Nome da automação</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Boas-vindas ao aluno"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl
                  focus:border-[#2A658F] focus:ring-4 focus:ring-[#2A658F]/10
                  transition-all outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Descrição (opcional)</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Breve descrição do objetivo"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl
                  focus:border-[#2A658F] focus:ring-4 focus:ring-[#2A658F]/10
                  transition-all outline-none"
              />
            </div>
          </div>
        </div>

        {/* Step 2: Journey Phase */}
        <div
          className={`bg-white rounded-2xl border border-gray-100 p-6 transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '150ms' }}
        >
          <h2 className="text-sm font-semibold text-[#27273D] mb-4 flex items-center gap-2">
            <span className="w-6 h-6 bg-[#2A658F] text-white rounded-full flex items-center justify-center text-xs">2</span>
            Fase da Jornada
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {journeyPhases.map((phase) => {
              const Icon = phase.icon;
              const isSelected = journeyPhase === phase.key;
              return (
                <button
                  key={phase.key}
                  onClick={() => setJourneyPhase(isSelected ? '' : phase.key)}
                  className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all
                    ${isSelected
                      ? `${phase.color} border-current shadow-sm`
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  {phase.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 3: Trigger */}
        <div
          className={`bg-white rounded-2xl border border-gray-100 p-6 transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '200ms' }}
        >
          <h2 className="text-sm font-semibold text-[#27273D] mb-4 flex items-center gap-2">
            <span className="w-6 h-6 bg-[#2A658F] text-white rounded-full flex items-center justify-center text-xs">3</span>
            Gatilho — Quando disparar?
          </h2>

          <div className="space-y-3">
            {triggerTypes.map((trigger) => {
              const isSelected = triggerType === trigger.key;
              return (
                <div key={trigger.key}>
                  <button
                    onClick={() => {
                      setTriggerType(isSelected ? '' : trigger.key);
                      setTriggerConfig({});
                    }}
                    className={`w-full text-left p-4 rounded-xl border transition-all
                      ${isSelected
                        ? 'border-[#2A658F] bg-[#E2ECF4]/30 shadow-sm'
                        : 'border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <Clock className={`w-5 h-5 ${isSelected ? 'text-[#2A658F]' : 'text-gray-400'}`} />
                      <div>
                        <p className={`font-medium text-sm ${isSelected ? 'text-[#2A658F]' : 'text-gray-700'}`}>
                          {trigger.label}
                        </p>
                        <p className="text-xs text-gray-500">{trigger.description}</p>
                      </div>
                    </div>
                  </button>

                  {isSelected && trigger.fields.length > 0 && (
                    <div className="mt-3 ml-8 flex gap-3">
                      {trigger.fields.map((field) => (
                        <div key={field.key} className="flex-1">
                          <label className="text-xs font-medium text-gray-600 mb-1 block">{field.label}</label>
                          <input
                            type={field.type}
                            value={triggerConfig[field.key] || ''}
                            onChange={(e) =>
                              setTriggerConfig((prev) => ({
                                ...prev,
                                [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value,
                              }))
                            }
                            placeholder={field.placeholder}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                              focus:border-[#2A658F] focus:ring-4 focus:ring-[#2A658F]/10
                              transition-all outline-none"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step 4: Action */}
        <div
          className={`bg-white rounded-2xl border border-gray-100 p-6 transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '250ms' }}
        >
          <h2 className="text-sm font-semibold text-[#27273D] mb-4 flex items-center gap-2">
            <span className="w-6 h-6 bg-[#2A658F] text-white rounded-full flex items-center justify-center text-xs">4</span>
            Ação — O que fazer?
          </h2>

          <div className="grid grid-cols-2 gap-3 mb-4">
            {actionTypes.map((action) => {
              const Icon = action.icon;
              const isSelected = actionType === action.key;
              return (
                <button
                  key={action.key}
                  onClick={() => setActionType(isSelected ? '' : action.key)}
                  className={`flex items-center gap-3 p-4 rounded-xl border text-sm font-medium transition-all
                    ${isSelected
                      ? `${action.color} border-current shadow-sm`
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                >
                  <Icon className="w-5 h-5" />
                  {action.label}
                </button>
              );
            })}
          </div>

          {/* WhatsApp config */}
          {actionType === 'send_whatsapp' && (
            <div className="space-y-4">
              {/* Modo de envio */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Modo de envio</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setActionConfig((prev) => ({ ...prev, wa_mode: 'template', template: '' }))}
                    className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                      (actionConfig.wa_mode || 'text') === 'template'
                        ? 'bg-green-50 text-green-600 border-green-300 shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    �� Template Meta (aprovado)
                  </button>
                  <button
                    onClick={() => setActionConfig((prev) => ({ ...prev, wa_mode: 'text', wa_template_name: '', wa_template_params: [] }))}
                    className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                      (actionConfig.wa_mode || 'text') === 'text'
                        ? 'bg-green-50 text-green-600 border-green-300 shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    💬 Texto livre (janela 24h)
                  </button>
                </div>
              </div>

              {/* Template Meta */}
              {actionConfig.wa_mode === 'template' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Template aprovado</label>
                    <select
                      value={actionConfig.wa_template_name || ''}
                      onChange={(e) => {
                        const tmpl = whatsappTemplates.find((t) => t.name === e.target.value);
                        setActionConfig((prev) => ({
                          ...prev,
                          wa_template_name: e.target.value,
                          wa_template_params: tmpl ? tmpl.params.map((p) => p.default) : [],
                        }));
                      }}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm
                        focus:border-[#2A658F] focus:ring-4 focus:ring-[#2A658F]/10
                        transition-all outline-none"
                    >
                      <option value="">Selecione um template...</option>
                      {whatsappTemplates.map((t) => (
                        <option key={t.name} value={t.name}>{t.label} ({t.name})</option>
                      ))}
                    </select>
                  </div>

                  {actionConfig.wa_template_name && (() => {
                    const tmpl = whatsappTemplates.find((t) => t.name === actionConfig.wa_template_name);
                    if (!tmpl) return null;
                    return (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-gray-500">Parâmetros do template:</p>
                        {tmpl.params.map((param, idx) => (
                          <div key={idx}>
                            <label className="text-xs text-gray-500 mb-1 block">
                              {'{{' + (idx + 1) + '}} — ' + param.label}
                            </label>
                            <input
                              type="text"
                              value={(actionConfig.wa_template_params || [])[idx] || ''}
                              onChange={(e) => {
                                const params = [...(actionConfig.wa_template_params || [])];
                                params[idx] = e.target.value;
                                setActionConfig((prev) => ({ ...prev, wa_template_params: params }));
                              }}
                              placeholder={param.placeholder}
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                                focus:border-[#2A658F] focus:ring-4 focus:ring-[#2A658F]/10
                                transition-all outline-none"
                            />
                          </div>
                        ))}
                        <p className="text-xs text-gray-400 mt-1">
                          Use variáveis como {'{name}'}, {'{course}'}, {'{days}'} para preencher automaticamente.
                        </p>

                        {/* Preview */}
                        <div className="mt-4 p-4 bg-[#e5ddd5] rounded-xl">
                          <p className="text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">Prévia da mensagem</p>
                          <div className="bg-white rounded-lg p-3 shadow-sm max-w-sm">
                            <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">
                              {(() => {
                                let preview = tmpl.preview || '';
                                const params = actionConfig.wa_template_params || [];
                                params.forEach((val: string, i: number) => {
                                  const placeholder = '{{' + (i + 1) + '}}';
                                  preview = preview.replaceAll(placeholder, val || placeholder);
                                });
                                return preview;
                              })()}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Texto livre */}
              {(actionConfig.wa_mode || 'text') === 'text' && (
                <div className="space-y-3">
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-xs">
                    ⚠️ Texto livre só funciona se o aluno tiver mandado mensagem nas últimas 24h.
                    Para iniciar conversa, use um template aprovado.
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                      Template da mensagem
                    </label>
                    <textarea
                      value={actionConfig.template || ''}
                      onChange={(e) => setActionConfig((prev) => ({ ...prev, template: e.target.value }))}
                      placeholder="Olá {name}, tudo bem? ..."
                      rows={5}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl
                        focus:border-[#2A658F] focus:ring-4 focus:ring-[#2A658F]/10
                        transition-all outline-none resize-none text-sm"
                    />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">Variáveis disponíveis (clique para inserir):</p>
                    <div className="flex flex-wrap gap-2">
                      {templateVars.map((v) => (
                        <button
                          key={v.var}
                          onClick={() => insertVariable(v.var)}
                          className="px-3 py-1.5 text-xs font-mono bg-gray-50 text-gray-700 border border-gray-200
                            rounded-lg hover:bg-[#E2ECF4] hover:text-[#2A658F] hover:border-[#2A658F]/30 transition-colors"
                          title={v.desc}
                        >
                          {v.var}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Email template editor */}
          {actionType === 'send_email' && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                  Template da mensagem
                </label>
                <textarea
                  value={actionConfig.template || ''}
                  onChange={(e) => setActionConfig((prev) => ({ ...prev, template: e.target.value }))}
                  placeholder="Olá {name}, tudo bem? ..."
                  rows={5}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl
                    focus:border-[#2A658F] focus:ring-4 focus:ring-[#2A658F]/10
                    transition-all outline-none resize-none text-sm"
                />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Variáveis disponíveis (clique para inserir):</p>
                <div className="flex flex-wrap gap-2">
                  {templateVars.map((v) => (
                    <button
                      key={v.var}
                      onClick={() => insertVariable(v.var)}
                      className="px-3 py-1.5 text-xs font-mono bg-gray-50 text-gray-700 border border-gray-200
                        rounded-lg hover:bg-[#E2ECF4] hover:text-[#2A658F] hover:border-[#2A658F]/30 transition-colors"
                      title={v.desc}
                    >
                      {v.var}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Ticket config */}
          {actionType === 'create_ticket' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Categoria</label>
                  <select
                    value={actionConfig.category || 'academic'}
                    onChange={(e) => setActionConfig((prev) => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                      focus:border-[#2A658F] focus:ring-4 focus:ring-[#2A658F]/10
                      transition-all outline-none"
                  >
                    <option value="academic">Acadêmico</option>
                    <option value="financial">Financeiro</option>
                    <option value="technical">Técnico</option>
                    <option value="administrative">Administrativo</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Prioridade</label>
                  <select
                    value={actionConfig.priority || 'medium'}
                    onChange={(e) => setActionConfig((prev) => ({ ...prev, priority: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                      focus:border-[#2A658F] focus:ring-4 focus:ring-[#2A658F]/10
                      transition-all outline-none"
                  >
                    <option value="low">Baixa</option>
                    <option value="medium">Média</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Assunto do ticket</label>
                <input
                  type="text"
                  value={actionConfig.subject || ''}
                  onChange={(e) => setActionConfig((prev) => ({ ...prev, subject: e.target.value }))}
                  placeholder="Ex: Aluno {name} sem acesso há {days} dias"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                    focus:border-[#2A658F] focus:ring-4 focus:ring-[#2A658F]/10
                    transition-all outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Preview */}
        {triggerType && actionType && (
          <div
            className={`bg-gradient-to-r from-[#27273D] to-[#2A658F] rounded-2xl p-6 text-white transition-all duration-700 ease-out ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
            style={{ transitionDelay: '300ms' }}
          >
            <h3 className="text-sm font-medium text-white/70 mb-2 flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Resumo da automação
            </h3>
            <p className="text-lg">
              Quando <span className="font-semibold">{selectedTrigger?.label.toLowerCase()}</span>
              {triggerConfig.days && <span> ({triggerConfig.days} dias)</span>}
              {triggerConfig.days_before && <span> ({triggerConfig.days_before} dias antes)</span>}
              {triggerConfig.nps_min !== undefined && <span> (NPS {triggerConfig.nps_min}-{triggerConfig.nps_max})</span>}
              {' → '}
              <span className="font-semibold">{selectedAction?.label}</span>
              {journeyPhase && (
                <span className="text-white/60">
                  {' '}(fase: {journeyPhases.find((p) => p.key === journeyPhase)?.label})
                </span>
              )}
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm text-center">
            {error}
          </div>
        )}

        {/* Save */}
        <div className="flex gap-3">
          <button
            onClick={() => router.push('/automations')}
            className="flex-1 px-4 py-3 text-sm font-medium text-gray-700 bg-gray-100
              hover:bg-gray-200 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white
              bg-gradient-to-r from-[#2A658F] to-[#3d7ba8] rounded-xl
              hover:shadow-lg hover:shadow-[#2A658F]/30 transition-all
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Criar Automação
              </>
            )}
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
