'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import AppLayout from '@/components/AppLayout';
import {
  BarChart3,
  Users,
  DollarSign,
  AlertTriangle,
  FileCheck,
  Monitor,
  Send,
  GitBranch,
  Ticket,
  TrendingUp,
  TrendingDown,
  Download,
  Loader2,
  GraduationCap,
  ShieldAlert,
  ShieldCheck,
  Shield,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

interface ExecutiveData {
  summary: { total_students: number; with_phone: number; with_moodle: number; phone_coverage: number };
  financial: { em_dia: number; pendente: number; inadimplente: number; total: number; overdue_total: number; health_rate: number };
  risk: Record<string, number>;
  documents: { complete: number; incomplete: number; none: number };
  moodle: { accessed: number; never_accessed: number };
  broadcasts: { total: number; messages_sent: number; messages_failed: number };
  journeys: { total: number; active: number; students_active: number };
  tickets: { total: number };
  courses: { course: string; total: number; inadimplentes: number; em_dia: number; pendentes: number; avg_overdue: number }[];
}

export default function ReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<ExecutiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const res = await api.get('/reports/executive');
      setData(res.data);
    } catch {
      toast.error('Erro ao carregar relatório');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const getRiskCount = (level: string) => {
    if (!data) return 0;
    return data.risk[`RiskLevel.${level}`] || data.risk[level] || 0;
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

  if (!data) return null;

  const maxCourseStudents = Math.max(...data.courses.map(c => c.total), 1);

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className={`flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 transition-all duration-700 ease-out ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
        }`}>
          <div>
            <p className="text-sm font-medium text-[#2A658F] mb-1">Visão Executiva</p>
            <h1 className="text-3xl font-semibold text-[#27273D] tracking-tight">Relatório Geral</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                try {
                  const res = await api.get('/reports/executive/export-pdf', { responseType: 'blob' });
                  const url = window.URL.createObjectURL(new Blob([res.data]));
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `relatorio_executivo_${new Date().toISOString().slice(0,10)}.pdf`;
                  a.click();
                  window.URL.revokeObjectURL(url);
                  toast.success('PDF exportado!');
                } catch {
                  toast.error('Erro ao exportar PDF');
                }
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#2A658F] bg-[#E2ECF4] rounded-xl hover:bg-[#CCE4F4] transition-colors"
            >
              <Download className="w-4 h-4" />
              PDF
            </button>
            <button
              onClick={async () => {
                try {
                  const res = await api.get('/reports/executive/export-excel', { responseType: 'blob' });
                  const url = window.URL.createObjectURL(new Blob([res.data]));
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `relatorio_executivo_${new Date().toISOString().slice(0,10)}.xlsx`;
                  a.click();
                  window.URL.revokeObjectURL(url);
                  toast.success('Excel exportado!');
                } catch {
                  toast.error('Erro ao exportar Excel');
                }
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-colors"
            >
              <Download className="w-4 h-4" />
              Excel
            </button>
          </div>
        </div>

        {/* Links para relatórios detalhados (MOVIDO PARA O TOPO) */}
        <div className={`flex gap-3 transition-all duration-700 ease-out ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`} style={{ transitionDelay: '50ms' }}>
          <button
            onClick={() => router.push('/reports/inadimplencia')}
            className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 px-4 py-3 text-left hover:shadow-md hover:border-red-200 transition-all group"
          >
            <div className="w-9 h-9 bg-red-50 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
              <DollarSign className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-[#27273D]">Inadimplência por Curso</h3>
              <p className="text-xs text-gray-500">Taxa, valores e top devedores</p>
            </div>
          </button>
          <button
            onClick={() => router.push('/reports/courses')}
            className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 px-4 py-3 text-left hover:shadow-md hover:border-purple-200 transition-all group"
          >
            <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
              <GraduationCap className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-[#27273D]">Desempenho por Curso</h3>
              <p className="text-xs text-gray-500">Progresso, notas e risco</p>
            </div>
          </button>
        </div>

        {/* KPI Cards */}
        <div className={`grid grid-cols-2 sm:grid-cols-4 gap-4 transition-all duration-700 ease-out ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`} style={{ transitionDelay: '100ms' }}>
          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                {data.summary.phone_coverage}% c/ tel
              </span>
            </div>
            <p className="text-3xl font-bold text-[#27273D]">{data.summary.total_students.toLocaleString()}</p>
            <p className="text-sm text-gray-500">Alunos</p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-red-600" />
              </div>
              <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                {data.financial.inadimplente} alunos
              </span>
            </div>
            <p className="text-3xl font-bold text-red-600">{formatCurrency(data.financial.overdue_total)}</p>
            <p className="text-sm text-gray-500">Valor em atraso</p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-emerald-600">{data.financial.health_rate}%</p>
            <p className="text-sm text-gray-500">Saúde financeira</p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                <Monitor className="w-5 h-5 text-purple-600" />
              </div>
              <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                {data.moodle.never_accessed} sem acesso
              </span>
            </div>
            <p className="text-3xl font-bold text-[#27273D]">{data.moodle.accessed.toLocaleString()}</p>
            <p className="text-sm text-gray-500">Acessaram Moodle</p>
          </div>
        </div>

        {/* Financial + Risk Row */}
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 transition-all duration-700 ease-out ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`} style={{ transitionDelay: '200ms' }}>

          {/* Financial Breakdown */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h3 className="font-semibold text-[#27273D] mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-gray-400" />
              Situação Financeira
            </h3>
            <div className="space-y-4">
              {[
                { label: 'Em dia', value: data.financial.em_dia, total: data.financial.total, color: 'bg-emerald-500' },
                { label: 'Pendente', value: data.financial.pendente, total: data.financial.total, color: 'bg-amber-500' },
                { label: 'Inadimplente', value: data.financial.inadimplente, total: data.financial.total, color: 'bg-red-500' },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{item.label}</span>
                    <span className="font-medium text-[#27273D]">
                      {item.value} ({item.total ? ((item.value / item.total) * 100).toFixed(1) : 0}%)
                    </span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.color} rounded-full transition-all duration-1000`}
                      style={{ width: `${item.total ? (item.value / item.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between text-sm">
              <span className="text-gray-500">Total com dados financeiros</span>
              <span className="font-semibold text-[#27273D]">{data.financial.total}</span>
            </div>
          </div>

          {/* Risk Distribution */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h3 className="font-semibold text-[#27273D] mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-gray-400" />
              Distribuição de Risco
            </h3>
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { level: 'LOW', label: 'Baixo', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: ShieldCheck },
                { level: 'MEDIUM', label: 'Médio', color: 'text-amber-600', bg: 'bg-amber-50', icon: Shield },
                { level: 'HIGH', label: 'Alto', color: 'text-red-600', bg: 'bg-red-50', icon: ShieldAlert },
              ].map((item) => {
                const Icon = item.icon;
                const count = getRiskCount(item.level);
                const totalRisk = getRiskCount('LOW') + getRiskCount('MEDIUM') + getRiskCount('HIGH');
                return (
                  <div key={item.level} className={`${item.bg} rounded-xl p-4 text-center`}>
                    <Icon className={`w-6 h-6 ${item.color} mx-auto mb-2`} />
                    <p className={`text-2xl font-bold ${item.color}`}>{count}</p>
                    <p className="text-xs text-gray-500">{item.label}</p>
                    <p className="text-xs font-medium text-gray-400 mt-1">
                      {totalRisk ? ((count / totalRisk) * 100).toFixed(0) : 0}%
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Risk bar */}
            <div className="h-4 rounded-full overflow-hidden flex">
              {[
                { level: 'LOW', color: 'bg-emerald-500' },
                { level: 'MEDIUM', color: 'bg-amber-500' },
                { level: 'HIGH', color: 'bg-red-500' },
              ].map((item) => {
                const count = getRiskCount(item.level);
                const totalRisk = getRiskCount('LOW') + getRiskCount('MEDIUM') + getRiskCount('HIGH');
                return (
                  <div
                    key={item.level}
                    className={`${item.color} transition-all duration-1000`}
                    style={{ width: `${totalRisk ? (count / totalRisk) * 100 : 0}%` }}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Documents + Operations Row */}
        <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 transition-all duration-700 ease-out ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`} style={{ transitionDelay: '300ms' }}>

          {/* Documents */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-semibold text-[#27273D] mb-3 flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-gray-400" />
              Documentação
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Completa</span>
                <span className="text-sm font-semibold text-emerald-600">{data.documents.complete}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Incompleta</span>
                <span className="text-sm font-semibold text-amber-600">{data.documents.incomplete}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Sem documentos</span>
                <span className="text-sm font-semibold text-red-600">{data.documents.none}</span>
              </div>
            </div>
          </div>

          {/* Broadcasts */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-semibold text-[#27273D] mb-3 flex items-center gap-2">
              <Send className="w-5 h-5 text-gray-400" />
              Disparos
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Campanhas</span>
                <span className="text-sm font-semibold">{data.broadcasts.total}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Mensagens enviadas</span>
                <span className="text-sm font-semibold text-emerald-600">{data.broadcasts.messages_sent}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Falhas</span>
                <span className="text-sm font-semibold text-red-600">{data.broadcasts.messages_failed}</span>
              </div>
            </div>
          </div>

          {/* Journeys */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-semibold text-[#27273D] mb-3 flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-gray-400" />
              Réguas
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total</span>
                <span className="text-sm font-semibold">{data.journeys.total}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Ativas</span>
                <span className="text-sm font-semibold text-emerald-600">{data.journeys.active}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Alunos em jornada</span>
                <span className="text-sm font-semibold text-blue-600">{data.journeys.students_active}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Courses Table */}
        <div className={`bg-white rounded-2xl border border-gray-100 p-6 transition-all duration-700 ease-out ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`} style={{ transitionDelay: '400ms' }}>
          <h3 className="font-semibold text-[#27273D] mb-4 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-gray-400" />
            Desempenho por Curso ({data.courses.length} cursos)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 uppercase border-b border-gray-100">
                  <th className="px-3 py-3">Curso</th>
                  <th className="px-3 py-3 text-center">Alunos</th>
                  <th className="px-3 py-3 text-center">Em dia</th>
                  <th className="px-3 py-3 text-center">Pendentes</th>
                  <th className="px-3 py-3 text-center">Inadimplentes</th>
                  <th className="px-3 py-3 text-right">Média atraso</th>
                  <th className="px-3 py-3 w-40">Saúde</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.courses.map((course, idx) => {
                  const total = course.em_dia + course.pendentes + course.inadimplentes;
                  const healthPct = total ? (course.em_dia / total) * 100 : 0;
                  const pendPct = total ? (course.pendentes / total) * 100 : 0;
                  const inadPct = total ? (course.inadimplentes / total) * 100 : 0;
                  return (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-3 py-3">
                        <p className="font-medium text-gray-800 line-clamp-1 max-w-xs" title={course.course}>
                          {course.course}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-center font-semibold">{course.total}</td>
                      <td className="px-3 py-3 text-center text-emerald-600 font-medium">{course.em_dia}</td>
                      <td className="px-3 py-3 text-center text-amber-600 font-medium">{course.pendentes}</td>
                      <td className="px-3 py-3 text-center text-red-600 font-medium">{course.inadimplentes}</td>
                      <td className="px-3 py-3 text-right text-gray-600">{formatCurrency(course.avg_overdue)}</td>
                      <td className="px-3 py-3">
                        <div className="h-2.5 rounded-full overflow-hidden flex bg-gray-100">
                          <div className="bg-emerald-500 h-full" style={{ width: `${healthPct}%` }} />
                          <div className="bg-amber-500 h-full" style={{ width: `${pendPct}%` }} />
                          <div className="bg-red-500 h-full" style={{ width: `${inadPct}%` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}