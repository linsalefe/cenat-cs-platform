'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import AppLayout from '@/components/AppLayout';
import KpiCard from '@/components/KpiCard';
import PageHeader from '@/components/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
  BarChart3,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

interface DashboardData {
  students: { total: number; at_risk: number };
  tickets: {
    open: number;
    closed_period: number;
    sla_percentage: number | null;
    avg_resolution_hours: number | null;
  };
  nps: number | null;
  csat: number | null;
  risk_breakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    ? (
        ((data.students.total - data.students.at_risk) / data.students.total) *
        100
      ).toFixed(1)
    : null;

  const isLoadingPage = authLoading || loading;
  const firstName = user?.name?.split(' ')[0] || '';

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          eyebrow="Dashboard"
          title={isLoadingPage ? 'Carregando…' : `${getGreeting()}, ${firstName}`}
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing || isLoadingPage}
            >
              <RefreshCw
                className={cn('w-4 h-4 mr-2', refreshing && 'animate-spin')}
              />
              Atualizar dados
            </Button>
          }
        />

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Alunos"
            value={data?.students.total ?? 0}
            icon={Users}
            subtitle="Total cadastrados"
            tone="primary"
            loading={isLoadingPage}
          />
          <KpiCard
            label="Atenção"
            value={data?.students.at_risk ?? 0}
            icon={AlertTriangle}
            subtitle="Alunos em risco"
            tone="warning"
            href="/risk"
            actionLabel="Ver"
            loading={isLoadingPage}
          />
          <KpiCard
            label="Suporte"
            value={data?.tickets.open ?? 0}
            icon={Ticket}
            subtitle="Tickets abertos"
            tone="info"
            href="/tickets"
            actionLabel="Ver"
            loading={isLoadingPage}
          />
          <KpiCard
            label="SLA"
            value={
              data?.tickets.sla_percentage !== null &&
              data?.tickets.sla_percentage !== undefined
                ? `${data.tickets.sla_percentage}%`
                : '—'
            }
            icon={Clock}
            subtitle="Dentro do prazo"
            tone="success"
            loading={isLoadingPage}
          />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Risk Overview */}
          <Card className="lg:col-span-2 p-6">
            {isLoadingPage ? (
              <RiskOverviewSkeleton />
            ) : (
              <>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">
                      Visão Geral de Risco
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Distribuição dos alunos por nível de risco
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push('/risk')}
                  >
                    Ver todos
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  {[
                    {
                      label: 'Crítico',
                      value: data?.risk_breakdown.critical || 0,
                      bg: 'bg-red-50 dark:bg-red-500/10',
                      text: 'text-red-600 dark:text-red-400',
                      border: 'border-red-100 dark:border-red-500/20',
                    },
                    {
                      label: 'Alto',
                      value: data?.risk_breakdown.high || 0,
                      bg: 'bg-orange-50 dark:bg-orange-500/10',
                      text: 'text-orange-600 dark:text-orange-400',
                      border: 'border-orange-100 dark:border-orange-500/20',
                    },
                    {
                      label: 'Médio',
                      value: data?.risk_breakdown.medium || 0,
                      bg: 'bg-amber-50 dark:bg-amber-500/10',
                      text: 'text-amber-600 dark:text-amber-400',
                      border: 'border-amber-100 dark:border-amber-500/20',
                    },
                    {
                      label: 'Baixo',
                      value: data?.risk_breakdown.low || 0,
                      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
                      text: 'text-emerald-600 dark:text-emerald-400',
                      border: 'border-emerald-100 dark:border-emerald-500/20',
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className={cn(
                        'rounded-lg p-3 text-center border',
                        item.bg,
                        item.border
                      )}
                    >
                      <p
                        className={cn(
                          'text-2xl font-semibold tabular-nums',
                          item.text
                        )}
                      >
                        {item.value}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {item.label}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="space-y-2.5">
                  {[
                    {
                      label: 'Crítico',
                      value: data?.risk_breakdown.critical || 0,
                      color: 'bg-red-500',
                    },
                    {
                      label: 'Alto',
                      value: data?.risk_breakdown.high || 0,
                      color: 'bg-orange-500',
                    },
                    {
                      label: 'Médio',
                      value: data?.risk_breakdown.medium || 0,
                      color: 'bg-amber-500',
                    },
                    {
                      label: 'Baixo',
                      value: data?.risk_breakdown.low || 0,
                      color: 'bg-emerald-500',
                    },
                  ].map((item) => {
                    const total = data?.students.total || 1;
                    const pct = (item.value / total) * 100;
                    return (
                      <div
                        key={item.label}
                        className="flex items-center gap-3"
                      >
                        <span className="w-14 text-xs text-muted-foreground">
                          {item.label}
                        </span>
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all duration-700',
                              item.color
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-12 text-xs text-muted-foreground text-right tabular-nums">
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </Card>

          {/* Right column: Retention + Satisfaction */}
          <div className="space-y-4">
            {/* Retention Card */}
            <Card className="p-6 bg-gradient-to-br from-primary to-primary/70 text-primary-foreground border-0">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-5 h-5 opacity-80" />
                <span className="text-sm font-medium opacity-90">
                  Taxa de Retenção
                </span>
              </div>
              {isLoadingPage ? (
                <>
                  <Skeleton className="h-10 w-24 mb-2 bg-white/20" />
                  <Skeleton className="h-4 w-40 bg-white/20" />
                </>
              ) : (
                <>
                  <p className="text-4xl font-semibold mb-1 tabular-nums">
                    {retentionRate ?? '—'}%
                  </p>
                  <p className="text-sm opacity-75">
                    dos alunos em situação saudável
                  </p>
                  <div className="mt-4 pt-4 border-t border-white/20">
                    <div className="flex items-center gap-2 text-sm">
                      {parseFloat(retentionRate || '0') > 80 ? (
                        <>
                          <TrendingUp className="w-4 h-4" />
                          <span>Bom desempenho</span>
                        </>
                      ) : (
                        <>
                          <TrendingDown className="w-4 h-4" />
                          <span>Atenção necessária</span>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </Card>

            {/* NPS & CSAT */}
            <Card className="p-6">
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">
                Satisfação
              </h3>
              {isLoadingPage ? (
                <div className="space-y-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : (
                <div className="space-y-3">
                  <SatisfactionRow
                    label="NPS"
                    value={data?.nps}
                    threshold={50}
                    suffix=""
                  />
                  <div className="h-px bg-border" />
                  <SatisfactionRow
                    label="CSAT"
                    value={data?.csat}
                    threshold={80}
                    suffix="%"
                  />
                </div>
              )}
              <Button
                variant="secondary"
                className="mt-5 w-full"
                onClick={() => router.push('/feedback')}
                disabled={isLoadingPage}
              >
                Ver detalhes
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Card>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <QuickAction
            label="Gerenciar"
            title="Alunos"
            icon={Users}
            onClick={() => router.push('/students')}
          />
          <QuickAction
            label="Analisar"
            title="Métricas"
            icon={BarChart3}
            onClick={() => router.push('/metrics')}
          />
          <QuickAction
            label="Atender"
            title="Tickets"
            icon={Ticket}
            onClick={() => router.push('/tickets')}
          />
        </div>
      </div>
    </AppLayout>
  );
}

/* ============================================================
   Subcomponentes locais
   ============================================================ */

function SatisfactionRow({
  label,
  value,
  threshold,
  suffix,
}: {
  label: string;
  value: number | null | undefined;
  threshold: number;
  suffix: string;
}) {
  const hasValue = value !== null && value !== undefined;
  const isGood = hasValue && value >= threshold;
  const badge = isGood ? 'Excelente' : 'Melhorar';
  const badgeClass = isGood
    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
    : 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400';
  const iconWrapClass = isGood
    ? 'bg-emerald-50 dark:bg-emerald-500/10'
    : 'bg-amber-50 dark:bg-amber-500/10';
  const iconClass = isGood
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-amber-600 dark:text-amber-400';
  const Icon = isGood ? CheckCircle : Activity;

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center',
            iconWrapClass
          )}
        >
          <Icon className={cn('w-5 h-5', iconClass)} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold text-foreground tabular-nums">
            {hasValue ? `${value}${suffix}` : '—'}
          </p>
        </div>
      </div>
      <span
        className={cn(
          'text-[11px] font-semibold px-2 py-0.5 rounded-full',
          badgeClass
        )}
      >
        {badge}
      </span>
    </div>
  );
}

function QuickAction({
  label,
  title,
  icon: Icon,
  onClick,
}: {
  label: string;
  title: string;
  icon: any;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left w-full focus:outline-none"
    >
      <Card className="p-5 group cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-foreground/15">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              <Icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                {label}
              </p>
              <p className="text-base font-semibold text-foreground">{title}</p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
        </div>
      </Card>
    </button>
  );
}

function RiskOverviewSkeleton() {
  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
        <Skeleton className="h-8 w-20" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[76px] rounded-lg" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    </>
  );
}
