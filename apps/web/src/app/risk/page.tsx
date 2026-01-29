'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  score: number;
  level: string;
  factors: string[];
  calculated_at: string;
}

export default function RiskDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<RiskSummary | null>(null);
  const [studentsAtRisk, setStudentsAtRisk] = useState<StudentAtRisk[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [recalculating, setRecalculating] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      setLoadingData(true);
      const [summaryRes, studentsRes] = await Promise.all([
        api.get('/risk/summary'),
        api.get('/risk/students/at-risk'),
      ]);
      setSummary(summaryRes.data);
      setStudentsAtRisk(studentsRes.data);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
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

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Dashboard de Risco</h1>
            <p className="text-sm text-gray-500">Monitoramento de evasão</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/tickets')}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Tickets
            </button>
            <button
              onClick={handleRecalculateAll}
              disabled={recalculating}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {recalculating ? 'Recalculando...' : 'Recalcular Todos'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-600">
            <p className="text-sm text-gray-500 uppercase">Crítico</p>
            <p className="text-3xl font-bold text-red-600">{summary?.critical || 0}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
            <p className="text-sm text-gray-500 uppercase">Alto</p>
            <p className="text-3xl font-bold text-orange-500">{summary?.high || 0}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
            <p className="text-sm text-gray-500 uppercase">Médio</p>
            <p className="text-3xl font-bold text-yellow-500">{summary?.medium || 0}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
            <p className="text-sm text-gray-500 uppercase">Baixo</p>
            <p className="text-3xl font-bold text-green-500">{summary?.low || 0}</p>
          </div>
        </div>

        {/* Lista de Alunos em Risco */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-800">
              Alunos em Risco Alto/Crítico
            </h2>
          </div>

          {studentsAtRisk.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              Nenhum aluno em risco alto ou crítico no momento.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Aluno
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Score
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Nível
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Fatores de Risco
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {studentsAtRisk.map((student) => (
                    <tr key={student.student_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900">{student.student_name}</p>
                          <p className="text-sm text-gray-500">{student.student_email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-lg font-bold">{student.score}</span>
                        <span className="text-gray-400">/100</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-white text-sm ${getLevelColor(student.level)}`}>
                          {getLevelLabel(student.level)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {student.factors.slice(0, 3).map((factor, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded"
                            >
                              {factor}
                            </span>
                          ))}
                          {student.factors.length > 3 && (
                            <span className="px-2 py-1 text-gray-400 text-xs">
                              +{student.factors.length - 3}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => router.push(`/risk/${student.student_id}`)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          Ver detalhes
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
