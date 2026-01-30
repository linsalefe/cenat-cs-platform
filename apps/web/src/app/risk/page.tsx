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
  Mail,
  Shield,
  Activity,
  Ticket,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

interface RiskSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
}

interface StudentAtRisk {
  student_id: number;
  student_name: string;
  student_email: string;
  student_phone?: string | null;
  score: number;
  level: string;
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

export default function RiskDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [summary, setSummary] = useState<RiskSummary | null>(null);
  const [students, setStudents] = useState<StudentAtRisk[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<string>('high');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [creatingTicketFor, setCreatingTicketFor] = useState<number | null>(null);

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
      loadSummary();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadStudents();
    }
  }, [user, selectedLevel, currentPage]);

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
      const res = await api.get(`/risk/students/at-risk?level=${selectedLevel}&page=${currentPage}&per_page=30`);
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
        message: `Aluno identificado em risco de evasão.\n\nScore: ${student.score}\nFatores: ${student.factors.join(', ')}`,
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
          <div className="h-8 bg-gray-100 rounded-lg w-48"></div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 bg-gray-100 rounded-2xl"></div>
            ))}
          </div>
          <div className="h-12 bg-gray-100 rounded-xl"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-100 rounded-xl"></div>
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
            <p className="text-sm font-medium text-[#2A658F] mb-1">Gestão</p>
            <h1 className="text-3xl font-semibold text-[#27273D] tracking-tight">Risco de Evasão</h1>
          </div>

          {atRiskTotal > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-orange-50 border border-orange-200 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
              <span className="text-sm font-medium text-orange-700">
                {atRiskTotal} aluno(s) precisam de atenção
              </span>
            </div>
          )}
        </div>

        {/* Stats */}
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
                onClick={() => {
                  setSelectedLevel(item.key);
                  setCurrentPage(1);
                }}
                className={`bg-white rounded-2xl p-5 border transition-all duration-300 text-left
                  ${isSelected ? `${config.border} shadow-lg` : 'border-gray-100 hover:border-gray-200'}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-10 h-10 ${config.bg} rounded-xl flex items-center justify-center`}>
                    <item.icon className={`w-5 h-5 ${config.color}`} />
                  </div>
                  {isSelected && <div className={`w-2 h-2 ${config.bar} rounded-full`} />}
                </div>
                <p className="text-2xl font-semibold text-[#27273D]">{count}</p>
                <p className="text-sm text-gray-500">{config.label}</p>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div
          className={`transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '200ms' }}
        >
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl
                focus:border-[#2A658F] focus:ring-4 focus:ring-[#2A658F]/10 
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
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Nenhum aluno encontrado</h3>
              <p className="text-gray-500">Tente ajustar os filtros</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((student) => {
                const config = levelConfig[student.level] || levelConfig.medium;
                const isCreating = creatingTicketFor === student.student_id;

                return (
                  <div
                    key={student.student_id}
                    onClick={() => router.push(`/risk/${student.student_id}`)}
                    className="group bg-white rounded-xl border border-gray-100 p-5
                      hover:border-gray-200 hover:shadow-lg hover:shadow-gray-100/50
                      transition-all duration-300 cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <Avatar name={student.student_name} size="md" />
                        <div className={`absolute -bottom-1 -right-1 w-4 h-4 ${config.bar} rounded-full border-2 border-white`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-medium text-[#27273D] group-hover:text-[#2A658F] transition-colors truncate">
                            {student.student_name}
                          </h3>
                          <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${config.bg} ${config.color}`}>
                            {config.label}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 truncate">{student.student_email}</p>
                      </div>

                      {/* Score */}
                      <div className="hidden sm:block w-32">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-500">Score</span>
                          <span className="font-semibold text-[#27273D]">{student.score.toFixed(1)}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${config.bar} rounded-full transition-all duration-500`}
                            style={{ width: `${student.score}%` }}
                          />
                        </div>
                      </div>

                      {/* Factors */}
                      <div className="hidden md:flex items-center gap-1 max-w-[200px]">
                        {student.factors.slice(0, 2).map((f, i) => (
                          <span
                            key={i}
                            className="px-2 py-1 bg-gray-50 border border-gray-100 text-gray-600 text-[10px] uppercase rounded truncate"
                          >
                            {f}
                          </span>
                        ))}
                        {student.factors.length > 2 && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-500 text-[10px] rounded">
                            +{student.factors.length - 2}
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => createTicket(e, student)}
                          disabled={isCreating}
                          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium
                            border border-gray-200 text-gray-600 rounded-lg
                            hover:border-[#2A658F] hover:text-[#2A658F] hover:bg-[#E2ECF4]
                            transition-all disabled:opacity-50"
                        >
                          <Ticket className="w-3.5 h-3.5" />
                          {isCreating ? '...' : 'Ticket'}
                        </button>

                        <a
                          href={`mailto:${student.student_email}`}
                          className="p-2 text-gray-400 hover:text-[#2A658F] hover:bg-[#E2ECF4] rounded-lg transition-all"
                        >
                          <Mail className="w-4 h-4" />
                        </a>
                      </div>

                      <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-[#2A658F] group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination && pagination.total_pages > 1 && (
          <div
            className={`flex items-center justify-between bg-white rounded-xl border border-gray-100 p-4
              transition-all duration-700 ease-out ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
            style={{ transitionDelay: '400ms' }}
          >
            <p className="text-sm text-gray-500">
              Mostrando {(pagination.page - 1) * pagination.per_page + 1} -{' '}
              {Math.min(pagination.page * pagination.per_page, pagination.total)} de {pagination.total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-600
                  border border-gray-200 rounded-lg hover:bg-gray-50
                  disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </button>
              <span className="px-3 py-2 text-sm text-gray-600">
                {pagination.page} / {pagination.total_pages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(pagination.total_pages, p + 1))}
                disabled={currentPage === pagination.total_pages}
                className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-600
                  border border-gray-200 rounded-lg hover:bg-gray-50
                  disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Próximo
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}