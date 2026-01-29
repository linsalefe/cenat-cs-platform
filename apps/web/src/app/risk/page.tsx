'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import AppLayout from '@/components/AppLayout';
import LoadingState from '@/components/LoadingState';
import EmptyState from '@/components/EmptyState';

import { useAuth } from '@/contexts/auth-context';
import api from '@/lib/api';

// --- Interfaces ---
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

// --- Constantes Visuais ---
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

// Cores de fundo suave para estado ativo dos cards
const levelBgActive: Record<string, string> = {
  critical: 'bg-red-50',
  high: 'bg-orange-50',
  medium: 'bg-amber-50',
  low: 'bg-green-50',
};

const levelBar: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-amber-500',
  low: 'bg-green-500',
};

// --- Helpers ---
function normalizePhoneToWa(phone?: string | null) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('55')) return digits;
  return `55${digits}`;
}

function formatDateTimeBR(iso?: string | null) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function RiskDashboard() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [summary, setSummary] = useState<RiskSummary | null>(null);
  const [studentsAtRisk, setStudentsAtRisk] = useState<StudentAtRisk[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Filtros
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('');
  const [minScore, setMinScore] = useState<number>(0);
  const [sortBy, setSortBy] = useState<'score_desc' | 'score_asc' | 'name_asc'>('score_desc');

  // Ações
  const [creatingTicketFor, setCreatingTicketFor] = useState<number | null>(null);
  const [createTicketError, setCreateTicketError] = useState<string>('');

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (user) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadData = async () => {
    setLoadingData(true);
    setLoadError(false);
    try {
      const [summaryRes, studentsRes] = await Promise.all([
        api.get('/risk/summary'),
        api.get('/risk/students/at-risk'),
      ]);
      setSummary(summaryRes.data);
      setStudentsAtRisk(studentsRes.data);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setSummary(null);
      setStudentsAtRisk([]);
      setLoadError(true);
    } finally {
      setLoadingData(false);
    }
  };

  const handleRecalculateAll = async () => {
    try {
      setRecalculating(true);
      await api.post('/risk/calculate-all');
      await loadData();
    } catch (error) {
      console.error('Erro ao recalcular:', error);
    } finally {
      setRecalculating(false);
    }
  };

  const lastCalculatedAt = useMemo(() => {
    if (!studentsAtRisk?.length) return null;
    const max = studentsAtRisk.reduce((acc, s) => {
      const t = new Date(s.calculated_at).getTime();
      return t > acc ? t : acc;
    }, 0);
    return max ? new Date(max).toISOString() : null;
  }, [studentsAtRisk]);

  const filtered = useMemo(() => {
    let list = [...studentsAtRisk];
    const term = search.trim().toLowerCase();

    if (term) {
      list = list.filter((s) => {
        const name = (s.student_name || '').toLowerCase();
        const email = (s.student_email || '').toLowerCase();
        return name.includes(term) || email.includes(term);
      });
    }

    if (levelFilter) list = list.filter((s) => s.level === levelFilter);
    if (minScore > 0) list = list.filter((s) => (s.score ?? 0) >= minScore);

    if (sortBy === 'score_desc') list.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    if (sortBy === 'score_asc') list.sort((a, b) => (a.score ?? 0) - (b.score ?? 0));
    if (sortBy === 'name_asc') list.sort((a, b) => (a.student_name || '').localeCompare(b.student_name || ''));

    return list;
  }, [studentsAtRisk, search, levelFilter, minScore, sortBy]);

  const handleCardFilter = (lvl: string) => {
    setLevelFilter((prev) => (prev === lvl ? '' : lvl));
  };

  const clearFilters = () => {
    setSearch('');
    setLevelFilter('');
    setMinScore(0);
    setSortBy('score_desc');
  };

  const createTicket = async (e: React.MouseEvent, s: StudentAtRisk) => {
    e.stopPropagation(); // Evita navegar para detalhes
    setCreateTicketError('');
    setCreatingTicketFor(s.student_id);

    try {
      const payload = {
        student_id: s.student_id,
        category: 'academic',
        priority: 'medium',
        subject: `Ação proativa - risco ${levelLabel[s.level] ?? s.level} (score ${Math.round(s.score)}/100)`,
      };

      const res = await api.post('/tickets', payload);
      const ticketId = res?.data?.id;
      if (ticketId) {
        router.push(`/tickets/${ticketId}`);
        return;
      }
      router.push('/tickets');
    } catch (err: any) {
      console.error('Erro ao criar ticket:', err);
      setCreateTicketError('Falha ao criar ticket.');
    } finally {
      setCreatingTicketFor(null);
    }
  };

  if (loading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingState label="Carregando..." />
      </div>
    );
  }

  // Helper para renderizar card
  const RiskCard = ({ level, label, count, colorClass, borderClass }: any) => {
    const isActive = levelFilter === level;
    return (
      <button
        onClick={() => handleCardFilter(level)}
        type="button"
        className={`
          text-left p-6 rounded-xl shadow-sm border-l-4 transition-all duration-200 group
          ${borderClass} 
          ${isActive ? `${levelBgActive[level]} ring-2 ring-offset-2 ring-opacity-50 ring-gray-300` : 'bg-white hover:-translate-y-1 hover:shadow-md'}
        `}
      >
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-gray-500 uppercase">{label}</p>
            <p className="text-3xl font-bold text-gray-800 mt-2">{count}</p>
          </div>
          {/* Indicador visual de seleção */}
          {isActive && (
            <div className="h-2 w-2 rounded-full bg-gray-400"></div>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-1 group-hover:text-gray-600 transition-colors">alunos detectados</p>
      </button>
    );
  };

  return (
    <AppLayout>
      <div className="mb-6 flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#27273D]">Risco de Evasão</h1>
          <p className="text-gray-600 mt-1">Monitoramento preditivo de alunos</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <p className="text-xs text-gray-500">
              Última atualização da IA: <span className="font-medium text-[#27273D]">{formatDateTimeBR(lastCalculatedAt)}</span>
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => router.push('/tickets')}
            className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-[#27273D] hover:bg-gray-50 transition-colors flex items-center gap-2"
            type="button"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>
            Ver Tickets
          </button>

          <button
            onClick={handleRecalculateAll}
            disabled={recalculating}
            className="px-4 py-2 rounded-md bg-[#2A658F] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2 shadow-sm"
            type="button"
          >
            {recalculating ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path></svg>
                Processando...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Recalcular Score
              </>
            )}
          </button>
        </div>
      </div>

      {/* Cards interativos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <RiskCard level="critical" label="Crítico" count={summary?.critical ?? 0} borderClass="border-red-600" />
        <RiskCard level="high" label="Alto" count={summary?.high ?? 0} borderClass="border-orange-500" />
        <RiskCard level="medium" label="Médio" count={summary?.medium ?? 0} borderClass="border-amber-500" />
        <RiskCard level="low" label="Baixo" count={summary?.low ?? 0} borderClass="border-green-500" />
      </div>

      {/* Barra de Ferramentas Refatorada */}
      <div className="bg-white p-4 rounded-xl shadow-sm mb-6 flex flex-col lg:flex-row gap-4 lg:items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-[#27273D] mb-1">Buscar</label>
          <div className="relative">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nome ou e-mail..."
              className="w-full border border-gray-300 rounded-md pl-9 pr-3 py-2 text-sm focus:ring-[#2A658F] focus:border-[#2A658F]"
            />
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
          <div>
            <label className="block text-sm font-medium text-[#27273D] mb-1">Nível</label>
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-[#2A658F] focus:border-[#2A658F] bg-white"
            >
              <option value="">Todos</option>
              <option value="critical">Crítico</option>
              <option value="high">Alto</option>
              <option value="medium">Médio</option>
              <option value="low">Baixo</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#27273D] mb-1">Score Mín.</label>
            <input
              type="number"
              min={0}
              max={100}
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value || 0))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-[#2A658F] focus:border-[#2A658F]"
            />
          </div>

          <div className="col-span-2 md:col-span-1">
            <label className="block text-sm font-medium text-[#27273D] mb-1">Ordenar</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-[#2A658F] focus:border-[#2A658F] bg-white"
            >
              <option value="score_desc">Maior Risco</option>
              <option value="score_asc">Menor Risco</option>
              <option value="name_asc">A - Z</option>
            </select>
          </div>

          <div className="flex items-end col-span-2 md:col-span-1">
            {(search || levelFilter || minScore > 0) && (
              <button
                onClick={clearFilters}
                type="button"
                className="w-full px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-[#27273D] transition-colors"
              >
                Limpar
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden min-h-[400px]">
        {loadingData ? (
          <LoadingState label="Analisando dados de evasão..." />
        ) : loadError ? (
          <div className="py-20 text-center">
            <EmptyState
              title="Erro ao carregar dados"
              description="Não foi possível recuperar os dados de risco."
            />
            <button onClick={loadData} className="mt-4 text-[#2A658F] font-medium hover:underline">Tentar novamente</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-10">
            <EmptyState
              title="Nenhum aluno encontrado"
              description="Tente ajustar os filtros para ver mais resultados."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-[#CCE4F4]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-[#27273D] uppercase tracking-wider">Aluno</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-[#27273D] uppercase tracking-wider">Score de Risco</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-[#27273D] uppercase tracking-wider">Nível</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-[#27273D] uppercase tracking-wider">Fatores Principais</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-[#27273D] uppercase tracking-wider">Ações Rápidas</th>
                </tr>
              </thead>

              <tbody className="bg-white divide-y divide-gray-200">
                {filtered.map((s) => {
                  const score = Math.max(0, Math.min(100, Number(s.score ?? 0)));
                  const barClass = levelBar[s.level] ?? 'bg-gray-400';
                  const wa = normalizePhoneToWa(s.student_phone);
                  const isCreating = creatingTicketFor === s.student_id;

                  // Fatores escondidos para tooltip
                  const hiddenFactors = (s.factors || []).slice(3);
                  const tooltipText = hiddenFactors.length > 0 ? hiddenFactors.join(', ') : '';

                  return (
                    <tr
                      key={s.student_id}
                      className="hover:bg-[#E2ECF4] group cursor-pointer transition-colors"
                      onClick={() => router.push(`/risk/${s.student_id}`)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className={`w-1 h-8 rounded-full mr-3 ${barClass}`}></div>
                          <div>
                            <p className="text-sm font-medium text-[#27273D] group-hover:text-[#2A658F] transition-colors">{s.student_name}</p>
                            <p className="text-xs text-gray-500">{s.student_email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1 w-32">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-bold text-[#27273D]">{score.toFixed(1)}</span>
                          </div>
                          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${barClass}`}
                              style={{ width: `${score}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${levelColors[s.level] ?? 'bg-gray-100 text-gray-700'
                            }`}
                        >
                          {levelLabel[s.level] ?? s.level}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {(s.factors || []).slice(0, 3).map((factor, idx) => (
                            <span key={idx} className="px-2 py-0.5 bg-gray-50 border border-gray-100 text-gray-600 text-[10px] uppercase tracking-wide rounded">
                              {factor}
                            </span>
                          ))}
                          {(s.factors || []).length > 3 && (
                            <span
                              title={tooltipText}
                              className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] rounded cursor-help border border-transparent hover:border-gray-300 transition-colors"
                            >
                              +{hiddenFactors.length}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>

                          {/* Botão Principal: Ticket */}
                          <button
                            onClick={(e) => createTicket(e, s)}
                            disabled={isCreating}
                            className={`
                                flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium border transition-all
                                ${isCreating
                                ? 'bg-gray-100 text-gray-400 border-gray-100 cursor-not-allowed'
                                : 'border-[#2A658F] text-[#2A658F] hover:bg-[#2A658F] hover:text-white'
                              }
                            `}
                            title="Criar ticket de acompanhamento"
                          >
                            {isCreating ? '...' : 'Ticket'}
                          </button>

                          <div className="h-4 w-px bg-gray-300 mx-1"></div>

                          {/* Ações de Comunicação (Ícones) */}
                          <a
                            href={`mailto:${s.student_email}`}
                            className="p-1.5 text-gray-400 hover:text-[#27273D] hover:bg-gray-100 rounded-full transition-colors"
                            title={`Enviar e-mail para ${s.student_email}`}
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                          </a>

                          {/* CORREÇÃO AQUI: Usando operador ternário (? :) ao invés de lógico (&&) */}
                          {wa ? (
                            <a
                              href={`https://wa.me/${wa}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-full transition-colors"
                              title="Abrir WhatsApp Web"
                            >
                              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                            </a>
                          ) : null}

                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}