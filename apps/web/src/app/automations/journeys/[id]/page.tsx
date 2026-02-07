'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import AppLayout from '@/components/AppLayout';
import {
  ArrowLeft,
  GitBranch,
  Clock,
  Users,
  MessageSquare,
  Power,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  PauseCircle,
  MousePointerClick,
  RefreshCw,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

interface JourneyStep {
  id: number;
  step_order: number;
  delay_days: number;
  delay_hours: number;
  template_name: string;
  template_language: string;
  template_params: string[];
  buttons: { id: string; text: string; action: string }[];
  title: string;
  is_active: boolean;
}

interface StudentJourney {
  id: number;
  student_id: number;
  student_name: string;
  phone: string;
  current_step: number;
  status: string;
  sent_count: number;
  failed_count: number;
  last_button_clicked: string | null;
  started_at: string | null;
  next_step_at: string | null;
  completed_at: string | null;
}

interface JourneyDetail {
  id: number;
  name: string;
  description: string | null;
  trigger_type: string;
  trigger_config: Record<string, any>;
  channel: string;
  conditions: Record<string, any>;
  on_reply: string;
  max_steps: number;
  is_active: boolean;
  created_at: string;
  steps: JourneyStep[];
  students: StudentJourney[];
}

const triggerLabels: Record<string, string> = {
  new_enrollment: 'Matrícula nova',
  first_login: 'Primeiro login',
  payment_overdue: 'Pagamento atrasado',
  days_without_access: 'Dias sem acesso',
};

const replyLabels: Record<string, string> = {
  pause: 'Pausa e direciona para humano',
  continue: 'Continua normalmente',
  stop: 'Para a régua',
};

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  active: { label: 'Ativo', color: 'bg-blue-50 text-blue-700', icon: RefreshCw },
  paused: { label: 'Pausado', color: 'bg-amber-50 text-amber-700', icon: PauseCircle },
  completed: { label: 'Concluído', color: 'bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
  stopped: { label: 'Parado', color: 'bg-gray-100 text-gray-600', icon: XCircle },
  failed: { label: 'Falhou', color: 'bg-red-50 text-red-700', icon: XCircle },
};

const actionLabels: Record<string, string> = {
  continue: '➡️ Continuar',
  stop: '🛑 Parar',
  handoff: '🤝 Humano',
};

export default function JourneyDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const journeyId = params.id;

  const [journey, setJourney] = useState<JourneyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && journeyId) loadJourney();
  }, [user, journeyId]);

  const loadJourney = async () => {
    try {
      const res = await api.get(`/journeys/${journeyId}`);
      setJourney(res.data);
    } catch {
      toast.error('Erro ao carregar régua');
      router.push('/automations');
    } finally {
      setLoading(false);
    }
  };

  const toggleJourney = async () => {
    try {
      const res = await api.post(`/journeys/${journeyId}/toggle`);
      setJourney((prev) => prev ? { ...prev, is_active: res.data.is_active } : prev);
      toast.success(res.data.message);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Erro');
    }
  };

  const deleteJourney = async () => {
    if (!confirm('Tem certeza que deseja excluir esta régua?')) return;
    try {
      await api.delete(`/journeys/${journeyId}`);
      toast.success('Régua removida');
      router.push('/automations');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Erro ao remover');
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!journey) return null;

  const activeStudents = journey.students.filter(s => s.status === 'active').length;
  const completedStudents = journey.students.filter(s => s.status === 'completed').length;
  const pausedStudents = journey.students.filter(s => s.status === 'paused').length;

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className={`transition-all duration-700 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
          <button onClick={() => router.push('/automations')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#2A658F] transition-colors mb-4">
            <ArrowLeft className="w-4 h-4" />
            Voltar para Automações
          </button>

          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                journey.is_active ? 'bg-gradient-to-br from-indigo-500 to-purple-600' : 'bg-gray-200'
              }`}>
                <GitBranch className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-[#27273D] tracking-tight">{journey.name}</h1>
                {journey.description && <p className="text-sm text-gray-500 mt-0.5">{journey.description}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={toggleJourney}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  journey.is_active
                    ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}>
                <Power className="w-4 h-4" />
                {journey.is_active ? 'Desativar' : 'Ativar'}
              </button>
              <button onClick={deleteJourney} className="p-2 rounded-xl text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                <Trash2 className="w-5 h-5" />
              </button>
              <button onClick={loadJourney} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors">
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
            <p className={`text-xs font-medium px-2 py-0.5 rounded-full inline-block mb-2 ${
              journey.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {journey.is_active ? 'Ativa' : 'Inativa'}
            </p>
            <p className="text-sm text-gray-500">Status</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
            <p className="text-2xl font-bold text-[#27273D]">{journey.steps.length}</p>
            <p className="text-sm text-gray-500">Steps</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
            <p className="text-2xl font-bold text-blue-600">{activeStudents}</p>
            <p className="text-sm text-gray-500">Ativos</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
            <p className="text-2xl font-bold text-emerald-600">{completedStudents}</p>
            <p className="text-sm text-gray-500">Concluídos</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
            <p className="text-2xl font-bold text-amber-600">{pausedStudents}</p>
            <p className="text-sm text-gray-500">Pausados</p>
          </div>
        </div>

        {/* Config */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-semibold text-[#27273D] mb-3">Configuração</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1.5 border-b border-gray-50">
                <span className="text-gray-500">Gatilho</span>
                <span className="font-medium">{triggerLabels[journey.trigger_type] || journey.trigger_type}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-50">
                <span className="text-gray-500">Canal</span>
                <span className="font-medium uppercase">{journey.channel}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-50">
                <span className="text-gray-500">Ao responder</span>
                <span className="font-medium">{replyLabels[journey.on_reply] || journey.on_reply}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-gray-500">Criada em</span>
                <span className="font-medium">{formatDate(journey.created_at)}</span>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-semibold text-[#27273D] mb-3">Timeline</h3>
            <div className="relative">
              <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-indigo-100"></div>
              {journey.steps.map((s, idx) => (
                <div key={s.id} className="relative pl-10 pb-3 last:pb-0">
                  <div className="absolute left-1.5 w-4 h-4 rounded-full bg-indigo-600 flex items-center justify-center">
                    <span className="text-[9px] text-white font-bold">{idx + 1}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                        {idx === 0 ? 'Dia 0' : `+${s.delay_days}d ${s.delay_hours}h`}
                      </span>
                      <span className="text-sm font-medium text-gray-800">{s.title || s.template_name}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{s.template_name} ({s.template_language})</p>
                    {s.buttons.length > 0 && (
                      <div className="flex gap-1.5 mt-1">
                        {s.buttons.map((btn, bIdx) => (
                          <span key={bIdx} className="text-[11px] px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">
                            {btn.text} {actionLabels[btn.action] || btn.action}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Students */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[#27273D] flex items-center gap-2">
              <Users className="w-5 h-5 text-gray-400" />
              Alunos na Jornada ({journey.students.length})
            </h3>
          </div>

          {journey.students.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">Nenhum aluno inscrito</p>
              <p className="text-xs text-gray-400 mt-1">Os alunos serão inscritos automaticamente quando o gatilho for acionado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-medium text-gray-500 uppercase border-b border-gray-100">
                    <th className="px-3 py-2">Aluno</th>
                    <th className="px-3 py-2">Telefone</th>
                    <th className="px-3 py-2">Step Atual</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Enviados</th>
                    <th className="px-3 py-2">Último botão</th>
                    <th className="px-3 py-2">Próximo step</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {journey.students.map((sj) => {
                    const st = statusConfig[sj.status] || statusConfig.active;
                    const StIcon = st.icon;
                    return (
                      <tr key={sj.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-800">{sj.student_name}</td>
                        <td className="px-3 py-2 text-gray-600">{sj.phone}</td>
                        <td className="px-3 py-2">
                          <span className="text-indigo-600 font-medium">{sj.current_step}/{journey.steps.length}</span>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>
                            <StIcon className="w-3 h-3" />
                            {st.label}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-600">{sj.sent_count}</td>
                        <td className="px-3 py-2 text-gray-500 text-xs">{sj.last_button_clicked || '-'}</td>
                        <td className="px-3 py-2 text-xs text-gray-500">{formatDate(sj.next_step_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}