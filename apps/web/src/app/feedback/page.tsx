'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import AppLayout from '@/components/AppLayout';
import LoadingState from '@/components/LoadingState';
import EmptyState from '@/components/EmptyState';

import { useAuth } from '@/contexts/auth-context';
import api from '@/lib/api';

// --- Interfaces ---
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

// --- Constantes & Helpers ---
const triggerLabels: Record<string, string> = {
  ticket_closed: 'Ticket Fechado',
  course_completed: 'Curso Concluído',
  manual: 'Manual',
  scheduled: 'Agendado',
};

const getNpsColor = (score: number | null) => {
  if (score === null) return 'text-gray-400';
  if (score >= 50) return 'text-green-600';
  if (score >= 0) return 'text-amber-600';
  return 'text-red-600';
};

const getCsatColor = (score: number | null) => {
  if (score === null) return 'text-gray-400';
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-600';
};

// Componente de Badge de Score (Reutilizável)
const ScoreBadge = ({ type, score }: { type: string, score: number | null }) => {
  if (score === null) return <span className="text-gray-400 text-xs">Pendente</span>;
  
  let label = '';
  let colorClass = '';

  if (type === 'nps') {
    if (score >= 9) { label = 'Promotor'; colorClass = 'bg-green-100 text-green-800'; }
    else if (score >= 7) { label = 'Passivo'; colorClass = 'bg-amber-100 text-amber-800'; }
    else { label = 'Detrator'; colorClass = 'bg-red-100 text-red-800'; }
  } else {
    if (score >= 4) { label = 'Satisfeito'; colorClass = 'bg-green-100 text-green-800'; }
    else if (score === 3) { label = 'Neutro'; colorClass = 'bg-amber-100 text-amber-800'; }
    else { label = 'Insatisfeito'; colorClass = 'bg-red-100 text-red-800'; }
  }

  return <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${colorClass}`}>{label}</span>;
};

// --- Componente: Card Mobile ---
function MobileFeedbackCard({ feedback }: { feedback: FeedbackItem }) {
  const date = feedback.answered_at 
    ? new Date(feedback.answered_at).toLocaleDateString('pt-BR')
    : new Date(feedback.sent_at!).toLocaleDateString('pt-BR');

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-3">
      {/* Cabeçalho: Nome e Data */}
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-[#27273D] text-sm">{feedback.student_name}</h3>
        <span className="text-xs text-gray-400">{date}</span>
      </div>

      {/* Badges de Contexto */}
      <div className="flex gap-2 mb-3">
         <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${
            feedback.feedback_type === 'nps' 
              ? 'bg-blue-50 text-blue-700 border-blue-100' 
              : 'bg-purple-50 text-purple-700 border-purple-100'
         }`}>
            {feedback.feedback_type}
         </span>
         <span className="px-2 py-0.5 text-[10px] font-medium uppercase rounded border border-gray-200 text-gray-500 bg-gray-50">
            {triggerLabels[feedback.trigger] || feedback.trigger}
         </span>
      </div>

      {/* Score e Status */}
      <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg mb-3">
        <div className="flex flex-col">
            <span className="text-[10px] text-gray-500 uppercase font-bold">Nota</span>
            <span className="text-lg font-bold text-[#27273D]">{feedback.score !== null ? feedback.score : '-'}</span>
        </div>
        <ScoreBadge type={feedback.feedback_type} score={feedback.score} />
      </div>

      {/* Comentário (se houver) */}
      {feedback.comment && (
        <div className="text-sm text-gray-600 italic bg-yellow-50/50 p-3 rounded border border-yellow-100/50">
          "{feedback.comment}"
        </div>
      )}
    </div>
  );
}


export default function FeedbackDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [nps, setNps] = useState<NPSSummary | null>(null);
  const [csat, setCsat] = useState<CSATSummary | null>(null);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

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
      toast.error('Erro ao carregar métricas de feedback');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <AppLayout>
        <LoadingState label="Carregando métricas..." />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#27273D]">NPS & CSAT</h1>
            <p className="text-gray-600 mt-1">Métricas de satisfação e lealdade dos alunos</p>
          </div>
          
          <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
            <span className="text-xs font-medium text-gray-500 px-2">Período:</span>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="text-sm border-none focus:ring-0 text-[#27273D] font-medium bg-transparent cursor-pointer"
            >
              <option value={7}>Últimos 7 dias</option>
              <option value={30}>Últimos 30 dias</option>
              <option value={90}>Últimos 90 dias</option>
              <option value={365}>Último ano</option>
            </select>
          </div>
        </div>

        {/* Cards NPS e CSAT */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* NPS Card */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex justify-between items-start mb-4">
                <h2 className="text-lg font-bold text-[#27273D]">Net Promoter Score (NPS)</h2>
                <span className="px-2 py-1 bg-gray-100 text-gray-500 text-[10px] uppercase font-bold rounded">Lealdade</span>
            </div>
            
            <div className="flex items-end gap-3 mb-6">
              <div className={`text-5xl font-bold ${getNpsColor(nps?.nps_score ?? null)}`}>
                {nps?.nps_score !== null && nps?.nps_score !== undefined ? nps?.nps_score : '-'}
              </div>
              <div className="text-sm text-gray-500 mb-1">
                 score atual ({nps?.total_responses || 0} respostas)
              </div>
            </div>

            <div className="space-y-4">
               {/* Barras de progresso com design refinado */}
              <div className="group">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-600 font-medium">Promotores (9-10)</span>
                  <span className="text-gray-800 font-bold">{nps?.promoters || 0}</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${nps?.promoters_pct || 0}%` }} />
                </div>
              </div>
              
              <div className="group">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-600 font-medium">Passivos (7-8)</span>
                  <span className="text-gray-800 font-bold">{nps?.passives || 0}</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 transition-all duration-500" style={{ width: `${nps ? (nps.passives / (nps.total_responses || 1)) * 100 : 0}%` }} />
                </div>
              </div>
              
              <div className="group">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-600 font-medium">Detratores (0-6)</span>
                  <span className="text-gray-800 font-bold">{nps?.detractors || 0}</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${nps?.detractors_pct || 0}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* CSAT Card */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
             <div className="flex justify-between items-start mb-4">
                <h2 className="text-lg font-bold text-[#27273D]">CSAT Score</h2>
                <span className="px-2 py-1 bg-gray-100 text-gray-500 text-[10px] uppercase font-bold rounded">Satisfação</span>
            </div>
            
            <div className="flex items-end gap-3 mb-6">
              <div className={`text-5xl font-bold ${getCsatColor(csat?.csat_score ?? null)}`}>
                {csat?.csat_score !== null && csat?.csat_score !== undefined ? `${csat?.csat_score}%` : '-'}
              </div>
              <div className="text-sm text-gray-500 mb-1">
                média {csat?.average_score?.toFixed(1) || '-'}/5 ({csat?.total_responses || 0} respostas)
              </div>
            </div>

            <div className="space-y-4">
              <div className="group">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-600 font-medium">Satisfeitos (4-5)</span>
                  <span className="text-gray-800 font-bold">{csat?.satisfied || 0}</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${csat ? (csat.satisfied / (csat.total_responses || 1)) * 100 : 0}%` }} />
                </div>
              </div>
              
              <div className="group">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-600 font-medium">Neutros (3)</span>
                  <span className="text-gray-800 font-bold">{csat?.neutral || 0}</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 transition-all duration-500" style={{ width: `${csat ? (csat.neutral / (csat.total_responses || 1)) * 100 : 0}%` }} />
                </div>
              </div>
              
              <div className="group">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-600 font-medium">Insatisfeitos (1-2)</span>
                  <span className="text-gray-800 font-bold">{csat?.dissatisfied || 0}</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${csat ? (csat.dissatisfied / (csat.total_responses || 1)) * 100 : 0}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Lista de Feedbacks Recentes (Híbrida) */}
        <div className="bg-transparent md:bg-white md:rounded-xl md:shadow-sm overflow-hidden min-h-[400px]">
          <div className="p-4 border-b border-gray-100 hidden md:block">
            <h2 className="text-lg font-semibold text-[#27273D]">Feedbacks Recentes</h2>
          </div>
          
          {feedbacks.length === 0 ? (
            <div className="p-8 bg-white md:bg-transparent rounded-xl">
              <EmptyState
                title="Nenhum feedback ainda"
                description="Os feedbacks aparecerão aqui quando forem enviados."
              />
            </div>
          ) : (
            <>
              {/* VERSÃO MOBILE: Cards */}
              <div className="md:hidden space-y-3">
                 <h2 className="text-lg font-semibold text-[#27273D] px-1 mb-2">Feedbacks Recentes</h2>
                 {feedbacks.map(f => <MobileFeedbackCard key={f.id} feedback={f} />)}
              </div>

              {/* VERSÃO DESKTOP: Tabela */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-[#CCE4F4]">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-bold text-[#27273D] uppercase tracking-wider">Aluno</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-[#27273D] uppercase tracking-wider">Tipo</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-[#27273D] uppercase tracking-wider">Origem</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-[#27273D] uppercase tracking-wider">Nota</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-[#27273D] uppercase tracking-wider">Comentário</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-[#27273D] uppercase tracking-wider">Data</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {feedbacks.map((f) => (
                      <tr key={f.id} className="hover:bg-[#E2ECF4] transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-sm font-medium text-[#27273D]">{f.student_name}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-bold uppercase rounded-full ${
                            f.feedback_type === 'nps' 
                              ? 'bg-blue-50 text-blue-700' 
                              : 'bg-purple-50 text-purple-700'
                          }`}>
                            {f.feedback_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {triggerLabels[f.trigger] || f.trigger}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-[#27273D] w-6 text-center">{f.score !== null ? f.score : '-'}</span>
                            <ScoreBadge type={f.feedback_type} score={f.score} />
                          </div>
                        </td>
                        <td className="px-6 py-4 max-w-xs">
                          {f.comment ? (
                             <p className="text-sm text-gray-600 truncate" title={f.comment}>"{f.comment}"</p>
                          ) : (
                             <span className="text-gray-300 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {f.answered_at 
                            ? new Date(f.answered_at).toLocaleDateString('pt-BR')
                            : new Date(f.sent_at!).toLocaleDateString('pt-BR')
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}