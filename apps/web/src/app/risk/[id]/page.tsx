'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import AppLayout from '@/components/AppLayout';
import { Avatar } from '@/components/ui';
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  AlertTriangle,
  TrendingUp,
  UserX,
  RefreshCw,
  Mail,
  Phone,
  Ticket,
  Calendar,
  BookOpen,
  DollarSign,
  MessageSquare,
  Activity,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

interface RiskDetail {
  student_id: number;
  student_name: string;
  student_email: string;
  student_phone: string | null;
  score: number;
  level: string;
  trend: string;
  trend_delta: number;
  trends: {
    attendance: string;
    financial: string;
    engagement: string;
  };
  components: {
    engagement: number;
    attendance: number;
    grade: number;
    financial: number;
    ticket: number;
    nps: number;
  };
  attendance_info: {
    total: number;
    absences: number;
    consecutive_absences: number;
    rate: number;
  };
  abandonment_status: string | null;
  factors: string[];
  calculated_at: string;
}

interface HistoryEntry {
  period_start: string;
  period_end: string;
  score: number;
  components: {
    engagement: number;
    attendance: number;
    academic: number;
    financial: number;
    ticket: number;
    nps: number;
  };
}

const levelConfig: Record<string, { label: string; color: string; bg: string; bar: string }> = {
  critical: { label: 'Crítico', color: 'text-red-700', bg: 'bg-red-50', bar: 'bg-red-500' },
  high: { label: 'Alto', color: 'text-orange-700', bg: 'bg-orange-50', bar: 'bg-orange-500' },
  medium: { label: 'Médio', color: 'text-amber-700', bg: 'bg-amber-50', bar: 'bg-amber-500' },
  low: { label: 'Baixo', color: 'text-emerald-700', bg: 'bg-emerald-50', bar: 'bg-emerald-500' },
};

const trendConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  worsening: { label: 'Piorando', color: 'text-red-600', bg: 'bg-red-50', icon: ArrowUpRight },
  stable: { label: 'Estável', color: 'text-muted-foreground', bg: 'bg-muted/50', icon: Minus },
  improving: { label: 'Melhorando', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: ArrowDownRight },
};

const componentConfig: Record<string, { label: string; icon: any; description: string }> = {
  engagement: { label: 'Engajamento', icon: Activity, description: 'Dias sem acessar o Moodle' },
  attendance: { label: 'Presença', icon: Calendar, description: 'Faltas em aulas ao vivo' },
  grade: { label: 'Notas', icon: BookOpen, description: 'Média de notas nos cursos' },
  financial: { label: 'Financeiro', icon: DollarSign, description: 'Status de pagamento (ASAAS)' },
  ticket: { label: 'Tickets', icon: Ticket, description: 'Reclamações abertas' },
  nps: { label: 'NPS/CSAT', icon: MessageSquare, description: 'Feedback de satisfação' },
};

export default function StudentRiskDetail() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const studentId = params.id;

  const [risk, setRisk] = useState<RiskDetail | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [recalculating, setRecalculating] = useState(false);

  useEffect(() => { if (!authLoading && !user) router.push('/login'); }, [user, authLoading, router]);
  useEffect(() => { if (user && studentId) loadData(); }, [user, studentId]);

  const loadData = async () => {
    try {
      setLoadingData(true);
      const [riskRes, historyRes] = await Promise.all([
        api.get(`/risk/students/${studentId}`),
        api.get(`/risk/students/${studentId}/history?weeks=12`).catch(() => ({ data: { history: [] } })),
      ]);
      setRisk(riskRes.data);
      setHistory(historyRes.data.history || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleRecalculate = async () => {
    try {
      setRecalculating(true);
      await api.post(`/risk/students/${studentId}/calculate`);
      await loadData();
      toast.success('Risco recalculado!');
    } catch (error) {
      toast.error('Erro ao recalcular');
    } finally {
      setRecalculating(false);
    }
  };

  if (authLoading || loadingData) {
    return (
      <AppLayout>
        <div className="animate-pulse space-y-8">
          <div className="h-8 bg-muted rounded-lg w-48"></div>
          <div className="h-64 bg-muted rounded-2xl"></div>
        </div>
      </AppLayout>
    );
  }

  if (!risk) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">Score não encontrado. Recalcule o risco.</p>
        </div>
      </AppLayout>
    );
  }

  const config = levelConfig[risk.level] || levelConfig.medium;
  const trend = trendConfig[risk.trend] || trendConfig.stable;
  const TrendIcon = trend.icon;

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/risk')}
              className="p-2 text-muted-foreground/70 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-4">
              <Avatar name={risk.student_name} size="lg" />
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-2xl font-semibold text-foreground">{risk.student_name}</h1>
                  {risk.abandonment_status === 'abandoned' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-gray-800 text-white">
                      <UserX className="w-3 h-3" /> Abandono
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span>{risk.student_email}</span>
                  {risk.student_phone && <span>· {risk.student_phone}</span>}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a href={`mailto:${risk.student_email}`} className="p-2 text-muted-foreground/70 hover:text-primary hover:bg-primary/10 rounded-lg transition-all">
              <Mail className="w-5 h-5" />
            </a>
            {risk.student_phone && (
              <a href={`tel:${risk.student_phone}`} className="p-2 text-muted-foreground/70 hover:text-primary hover:bg-primary/10 rounded-lg transition-all">
                <Phone className="w-5 h-5" />
              </a>
            )}
            <button
              onClick={handleRecalculate}
              disabled={recalculating}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-xl
                hover:bg-[#1E4F73] transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${recalculating ? 'animate-spin' : ''}`} />
              {recalculating ? 'Calculando...' : 'Recalcular'}
            </button>
          </div>
        </div>

        {/* Score + Trend Card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Score principal */}
          <div className="bg-card rounded-2xl border border-border p-6">
            <h2 className="text-sm font-medium text-muted-foreground mb-4">Score de Risco</h2>
            <div className="flex items-center gap-6">
              <div className="relative">
                <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" stroke="#f3f4f6" strokeWidth="8" fill="none" />
                  <circle
                    cx="50" cy="50" r="40"
                    stroke={config.bar.replace('bg-', 'rgb(') === config.bar ? '#ef4444' : undefined}
                    className={config.bar.replace('bg-', 'stroke-')}
                    strokeWidth="8" fill="none"
                    strokeDasharray={`${risk.score * 2.51} 251`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-foreground">{risk.score.toFixed(0)}</span>
                </div>
              </div>
              <div>
                <span className={`inline-flex items-center px-3 py-1 text-sm font-medium rounded-full ${config.bg} ${config.color}`}>
                  {config.label}
                </span>
                <div className="flex items-center gap-2 mt-3">
                  <TrendIcon className={`w-4 h-4 ${trend.color}`} />
                  <span className={`text-sm font-medium ${trend.color}`}>
                    {trend.label}
                    {risk.trend_delta !== 0 && ` (${risk.trend_delta > 0 ? '+' : ''}${risk.trend_delta.toFixed(1)})`}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground/70 mt-2">
                  Calculado em {new Date(risk.calculated_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>
          </div>

          {/* Tendências por indicador */}
          <div className="bg-card rounded-2xl border border-border p-6">
            <h2 className="text-sm font-medium text-muted-foreground mb-4">Tendências</h2>
            <div className="space-y-4">
              {[
                { key: 'attendance', label: 'Presença', value: risk.trends.attendance },
                { key: 'financial', label: 'Financeiro', value: risk.trends.financial },
                { key: 'engagement', label: 'Engajamento', value: risk.trends.engagement },
              ].map((item) => {
                const t = trendConfig[item.value] || trendConfig.stable;
                const TIcon = t.icon;
                return (
                  <div key={item.key} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${t.bg} ${t.color}`}>
                      <TIcon className="w-3 h-3" />
                      {t.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Presença */}
          <div className="bg-card rounded-2xl border border-border p-6">
            <h2 className="text-sm font-medium text-muted-foreground mb-4">Presença</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-2xl font-semibold text-foreground">{risk.attendance_info.rate}%</p>
                <p className="text-xs text-muted-foreground">Taxa de faltas</p>
              </div>
              <div>
                <p className={`text-2xl font-semibold ${risk.attendance_info.consecutive_absences >= 8 ? 'text-red-600' : risk.attendance_info.consecutive_absences >= 3 ? 'text-amber-600' : 'text-foreground'}`}>
                  {risk.attendance_info.consecutive_absences}
                </p>
                <p className="text-xs text-muted-foreground">Faltas consecutivas</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground">{risk.attendance_info.absences}</p>
                <p className="text-xs text-muted-foreground">Total de faltas</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground">{risk.attendance_info.total}</p>
                <p className="text-xs text-muted-foreground">Total de sessões</p>
              </div>
            </div>
            {risk.attendance_info.consecutive_absences >= 8 && (
              <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl">
                <p className="text-xs text-red-700 font-medium flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {risk.attendance_info.consecutive_absences}+ faltas seguidas — critério de abandono
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Componentes do Score */}
        <div className="bg-card rounded-2xl border border-border p-6">
          <h2 className="text-sm font-medium text-muted-foreground mb-6">Componentes do Score</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.entries(risk.components).map(([key, value]) => {
              const comp = componentConfig[key];
              if (!comp) return null;
              const Icon = comp.icon;
              const barColor = value > 60 ? 'bg-red-500' : value > 30 ? 'bg-amber-500' : 'bg-emerald-500';

              return (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-muted-foreground/70" />
                      <span className="text-sm font-medium text-foreground/90">{comp.label}</span>
                    </div>
                    <span className="text-sm font-semibold text-foreground">{value.toFixed(0)}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${barColor} rounded-full transition-all duration-500`} style={{ width: `${value}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground/70">{comp.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Fatores */}
        <div className="bg-card rounded-2xl border border-border p-6">
          <h2 className="text-sm font-medium text-muted-foreground mb-4">Fatores de Risco</h2>
          <div className="flex flex-wrap gap-2">
            {risk.factors.map((factor, idx) => {
              const isWarning = factor.includes('Inadimplente') || factor.includes('faltas consecutivas') || factor.includes('piora') || factor.includes('Sem acessar');
              return (
                <span
                  key={idx}
                  className={`px-3 py-1.5 text-sm rounded-lg ${
                    isWarning ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-muted/50 text-muted-foreground border border-border'
                  }`}
                >
                  {factor}
                </span>
              );
            })}
          </div>
        </div>

        {/* Histórico (se houver) */}
        {history.length > 1 && (
          <div className="bg-card rounded-2xl border border-border p-6">
            <h2 className="text-sm font-medium text-muted-foreground mb-4">Histórico Semanal</h2>
            <div className="space-y-3">
              {history.map((h, idx) => (
                <div key={idx} className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground/70 w-24 shrink-0">
                    {new Date(h.period_end).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  </span>
                  <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        h.score >= 75 ? 'bg-red-500' : h.score >= 50 ? 'bg-orange-500' : h.score >= 25 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${h.score}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-foreground/90 w-10 text-right">{h.score.toFixed(0)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
