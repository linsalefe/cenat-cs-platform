'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import api from '@/lib/api';

interface RiskDetail {
  student_id: number;
  student_name: string;
  score: number;
  level: string;
  components: {
    engagement: number;
    progress: number;
    grade: number;
    financial: number;
    ticket: number;
  };
  factors: string[];
  calculated_at: string;
}

interface MoodleSignal {
  id: number;
  course_id: number;
  progress_percent: number;
  course_grade: number | null;
  days_since_access: number;
  captured_at: string;
}

interface Ticket {
  id: number;
  protocol: string;
  subject: string;
  status: string;
  category: string;
  created_at: string;
}

interface Student {
  id: number;
  name: string;
  email: string;
  phone: string;
}

export default function StudentRiskDetail() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const studentId = params.id;

  const [student, setStudent] = useState<Student | null>(null);
  const [risk, setRisk] = useState<RiskDetail | null>(null);
  const [moodleSignals, setMoodleSignals] = useState<MoodleSignal[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && studentId) {
      loadData();
    }
  }, [user, studentId]);

  const loadData = async () => {
    try {
      setLoadingData(true);
      const [studentRes, riskRes, signalsRes, ticketsRes] = await Promise.all([
        api.get(`/students/${studentId}`),
        api.get(`/risk/students/${studentId}`).catch(() => null),
        api.get(`/students/${studentId}/moodle-signals`),
        api.get(`/tickets?student_id=${studentId}`),
      ]);
      setStudent(studentRes.data);
      setRisk(riskRes?.data || null);
      setMoodleSignals(signalsRes.data.signals || []);
      setTickets(ticketsRes.data || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleSyncMoodle = async () => {
    try {
      setSyncing(true);
      await api.post(`/students/${studentId}/sync-moodle`);
      await loadData();
    } catch (error) {
      console.error('Erro ao sincronizar:', error);
    } finally {
      setSyncing(false);
    }
  };

  const handleRecalculateRisk = async () => {
    try {
      setRecalculating(true);
      await api.post(`/risk/students/${studentId}/calculate`);
      await loadData();
    } catch (error) {
      console.error('Erro ao recalcular:', error);
    } finally {
      setRecalculating(false);
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-600';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getLevelLabel = (level: string) => {
    switch (level) {
      case 'critical': return 'Crítico';
      case 'high': return 'Alto';
      case 'medium': return 'Médio';
      case 'low': return 'Baixo';
      default: return level;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      open: 'Aberto',
      in_progress: 'Em Andamento',
      waiting_student: 'Aguardando Aluno',
      resolved: 'Resolvido',
      closed: 'Fechado',
    };
    return labels[status] || status;
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Carregando...</p>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-500">Aluno não encontrado</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <button
              onClick={() => router.push('/risk')}
              className="text-blue-600 hover:text-blue-800 text-sm mb-1"
            >
              ← Voltar ao Dashboard
            </button>
            <h1 className="text-2xl font-bold text-gray-800">{student.name}</h1>
            <p className="text-sm text-gray-500">{student.email}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSyncMoodle}
              disabled={syncing}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
            >
              {syncing ? 'Sincronizando...' : 'Sync Moodle'}
            </button>
            <button
              onClick={handleRecalculateRisk}
              disabled={recalculating}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {recalculating ? 'Calculando...' : 'Recalcular Risco'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Score de Risco */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Score de Risco</h2>
          
          {risk ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Score Principal */}
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className={`w-24 h-24 rounded-full flex items-center justify-center text-white text-3xl font-bold ${getLevelColor(risk.level)}`}>
                    {risk.score}
                  </div>
                  <span className={`mt-2 inline-block px-3 py-1 rounded-full text-white text-sm ${getLevelColor(risk.level)}`}>
                    {getLevelLabel(risk.level)}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-500 mb-2">Fatores de Risco:</p>
                  <div className="flex flex-wrap gap-2">
                    {risk.factors.map((factor, idx) => (
                      <span key={idx} className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded">
                        {factor}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Componentes */}
              <div className="space-y-3">
                <p className="text-sm text-gray-500">Componentes do Score:</p>
                {Object.entries(risk.components).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="w-24 text-sm text-gray-600 capitalize">{key}</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full ${value > 50 ? 'bg-red-500' : value > 25 ? 'bg-yellow-500' : 'bg-green-500'}`}
                        style={{ width: `${value}%` }}
                      />
                    </div>
                    <span className="w-12 text-sm text-gray-600 text-right">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-gray-500">Score ainda não calculado. Clique em "Recalcular Risco".</p>
          )}
        </div>

        {/* Dados do Moodle */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Dados do Moodle</h2>
          
          {moodleSignals.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Curso</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Progresso</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nota</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Dias sem Acesso</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {moodleSignals.map((signal) => (
                    <tr key={signal.id}>
                      <td className="px-4 py-3 text-sm">Curso #{signal.course_id}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div
                              className="h-2 rounded-full bg-blue-500"
                              style={{ width: `${signal.progress_percent}%` }}
                            />
                          </div>
                          <span className="text-sm">{signal.progress_percent?.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {signal.course_grade !== null ? signal.course_grade.toFixed(1) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm ${signal.days_since_access > 7 ? 'text-red-600 font-medium' : ''}`}>
                          {signal.days_since_access} dias
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500">Nenhum dado do Moodle. Clique em "Sync Moodle".</p>
          )}
        </div>

        {/* Tickets */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Tickets</h2>
            <span className="text-sm text-gray-500">{tickets.length} ticket(s)</span>
          </div>
          
          {tickets.length > 0 ? (
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  onClick={() => router.push(`/tickets/${ticket.id}`)}
                  className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-800">{ticket.subject}</p>
                      <p className="text-sm text-gray-500">{ticket.protocol}</p>
                    </div>
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                      {getStatusLabel(ticket.status)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">Nenhum ticket registrado.</p>
          )}
        </div>
      </main>
    </div>
  );
}
