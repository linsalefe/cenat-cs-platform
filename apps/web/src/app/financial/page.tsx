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
  Filter,
  Eye,
  X,
  Loader2,
  FileText,
  TrendingDown,
  Users,
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
  CHARGEBACK_REQUESTED: { label: 'Chargeback', color: 'text-red-700', bg: 'bg-red-50' },
  CHARGEBACK_DISPUTE: { label: 'Disputa', color: 'text-red-700', bg: 'bg-red-50' },
  AWAITING_CHARGEBACK_REVERSAL: { label: 'Aguardando reversão', color: 'text-amber-700', bg: 'bg-amber-50' },
  DUNNING_REQUESTED: { label: 'Negativado', color: 'text-red-700', bg: 'bg-red-50' },
  DUNNING_RECEIVED: { label: 'Recuperado', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  AWAITING_RISK_ANALYSIS: { label: 'Análise de risco', color: 'text-amber-700', bg: 'bg-amber-50' },
};

const billingTypeLabels: Record<string, string> = {
  BOLETO: 'Boleto',
  CREDIT_CARD: 'Cartão',
  PIX: 'PIX',
  UNDEFINED: '-',
};

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

  // Modal de cobranças
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [financialSummary, setFinancialSummary] = useState<any>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (!authLoading && !user) router.push('/login'); }, [user, authLoading, router]);
  useEffect(() => { if (user) loadStudents(); }, [user]);
  useEffect(() => { setCurrentPage(1); }, [search, filter]);

  const loadStudents = async () => {
    try {
      setLoading(true);
      const res = await api.get('/students?limit=5000');
      // Garante que é array
      const data = Array.isArray(res.data) ? res.data : (res.data.data || []);
      setStudents(data);
    } catch (error) {
      console.error('Erro ao carregar alunos:', error);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncCustomers = async () => {
    setSyncing(true);
    try {
      const res = await api.post('/asaas/sync-customers');
      toast.success(`${res.data.matched} alunos vinculados ao ASAAS`);
      await loadStudents();
    } catch (error) {
      toast.error('Erro ao sincronizar clientes');
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncFinancial = async () => {
    setSyncingFinancial(true);
    try {
      const res = await api.post('/asaas/sync-financial');
      toast.success(`${res.data.updated} alunos atualizados`);
      await loadStudents();
    } catch (error) {
      toast.error('Erro ao sincronizar financeiro');
    } finally {
      setSyncingFinancial(false);
    }
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
    } catch (error) {
      toast.error('Erro ao carregar cobranças');
    } finally {
      setLoadingPayments(false);
    }
  };

  const closeModal = () => {
    setSelectedStudent(null);
    setPayments([]);
    setFinancialSummary(null);
  };

  // Safe checks
  const safeStudents = Array.isArray(students) ? students : [];

  // --- CORREÇÃO SOLICITADA ---
  // Troca filtro por financial_status já que asaas_customer_id não vem na API de listagem
  const linkedStudents = safeStudents.filter((s) => s.financial_status);
  
  const emDia = linkedStudents.filter((s) => s.financial_status === 'em_dia').length;
  const pendente = linkedStudents.filter((s) => s.financial_status === 'pendente').length;
  const inadimplente = linkedStudents.filter((s) => s.financial_status === 'inadimplente').length;
  
  // --- CORREÇÃO SOLICITADA ---
  const semVinculo = safeStudents.filter((s) => !s.financial_status).length;
  
  const totalOverdue = linkedStudents.reduce((acc, s) => acc + (s.overdue_value || 0), 0);

  const filteredStudents = safeStudents.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      (s.cpf && s.cpf.includes(search));

    if (filter === 'em_dia') return matchesSearch && s.financial_status === 'em_dia';
    if (filter === 'pendente') return matchesSearch && s.financial_status === 'pendente';
    if (filter === 'inadimplente') return matchesSearch && s.financial_status === 'inadimplente';
    
    // Atualizado filtro da tabela para manter consistência com o card de estatística
    if (filter === 'sem_vinculo') return matchesSearch && !s.financial_status;
    
    return matchesSearch;
  });

  const totalPages = Math.ceil(filteredStudents.length / PER_PAGE);
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * PER_PAGE,
    currentPage * PER_PAGE
  );

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const formatCPF = (cpf: string) => {
    if (!cpf || cpf.length !== 11) return cpf;
    return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
  };

  const formatDate = (date: string) => {
    if (!date) return '-';
    return new Date(date + 'T00:00:00').toLocaleDateString('pt-BR');
  };

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  const getAvatarColor = (name: string) => {
    const colors = [
      'from-blue-500 to-blue-600',
      'from-purple-500 to-purple-600',
      'from-green-500 to-green-600',
      'from-orange-500 to-orange-600',
      'from-pink-500 to-pink-600',
      'from-cyan-500 to-cyan-600',
      'from-indigo-500 to-indigo-600',
    ];
    return colors[name.charCodeAt(0) % colors.length];
  };

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-100 rounded-lg w-48"></div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 bg-gray-100 rounded-2xl"></div>
            ))}
          </div>
          <div className="h-96 bg-gray-100 rounded-2xl"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div
          className={`flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
          }`}
        >
          <div>
            <p className="text-sm font-medium text-[#2A658F] mb-1">Gestão Financeira</p>
            <h1 className="text-3xl font-semibold text-[#27273D] tracking-tight">Financeiro</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncCustomers}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700
                bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all
                disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Vinculando...' : 'Vincular Alunos'}
            </button>
            <button
              onClick={handleSyncFinancial}
              disabled={syncingFinancial}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white
                bg-gradient-to-r from-[#2A658F] to-[#3d7ba8] rounded-xl
                hover:shadow-lg hover:shadow-[#2A658F]/30 hover:-translate-y-0.5
                transition-all duration-200 disabled:opacity-50"
            >
              <DollarSign className={`w-4 h-4 ${syncingFinancial ? 'animate-pulse' : ''}`} />
              {syncingFinancial ? 'Atualizando...' : 'Atualizar Financeiro'}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div
          className={`grid grid-cols-2 lg:grid-cols-5 gap-4 transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '100ms' }}
        >
          <button
            onClick={() => setFilter('em_dia')}
            className={`group bg-white rounded-2xl p-5 border transition-all hover:shadow-md text-left ${
              filter === 'em_dia' ? 'ring-2 ring-emerald-500 border-emerald-200' : 'border-gray-100'
            }`}
          >
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center mb-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-2xl font-semibold text-[#27273D]">{emDia}</p>
            <p className="text-sm text-gray-500">Em dia</p>
          </button>

          <button
            onClick={() => setFilter('pendente')}
            className={`group bg-white rounded-2xl p-5 border transition-all hover:shadow-md text-left ${
              filter === 'pendente' ? 'ring-2 ring-amber-500 border-amber-200' : 'border-gray-100'
            }`}
          >
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center mb-2">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <p className="text-2xl font-semibold text-[#27273D]">{pendente}</p>
            <p className="text-sm text-gray-500">Pendentes</p>
          </button>

          <button
            onClick={() => setFilter('inadimplente')}
            className={`group bg-white rounded-2xl p-5 border transition-all hover:shadow-md text-left ${
              filter === 'inadimplente' ? 'ring-2 ring-red-500 border-red-200' : 'border-gray-100'
            }`}
          >
            <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center mb-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <p className="text-2xl font-semibold text-[#27273D]">{inadimplente}</p>
            <p className="text-sm text-gray-500">Inadimplentes</p>
          </button>

          <button
            onClick={() => setFilter('inadimplente')}
            className={`group bg-white rounded-2xl p-5 border border-gray-100 transition-all hover:shadow-md text-left`}
          >
            <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center mb-2">
              <TrendingDown className="w-5 h-5 text-red-600" />
            </div>
            <p className="text-2xl font-semibold text-red-600">{formatCurrency(totalOverdue)}</p>
            <p className="text-sm text-gray-500">Valor em atraso</p>
          </button>

          <button
            onClick={() => setFilter('sem_vinculo')}
            className={`group bg-white rounded-2xl p-5 border transition-all hover:shadow-md text-left ${
              filter === 'sem_vinculo' ? 'ring-2 ring-gray-400 border-gray-300' : 'border-gray-100'
            }`}
          >
            <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center mb-2">
              <Users className="w-5 h-5 text-gray-500" />
            </div>
            <p className="text-2xl font-semibold text-[#27273D]">{semVinculo}</p>
            <p className="text-sm text-gray-500">Sem vínculo</p>
          </button>
        </div>

        {/* Search + Filter info */}
        <div
          className={`flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '200ms' }}
        >
          <div className="relative w-full max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome, email ou CPF..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm
                focus:border-[#2A658F] focus:ring-4 focus:ring-[#2A658F]/10
                transition-all duration-200 outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <XCircle className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {filter !== 'all' && (
              <button
                onClick={() => setFilter('all')}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
              >
                Limpar filtro
                <X className="w-3 h-3" />
              </button>
            )}
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Filter className="w-4 h-4" />
              <span>{filteredStudents.length} alunos</span>
            </div>
          </div>
        </div>

        {/* Table */}
        <div
          className={`bg-white rounded-2xl border border-gray-100 overflow-hidden transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '300ms' }}
        >
          {paginatedStudents.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <DollarSign className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Nenhum aluno encontrado</h3>
              <p className="text-gray-500">Tente outro filtro ou busca</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50/80">
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Aluno</th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">CPF</th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Telefone</th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Valor em atraso</th>
                    <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paginatedStudents.map((student) => {
                    const st = student.financial_status
                      ? statusConfig[student.financial_status]
                      : null;
                    const StIcon = st?.icon || Users;

                    return (
                      <tr key={student.id} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-full bg-gradient-to-br ${getAvatarColor(student.name)}
                                flex items-center justify-center text-white font-semibold text-xs
                                shadow-sm group-hover:scale-105 transition-transform`}
                            >
                              {getInitials(student.name)}
                            </div>
                            <div>
                              <p className="font-medium text-[#27273D] text-sm">{student.name}</p>
                              <p className="text-xs text-gray-400">{student.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3.5 text-sm text-gray-600">
                          {student.cpf ? formatCPF(student.cpf) : '-'}
                        </td>
                        <td className="px-6 py-3.5 text-sm text-gray-600">
                          {student.phone || '-'}
                        </td>
                        <td className="px-6 py-3.5">
                          {st ? (
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${st.bg} ${st.color} border ${st.border}`}
                            >
                              <StIcon className="w-3 h-3" />
                              {st.label}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">Sem vínculo</span>
                          )}
                        </td>
                        <td className="px-6 py-3.5">
                          {student.overdue_value && student.overdue_value > 0 ? (
                            <span className="text-sm font-medium text-red-600">
                              {formatCurrency(student.overdue_value)}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          {/* Atualizado para checar status financeiro também, garantindo que o botão apareça */}
                          {(student.asaas_customer_id || student.financial_status) && (
                            <button
                              onClick={() => handleViewPayments(student)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#2A658F]
                                hover:bg-[#2A658F]/10 rounded-lg transition-colors"
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
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between bg-white rounded-xl border border-gray-100 p-4">
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

      {/* Modal de Cobranças */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div
            className="bg-white rounded-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#27273D]">{selectedStudent.name}</h2>
                <p className="text-sm text-gray-500">{selectedStudent.email}</p>
              </div>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Financial Summary */}
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

            {/* Payments List */}
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
                      const ps = paymentStatusLabels[payment.status] || {
                        label: payment.status,
                        color: 'text-gray-600',
                        bg: 'bg-gray-100',
                      };
                      return (
                        <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-3 text-sm text-gray-700">{formatDate(payment.dueDate)}</td>
                          <td className="px-6 py-3 text-sm font-medium text-[#27273D]">
                            {formatCurrency(payment.value)}
                          </td>
                          <td className="px-6 py-3 text-sm text-gray-600">
                            {billingTypeLabels[payment.billingType] || payment.billingType}
                          </td>
                          <td className="px-6 py-3">
                            <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ${ps.bg} ${ps.color}`}>
                              {ps.label}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-sm text-gray-500">
                            {payment.paymentDate ? formatDate(payment.paymentDate) : '-'}
                          </td>
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