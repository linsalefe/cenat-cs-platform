'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { toast } from 'sonner';
import {
  DollarSign,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Eye,
  X,
  Loader2,
  FileText,
  TrendingDown,
  Users,
  ArrowDownCircle,
  ArrowUpCircle,
  CreditCard,
} from 'lucide-react';

interface Student {
  id: number;
  name: string;
  email: string;
  phone: string;
  cpf: string | null;
  asaas_customer_id: string | null;
  financial_status: string | null;
  overdue_value: number | null;
}

interface Payment {
  id: string;
  value: number;
  netValue: number;
  status: string;
  dueDate: string;
  paymentDate: string | null;
  billingType: string;
  description: string | null;
  invoiceUrl: string | null;
}

interface Summary {
  period: string;
  start_date: string;
  end_date: string;
  students: {
    em_dia: number;
    pendente: number;
    inadimplente: number;
    sem_vinculo: number;
    total_overdue: number;
  };
  payments: {
    received: { count: number; value: number };
    confirmed: { count: number; value: number };
    pending: { count: number; value: number };
    overdue: { count: number; value: number };
  };
}

const statusConfig: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
  em_dia: { label: 'Em dia', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: CheckCircle2 },
  pendente: { label: 'Pendente', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: Clock },
  inadimplente: { label: 'Inadimplente', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', icon: AlertTriangle },
};

const paymentStatusLabels: Record<string, { label: string; color: string; bg: string }> = {
  RECEIVED: { label: 'Pago', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  CONFIRMED: { label: 'Confirmado', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  RECEIVED_IN_CASH: { label: 'Pago em dinheiro', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  PENDING: { label: 'Pendente', color: 'text-amber-700', bg: 'bg-amber-50' },
  OVERDUE: { label: 'Vencido', color: 'text-red-700', bg: 'bg-red-50' },
  REFUNDED: { label: 'Estornado', color: 'text-gray-700', bg: 'bg-gray-100' },
  REFUND_REQUESTED: { label: 'Estorno solicitado', color: 'text-gray-700', bg: 'bg-gray-100' },
  DUNNING_REQUESTED: { label: 'Negativado', color: 'text-red-700', bg: 'bg-red-50' },
  DUNNING_RECEIVED: { label: 'Recuperado', color: 'text-emerald-700', bg: 'bg-emerald-50' },
};

const billingTypeLabels: Record<string, string> = {
  BOLETO: 'Boleto',
  CREDIT_CARD: 'Cartão',
  PIX: 'PIX',
  UNDEFINED: '-',
};

const periods = [
  { key: 'today', label: 'Hoje' },
  { key: '7d', label: '7 dias' },
  { key: 'month', label: 'Este mês' },
  { key: '30d', label: '30 dias' },
];

const PER_PAGE = 30;

export default function FinancialPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncingFinancial, setSyncingFinancial] = useState(false);
  const [search, setSearch] = useState('');
  const [mounted, setMounted] = useState(false);
  const [filter, setFilter] = useState<'all' | 'em_dia' | 'pendente' | 'inadimplente' | 'sem_vinculo'>('all');
  const [currentPage, setCurrentPage] = useState(1);

  // Summary
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [period, setPeriod] = useState('month');

  // Modal
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [financialSummary, setFinancialSummary] = useState<any>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (!authLoading && !user) router.push('/login'); }, [user, authLoading, router]);
  useEffect(() => { if (user) { loadStudents(); } }, [user]);
  useEffect(() => { if (user) loadSummary(); }, [user, period]);
  useEffect(() => { setCurrentPage(1); }, [search, filter]);

  const loadStudents = async () => {
    try {
      setLoading(true);
      const res = await api.get('/students?limit=5000');
      const data = Array.isArray(res.data) ? res.data : (res.data.data || []);
      setStudents(data);
    } catch { setStudents([]); }
    finally { setLoading(false); }
  };

  const loadSummary = async () => {
    setLoadingSummary(true);
    try {
      const res = await api.get(`/asaas/summary?period=${period}`);
      setSummary(res.data);
    } catch { }
    finally { setLoadingSummary(false); }
  };

  const handleSyncCustomers = async () => {
    setSyncing(true);
    try {
      const res = await api.post('/asaas/sync-customers');
      toast.success(`${res.data.matched} alunos vinculados ao ASAAS`);
      await loadStudents();
      await loadSummary();
    } catch { toast.error('Erro ao sincronizar'); }
    finally { setSyncing(false); }
  };

  const handleSyncFinancial = async () => {
    setSyncingFinancial(true);
    try {
      await api.post('/asaas/sync-financial');
      toast.success('Sync financeiro iniciado! Aguarde alguns minutos.');
      setTimeout(() => { loadStudents(); loadSummary(); }, 10000);
    } catch { toast.error('Erro ao sincronizar'); }
    finally { setSyncingFinancial(false); }
  };

  const handleViewPayments = async (student: Student) => {
    setSelectedStudent(student);
    setLoadingPayments(true);
    setPayments([]);
    setFinancialSummary(null);
    try {
      const res = await api.get(`/asaas/student/${student.id}/payments`);
      setPayments(res.data.payments || []);
      setFinancialSummary(res.data.financial || null);
    } catch { toast.error('Erro ao carregar cobranças'); }
    finally { setLoadingPayments(false); }
  };

  const closeModal = () => { setSelectedStudent(null); setPayments([]); setFinancialSummary(null); };

  const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatDate = (d: string) => {
    const [y, m, day] = d.split('-');
    return day ? `${day}/${m}/${y}` : d;
  };
  const formatCPF = (c: string) => c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  const getInitials = (n: string) => n.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);

  const safeStudents = Array.isArray(students) ? students : [];

  const filteredStudents = safeStudents.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      (s.cpf && s.cpf.includes(search));
    const matchesFilter = filter === 'all' ||
      (filter === 'sem_vinculo' ? !s.financial_status : s.financial_status === filter);
    return matchesSearch && matchesFilter;
  });

  const totalPages = Math.ceil(filteredStudents.length / PER_PAGE);
  const paginatedStudents = filteredStudents.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-100 rounded-lg w-48" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-40 bg-gray-100 rounded-2xl" />)}
          </div>
          <div className="h-96 bg-gray-100 rounded-2xl" />
        </div>
      </AppLayout>
    );
  }

  const p = summary?.payments;
  const s = summary?.students;

  return (
    <AppLayout>
      <div className={`space-y-6 transition-all duration-700 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[#2A658F] mb-1">Gestão Financeira</p>
            <h1 className="text-3xl font-semibold text-[#27273D] tracking-tight">Financeiro</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncCustomers}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[#2A658F] bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all disabled:opacity-50"
            >
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Vincular Alunos
            </button>
            <button
              onClick={handleSyncFinancial}
              disabled={syncingFinancial}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-[#2A658F] to-[#3d7ba8] rounded-xl hover:shadow-lg transition-all disabled:opacity-50"
            >
              {syncingFinancial ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
              Atualizar Financeiro
            </button>
          </div>
        </div>

        {/* Situação das Cobranças */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-[#27273D]">Situação das cobranças</h2>
            <div className="flex bg-gray-100 rounded-xl p-1">
              {periods.map((pr) => (
                <button
                  key={pr.key}
                  onClick={() => setPeriod(pr.key)}
                  className={`px-4 py-2 text-xs font-medium rounded-lg transition-all ${
                    period === pr.key
                      ? 'bg-white text-[#2A658F] shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {pr.label}
                </button>
              ))}
            </div>
          </div>

          {loadingSummary ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Recebidas */}
              <div className="border border-gray-200 rounded-xl p-5">
                <p className="text-sm font-medium text-gray-600 mb-3">Recebidas</p>
                <p className="text-2xl font-bold text-emerald-600 mb-1">
                  {formatCurrency(p?.received.value || 0)}
                </p>
                <div className="w-full h-2 bg-gray-100 rounded-full mt-3 mb-4">
                  <div className="h-2 bg-emerald-500 rounded-full" style={{ width: '100%' }} />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />{p?.received.count || 0} cobranças</span>
                  </div>
                </div>
              </div>

              {/* Confirmadas */}
              <div className="border border-gray-200 rounded-xl p-5">
                <p className="text-sm font-medium text-gray-600 mb-3">Confirmadas</p>
                <p className="text-2xl font-bold text-blue-600 mb-1">
                  {formatCurrency(p?.confirmed.value || 0)}
                </p>
                <div className="w-full h-2 bg-gray-100 rounded-full mt-3 mb-4">
                  <div className="h-2 bg-blue-500 rounded-full" style={{ width: '100%' }} />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />{p?.confirmed.count || 0} cobranças</span>
                  </div>
                </div>
              </div>

              {/* Aguardando */}
              <div className="border border-gray-200 rounded-xl p-5">
                <p className="text-sm font-medium text-gray-600 mb-3">Aguardando pagamento</p>
                <p className="text-2xl font-bold text-amber-600 mb-1">
                  {formatCurrency(p?.pending.value || 0)}
                </p>
                <div className="w-full h-2 bg-gray-100 rounded-full mt-3 mb-4">
                  <div className="h-2 bg-amber-500 rounded-full" style={{ width: '100%' }} />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />{p?.pending.count || 0} cobranças</span>
                  </div>
                </div>
              </div>

              {/* Vencidas */}
              <div className="border border-gray-200 rounded-xl p-5">
                <p className="text-sm font-medium text-gray-600 mb-3">Vencidas</p>
                <p className="text-2xl font-bold text-red-600 mb-1">
                  {formatCurrency(p?.overdue.value || 0)}
                </p>
                <div className="w-full h-2 bg-gray-100 rounded-full mt-3 mb-4">
                  <div className="h-2 bg-red-500 rounded-full" style={{ width: '100%' }} />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />{p?.overdue.count || 0} cobranças</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* KPIs Alunos */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: 'Em dia', value: s?.em_dia || 0, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CheckCircle2, filterKey: 'em_dia' as const },
            { label: 'Pendentes', value: s?.pendente || 0, color: 'text-amber-600', bg: 'bg-amber-50', icon: Clock, filterKey: 'pendente' as const },
            { label: 'Inadimplentes', value: s?.inadimplente || 0, color: 'text-red-600', bg: 'bg-red-50', icon: AlertTriangle, filterKey: 'inadimplente' as const },
            { label: 'Valor em atraso', value: formatCurrency(s?.total_overdue || 0), color: 'text-red-600', bg: 'bg-red-50', icon: TrendingDown, filterKey: null },
            { label: 'Sem vínculo', value: s?.sem_vinculo || 0, color: 'text-gray-600', bg: 'bg-gray-50', icon: Users, filterKey: 'sem_vinculo' as const },
          ].map((kpi, i) => {
            const Icon = kpi.icon;
            const isActive = kpi.filterKey && filter === kpi.filterKey;
            return (
              <button
                key={i}
                onClick={() => kpi.filterKey && setFilter(isActive ? 'all' : kpi.filterKey)}
                className={`bg-white rounded-xl p-4 border text-left transition-all ${
                  isActive ? 'border-[#2A658F] shadow-md' : 'border-gray-100 hover:border-gray-200'
                } ${kpi.filterKey ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <div className={`w-8 h-8 ${kpi.bg} rounded-lg flex items-center justify-center mb-2`}>
                  <Icon className={`w-4 h-4 ${kpi.color}`} />
                </div>
                <p className={`text-xl font-bold ${typeof kpi.value === 'string' && kpi.value.includes('R$') ? kpi.color : 'text-[#27273D]'}`}>
                  {kpi.value}
                </p>
                <p className="text-xs text-gray-500">{kpi.label}</p>
              </button>
            );
          })}
        </div>

        {/* Busca + Tabela */}
        <div className="bg-white rounded-2xl border border-gray-100">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nome, email ou CPF..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-[#2A658F] focus:ring-4 focus:ring-[#2A658F]/10 outline-none"
              />
            </div>
            <span className="text-sm text-gray-400 ml-4">{filteredStudents.length} alunos</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100">
                  <th className="px-5 py-3">Aluno</th>
                  <th className="px-5 py-3">CPF</th>
                  <th className="px-5 py-3">Telefone</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Valor em atraso</th>
                  <th className="px-5 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginatedStudents.map((student) => {
                  const st = statusConfig[student.financial_status || ''];
                  const StIcon = st?.icon;
                  return (
                    <tr key={student.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#2A658F] to-[#3d7ba8] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {getInitials(student.name)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-[#27273D]">{student.name}</p>
                            <p className="text-xs text-gray-400">{student.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-600">
                        {student.cpf ? formatCPF(student.cpf) : '-'}
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-600">{student.phone || '-'}</td>
                      <td className="px-5 py-3">
                        {st ? (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${st.bg} ${st.color} border ${st.border}`}>
                            <StIcon className="w-3 h-3" />
                            {st.label}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">Sem vínculo</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {student.overdue_value && student.overdue_value > 0 ? (
                          <span className="text-sm font-medium text-red-600">{formatCurrency(student.overdue_value)}</span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {(student.asaas_customer_id || student.financial_status) && (
                          <button
                            onClick={() => handleViewPayments(student)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#2A658F] hover:bg-[#2A658F]/10 rounded-lg transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Cobranças
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-gray-100">
              <p className="text-sm text-gray-500">
                {(currentPage - 1) * PER_PAGE + 1} - {Math.min(currentPage * PER_PAGE, filteredStudents.length)} de {filteredStudents.length}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1 px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium disabled:opacity-50 hover:bg-gray-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Anterior
                </button>
                <span className="px-3 py-2 text-xs text-gray-500">{currentPage} / {totalPages}</span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-1 px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium disabled:opacity-50 hover:bg-gray-50"
                >
                  Próximo
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Cobranças */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#27273D]">{selectedStudent.name}</h2>
                <p className="text-sm text-gray-500">{selectedStudent.email}</p>
              </div>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {financialSummary && (
              <div className="px-6 py-4 bg-gray-50 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Total cobranças</p>
                  <p className="text-lg font-semibold">{financialSummary.total_payments}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Pagas</p>
                  <p className="text-lg font-semibold text-emerald-600">{financialSummary.received_count}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Pendentes</p>
                  <p className="text-lg font-semibold text-amber-600">{financialSummary.pending_count}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Vencidas</p>
                  <p className="text-lg font-semibold text-red-600">
                    {financialSummary.overdue_count} ({formatCurrency(financialSummary.overdue_value)})
                  </p>
                </div>
              </div>
            )}

            <div className="overflow-y-auto max-h-[50vh]">
              {loadingPayments ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                </div>
              ) : payments.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Nenhuma cobrança encontrada</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <th className="px-6 py-3">Vencimento</th>
                      <th className="px-6 py-3">Valor</th>
                      <th className="px-6 py-3">Tipo</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3">Pagamento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {payments.map((payment) => {
                      const ps = paymentStatusLabels[payment.status] || { label: payment.status, color: 'text-gray-600', bg: 'bg-gray-100' };
                      return (
                        <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-3 text-sm text-gray-700">{formatDate(payment.dueDate)}</td>
                          <td className="px-6 py-3 text-sm font-medium text-[#27273D]">{formatCurrency(payment.value)}</td>
                          <td className="px-6 py-3 text-sm text-gray-600">{billingTypeLabels[payment.billingType] || payment.billingType}</td>
                          <td className="px-6 py-3">
                            <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ${ps.bg} ${ps.color}`}>
                              {ps.label}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-sm text-gray-500">{payment.paymentDate ? formatDate(payment.paymentDate) : '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}