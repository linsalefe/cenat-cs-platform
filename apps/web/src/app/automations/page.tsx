'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import AppLayout from '@/components/AppLayout';
import JourneysTab from './JourneysTab';
import {
  Zap,
  Plus,
  Search,
  Power,
  Trash2,
  Clock,
  MessageSquare,
  Mail,
  Ticket,
  Bell,
  AlertCircle,
  Users,
  BookOpen,
  GraduationCap,
  Lock,
  RotateCcw,
  ChevronRight,
  Activity,
  GitBranch,
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
}

const journeyPhases = [
  { key: 'all', label: 'Todas', icon: Zap, color: 'text-gray-600', bg: 'bg-gray-50' },
  { key: 'onboarding', label: 'Onboarding', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
  { key: 'first_classes', label: 'Primeiras Aulas', icon: BookOpen, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { key: 'mid_course', label: 'Meio de Curso', icon: Activity, color: 'text-amber-600', bg: 'bg-amber-50' },
  { key: 'conclusion', label: 'Conclusão', icon: GraduationCap, color: 'text-purple-600', bg: 'bg-purple-50' },
  { key: 'lock', label: 'Trancamento', icon: Lock, color: 'text-red-600', bg: 'bg-red-50' },
  { key: 're_enrollment', label: 'Rematrícula', icon: RotateCcw, color: 'text-cyan-600', bg: 'bg-cyan-50' },
];

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
  create_ticket: { label: 'Criar Ticket', icon: Ticket, color: 'text-amber-600' },
  notify_team: { label: 'Notificar', icon: Bell, color: 'text-purple-600' },
};

export default function AutomationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [automations, setAutomations] = useState<AutomationType[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [phaseFilter, setPhaseFilter] = useState('all');
  // 1) State da Tab adicionado
  const [activeTab, setActiveTab] = useState<'automations' | 'journeys'>('automations');

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) loadAutomations();
  }, [user]);

  const loadAutomations = async () => {
    try {
      const res = await api.get('/automations');
      setAutomations(res.data);
    } catch (error) {
      console.error('Erro ao carregar automações:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleAutomation = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.patch(`/automations/${id}/toggle`);
      setAutomations((prev) =>
        prev.map((a) => (a.id === id ? { ...a, is_active: !a.is_active } : a))
      );
      toast.success('Status atualizado');
    } catch {
      toast.error('Erro ao atualizar');
    }
  };

  const deleteAutomation = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Tem certeza que deseja excluir esta automação?')) return;
    try {
      await api.delete(`/automations/${id}`);
      setAutomations((prev) => prev.filter((a) => a.id !== id));
      toast.success('Automação removida');
    } catch {
      toast.error('Erro ao remover');
    }
  };

  const filtered = automations.filter((a) => {
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase());
    const matchPhase = phaseFilter === 'all' || a.journey_phase === phaseFilter;
    return matchSearch && matchPhase;
  });

  const activeCount = automations.filter((a) => a.is_active).length;

  const getTriggerDescription = (a: AutomationType) => {
    const cfg = a.trigger_config;
    switch (a.trigger_type) {
      case 'days_without_access': return `${cfg.days || '?'} dias sem acessar`;
      case 'days_after_enrollment': return `${cfg.days || '?'} dias após matrícula`;
      case 'first_login': return 'No primeiro acesso';
      case 'assignment_due_soon': return `${cfg.days_before || '?'} dias antes do prazo`;
      case 'nps_response': return `NPS entre ${cfg.nps_min ?? 0} e ${cfg.nps_max ?? 10}`;
      case 'module_completed': return 'Ao concluir módulo';
      case 'inactive_student': return `${cfg.days || '?'} dias inativo`;
      default: return a.trigger_type;
    }
  };

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="animate-pulse space-y-8">
          <div className="h-8 bg-gray-100 rounded-lg w-48"></div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-100 rounded-2xl"></div>
            ))}
          </div>
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-100 rounded-xl"></div>
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div
          className={`flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
          }`}
        >
          <div>
            <p className="text-sm font-medium text-[#2A658F] mb-1">Réguas de Comunicação</p>
            <h1 className="text-3xl font-semibold text-[#27273D] tracking-tight">Automações</h1>
          </div>

          {/* 2) Botão substituído */}
          <div className="flex gap-2">
            {activeTab === 'journeys' ? (
              <button
                onClick={() => router.push('/automations/journeys/new')}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white
                  bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl
                  hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
              >
                <Plus className="w-4 h-4" />
                Nova Régua
              </button>
            ) : (
              <button
                onClick={() => router.push('/automations/new')}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white
                  bg-gradient-to-r from-[#2A658F] to-[#3d7ba8] rounded-xl
                  hover:shadow-lg hover:shadow-[#2A658F]/30 hover:-translate-y-0.5
                  transition-all duration-200"
              >
                <Plus className="w-4 h-4" />
                Nova Automação
              </button>
            )}
          </div>
        </div>

        {/* 3) Tabs adicionadas antes dos Stats */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('automations')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'automations'
                ? 'bg-white text-[#27273D] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Zap className="w-4 h-4" />
            Automações
          </button>
          <button
            onClick={() => setActiveTab('journeys')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'journeys'
                ? 'bg-white text-[#27273D] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <GitBranch className="w-4 h-4" />
            Réguas de Jornada
          </button>
        </div>

        {activeTab === 'journeys' ? (
          <JourneysTab />
        ) : (
          <>
            {/* Stats */}
            <div
              className={`grid grid-cols-1 sm:grid-cols-3 gap-4 transition-all duration-700 ease-out ${
                mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
              style={{ transitionDelay: '100ms' }}
            >
              <div className="bg-white rounded-2xl p-5 border border-gray-100">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mb-3">
                  <Zap className="w-5 h-5 text-blue-600" />
                </div>
                <p className="text-2xl font-semibold text-[#27273D]">{automations.length}</p>
                <p className="text-sm text-gray-500">Total de automações</p>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-gray-100">
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center mb-3">
                  <Power className="w-5 h-5 text-emerald-600" />
                </div>
                <p className="text-2xl font-semibold text-[#27273D]">{activeCount}</p>
                <p className="text-sm text-gray-500">Ativas</p>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-gray-100">
                <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center mb-3">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                </div>
                <p className="text-2xl font-semibold text-[#27273D]">{automations.length - activeCount}</p>
                <p className="text-sm text-gray-500">Inativas</p>
              </div>
            </div>

            {/* Journey Phase Filter */}
            <div
              className={`flex gap-2 overflow-x-auto pb-2 transition-all duration-700 ease-out ${
                mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
              style={{ transitionDelay: '150ms' }}
            >
              {journeyPhases.map((phase) => {
                const Icon = phase.icon;
                const isSelected = phaseFilter === phase.key;
                return (
                  <button
                    key={phase.key}
                    onClick={() => setPhaseFilter(phase.key)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all
                      ${isSelected
                        ? 'bg-[#2A658F] text-white shadow-md'
                        : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    <Icon className="w-4 h-4" />
                    {phase.label}
                  </button>
                );
              })}
            </div>

            {/* Search */}
            <div
              className={`transition-all duration-700 ease-out ${
                mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
              style={{ transitionDelay: '200ms' }}
            >
              <div className="relative max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar automação..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl
                    focus:border-[#2A658F] focus:ring-4 focus:ring-[#2A658F]/10
                    transition-all duration-200 outline-none"
                />
              </div>
            </div>

            {/* Automations List */}
            <div
              className={`space-y-3 transition-all duration-700 ease-out ${
                mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
              style={{ transitionDelay: '300ms' }}
            >
              {filtered.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Zap className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">Nenhuma automação</h3>
                  <p className="text-gray-500 mb-4">Crie sua primeira régua de comunicação</p>
                  <button
                    onClick={() => router.push('/automations/new')}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#2A658F]
                      bg-[#E2ECF4] hover:bg-[#CCE4F4] rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Criar automação
                  </button>
                </div>
              ) : (
                filtered.map((automation) => {
                  const action = actionLabels[automation.action_type] || {
                    label: automation.action_type,
                    icon: Zap,
                    color: 'text-gray-600',
                  };
                  const ActionIcon = action.icon;
                  const phase = journeyPhases.find((p) => p.key === automation.journey_phase);

                  return (
                    <div
                      key={automation.id}
                      onClick={() => router.push(`/automations/${automation.id}`)}
                      className={`group bg-white rounded-xl border p-5 cursor-pointer
                        hover:shadow-lg hover:shadow-gray-100/50 transition-all duration-300
                        ${automation.is_active ? 'border-gray-100 hover:border-gray-200' : 'border-gray-100 opacity-60'}`}
                    >
                      <div className="flex items-center gap-4">
                        {/* Icon */}
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          automation.is_active ? 'bg-gradient-to-br from-[#2A658F] to-[#3d7ba8]' : 'bg-gray-200'
                        }`}>
                          <Zap className="w-6 h-6 text-white" />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-[#27273D] group-hover:text-[#2A658F] transition-colors">
                              {automation.name}
                            </h3>
                            {phase && (
                              <span className={`text-xs px-2 py-0.5 rounded-full ${phase.bg} ${phase.color} font-medium`}>
                                {phase.label}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {getTriggerDescription(automation)}
                            </span>
                            <span className="text-gray-300">→</span>
                            <span className={`flex items-center gap-1 ${action.color}`}>
                              <ActionIcon className="w-3.5 h-3.5" />
                              {action.label}
                            </span>
                          </div>
                          {automation.description && (
                            <p className="text-xs text-gray-400 mt-1 line-clamp-1">{automation.description}</p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={(e) => toggleAutomation(automation.id, e)}
                            className={`p-2 rounded-lg transition-colors ${
                              automation.is_active
                                ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                            }`}
                            title={automation.is_active ? 'Desativar' : 'Ativar'}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => deleteAutomation(automation.id, e)}
                            className="p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#2A658F] transition-colors" />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {filtered.length > 0 && (
              <p className="text-sm text-gray-500 text-center">
                {filtered.length} automação(ões)
              </p>
            )}
          </>
        )}
        {/* 4) Fechamento da condicional */}
      </div>
    </AppLayout>
  );
}