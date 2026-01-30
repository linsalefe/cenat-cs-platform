'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import AppLayout from '@/components/AppLayout';
import {
  BarChart3,
  Users,
  Ticket,
  Clock,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Activity,
  Target,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import api from '@/lib/api';

interface OverviewMetrics {
  period_days: number;
  students: {
    total: number;
    at_risk: number;
    risk_breakdown: { critical: number; high: number; medium: number; low: number };
  };
  tickets: {
    created_period: number;
    open: number;
    closed_period: number;
    avg_resolution_hours: number | null;
    sla_percentage: number | null;
  };
}

interface TicketMetrics {
  by_category: { category: string; count: number }[];
  by_status: { status: string; count: number }[];
  daily: { date: string; created: number; closed: number }[];
}

interface EngagementMetrics {
  total_with_data: number;
  avg_progress: number | null;
  avg_days_without_access: number | null;
  access_distribution: { label: string; count: number }[];
  progress_distribution: { label: string; count: number }[];
}

interface SatisfactionMetrics {
  nps: { score: number | null; responses: number };
  csat: { score: number | null; responses: number };
  pending_responses: number;
}

export default function MetricsDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [overview, setOverview] = useState<OverviewMetrics | null>(null);
  const [tickets, setTickets] = useState<TicketMetrics | null>(null);
  const [engagement, setEngagement] = useState<EngagementMetrics | null>(null);
  const [satisfaction, setSatisfaction] = useState<SatisfactionMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [days, setDays] = useState(30);
  const [refreshing, setRefreshing] = useState(false);

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
      loadData();
    }
  }, [user, days]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [overviewRes, ticketsRes, engagementRes, satisfactionRes] = await Promise.all([
        api.get(`/metrics/overview?days=${days}`),
        api.get(`/metrics/tickets?days=${days}`),
        api.get('/metrics/engagement'),
        api.get(`/metrics/satisfaction?days=${days}`),
      ]);
      setOverview(overviewRes.data);
      setTickets(ticketsRes.data);
      setEngagement(engagementRes.data);
      setSatisfaction(satisfactionRes.data);
    } catch (error) {
      console.error('Erro ao carregar métricas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const maxDaily = Math.max(...(tickets?.daily.map((d) => Math.max(d.created, d.closed)) || [1]));

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="animate-pulse space-y-8">
          <div className="h-8 bg-gray-100 rounded-lg w-48"></div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 bg-gray-100 rounded-2xl"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-80 bg-gray-100 rounded-2xl"></div>
            <div className="h-80 bg-gray-100 rounded-2xl"></div>
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
            <p className="text-sm font-medium text-[#2A658F] mb-1">Análise</p>
            <h1 className="text-3xl font-semibold text-[#27273D] tracking-tight">Métricas</h1>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium
                focus:border-[#2A658F] focus:ring-4 focus:ring-[#2A658F]/10 outline-none transition-all"
            >
              <option value={7}>Últimos 7 dias</option>
              <option value={30}>Últimos 30 dias</option>
              <option value={90}>Últimos 90 dias</option>
            </select>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-600
                bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div
          className={`grid grid-cols-2 lg:grid-cols-4 gap-4 transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '100ms' }}
        >
          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-slate-600" />
              </div>
            </div>
            <p className="text-2xl font-semibold text-[#27273D]">{overview?.students.total.toLocaleString()}</p>
            <p className="text-sm text-gray-500">Total de alunos</p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-orange-600" />
              </div>
              {overview && overview.students.at_risk > 0 && (
                <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-1 rounded-full">
                  Atenção
                </span>
              )}
            </div>
            <p className="text-2xl font-semibold text-[#27273D]">{overview?.students.at_risk}</p>
            <p className="text-sm text-gray-500">Em risco</p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <Ticket className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <p className="text-2xl font-semibold text-[#27273D]">{overview?.tickets.open}</p>
            <p className="text-sm text-gray-500">Tickets abertos</p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                <Clock className="w-5 h-5 text-emerald-600" />
              </div>
              {overview?.tickets.sla_percentage !== null && overview.tickets.sla_percentage >= 80 && (
                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                  Bom
                </span>
              )}
            </div>
            <p className="text-2xl font-semibold text-[#27273D]">
              {overview?.tickets.sla_percentage !== null ? `${overview.tickets.sla_percentage}%` : '—'}
            </p>
            <p className="text-sm text-gray-500">SLA cumprido</p>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tickets por Dia */}
          <div
            className={`bg-white rounded-2xl border border-gray-100 p-6 transition-all duration-700 ease-out ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
            style={{ transitionDelay: '200ms' }}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-[#27273D]">Tickets - Últimos 7 dias</h2>
                <p className="text-sm text-gray-500">Criados vs Fechados</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-[#2A658F] rounded" />
                  <span className="text-xs text-gray-500">Criados</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-emerald-500 rounded" />
                  <span className="text-xs text-gray-500">Fechados</span>
                </div>
              </div>
            </div>

            <div className="flex items-end gap-3 h-48">
              {tickets?.daily.map((day, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex gap-1 items-end h-36">
                    <div
                      className="flex-1 bg-[#2A658F] rounded-t transition-all duration-500"
                      style={{
                        height: `${(day.created / (maxDaily || 1)) * 100}%`,
                        minHeight: day.created > 0 ? '8px' : '0',
                      }}
                      title={`Criados: ${day.created}`}
                    />
                    <div
                      className="flex-1 bg-emerald-500 rounded-t transition-all duration-500"
                      style={{
                        height: `${(day.closed / (maxDaily || 1)) * 100}%`,
                        minHeight: day.closed > 0 ? '8px' : '0',
                      }}
                      title={`Fechados: ${day.closed}`}
                    />
                  </div>
                  <span className="text-xs text-gray-400">{day.date}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Distribuição de Risco */}
          <div
            className={`bg-white rounded-2xl border border-gray-100 p-6 transition-all duration-700 ease-out ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
            style={{ transitionDelay: '250ms' }}
          >
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-[#27273D]">Distribuição de Risco</h2>
              <p className="text-sm text-gray-500">Por nível de risco</p>
            </div>

            <div className="space-y-4">
              {[
                { label: 'Crítico', key: 'critical', color: 'bg-red-500', bgLight: 'bg-red-50' },
                { label: 'Alto', key: 'high', color: 'bg-orange-500', bgLight: 'bg-orange-50' },
                { label: 'Médio', key: 'medium', color: 'bg-amber-500', bgLight: 'bg-amber-50' },
                { label: 'Baixo', key: 'low', color: 'bg-emerald-500', bgLight: 'bg-emerald-50' },
              ].map((item) => {
                const count = overview?.students.risk_breakdown[item.key as keyof typeof overview.students.risk_breakdown] || 0;
                const total = overview?.students.total || 1;
                const pct = (count / total) * 100;

                return (
                  <div key={item.key}>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">{item.label}</span>
                      <span className="font-medium text-[#27273D]">{count} alunos ({pct.toFixed(1)}%)</span>
                    </div>
                    <div className={`h-3 ${item.bgLight} rounded-full overflow-hidden`}>
                      <div
                        className={`h-full ${item.color} rounded-full transition-all duration-700`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Second Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Engajamento */}
          <div
            className={`bg-white rounded-2xl border border-gray-100 p-6 transition-all duration-700 ease-out ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
            style={{ transitionDelay: '300ms' }}
          >
            <div className="flex items-center gap-2 mb-6">
              <Activity className="w-5 h-5 text-[#2A658F]" />
              <h2 className="text-lg font-semibold text-[#27273D]">Engajamento</h2>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-semibold text-[#27273D]">
                  {engagement?.avg_progress !== null ? `${engagement.avg_progress}%` : '—'}
                </p>
                <p className="text-xs text-gray-500 mt-1">Progresso médio</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-semibold text-[#27273D]">
                  {engagement?.avg_days_without_access !== null ? `${engagement.avg_days_without_access}d` : '—'}
                </p>
                <p className="text-xs text-gray-500 mt-1">Média sem acesso</p>
              </div>
            </div>

            <p className="text-sm text-gray-500 mb-3">Dias sem acesso</p>
            <div className="space-y-2">
              {engagement?.access_distribution.map((item) => {
                const total = engagement?.total_with_data || 1;
                const pct = (item.count / total) * 100;
                const color =
                  item.label === '30+ dias' ? 'bg-red-500' : item.label === '15-30 dias' ? 'bg-amber-500' : 'bg-emerald-500';

                return (
                  <div key={item.label} className="flex items-center gap-3">
                    <span className="w-20 text-xs text-gray-500">{item.label}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-8 text-xs text-gray-600 text-right">{item.count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Satisfação */}
          <div
            className={`bg-white rounded-2xl border border-gray-100 p-6 transition-all duration-700 ease-out ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
            style={{ transitionDelay: '350ms' }}
          >
            <div className="flex items-center gap-2 mb-6">
              <Target className="w-5 h-5 text-[#2A658F]" />
              <h2 className="text-lg font-semibold text-[#27273D]">Satisfação</h2>
            </div>

            <div className="space-y-6">
              {/* NPS */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">NPS</span>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    satisfaction?.nps.score !== null && satisfaction.nps.score >= 50
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-amber-50 text-amber-600'
                  }`}>
                    {satisfaction?.nps.score !== null && satisfaction.nps.score >= 50 ? 'Excelente' : 'Regular'}
                  </span>
                </div>
                <div className="flex items-end gap-3">
                  <p className={`text-4xl font-semibold ${
                    satisfaction?.nps.score !== null && satisfaction.nps.score >= 50 ? 'text-emerald-600' : 'text-amber-600'
                  }`}>
                    {satisfaction?.nps.score !== null ? satisfaction.nps.score : '—'}
                  </p>
                  <p className="text-sm text-gray-400 mb-1">{satisfaction?.nps.responses} respostas</p>
                </div>
              </div>

              <div className="h-px bg-gray-100" />

              {/* CSAT */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">CSAT</span>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    satisfaction?.csat.score !== null && satisfaction.csat.score >= 80
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-amber-50 text-amber-600'
                  }`}>
                    {satisfaction?.csat.score !== null && satisfaction.csat.score >= 80 ? 'Excelente' : 'Regular'}
                  </span>
                </div>
                <div className="flex items-end gap-3">
                  <p className={`text-4xl font-semibold ${
                    satisfaction?.csat.score !== null && satisfaction.csat.score >= 80 ? 'text-emerald-600' : 'text-amber-600'
                  }`}>
                    {satisfaction?.csat.score !== null ? `${satisfaction.csat.score}%` : '—'}
                  </p>
                  <p className="text-sm text-gray-400 mb-1">{satisfaction?.csat.responses} respostas</p>
                </div>
              </div>

              {satisfaction && satisfaction.pending_responses > 0 && (
                <div className="bg-amber-50 rounded-xl p-3 text-center">
                  <p className="text-sm text-amber-700">
                    {satisfaction.pending_responses} feedback(s) pendente(s)
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Atendimento */}
          <div
            className={`bg-white rounded-2xl border border-gray-100 p-6 transition-all duration-700 ease-out ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
            style={{ transitionDelay: '400ms' }}
          >
            <div className="flex items-center gap-2 mb-6">
              <Ticket className="w-5 h-5 text-[#2A658F]" />
              <h2 className="text-lg font-semibold text-[#27273D]">Atendimento</h2>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Criados no período</span>
                  <span className="text-xl font-semibold text-[#27273D]">{overview?.tickets.created_period}</span>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Resolvidos no período</span>
                  <span className="text-xl font-semibold text-emerald-600">{overview?.tickets.closed_period}</span>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Tempo médio de resolução</span>
                  <span className="text-xl font-semibold text-[#27273D]">
                    {overview?.tickets.avg_resolution_hours !== null ? `${overview.tickets.avg_resolution_hours}h` : '—'}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <p className="text-sm text-gray-500 mb-3">Por categoria</p>
                <div className="space-y-2">
                  {tickets?.by_category.slice(0, 4).map((cat) => (
                    <div key={cat.category} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{cat.category}</span>
                      <span className="font-medium text-[#27273D]">{cat.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
