'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import AppLayout from '@/components/AppLayout';
import {
  Users,
  AlertTriangle,
  Ticket,
  Clock,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  ArrowRight,
  Activity,
  Shield,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import api from '@/lib/api';

interface DashboardData {
  students: { total: number; at_risk: number };
  tickets: { open: number; closed_period: number; sla_percentage: number | null; avg_resolution_hours: number | null };
  nps: number | null;
  csat: number | null;
  risk_breakdown: { critical: number; high: number; medium: number; low: number };
}

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
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
  }, [user]);

  const loadData = async () => {
    try {
      const [metricsRes, satisfactionRes] = await Promise.all([
        api.get('/metrics/overview?days=30'),
        api.get('/metrics/satisfaction?days=30'),
      ]);

      setData({
        students: metricsRes.data.students,
        tickets: metricsRes.data.tickets,
        nps: satisfactionRes.data.nps.score,
        csat: satisfactionRes.data.csat.score,
        risk_breakdown: metricsRes.data.students.risk_breakdown,
      });
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const retentionRate = data?.students.total
    ? (((data.students.total - data.students.at_risk) / data.students.total) * 100).toFixed(1)
    : null;

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="animate-pulse space-y-8">
          <div className="h-8 bg-gray-100 rounded-lg w-64"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-36 bg-gray-100 rounded-2xl"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-80 bg-gray-100 rounded-2xl"></div>
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
          className={`flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 
            transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
          }`}
        >
          <div>
            <p className="text-sm font-medium text-[#2A658F] mb-1">Dashboard</p>
            <h1 className="text-3xl font-semibold text-[#27273D] tracking-tight">
              {getGreeting()}, {user?.name?.split(' ')[0]}
            </h1>
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-600
              bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 
              transition-all duration-200 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar dados
          </button>
        </div>

        {/* KPI Cards */}
        <div
          className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '100ms' }}
        >
          {/* Total Alunos */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 hover:border-gray-200 hover:shadow-lg hover:shadow-gray-100/50 transition-all duration-300">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-slate-600" />
              </div>
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Alunos</span>
            </div>
            <p className="text-3xl font-semibold text-[#27273D] mb-1">{data?.students.total.toLocaleString()}</p>
            <p className="text-sm text-gray-500">Total cadastrados</p>
          </div>

          {/* Em Risco */}
          <div 
            onClick={() => router.push('/risk')}
            className="bg-white rounded-2xl p-6 border border-gray-100 hover:border-orange-200 hover:shadow-lg hover:shadow-orange-50 transition-all duration-300 cursor-pointer group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center group-hover:bg-orange-100 transition-colors">
                <AlertTriangle className="w-6 h-6 text-orange-500" />
              </div>
              <span className="text-xs font-medium text-orange-500 uppercase tracking-wider">Atenção</span>
            </div>
            <p className="text-3xl font-semibold text-[#27273D] mb-1">{data?.students.at_risk}</p>
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-500">Alunos em risco</p>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-orange-500 group-hover:translate-x-1 transition-all" />
            </div>
          </div>

          {/* Tickets */}
          <div 
            onClick={() => router.push('/tickets')}
            className="bg-white rounded-2xl p-6 border border-gray-100 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-50 transition-all duration-300 cursor-pointer group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                <Ticket className="w-6 h-6 text-blue-500" />
              </div>
              <span className="text-xs font-medium text-blue-500 uppercase tracking-wider">Suporte</span>
            </div>
            <p className="text-3xl font-semibold text-[#27273D] mb-1">{data?.tickets.open}</p>
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-500">Tickets abertos</p>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
            </div>
          </div>

          {/* SLA */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 hover:border-gray-200 hover:shadow-lg hover:shadow-gray-100/50 transition-all duration-300">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-emerald-500" />
              </div>
              <span className="text-xs font-medium text-emerald-500 uppercase tracking-wider">SLA</span>
            </div>
            <p className="text-3xl font-semibold text-[#27273D] mb-1">
              {data?.tickets.sla_percentage !== null ? `${data.tickets.sla_percentage}%` : '—'}
            </p>
            <p className="text-sm text-gray-500">Dentro do prazo</p>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Risk Overview */}
          <div
            className={`lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6 
              transition-all duration-700 ease-out ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
            style={{ transitionDelay: '200ms' }}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-[#27273D]">Visão Geral de Risco</h2>
                <p className="text-sm text-gray-500">Distribuição dos alunos por nível de risco</p>
              </div>
              <button 
                onClick={() => router.push('/risk')}
                className="text-sm font-medium text-[#2A658F] hover:text-[#1a4a6e] flex items-center gap-1"
              >
                Ver todos
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Crítico', value: data?.risk_breakdown.critical || 0, color: 'red', bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-100' },
                { label: 'Alto', value: data?.risk_breakdown.high || 0, color: 'orange', bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-100' },
                { label: 'Médio', value: data?.risk_breakdown.medium || 0, color: 'amber', bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100' },
                { label: 'Baixo', value: data?.risk_breakdown.low || 0, color: 'emerald', bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100' },
              ].map((item) => (
                <div key={item.label} className={`${item.bg} ${item.border} border rounded-xl p-4 text-center`}>
                  <p className={`text-2xl font-semibold ${item.text}`}>{item.value}</p>
                  <p className="text-sm text-gray-600 mt-1">{item.label}</p>
                </div>
              ))}
            </div>

            {/* Progress Bars */}
            <div className="space-y-3">
              {[
                { label: 'Crítico', value: data?.risk_breakdown.critical || 0, color: 'bg-red-500' },
                { label: 'Alto', value: data?.risk_breakdown.high || 0, color: 'bg-orange-500' },
                { label: 'Médio', value: data?.risk_breakdown.medium || 0, color: 'bg-amber-500' },
                { label: 'Baixo', value: data?.risk_breakdown.low || 0, color: 'bg-emerald-500' },
              ].map((item) => {
                const total = data?.students.total || 1;
                const pct = (item.value / total) * 100;
                return (
                  <div key={item.label} className="flex items-center gap-4">
                    <span className="w-16 text-sm text-gray-600">{item.label}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${item.color} rounded-full transition-all duration-700`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-12 text-sm text-gray-500 text-right">{pct.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Metrics Panel */}
          <div
            className={`space-y-6 transition-all duration-700 ease-out ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
            style={{ transitionDelay: '300ms' }}
          >
            {/* Retention Card */}
            <div className="bg-gradient-to-br from-[#27273D] to-[#3d4a5c] rounded-2xl p-6 text-white">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-white/80" />
                <span className="text-sm font-medium text-white/80">Taxa de Retenção</span>
              </div>
              <p className="text-4xl font-semibold mb-2">{retentionRate}%</p>
              <p className="text-sm text-white/60">dos alunos em situação saudável</p>
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="flex items-center gap-2">
                  {parseFloat(retentionRate || '0') > 80 ? (
                    <>
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm text-emerald-400">Bom desempenho</span>
                    </>
                  ) : (
                    <>
                      <TrendingDown className="w-4 h-4 text-orange-400" />
                      <span className="text-sm text-orange-400">Atenção necessária</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* NPS & CSAT */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Satisfação</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      data?.nps !== null && data.nps >= 50 ? 'bg-emerald-50' : 'bg-amber-50'
                    }`}>
                      {data?.nps !== null && data.nps >= 50 ? (
                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <Activity className="w-5 h-5 text-amber-500" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">NPS</p>
                      <p className="text-xl font-semibold text-[#27273D]">
                        {data?.nps !== null ? data.nps : '—'}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    data?.nps !== null && data.nps >= 50 
                      ? 'bg-emerald-50 text-emerald-600' 
                      : 'bg-amber-50 text-amber-600'
                  }`}>
                    {data?.nps !== null && data.nps >= 50 ? 'Excelente' : 'Melhorar'}
                  </span>
                </div>

                <div className="h-px bg-gray-100" />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      data?.csat !== null && data.csat >= 80 ? 'bg-emerald-50' : 'bg-amber-50'
                    }`}>
                      {data?.csat !== null && data.csat >= 80 ? (
                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <Activity className="w-5 h-5 text-amber-500" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">CSAT</p>
                      <p className="text-xl font-semibold text-[#27273D]">
                        {data?.csat !== null ? `${data.csat}%` : '—'}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    data?.csat !== null && data.csat >= 80 
                      ? 'bg-emerald-50 text-emerald-600' 
                      : 'bg-amber-50 text-amber-600'
                  }`}>
                    {data?.csat !== null && data.csat >= 80 ? 'Excelente' : 'Melhorar'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => router.push('/feedback')}
                className="mt-4 w-full py-2.5 text-sm font-medium text-[#2A658F] bg-[#E2ECF4] 
                  hover:bg-[#CCE4F4] rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                Ver detalhes
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Cards */}
        <div
          className={`grid grid-cols-1 md:grid-cols-3 gap-6 transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '400ms' }}
        >
          <button
            onClick={() => router.push('/students')}
            className="group bg-white rounded-2xl border border-gray-100 p-6 text-left
              hover:border-gray-200 hover:shadow-lg hover:shadow-gray-100/50 transition-all duration-300"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Gerenciar</p>
                <p className="text-lg font-semibold text-[#27273D]">Alunos</p>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-[#2A658F] group-hover:translate-x-1 transition-all" />
            </div>
          </button>

          <button
            onClick={() => router.push('/metrics')}
            className="group bg-white rounded-2xl border border-gray-100 p-6 text-left
              hover:border-gray-200 hover:shadow-lg hover:shadow-gray-100/50 transition-all duration-300"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Analisar</p>
                <p className="text-lg font-semibold text-[#27273D]">Métricas</p>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-[#2A658F] group-hover:translate-x-1 transition-all" />
            </div>
          </button>

          <button
            onClick={() => router.push('/tickets')}
            className="group bg-white rounded-2xl border border-gray-100 p-6 text-left
              hover:border-gray-200 hover:shadow-lg hover:shadow-gray-100/50 transition-all duration-300"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Atender</p>
                <p className="text-lg font-semibold text-[#27273D]">Tickets</p>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-[#2A658F] group-hover:translate-x-1 transition-all" />
            </div>
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
