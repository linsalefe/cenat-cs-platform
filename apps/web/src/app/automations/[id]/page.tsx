'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import AppLayout from '@/components/AppLayout';
import {
  Zap,
  ArrowLeft,
  Power,
  Edit,
  Save,
  X,
  Clock,
  MessageSquare,
  Mail,
  Ticket,
  Bell,
  AlertCircle,
  Users,
  BookOpen,
  GraduationCap,
  CheckCircle2,
  XCircle,
  Lock,
  RotateCcw,
  Activity,
  Loader2,
  Trash2,
  PlayCircle,
  History,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

interface AutomationType {
  id: number;
  name: string;
  description: string | null;
  trigger_type: string;
  trigger_config: Record<string, any>;
  conditions: Record<string, any>;
  action_type: string;
  action_config: Record<string, any>;
  journey_phase: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface LogEntry {
  id: number;
  automation_id: number;
  student_id: number;
  action_type: string;
  status: string;
  details: Record<string, any>;
  executed_at: string;
}

const triggerLabels: Record<string, string> = {
  days_without_access: 'Dias sem acesso',
  days_after_enrollment: 'Dias após matrícula',
  first_login: 'Primeiro login',
  assignment_due_soon: 'Prazo de atividade',
  nps_response: 'Resposta NPS',
  module_completed: 'Módulo concluído',
  inactive_student: 'Aluno inativo',
};

const actionLabels: Record<string, { label: string; icon: any; color: string }> = {
  send_whatsapp: { label: 'WhatsApp', icon: MessageSquare, color: 'text-green-600' },
  send_email: { label: 'E-mail', icon: Mail, color: 'text-blue-600' },
  create_ticket: { label: 'Criar Ticket', icon: Ticket, color: 'text-orange-600' },
  notify_team: { label: 'Notificar Equipe', icon: Bell, color: 'text-purple-600' },
};

const journeyLabels: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  onboarding: { label: 'Onboarding', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
  first_classes: { label: 'Primeiras Aulas', icon: BookOpen, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  mid_course: { label: 'Meio de Curso', icon: Activity, color: 'text-amber-600', bg: 'bg-amber-50' },
  conclusion: { label: 'Conclusão', icon: GraduationCap, color: 'text-purple-600', bg: 'bg-purple-50' },
  lock: { label: 'Trancamento', icon: Lock, color: 'text-red-600', bg: 'bg-red-50' },
  re_enrollment: { label: 'Rematrícula', icon: RotateCcw, color: 'text-cyan-600', bg: 'bg-cyan-50' },
};

export default function AutomationDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const automationId = params.id;

  const [automation, setAutomation] = useState<AutomationType | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formTriggerConfig, setFormTriggerConfig] = useState('');
  const [formActionConfig, setFormActionConfig] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && automationId) {
      loadAutomation();
      loadLogs();
    }
  }, [user, automationId]);

  const loadAutomation = async () => {
    try {
      const res = await api.get(`/automations/${automationId}`);
      setAutomation(res.data);
      setFormName(res.data.name);
      setFormDescription(res.data.description || '');
      setFormTriggerConfig(JSON.stringify(res.data.trigger_config, null, 2));
      setFormActionConfig(JSON.stringify(res.data.action_config, null, 2));
    } catch (error) {
      toast.error('Erro ao carregar automação');
      router.push('/automations');
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    try {
      const res = await api.get(`/automations/${automationId}/logs`);
      setLogs(res.data);
    } catch (error) {
      console.error('Erro ao carregar logs:', error);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleToggle = async () => {
    if (!automation) return;
    setToggling(true);
    try {
      const res = await api.patch(`/automations/${automation.id}/toggle`);
      setAutomation(res.data);
      toast.success(res.data.is_active ? 'Automação ativada' : 'Automação desativada');
    } catch (error) {
      toast.error('Erro ao alterar status');
    } finally {
      setToggling(false);
    }
  };

  const handleSave = async () => {
    if (!automation) return;
    setSaving(true);

    try {
      const triggerConfig = JSON.parse(formTriggerConfig);
      const actionConfig = JSON.parse(formActionConfig);

      const res = await api.put(`/automations/${automation.id}`, {
        name: formName,
        description: formDescription || null,
        trigger_config: triggerConfig,
        action_config: actionConfig,
      });

      setAutomation(res.data);
      setEditing(false);
      toast.success('Automação atualizada');
    } catch (error: any) {
      if (error instanceof SyntaxError) {
        toast.error('JSON inválido na configuração');
      } else {
        toast.error('Erro ao salvar');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!automation) return;
    if (!confirm('Tem certeza que deseja excluir esta automação?')) return;

    try {
      await api.delete(`/automations/${automation.id}`);
      toast.success('Automação excluída');
      router.push('/automations');
    } catch (error) {
      toast.error('Erro ao excluir');
    }
  };

  const cancelEdit = () => {
    if (!automation) return;
    setFormName(automation.name);
    setFormDescription(automation.description || '');
    setFormTriggerConfig(JSON.stringify(automation.trigger_config, null, 2));
    setFormActionConfig(JSON.stringify(automation.action_config, null, 2));
    setEditing(false);
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

  const logStats = {
    total: logs.length,
    success: logs.filter((l) => l.status === 'success').length,
    failed: logs.filter((l) => l.status === 'failed').length,
    skipped: logs.filter((l) => l.status === 'skipped').length,
  };

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-100 rounded-lg w-64"></div>
          <div className="h-48 bg-gray-100 rounded-2xl"></div>
          <div className="h-64 bg-gray-100 rounded-2xl"></div>
        </div>
      </AppLayout>
    );
  }

  if (!automation) return null;

  const action = actionLabels[automation.action_type] || {
    label: automation.action_type,
    icon: Zap,
    color: 'text-gray-600',
  };
  const ActionIcon = action.icon;

  const journey = automation.journey_phase
    ? journeyLabels[automation.journey_phase]
    : null;
  const JourneyIcon = journey?.icon || Zap;

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
            onClick={() => router.push('/automations')}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#2A658F] transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para automações
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  automation.is_active
                    ? 'bg-gradient-to-br from-[#2A658F] to-[#3d7ba8]'
                    : 'bg-gray-200'
                }`}
              >
                <Zap className={`w-6 h-6 ${automation.is_active ? 'text-white' : 'text-gray-500'}`} />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-[#27273D] tracking-tight">
                  {automation.name}
                </h1>
                {automation.description && (
                  <p className="text-sm text-gray-500 mt-0.5">{automation.description}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!editing ? (
                <>
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all"
                  >
                    <Edit className="w-4 h-4" />
                    Editar
                  </button>
                  <button
                    onClick={handleToggle}
                    disabled={toggling}
                    className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                      automation.is_active
                        ? 'text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200'
                        : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                    }`}
                  >
                    {toggling ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Power className="w-4 h-4" />
                    )}
                    {automation.is_active ? 'Desativar' : 'Ativar'}
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={cancelEdit}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all"
                  >
                    <X className="w-4 h-4" />
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#2A658F] hover:bg-[#1e4f72] rounded-xl transition-all"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Salvar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div
          className={`grid grid-cols-2 lg:grid-cols-4 gap-4 transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '100ms' }}
        >
          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center mb-2">
              <History className="w-5 h-5 text-slate-600" />
            </div>
            <p className="text-2xl font-semibold text-[#27273D]">{logStats.total}</p>
            <p className="text-sm text-gray-500">Total de execuções</p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center mb-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-2xl font-semibold text-[#27273D]">{logStats.success}</p>
            <p className="text-sm text-gray-500">Sucesso</p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center mb-2">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <p className="text-2xl font-semibold text-[#27273D]">{logStats.failed}</p>
            <p className="text-sm text-gray-500">Falhas</p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center mb-2">
              <AlertCircle className="w-5 h-5 text-gray-500" />
            </div>
            <p className="text-2xl font-semibold text-[#27273D]">{logStats.skipped}</p>
            <p className="text-sm text-gray-500">Ignorados</p>
          </div>
        </div>

        {/* Configuration */}
        <div
          className={`grid grid-cols-1 lg:grid-cols-2 gap-6 transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '200ms' }}
        >
          {/* Detalhes */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
            <h2 className="text-lg font-semibold text-[#27273D]">Configuração</h2>

            {editing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:border-[#2A658F] focus:ring-4 focus:ring-[#2A658F]/10 transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                  <input
                    type="text"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:border-[#2A658F] focus:ring-4 focus:ring-[#2A658F]/10 transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Config. do Gatilho (JSON)</label>
                  <textarea
                    value={formTriggerConfig}
                    onChange={(e) => setFormTriggerConfig(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-mono focus:border-[#2A658F] focus:ring-4 focus:ring-[#2A658F]/10 transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Config. da Ação (JSON)</label>
                  <textarea
                    value={formActionConfig}
                    onChange={(e) => setFormActionConfig(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-mono focus:border-[#2A658F] focus:ring-4 focus:ring-[#2A658F]/10 transition-all outline-none"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-gray-50">
                  <span className="text-sm text-gray-500">Status</span>
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full ${
                      automation.is_active
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-gray-100 text-gray-600 border border-gray-200'
                    }`}
                  >
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        automation.is_active ? 'bg-emerald-500' : 'bg-gray-400'
                      }`}
                    />
                    {automation.is_active ? 'Ativa' : 'Inativa'}
                  </span>
                </div>

                <div className="flex items-center justify-between py-3 border-b border-gray-50">
                  <span className="text-sm text-gray-500">Gatilho</span>
                  <span className="text-sm font-medium text-[#27273D]">
                    {triggerLabels[automation.trigger_type] || automation.trigger_type}
                  </span>
                </div>

                <div className="flex items-center justify-between py-3 border-b border-gray-50">
                  <span className="text-sm text-gray-500">Ação</span>
                  <span className={`flex items-center gap-1.5 text-sm font-medium ${action.color}`}>
                    <ActionIcon className="w-4 h-4" />
                    {action.label}
                  </span>
                </div>

                {journey && (
                  <div className="flex items-center justify-between py-3 border-b border-gray-50">
                    <span className="text-sm text-gray-500">Fase da Jornada</span>
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full ${journey.bg} ${journey.color}`}
                    >
                      <JourneyIcon className="w-3.5 h-3.5" />
                      {journey.label}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between py-3 border-b border-gray-50">
                  <span className="text-sm text-gray-500">Criada em</span>
                  <span className="text-sm text-gray-700">{formatDate(automation.created_at)}</span>
                </div>

                <div className="flex items-center justify-between py-3">
                  <span className="text-sm text-gray-500">Atualizada em</span>
                  <span className="text-sm text-gray-700">{formatDate(automation.updated_at)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Configs JSON */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h3 className="text-sm font-semibold text-[#27273D] mb-3">Configuração do Gatilho</h3>
              <pre className="bg-gray-50 rounded-xl p-4 text-xs font-mono text-gray-700 overflow-x-auto">
                {JSON.stringify(automation.trigger_config, null, 2)}
              </pre>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h3 className="text-sm font-semibold text-[#27273D] mb-3">Configuração da Ação</h3>
              <pre className="bg-gray-50 rounded-xl p-4 text-xs font-mono text-gray-700 overflow-x-auto">
                {JSON.stringify(automation.action_config, null, 2)}
              </pre>
            </div>
          </div>
        </div>

        {/* Logs */}
        <div
          className={`bg-white rounded-2xl border border-gray-100 transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '300ms' }}
        >
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-[#27273D] flex items-center gap-2">
              <History className="w-5 h-5 text-gray-400" />
              Histórico de Execuções
            </h2>
          </div>

          {loadingLogs ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <History className="w-7 h-7 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-900">Nenhuma execução registrada</p>
              <p className="text-xs text-gray-500 mt-1">Os logs aparecerão aqui após a primeira execução</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <th className="px-6 py-3">Data</th>
                    <th className="px-6 py-3">Aluno ID</th>
                    <th className="px-6 py-3">Ação</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Detalhes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3.5 text-sm text-gray-700">
                        {formatDate(log.executed_at)}
                      </td>
                      <td className="px-6 py-3.5 text-sm text-gray-700">
                        #{log.student_id}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`flex items-center gap-1.5 text-sm font-medium ${(actionLabels[log.action_type] || { color: 'text-gray-600' }).color}`}>
                          {(actionLabels[log.action_type] || { label: log.action_type }).label}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full ${
                            log.status === 'success'
                              ? 'bg-emerald-50 text-emerald-700'
                              : log.status === 'failed'
                              ? 'bg-red-50 text-red-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {log.status === 'success' && <CheckCircle2 className="w-3 h-3" />}
                          {log.status === 'failed' && <XCircle className="w-3 h-3" />}
                          {log.status === 'skipped' && <AlertCircle className="w-3 h-3" />}
                          {log.status === 'success' ? 'Sucesso' : log.status === 'failed' ? 'Falha' : 'Ignorado'}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-xs text-gray-500 max-w-xs truncate">
                        {log.details ? JSON.stringify(log.details).slice(0, 80) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
