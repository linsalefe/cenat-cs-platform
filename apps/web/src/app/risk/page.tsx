'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import AppLayout from '@/components/AppLayout';
import LoadingState from '@/components/LoadingState';
import EmptyState from '@/components/EmptyState';

import { useAuth } from '@/contexts/auth-context';
import api from '@/lib/api';

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

const levelLabel: Record<string, string> = {
  critical: 'Crítico',
  high: 'Alto',
  medium: 'Médio',
  low: 'Baixo',
};

const levelColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-green-100 text-green-800',
};

const levelBar: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-amber-500',
  low: 'bg-green-500',
};

function normalizePhoneToWa(phone?: string | null) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('55')) return digits;
  return `55${digits}`;
}

export default function RiskDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [summary, setSummary] = useState<RiskSummary | null>(null);
  const [students, setStudents] = useState<StudentAtRisk[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<string>('high');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [creatingTicketFor, setCreatingTicketFor] = useState<number | null>(null);

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
      setError(false);
      const res = await api.get(`/risk/students/at-risk?level=${selectedLevel}&page=${currentPage}&per_page=30`);
      setStudents(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) {
      console.error('Erro ao carregar alunos:', err);
      setError(true);
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
        subject: `Acompanhamento - Risco ${levelLabel[student.level]}`,
        message: `Aluno identificado em risco de evasão.\n\nScore: ${student.score}\nFatores: ${student.factors.join(', ')}`,
      });
      toast.success('Ticket criado com sucesso!');
    } catch (err) {
      toast.error('Erro ao criar ticket');
    } finally {
      setCreatingTicketFor(null);
    }
  };

  // Filtro local por busca
  const filtered = useMemo(() => {
    if (!searchTerm) return students;
    const term = searchTerm.toLowerCase();
    return students.filter(
      (s) =>
        s.student_name.toLowerCase().includes(term) ||
        s.student_email.toLowerCase().includes(term)
    );
  }, [students, searchTerm]);

  if (authLoading) {
    return (
      <AppLayout>
        <LoadingState message="Carregando..." />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-[#27273D]">Gestão de Risco</h1>
          <p className="text-gray-500 text-sm">Monitore alunos em risco de evasão</p>
        </div>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { key: 'critical', label: 'Crítico', color: 'border-red-500', textColor: 'text-red-600' },
            { key: 'high', label: 'Alto', color: 'border-orange-500', textColor: 'text-orange-600' },
            { key: 'medium', label: 'Médio', color: 'border-amber-500', textColor: 'text-amber-600' },
            { key: 'low', label: 'Baixo', color: 'border-green-500', textColor: 'text-green-600' },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => { setSelectedLevel(item.key); setCurrentPage(1); }}
              className={`bg-white rounded-xl shadow-sm p-4 border-l-4 ${item.color} text-left transition-all ${
                selectedLevel === item.key ? 'ring-2 ring-[#2A658F]' : 'hover:shadow-md'
              }`}
            >
              <p className="text-sm text-gray-500">{item.label}</p>
              <p className={`text-3xl font-bold ${item.textColor}`}>
                {summary?.[item.key as keyof RiskSummary] || 0}
              </p>
            </button>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex flex-col md:flex-row gap-4">
          <input
            type="text"
            placeholder="Buscar por nome ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#2A658F] focus:border-[#2A658F]"
          />
        </div>

        {/* Lista de Alunos */}
        {loading ? (
          <LoadingState message="Carregando alunos..." />
        ) : error ? (
          <div className="py-20 text-center bg-white rounded-xl">
            <EmptyState title="Erro ao carregar dados" description="Não foi possível recuperar os dados de risco." />
            <button onClick={loadStudents} className="mt-4 text-[#2A658F] font-medium hover:underline">
              Tentar novamente
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-10 bg-white rounded-xl">
            <EmptyState title="Nenhum aluno encontrado" description="Tente ajustar os filtros para ver mais resultados." />
          </div>
        ) : (
          <>
            {/* Tabela Desktop */}
            <div className="hidden md:block overflow-x-auto bg-white rounded-xl shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-[#CCE4F4]">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-[#27273D] uppercase tracking-wider">Aluno</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-[#27273D] uppercase tracking-wider">Score</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-[#27273D] uppercase tracking-wider">Nível</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-[#27273D] uppercase tracking-wider">Fatores</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-[#27273D] uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filtered.map((s) => {
                    const wa = normalizePhoneToWa(s.student_phone);
                    const isCreating = creatingTicketFor === s.student_id;

                    return (
                      <tr
                        key={s.student_id}
                        className="hover:bg-[#E2ECF4] cursor-pointer transition-colors"
                        onClick={() => router.push(`/risk/${s.student_id}`)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className={`w-1 h-8 rounded-full mr-3 ${levelBar[s.level]}`}></div>
                            <div>
                              <p className="text-sm font-medium text-[#27273D]">{s.student_name}</p>
                              <p className="text-xs text-gray-500">{s.student_email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="w-24">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="font-bold text-[#27273D]">{s.score.toFixed(1)}</span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className={`h-full ${levelBar[s.level]}`} style={{ width: `${s.score}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${levelColors[s.level]}`}>
                            {levelLabel[s.level]}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {s.factors.slice(0, 2).map((f, i) => (
                              <span key={i} className="px-2 py-0.5 bg-gray-50 border border-gray-100 text-gray-600 text-[10px] uppercase rounded">
                                {f}
                              </span>
                            ))}
                            {s.factors.length > 2 && (
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] rounded">
                                +{s.factors.length - 2}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={(e) => createTicket(e, s)}
                              disabled={isCreating}
                              className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${
                                isCreating
                                  ? 'bg-gray-100 text-gray-400 border-gray-100'
                                  : 'border-[#2A658F] text-[#2A658F] hover:bg-[#2A658F] hover:text-white'
                              }`}
                            >
                              {isCreating ? '...' : 'Ticket'}
                            </button>
                            
                            <a
                              href={`mailto:${s.student_email}`}
                              className="p-1.5 text-gray-400 hover:text-[#27273D] hover:bg-gray-100 rounded-full"
                            >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                            </a>
                            {wa && (
                              <a
                                href={`https://wa.me/${wa}`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 text-green-600 hover:bg-green-50 rounded-full"
                              >
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                </svg>
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Cards Mobile */}
            <div className="md:hidden space-y-3">
              {filtered.map((s) => {
                const wa = normalizePhoneToWa(s.student_phone);
                const isCreating = creatingTicketFor === s.student_id;

                return (
                  <div
                    key={s.student_id}
                    onClick={() => router.push(`/risk/${s.student_id}`)}
                    className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 cursor-pointer"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold text-[#27273D] text-sm">{s.student_name}</h3>
                        <p className="text-xs text-gray-500">{s.student_email}</p>
                      </div>
                      <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded-full ${levelColors[s.level]}`}>
                        {levelLabel[s.level]}
                      </span>
                    </div>
                    <div className="mb-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500">Score</span>
                        <span className="font-bold">{s.score.toFixed(1)}</span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${levelBar[s.level]}`} style={{ width: `${s.score}%` }} />
                      </div>
                    </div>
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => createTicket(e, s)}
                        disabled={isCreating}
                        className="flex-1 py-2 border border-[#2A658F] text-[#2A658F] rounded-lg text-xs font-medium"
                      >
                        {isCreating ? '...' : 'Criar Ticket'}
                      </button>
                      {wa && (
                        <a
                          href={`https://wa.me/${wa}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-4 py-2 bg-green-50 text-green-600 rounded-lg"
                        >
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                          </svg>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Paginação */}
            {pagination && pagination.total_pages > 1 && (
              <div className="flex items-center justify-between bg-white rounded-xl shadow-sm p-4">
                <p className="text-sm text-gray-500">
                  Mostrando {((pagination.page - 1) * pagination.per_page) + 1} - {Math.min(pagination.page * pagination.per_page, pagination.total)} de {pagination.total}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Anterior
                  </button>
                  <span className="px-4 py-2 text-sm text-gray-600">
                    {pagination.page} / {pagination.total_pages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(pagination.total_pages, p + 1))}
                    disabled={currentPage === pagination.total_pages}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Próximo
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}