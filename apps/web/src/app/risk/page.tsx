'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import AppLayout from '@/components/AppLayout';
import { Avatar } from '@/components/ui';
import {
  Search,
  AlertTriangle,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Mail,
  Shield,
  Activity,
  Ticket,
  UserX,
  Users,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

interface RiskSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
  trends: {
    worsening: number;
    stable: number;
    improving: number;
  };
  abandonment: {
    abandoned: number;
    at_risk: number;
  };
}

interface StudentAtRisk {
  student_id: number;
  student_name: string;
  student_email: string;
  student_phone?: string | null;
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

interface Pagination {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

const levelConfig: Record<string, { label: string; color: string; bg: string; bar: string; border: string }> = {
  critical: { label: 'Crítico', color: 'text-red-700', bg: 'bg-red-50', bar: 'bg-red-500', border: 'border-red-200' },
  high: { label: 'Alto', color: 'text-orange-700', bg: 'bg-orange-50', bar: 'bg-orange-500', border: 'border-orange-200' },
  medium: { label: 'Médio', color: 'text-amber-700', bg: 'bg-amber-50', bar: 'bg-amber-500', border: 'border-amber-200' },
  low: { label: 'Baixo', color: 'text-emerald-700', bg: 'bg-emerald-50', bar: 'bg-emerald-500', border: 'border-emerald-200' },
};

const trendConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  worsening: { label: 'Piorando', color: 'text-red-600', bg: 'bg-red-50', icon: ArrowUpRight },
  stable: { label: 'Estável', color: 'text-muted-foreground', bg: 'bg-muted/50', icon: Minus },
  improving: { label: 'Melhorando', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: ArrowDownRight },
};

export default function RiskDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [summary, setSummary] = useState<RiskSummary | null>(null);
  const [students, setStudents] = useState<StudentAtRisk[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<string>('high');
  const [selectedTrend, setSelectedTrend] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [creatingTicketFor, setCreatingTicketFor] = useState<number | null>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (!authLoading && !user) router.push('/login'); }, [user, authLoading, router]);
  useEffect(() => { if (user) loadSummary(); }, [user]);
  useEffect(() => { if (user) loadStudents(); }, [user, selectedLevel, selectedTrend, currentPage]);

  const loadSummary = async () => {
    try {
      const res = await api.get('/risk/summary');
      setSummary(res.data);
    } catch (err) {
      console.error('Erro ao carregar resumo:', err);
    }
  };

  const loadStudents = async () => {
    try {
      setLoading(true);
      let url = `/risk/students/at-risk?level=${selectedLevel}&page=${currentPage}&per_page=30`;
      if (selectedTrend) url += `&trend=${selectedTrend}`;
      const res = await api.get(url);
      setStudents(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) {
      console.error('Erro ao carregar alunos:', err);
    } finally {
      setLoading(false);
    }
  };

  const createTicket = async (e: React.MouseEvent, student: StudentAtRisk) => {
    e.stopPropagation();
    setCreatingTicketFor(student.student_id);
    try {
      await api.post('/tickets', {
        student_id: student.student_id,
        category: 'academic',
        priority: 'high',
        subject: `Acompanhamento - Risco ${levelConfig[student.level]?.label || student.level}`,
        message: `Aluno identificado em risco de evasão.\n\nScore: ${student.score}\nTendência: ${trendConfig[student.trend]?.label || 'Estável'}\nFatores: ${student.factors.join(', ')}`,
      });
      toast.success('Ticket criado com sucesso!');
    } catch (err) {
      toast.error('Erro ao criar ticket');
    } finally {
      setCreatingTicketFor(null);
    }
  };

  const filtered = searchTerm
    ? students.filter(
        (s) =>
          s.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.student_email.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : students;

  const atRiskTotal = (summary?.critical || 0) + (summary?.high || 0);

  if (authLoading || (loading && !students.length)) {
    return (
      <AppLayout>
        <div className="animate-pulse space-y-8">
          <div className="h-8 bg-muted rounded-lg w-48"></div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 bg-muted rounded-2xl"></div>
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
            <p className="text-sm font-medium text-primary mb-1">Análise Preditiva</p>
            <h1 className="text-3xl font-semibold text-foreground tracking-tight">Risco de Evasão</h1>
          </div>

          <div className="flex items-center gap-3">
            {(summary?.trends?.worsening || 0) > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-xl">
                <TrendingUp className="w-4 h-4 text-red-600" />
                <span className="text-sm font-medium text-red-700">
                  {summary?.trends.worsening} piorando
                </span>
              </div>
            )}
            {(summary?.abandonment?.abandoned || 0) > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 bg-muted border border-border rounded-xl">
                <UserX className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground/90">
                  {summary?.abandonment.abandoned} abandono(s)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Stats Row 1 - Níveis */}
        <div
          className={`grid grid-cols-2 lg:grid-cols-4 gap-4 transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '100ms' }}
        >
          {[
            { key: 'critical', icon: AlertTriangle },
            { key: 'high', icon: TrendingUp },
            { key: 'medium', icon: Activity },
            { key: 'low', icon: Shield },
          ].map((item) => {
            const config = levelConfig[item.key];
            const count = summary?.[item.key as keyof RiskSummary] || 0;
            const isSelected = selectedLevel === item.key;

            return (
              <button
                key={item.key}
                onClick={() => { setSelectedLevel(item.key); setCurrentPage(1); setSelectedTrend(''); }}
                className={`bg-card rounded-2xl p-5 border transition-all duration-300 text-left
                  ${isSelected ? `${config.border} shadow-lg` : 'border-border hover:border-border'}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-10 h-10 ${config.bg} rounded-xl flex items-center justify-center`}>
                    <item.icon className={`w-5 h-5 ${config.color}`} />
                  </div>
                  {isSelected && <div className={`w-2 h-2 ${config.bar} rounded-full`} />}
                </div>
                <p className="text-2xl font-semibold text-foreground">{count as number}</p>
                <p className="text-sm text-muted-foreground">{config.label}</p>
              </button>
            );
          })}
        </div>

        {/* Stats Row 2 - Tendências + Abandono */}
        <div
          className={`grid grid-cols-2 lg:grid-cols-4 gap-4 transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '150ms' }}
        >
          {/* Piorando */}
          <button
            onClick={() => { setSelectedTrend(selectedTrend === 'worsening' ? '' : 'worsening'); setCurrentPage(1); }}
            className={`bg-card rounded-2xl p-5 border transition-all duration-300 text-left
              ${selectedTrend === 'worsening' ? 'border-red-200 shadow-lg' : 'border-border hover:border-border'}`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                <ArrowUpRight className="w-5 h-5 text-red-600" />
              </div>
            </div>
            <p className="text-2xl font-semibold text-foreground">{summary?.trends?.worsening || 0}</p>
            <p className="text-sm text-muted-foreground">Piorando</p>
          </button>

          {/* Melhorando */}
          <button
            onClick={() => { setSelectedTrend(selectedTrend === 'improving' ? '' : 'improving'); setCurrentPage(1); }}
            className={`bg-card rounded-2xl p-5 border transition-all duration-300 text-left
              ${selectedTrend === 'improving' ? 'border-emerald-200 shadow-lg' : 'border-border hover:border-border'}`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                <ArrowDownRight className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
            <p className="text-2xl font-semibold text-foreground">{summary?.trends?.improving || 0}</p>
            <p className="text-sm text-muted-foreground">Melhorando</p>
          </button>

          {/* Em risco de abandono */}
          <div className="bg-card rounded-2xl p-5 border border-border text-left">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-amber-600" />
              </div>
            </div>
            <p className="text-2xl font-semibold text-foreground">{summary?.abandonment?.at_risk || 0}</p>
            <p className="text-sm text-muted-foreground">Risco de abandono</p>
          </div>

          {/* Abandonos confirmados */}
          <div className="bg-card rounded-2xl p-5 border border-border text-left">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center">
                <UserX className="w-5 h-5 text-muted-foreground" />
              </div>
            </div>
            <p className="text-2xl font-semibold text-foreground">{summary?.abandonment?.abandoned || 0}</p>
            <p className="text-sm text-muted-foreground">Abandonos</p>
          </div>
        </div>

        {/* Search */}
        <div
          className={`transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '200ms' }}
        >
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/70" />
            <input
              type="text"
              placeholder="Buscar por nome ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-card border border-border rounded-xl
                focus:border-primary focus:ring-4 focus:ring-primary/10 
                transition-all duration-200 outline-none"
            />
          </div>
        </div>

        {/* Students List */}
        <div
          className={`transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '300ms' }}
        >
          {filtered.length === 0 ? (
            <div className="bg-card rounded-2xl border border-border p-12 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-muted-foreground/70" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">Nenhum aluno encontrado</h3>
              <p className="text-muted-foreground">Tente ajustar os filtros</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((student) => {
                const config = levelConfig[student.level] || levelConfig.medium;
                const trend = trendConfig[student.trend] || trendConfig.stable;
                const TrendIcon = trend.icon;
                const isCreating = creatingTicketFor === student.student_id;

                return (
                  <div
                    key={student.student_id}
                    onClick={() => router.push(`/risk/${student.student_id}`)}
                    className="group bg-card rounded-xl border border-border p-5
                      hover:border-border hover:shadow-lg hover:shadow-foreground/5/50
                      transition-all duration-300 cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <Avatar name={student.student_name} size="md" />
                        <div className={`absolute -bottom-1 -right-1 w-4 h-4 ${config.bar} rounded-full border-2 border-white`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-foreground group-hover:text-primary transition-colors truncate">
                            {student.student_name}
                          </h3>
                          <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${config.bg} ${config.color}`}>
                            {config.label}
                          </span>
                          {/* Trend badge */}
                          {student.trend !== 'stable' && (
                            <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 text-xs font-medium rounded-full ${trend.bg} ${trend.color}`}>
                              <TrendIcon className="w-3 h-3" />
                              {trend.label}
                            </span>
                          )}
                          {/* Abandonment badge */}
                          {student.abandonment_status === 'abandoned' && (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 text-xs font-medium rounded-full bg-gray-800 text-white">
                              <UserX className="w-3 h-3" />
                              Abandono
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{student.student_email}</p>
                      </div>

                      {/* Score + Trend Delta */}
                      <div className="hidden sm:block w-36">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Score</span>
                          <div className="flex items-center gap-1">
                            <span className="font-semibold text-foreground">{student.score.toFixed(1)}</span>
                            {student.trend_delta !== 0 && (
                              <span className={`text-xs ${student.trend_delta > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                {student.trend_delta > 0 ? '+' : ''}{student.trend_delta.toFixed(1)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full ${config.bar} rounded-full transition-all duration-500`}
                            style={{ width: `${student.score}%` }}
                          />
                        </div>
                      </div>

                      {/* Attendance mini */}
                      <div className="hidden lg:block text-center w-20">
                        <p className="text-xs text-muted-foreground/70 mb-1">Faltas</p>
                        <p className={`text-sm font-semibold ${student.attendance_info.consecutive_absences >= 8 ? 'text-red-600' : student.attendance_info.consecutive_absences >= 3 ? 'text-amber-600' : 'text-foreground/90'}`}>
                          {student.attendance_info.consecutive_absences} consec.
                        </p>
                        <p className="text-xs text-muted-foreground/70">{student.attendance_info.rate}%</p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => createTicket(e, student)}
                          disabled={isCreating}
                          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium
                            border border-border text-muted-foreground rounded-lg
                            hover:border-primary hover:text-primary hover:bg-primary/10
                            transition-all disabled:opacity-50"
                        >
                          <Ticket className="w-3.5 h-3.5" />
                          {isCreating ? '...' : 'Ticket'}
                        </button>
                        
                        <a
                          href={`mailto:${student.student_email}`}
                          onClick={(e) => e.stopPropagation()}
                          className="p-2 text-muted-foreground/70 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                        >
                          <Mail className="w-4 h-4" />
                        </a>
                      </div>

                      <ArrowRight className="w-5 h-5 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination && pagination.total_pages > 1 && (
          <div className="flex items-center justify-between bg-card rounded-xl border border-border p-4">
            <p className="text-sm text-muted-foreground">
              {(pagination.page - 1) * pagination.per_page + 1} - {Math.min(pagination.page * pagination.per_page, pagination.total)} de {pagination.total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-muted-foreground
                  border border-border rounded-lg hover:bg-muted/50
                  disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-4 h-4" /> Anterior
              </button>
              <span className="px-3 py-2 text-sm text-muted-foreground">{pagination.page} / {pagination.total_pages}</span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(pagination.total_pages, p + 1))}
                disabled={currentPage === pagination.total_pages}
                className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-muted-foreground
                  border border-border rounded-lg hover:bg-muted/50
                  disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Próximo <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}