'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import AppLayout from '@/components/AppLayout';
import LoadingState from '@/components/LoadingState';

import { useAuth } from '@/contexts/auth-context';
import api from '@/lib/api';

interface OverviewMetrics {
  period_days: number;
  students: {
    total: number;
    at_risk: number;
    risk_breakdown: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
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
  const [days, setDays] = useState(30);

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
      toast.error('Erro ao carregar métricas');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <AppLayout>
        <LoadingState message="Carregando métricas..." />
      </AppLayout>
    );
  }

  const maxDaily = Math.max(...(tickets?.daily.map(d => Math.max(d.created, d.closed)) || [1]));

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#27273D]">Dashboard de Métricas</h1>
            <p className="text-gray-500 text-sm">Visão geral do sistema</p>
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Período:</label>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-[#2A658F] focus:border-[#2A658F]"
            >
              <option value={7}>Últimos 7 dias</option>
              <option value={30}>Últimos 30 dias</option>
              <option value={90}>Últimos 90 dias</option>
            </select>
          </div>
        </div>

        {/* Cards Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-sm text-gray-500">Total Alunos</p>
            <p className="text-3xl font-bold text-[#27273D]">{overview?.students.total || 0}</p>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-sm text-gray-500">Em Risco</p>
            <p className="text-3xl font-bold text-red-600">{overview?.students.at_risk || 0}</p>
            <p className="text-xs text-gray-400">Crítico + Alto</p>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-sm text-gray-500">Tickets Abertos</p>
            <p className="text-3xl font-bold text-amber-600">{overview?.tickets.open || 0}</p>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-sm text-gray-500">SLA Cumprido</p>
            <p className="text-3xl font-bold text-green-600">
              {overview?.tickets.sla_percentage !== null ? `${overview?.tickets.sla_percentage}%` : '-'}
            </p>
          </div>
        </div>

        {/* Linha 2: Risco + Tickets por Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Distribuição de Risco */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-[#27273D] mb-4">Distribuição de Risco</h2>
            <div className="space-y-3">
              {[
                { label: 'Crítico', key: 'critical', color: 'bg-red-500' },
                { label: 'Alto', key: 'high', color: 'bg-orange-500' },
                { label: 'Médio', key: 'medium', color: 'bg-amber-500' },
                { label: 'Baixo', key: 'low', color: 'bg-green-500' },
              ].map((item) => {
                const count = overview?.students.risk_breakdown[item.key as keyof typeof overview.students.risk_breakdown] || 0;
                const total = overview?.students.total || 1;
                const pct = (count / total) * 100;
                
                return (
                  <div key={item.key} className="flex items-center gap-3">
                    <span className="w-16 text-sm text-gray-600">{item.label}</span>
                    <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${item.color}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-12 text-sm font-medium text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tickets por Categoria */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-[#27273D] mb-4">Tickets por Categoria</h2>
            <div className="space-y-3">
              {tickets?.by_category.map((item) => {
                const maxCount = Math.max(...(tickets?.by_category.map(c => c.count) || [1]));
                const pct = (item.count / maxCount) * 100;
                
                return (
                  <div key={item.category} className="flex items-center gap-3">
                    <span className="w-28 text-sm text-gray-600 truncate">{item.category}</span>
                    <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#2A658F]" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-12 text-sm font-medium text-right">{item.count}</span>
                  </div>
                );
              })}
              {(!tickets?.by_category || tickets.by_category.length === 0) && (
                <p className="text-gray-400 text-sm">Nenhum ticket no período</p>
              )}
            </div>
          </div>
        </div>

        {/* Linha 3: Gráfico Diário + Engajamento */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Tickets por Dia */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-[#27273D] mb-4">Tickets - Últimos 7 dias</h2>
            <div className="flex items-end gap-2 h-40">
              {tickets?.daily.map((day, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex gap-1 items-end h-28">
                    <div 
                      className="flex-1 bg-[#2A658F] rounded-t"
                      style={{ height: `${(day.created / (maxDaily || 1)) * 100}%`, minHeight: day.created > 0 ? '4px' : '0' }}
                      title={`Criados: ${day.created}`}
                    />
                    <div 
                      className="flex-1 bg-green-500 rounded-t"
                      style={{ height: `${(day.closed / (maxDaily || 1)) * 100}%`, minHeight: day.closed > 0 ? '4px' : '0' }}
                      title={`Fechados: ${day.closed}`}
                    />
                  </div>
                  <span className="text-xs text-gray-500">{day.date}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[#2A658F] rounded" />
                <span className="text-xs text-gray-600">Criados</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded" />
                <span className="text-xs text-gray-600">Fechados</span>
              </div>
            </div>
          </div>

          {/* Engajamento Moodle */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-[#27273D] mb-4">Engajamento Moodle</h2>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-[#E2ECF4] rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-[#2A658F]">
                  {engagement?.avg_progress !== null ? `${engagement?.avg_progress}%` : '-'}
                </p>
                <p className="text-xs text-gray-600">Progresso Médio</p>
              </div>
              <div className="bg-[#E2ECF4] rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-[#2A658F]">
                  {engagement?.avg_days_without_access !== null ? `${engagement?.avg_days_without_access}d` : '-'}
                </p>
                <p className="text-xs text-gray-600">Média sem Acesso</p>
              </div>
            </div>

            <p className="text-sm text-gray-500 mb-2">Dias sem acesso:</p>
            <div className="space-y-2">
              {engagement?.access_distribution.map((item) => {
                const total = engagement?.total_with_data || 1;
                const pct = (item.count / total) * 100;
                const color = item.label === '30+ dias' ? 'bg-red-500' : 
                              item.label === '15-30 dias' ? 'bg-amber-500' : 'bg-green-500';
                
                return (
                  <div key={item.label} className="flex items-center gap-2">
                    <span className="w-20 text-xs text-gray-600">{item.label}</span>
                    <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-10 text-xs text-right">{item.count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Linha 4: Satisfação + Métricas de Atendimento */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Satisfação */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-[#27273D] mb-4">Satisfação</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-[#E2ECF4] rounded-lg">
                <p className={`text-3xl font-bold ${
                  satisfaction?.nps.score !== null && satisfaction.nps.score >= 50 ? 'text-green-600' :
                  satisfaction?.nps.score !== null && satisfaction.nps.score >= 0 ? 'text-amber-600' : 'text-red-600'
                }`}>
                  {satisfaction?.nps.score !== null ? satisfaction.nps.score : '-'}
                </p>
                <p className="text-sm text-gray-600">NPS</p>
                <p className="text-xs text-gray-400">{satisfaction?.nps.responses || 0} respostas</p>
              </div>
              <div className="text-center p-4 bg-[#E2ECF4] rounded-lg">
                <p className={`text-3xl font-bold ${
                  satisfaction?.csat.score !== null && satisfaction.csat.score >= 80 ? 'text-green-600' :
                  satisfaction?.csat.score !== null && satisfaction.csat.score >= 60 ? 'text-amber-600' : 'text-red-600'
                }`}>
                  {satisfaction?.csat.score !== null ? `${satisfaction.csat.score}%` : '-'}
                </p>
                <p className="text-sm text-gray-600">CSAT</p>
                <p className="text-xs text-gray-400">{satisfaction?.csat.responses || 0} respostas</p>
              </div>
            </div>
            <p className="text-center text-sm text-amber-600 mt-4">
              {satisfaction?.pending_responses || 0} feedback(s) pendente(s)
            </p>
          </div>

          {/* Métricas de Atendimento */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-[#27273D] mb-4">Atendimento</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Tickets criados no período</span>
                <span className="text-lg font-bold text-[#27273D]">{overview?.tickets.created_period || 0}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Tickets resolvidos no período</span>
                <span className="text-lg font-bold text-green-600">{overview?.tickets.closed_period || 0}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Tempo médio de resolução</span>
                <span className="text-lg font-bold text-[#27273D]">
                  {overview?.tickets.avg_resolution_hours !== null ? `${overview?.tickets.avg_resolution_hours}h` : '-'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
