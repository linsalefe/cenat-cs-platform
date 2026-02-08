'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import AppLayout from '@/components/AppLayout';
import {
  AlertTriangle,
  DollarSign,
  Users,
  TrendingDown,
  Download,
  Loader2,
  ArrowLeft,
  Phone,
  Mail,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

interface InadimplenciaData {
  summary: {
    total_students: number;
    total_inadimplente: number;
    total_pendente: number;
    total_overdue: number;
    inadimplencia_rate: number;
  };
  courses: {
    course: string;
    total: number;
    em_dia: number;
    pendentes: number;
    inadimplentes: number;
    total_overdue: number;
    max_overdue: number;
    inadimplencia_rate: number;
  }[];
  top_debtors: {
    name: string;
    email: string;
    phone: string;
    course: string;
    overdue_value: number;
    status: string;
  }[];
}

export default function InadimplenciaPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<InadimplenciaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (!authLoading && !user) router.push('/login'); }, [user, authLoading, router]);
  useEffect(() => { if (user) loadData(); }, [user]);

  const loadData = async () => {
    try {
      const res = await api.get('/reports/inadimplencia');
      setData(res.data);
    } catch {
      toast.error('Erro ao carregar relatório');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className={`flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 transition-all duration-700 ease-out ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
        }`}>
          <div>
            <button
              onClick={() => router.push('/reports')}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-[#2A658F] transition-colors mb-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Relatórios
            </button>
            <p className="text-sm font-medium text-red-600 mb-1">Relatório Financeiro</p>
            <h1 className="text-3xl font-semibold text-[#27273D] tracking-tight">Inadimplência por Curso</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                try {
                  const res = await api.get('/reports/inadimplencia/export-excel', { responseType: 'blob' });
                  const url = window.URL.createObjectURL(new Blob([res.data]));
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `inadimplencia_${new Date().toISOString().slice(0,10)}.xlsx`;
                  a.click();
                  window.URL.revokeObjectURL(url);
                  toast.success('Excel exportado!');
                } catch { toast.error('Exportação Excel em breve'); }
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-colors"
            >
              <Download className="w-4 h-4" />
              Excel
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className={`grid grid-cols-2 sm:grid-cols-4 gap-4 transition-all duration-700 ease-out ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`} style={{ transitionDelay: '100ms' }}>
          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center mb-3">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <p className="text-3xl font-bold text-red-600">{data.summary.total_inadimplente}</p>
            <p className="text-sm text-gray-500">Inadimplentes</p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center mb-3">
              <Users className="w-5 h-5 text-amber-600" />
            </div>
            <p className="text-3xl font-bold text-amber-600">{data.summary.total_pendente}</p>
            <p className="text-sm text-gray-500">Pendentes</p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center mb-3">
              <DollarSign className="w-5 h-5 text-red-600" />
            </div>
            <p className="text-3xl font-bold text-red-600">{formatCurrency(data.summary.total_overdue)}</p>
            <p className="text-sm text-gray-500">Valor em atraso</p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center mb-3">
              <TrendingDown className="w-5 h-5 text-red-600" />
            </div>
            <p className="text-3xl font-bold text-red-600">{data.summary.inadimplencia_rate}%</p>
            <p className="text-sm text-gray-500">Taxa de inadimplência</p>
          </div>
        </div>

        {/* Tabela por Curso */}
        <div className={`bg-white rounded-2xl border border-gray-100 p-6 transition-all duration-700 ease-out ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`} style={{ transitionDelay: '200ms' }}>
          <h3 className="font-semibold text-[#27273D] mb-4">Inadimplência por Curso</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 uppercase border-b border-gray-100">
                  <th className="px-3 py-3">Curso</th>
                  <th className="px-3 py-3 text-center">Alunos</th>
                  <th className="px-3 py-3 text-center">Inadimpl.</th>
                  <th className="px-3 py-3 text-center">Taxa</th>
                  <th className="px-3 py-3 text-right">Valor Vencido</th>
                  <th className="px-3 py-3 text-right">Maior Dívida</th>
                  <th className="px-3 py-3 w-32">Risco</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.courses.map((course, idx) => {
                  const riskColor = course.inadimplencia_rate >= 25 ? 'bg-red-500'
                    : course.inadimplencia_rate >= 15 ? 'bg-amber-500' : 'bg-emerald-500';
                  const riskLabel = course.inadimplencia_rate >= 25 ? 'Crítico'
                    : course.inadimplencia_rate >= 15 ? 'Alerta' : 'Saudável';
                  const riskTextColor = course.inadimplencia_rate >= 25 ? 'text-red-700'
                    : course.inadimplencia_rate >= 15 ? 'text-amber-700' : 'text-emerald-700';
                  const riskBg = course.inadimplencia_rate >= 25 ? 'bg-red-50'
                    : course.inadimplencia_rate >= 15 ? 'bg-amber-50' : 'bg-emerald-50';

                  return (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-3 py-3">
                        <p className="font-medium text-gray-800 line-clamp-1 max-w-xs" title={course.course}>
                          {course.course}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-center font-semibold">{course.total}</td>
                      <td className="px-3 py-3 text-center font-semibold text-red-600">{course.inadimplentes}</td>
                      <td className="px-3 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${riskBg} ${riskTextColor}`}>
                          {course.inadimplencia_rate}%
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-red-600">
                        {course.total_overdue > 0 ? formatCurrency(course.total_overdue) : '-'}
                      </td>
                      <td className="px-3 py-3 text-right text-gray-600">
                        {course.max_overdue > 0 ? formatCurrency(course.max_overdue) : '-'}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full ${riskColor} rounded-full`} style={{ width: `${Math.min(course.inadimplencia_rate, 100)}%` }} />
                          </div>
                          <span className={`text-xs font-medium ${riskTextColor}`}>{riskLabel}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Devedores */}
        <div className={`bg-white rounded-2xl border border-gray-100 p-6 transition-all duration-700 ease-out ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`} style={{ transitionDelay: '300ms' }}>
          <h3 className="font-semibold text-[#27273D] mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Top 10 — Maiores Valores em Atraso
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 uppercase border-b border-gray-100">
                  <th className="px-3 py-3">#</th>
                  <th className="px-3 py-3">Aluno</th>
                  <th className="px-3 py-3">Curso</th>
                  <th className="px-3 py-3">Contato</th>
                  <th className="px-3 py-3 text-right">Valor em Atraso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.top_debtors.map((debtor, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                        idx < 3 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {idx + 1}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-gray-800">{debtor.name}</p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-gray-600 line-clamp-1 max-w-xs" title={debtor.course}>
                        {debtor.course}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        {debtor.phone && (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Phone className="w-3 h-3" />
                            {debtor.phone}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Mail className="w-3 h-3" />
                          {debtor.email}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="font-bold text-red-600 text-base">
                        {formatCurrency(debtor.overdue_value)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}