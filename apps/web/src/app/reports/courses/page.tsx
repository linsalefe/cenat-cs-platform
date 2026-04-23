'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import AppLayout from '@/components/AppLayout';
import {
  GraduationCap,
  Users,
  BookOpen,
  TrendingUp,
  Loader2,
  ArrowLeft,
  Monitor,
  DollarSign,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

interface CourseData {
  course: string;
  course_id: number;
  total: number;
  financial: { em_dia: number; pendentes: number; inadimplentes: number; health_rate: number };
  moodle: { acessaram: number; nunca_acessaram: number; avg_progress: number; avg_days_since: number; avg_grade: number };
  docs_ok: number;
  risk: { low: number; medium: number; high: number };
}

interface ReportData {
  summary: { total_courses: number; total_students: number; avg_progress: number };
  courses: CourseData[];
}

export default function CoursesReportPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [expandedCourse, setExpandedCourse] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'total' | 'progress' | 'risk' | 'financial'>('total');

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (!authLoading && !user) router.push('/login'); }, [user, authLoading, router]);
  useEffect(() => { if (user) loadData(); }, [user]);

  const loadData = async () => {
    try {
      const res = await api.get('/reports/courses');
      setData(res.data);
    } catch {
      toast.error('Erro ao carregar relatório');
    } finally {
      setLoading(false);
    }
  };

  const sortedCourses = data?.courses.slice().sort((a, b) => {
    if (sortBy === 'total') return b.total - a.total;
    if (sortBy === 'progress') return b.moodle.avg_progress - a.moodle.avg_progress;
    if (sortBy === 'risk') return b.risk.high - a.risk.high;
    if (sortBy === 'financial') return b.financial.inadimplentes - a.financial.inadimplentes;
    return 0;
  }) || [];

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-muted-foreground/70 animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!data) return null;

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className={`transition-all duration-700 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
          <button
            onClick={() => router.push('/reports')}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Relatórios
          </button>
          <p className="text-sm font-medium text-purple-600 mb-1">Visão Acadêmica</p>
          <h1 className="text-3xl font-semibold text-foreground tracking-tight">Desempenho por Curso</h1>
        </div>

        {/* KPI Cards */}
        <div className={`grid grid-cols-2 sm:grid-cols-3 gap-4 transition-all duration-700 ease-out ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`} style={{ transitionDelay: '100ms' }}>
          <div className="bg-card rounded-2xl p-5 border border-border">
            <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center mb-3">
              <GraduationCap className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-3xl font-bold text-foreground">{data.summary.total_courses}</p>
            <p className="text-sm text-muted-foreground">Cursos</p>
          </div>
          <div className="bg-card rounded-2xl p-5 border border-border">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mb-3">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-foreground">{data.summary.total_students.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Alunos matriculados</p>
          </div>
          <div className="bg-card rounded-2xl p-5 border border-border">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center mb-3">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-3xl font-bold text-emerald-600">{data.summary.avg_progress}%</p>
            <p className="text-sm text-muted-foreground">Progresso médio geral</p>
          </div>
        </div>

        {/* Sort */}
        <div className={`flex gap-2 transition-all duration-700 ease-out ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`} style={{ transitionDelay: '200ms' }}>
          <span className="text-sm text-muted-foreground py-1.5">Ordenar por:</span>
          {[
            { key: 'total', label: 'Alunos' },
            { key: 'progress', label: 'Progresso' },
            { key: 'risk', label: 'Risco' },
            { key: 'financial', label: 'Inadimplência' },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSortBy(opt.key as any)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                sortBy === opt.key
                  ? 'bg-primary text-white'
                  : 'bg-card text-muted-foreground border border-border hover:bg-muted/50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Course Cards */}
        <div className={`space-y-4 transition-all duration-700 ease-out ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`} style={{ transitionDelay: '300ms' }}>
          {sortedCourses.map((course, idx) => {
            const isExpanded = expandedCourse === idx;
            const totalRisk = course.risk.low + course.risk.medium + course.risk.high;
            const highRiskPct = totalRisk ? Math.round(course.risk.high / totalRisk * 100) : 0;
            const progressColor = course.moodle.avg_progress >= 70 ? 'text-emerald-600'
              : course.moodle.avg_progress >= 40 ? 'text-amber-600' : 'text-red-600';
            const progressBg = course.moodle.avg_progress >= 70 ? 'bg-emerald-500'
              : course.moodle.avg_progress >= 40 ? 'bg-amber-500' : 'bg-red-500';

            return (
              <div key={idx} className="bg-card rounded-2xl border border-border overflow-hidden hover:shadow-sm transition-shadow">
                {/* Main Row */}
                <button
                  onClick={() => setExpandedCourse(isExpanded ? null : idx)}
                  className="w-full px-6 py-4 flex items-center gap-6 text-left"
                >
                  {/* Nome */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate" title={course.course}>
                      {course.course}
                    </p>
                    <p className="text-sm text-muted-foreground">{course.total} alunos</p>
                  </div>

                  {/* Progresso */}
                  <div className="hidden sm:flex flex-col items-center w-24">
                    <p className={`text-lg font-bold ${progressColor}`}>{course.moodle.avg_progress}%</p>
                    <div className="w-full h-1.5 bg-muted rounded-full mt-1">
                      <div className={`h-full ${progressBg} rounded-full`} style={{ width: `${course.moodle.avg_progress}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground/70 mt-0.5">Progresso</p>
                  </div>

                  {/* Nota */}
                  <div className="hidden md:flex flex-col items-center w-20">
                    <p className="text-lg font-bold text-foreground">{course.moodle.avg_grade || '-'}</p>
                    <p className="text-xs text-muted-foreground/70">Nota média</p>
                  </div>

                  {/* Risco Alto */}
                  <div className="hidden md:flex flex-col items-center w-20">
                    <p className={`text-lg font-bold ${course.risk.high > 10 ? 'text-red-600' : course.risk.high > 5 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {course.risk.high}
                    </p>
                    <p className="text-xs text-muted-foreground/70">Risco alto</p>
                  </div>

                  {/* Saúde Financeira */}
                  <div className="hidden lg:flex flex-col items-center w-20">
                    <p className={`text-lg font-bold ${course.financial.health_rate >= 50 ? 'text-emerald-600' : course.financial.health_rate >= 25 ? 'text-amber-600' : 'text-red-600'}`}>
                      {course.financial.health_rate}%
                    </p>
                    <p className="text-xs text-muted-foreground/70">Saúde fin.</p>
                  </div>

                  {/* Expand */}
                  <div className="text-muted-foreground/70">
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-6 pb-5 border-t border-border pt-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {/* Moodle */}
                      <div className="bg-blue-50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Monitor className="w-4 h-4 text-blue-600" />
                          <h4 className="font-semibold text-sm text-blue-900">Moodle</h4>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-blue-700">Acessaram</span>
                            <span className="font-semibold text-blue-900">{course.moodle.acessaram}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-blue-700">Nunca acessaram</span>
                            <span className="font-semibold text-red-600">{course.moodle.nunca_acessaram}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-blue-700">Dias sem acesso (média)</span>
                            <span className="font-semibold text-blue-900">{course.moodle.avg_days_since}d</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-blue-700">Progresso</span>
                            <span className={`font-semibold ${progressColor}`}>{course.moodle.avg_progress}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-blue-700">Nota média</span>
                            <span className="font-semibold text-blue-900">{course.moodle.avg_grade || '-'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Financeiro */}
                      <div className="bg-amber-50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <DollarSign className="w-4 h-4 text-amber-600" />
                          <h4 className="font-semibold text-sm text-amber-900">Financeiro</h4>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-amber-700">Em dia</span>
                            <span className="font-semibold text-emerald-600">{course.financial.em_dia}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-amber-700">Pendentes</span>
                            <span className="font-semibold text-amber-600">{course.financial.pendentes}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-amber-700">Inadimplentes</span>
                            <span className="font-semibold text-red-600">{course.financial.inadimplentes}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-amber-700">Saúde</span>
                            <span className="font-semibold text-amber-900">{course.financial.health_rate}%</span>
                          </div>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden flex mt-3 bg-muted-foreground/20">
                          <div className="bg-emerald-500 h-full" style={{ width: `${course.financial.health_rate}%` }} />
                          <div className="bg-amber-500 h-full" style={{ width: `${(course.financial.pendentes / course.total * 100)}%` }} />
                          <div className="bg-red-500 h-full" style={{ width: `${(course.financial.inadimplentes / course.total * 100)}%` }} />
                        </div>
                      </div>

                      {/* Risco */}
                      <div className="bg-red-50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <ShieldAlert className="w-4 h-4 text-red-600" />
                          <h4 className="font-semibold text-sm text-red-900">Risco de Evasão</h4>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-red-700">Baixo</span>
                            <span className="font-semibold text-emerald-600">{course.risk.low}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-red-700">Médio</span>
                            <span className="font-semibold text-amber-600">{course.risk.medium}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-red-700">Alto</span>
                            <span className="font-semibold text-red-600">{course.risk.high}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-red-700">% Alto Risco</span>
                            <span className="font-semibold text-red-900">{highRiskPct}%</span>
                          </div>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden flex mt-3 bg-muted-foreground/20">
                          <div className="bg-emerald-500 h-full" style={{ width: `${totalRisk ? course.risk.low / totalRisk * 100 : 0}%` }} />
                          <div className="bg-amber-500 h-full" style={{ width: `${totalRisk ? course.risk.medium / totalRisk * 100 : 0}%` }} />
                          <div className="bg-red-500 h-full" style={{ width: `${totalRisk ? course.risk.high / totalRisk * 100 : 0}%` }} />
                        </div>
                      </div>

                      {/* Documentação */}
                      <div className="bg-emerald-50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <BookOpen className="w-4 h-4 text-emerald-600" />
                          <h4 className="font-semibold text-sm text-emerald-900">Documentação</h4>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-emerald-700">Docs completos</span>
                            <span className="font-semibold text-emerald-600">{course.docs_ok}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-emerald-700">Pendentes</span>
                            <span className="font-semibold text-amber-600">{course.total - course.docs_ok}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-emerald-700">Taxa completa</span>
                            <span className="font-semibold text-emerald-900">
                              {course.total ? Math.round(course.docs_ok / course.total * 100) : 0}%
                            </span>
                          </div>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden mt-3 bg-muted-foreground/20">
                          <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${course.total ? course.docs_ok / course.total * 100 : 0}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}