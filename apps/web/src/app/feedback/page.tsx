'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import AppLayout from '@/components/AppLayout';
import { Avatar } from '@/components/ui';
import {
  MessageSquare,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Star,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Clock,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import api from '@/lib/api';

interface NPSSummary {
  nps_score: number | null;
  total_responses: number;
  promoters: number;
  passives: number;
  detractors: number;
  promoters_pct: number;
  detractors_pct: number;
}

interface CSATSummary {
  csat_score: number | null;
  total_responses: number;
  satisfied: number;
  neutral: number;
  dissatisfied: number;
  average_score: number | null;
}

interface FeedbackItem {
  id: number;
  student_id: number;
  student_name: string;
  feedback_type: string;
  trigger: string;
  score: number | null;
  comment: string | null;
  sent_at: string | null;
  answered_at: string | null;
}

const triggerLabels: Record<string, string> = {
  ticket_closed: 'Ticket Fechado',
  course_completed: 'Curso Concluído',
  manual: 'Manual',
  scheduled: 'Agendado',
};

export default function FeedbackDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [nps, setNps] = useState<NPSSummary | null>(null);
  const [csat, setCsat] = useState<CSATSummary | null>(null);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
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
      const [npsRes, csatRes, feedbacksRes] = await Promise.all([
        api.get(`/feedback/nps/summary?days=${days}`),
        api.get(`/feedback/csat/summary?days=${days}`),
        api.get('/feedback/list?limit=20'),
      ]);
      setNps(npsRes.data);
      setCsat(csatRes.data);
      setFeedbacks(feedbacksRes.data);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getNpsStatus = (score: number | null) => {
    if (score === null) return { label: '—', color: 'text-muted-foreground/70', bg: 'bg-muted/50' };
    if (score >= 50) return { label: 'Excelente', color: 'text-emerald-600', bg: 'bg-emerald-50' };
    if (score >= 0) return { label: 'Bom', color: 'text-amber-600', bg: 'bg-amber-50' };
    return { label: 'Crítico', color: 'text-red-600', bg: 'bg-red-50' };
  };

  const getCsatStatus = (score: number | null) => {
    if (score === null) return { label: '—', color: 'text-muted-foreground/70', bg: 'bg-muted/50' };
    if (score >= 80) return { label: 'Excelente', color: 'text-emerald-600', bg: 'bg-emerald-50' };
    if (score >= 60) return { label: 'Bom', color: 'text-amber-600', bg: 'bg-amber-50' };
    return { label: 'Crítico', color: 'text-red-600', bg: 'bg-red-50' };
  };

  const getScoreCategory = (type: string, score: number | null) => {
    if (score === null) return { icon: Clock, label: 'Pendente', color: 'text-muted-foreground/70', bg: 'bg-muted/50' };

    if (type === 'nps') {
      if (score >= 9) return { icon: ThumbsUp, label: 'Promotor', color: 'text-emerald-600', bg: 'bg-emerald-50' };
      if (score >= 7) return { icon: Minus, label: 'Passivo', color: 'text-amber-600', bg: 'bg-amber-50' };
      return { icon: ThumbsDown, label: 'Detrator', color: 'text-red-600', bg: 'bg-red-50' };
    } else {
      if (score >= 4) return { icon: ThumbsUp, label: 'Satisfeito', color: 'text-emerald-600', bg: 'bg-emerald-50' };
      if (score === 3) return { icon: Minus, label: 'Neutro', color: 'text-amber-600', bg: 'bg-amber-50' };
      return { icon: ThumbsDown, label: 'Insatisfeito', color: 'text-red-600', bg: 'bg-red-50' };
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
    });
  };

  const npsStatus = getNpsStatus(nps?.nps_score ?? null);
  const csatStatus = getCsatStatus(csat?.csat_score ?? null);

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="animate-pulse space-y-8">
          <div className="h-8 bg-muted rounded-lg w-48"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-64 bg-muted rounded-2xl"></div>
            <div className="h-64 bg-muted rounded-2xl"></div>
          </div>
          <div className="h-96 bg-muted rounded-2xl"></div>
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
            <p className="text-sm font-medium text-primary mb-1">Satisfação</p>
            <h1 className="text-3xl font-semibold text-foreground tracking-tight">NPS & CSAT</h1>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="px-4 py-2.5 bg-card border border-border rounded-xl text-sm font-medium
                focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all"
            >
              <option value={7}>Últimos 7 dias</option>
              <option value={30}>Últimos 30 dias</option>
              <option value={90}>Últimos 90 dias</option>
              <option value={365}>Último ano</option>
            </select>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-muted-foreground
                bg-card border border-border rounded-xl hover:bg-muted/50 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* NPS & CSAT Cards */}
        <div
          className={`grid grid-cols-1 md:grid-cols-2 gap-6 transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '100ms' }}
        >
          {/* NPS Card */}
          <div className="bg-card rounded-2xl border border-border p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Net Promoter Score</h2>
                <p className="text-sm text-muted-foreground">Lealdade dos alunos</p>
              </div>
              <span className={`text-xs font-medium px-3 py-1.5 rounded-full ${npsStatus.bg} ${npsStatus.color}`}>
                {npsStatus.label}
              </span>
            </div>

            <div className="flex items-center gap-6 mb-6">
              <div className={`text-5xl font-bold ${npsStatus.color}`}>
                {nps?.nps_score !== null && nps?.nps_score !== undefined ? nps.nps_score : '—'}
              </div>
              <div className="text-sm text-muted-foreground">
                <p>{nps?.total_responses || 0} respostas</p>
                <p className="text-xs text-muted-foreground/70">Escala: -100 a +100</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <ThumbsUp className="w-4 h-4 text-emerald-500" />
                    Promotores (9-10)
                  </span>
                  <span className="font-medium text-foreground">{nps?.promoters || 0} ({nps?.promoters_pct || 0}%)</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${nps?.promoters_pct || 0}%` }} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Minus className="w-4 h-4 text-amber-500" />
                    Passivos (7-8)
                  </span>
                  <span className="font-medium text-foreground">{nps?.passives || 0}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full"
                    style={{ width: `${nps ? (nps.passives / (nps.total_responses || 1)) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <ThumbsDown className="w-4 h-4 text-red-500" />
                    Detratores (0-6)
                  </span>
                  <span className="font-medium text-foreground">{nps?.detractors || 0} ({nps?.detractors_pct || 0}%)</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-red-500 rounded-full" style={{ width: `${nps?.detractors_pct || 0}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* CSAT Card */}
          <div className="bg-card rounded-2xl border border-border p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Customer Satisfaction</h2>
                <p className="text-sm text-muted-foreground">Satisfação com atendimento</p>
              </div>
              <span className={`text-xs font-medium px-3 py-1.5 rounded-full ${csatStatus.bg} ${csatStatus.color}`}>
                {csatStatus.label}
              </span>
            </div>

            <div className="flex items-center gap-6 mb-6">
              <div className={`text-5xl font-bold ${csatStatus.color}`}>
                {csat?.csat_score !== null && csat?.csat_score !== undefined ? `${csat.csat_score}%` : '—'}
              </div>
              <div className="text-sm text-muted-foreground">
                <p>{csat?.total_responses || 0} respostas</p>
                <p className="text-xs text-muted-foreground/70">Média: {csat?.average_score?.toFixed(1) || '—'}/5</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <ThumbsUp className="w-4 h-4 text-emerald-500" />
                    Satisfeitos (4-5)
                  </span>
                  <span className="font-medium text-foreground">{csat?.satisfied || 0}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${csat ? (csat.satisfied / (csat.total_responses || 1)) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Minus className="w-4 h-4 text-amber-500" />
                    Neutros (3)
                  </span>
                  <span className="font-medium text-foreground">{csat?.neutral || 0}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full"
                    style={{ width: `${csat ? (csat.neutral / (csat.total_responses || 1)) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <ThumbsDown className="w-4 h-4 text-red-500" />
                    Insatisfeitos (1-2)
                  </span>
                  <span className="font-medium text-foreground">{csat?.dissatisfied || 0}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500 rounded-full"
                    style={{ width: `${csat ? (csat.dissatisfied / (csat.total_responses || 1)) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feedbacks List */}
        <div
          className={`bg-card rounded-2xl border border-border transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '200ms' }}
        >
          <div className="p-6 border-b border-border">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Feedbacks Recentes</h2>
            </div>
          </div>

          {feedbacks.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-8 h-8 text-muted-foreground/70" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">Nenhum feedback ainda</h3>
              <p className="text-muted-foreground">Os feedbacks aparecerão aqui quando forem enviados</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {feedbacks.map((f) => {
                const category = getScoreCategory(f.feedback_type, f.score);
                const Icon = category.icon;

                return (
                  <div key={f.id} className="p-5 hover:bg-muted/50 transition-colors">
                    <div className="flex items-start gap-4">
                      <Avatar name={f.student_name} size="md" />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-4 mb-1">
                          <h3 className="font-medium text-foreground truncate">{f.student_name}</h3>
                          <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${category.bg} ${category.color}`}>
                            <Icon className="w-3.5 h-3.5" />
                            {category.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-sm text-muted-foreground mb-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            f.feedback_type === 'nps' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                          }`}>
                            {f.feedback_type.toUpperCase()}
                          </span>
                          <span>{triggerLabels[f.trigger] || f.trigger}</span>
                          <span>•</span>
                          <span>{f.answered_at ? formatDate(f.answered_at) : formatDate(f.sent_at!)}</span>
                        </div>

                        {f.score !== null && (
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm text-muted-foreground">Nota:</span>
                            <span className="text-lg font-semibold text-foreground">{f.score}</span>
                            {f.feedback_type === 'nps' && <span className="text-sm text-muted-foreground/70">/ 10</span>}
                            {f.feedback_type === 'csat' && <span className="text-sm text-muted-foreground/70">/ 5</span>}
                          </div>
                        )}

                        {f.comment && (
                          <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 italic">
                            "{f.comment}"
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
