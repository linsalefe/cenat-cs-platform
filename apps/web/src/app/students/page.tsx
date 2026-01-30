'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import {
  Search,
  Users,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Mail,
  Phone,
  GraduationCap,
  UserCheck,
  UserX,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Filter,
} from 'lucide-react';

interface Student {
  id: number;
  name: string;
  email: string;
  phone: string;
  moodle_user_id: number | null;
}

const PER_PAGE = 30;

export default function StudentsPage() {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [mounted, setMounted] = useState(false);
  const [filter, setFilter] = useState<'all' | 'linked' | 'unlinked'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [syncResult, setSyncResult] = useState<{ show: boolean; created: number; updated: number } | null>(null);

  useEffect(() => {
    setMounted(true);
    loadStudents();
  }, []);

  const loadStudents = async () => {
    try {
      setLoading(true);
      const res = await api.get('/students?limit=5000');
      setStudents(res.data);
    } catch (error) {
      console.error('Erro ao carregar alunos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncMoodle = async () => {
    try {
      setSyncing(true);
      const res = await api.post('/moodle/sync-students');
      setSyncResult({ show: true, created: res.data.created, updated: res.data.updated });
      await loadStudents();
      setTimeout(() => setSyncResult(null), 5000);
    } catch (error) {
      console.error('Erro ao sincronizar:', error);
    } finally {
      setSyncing(false);
    }
  };

  // Filtro por busca e status
  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase());
    
    if (filter === 'linked') return matchesSearch && s.moodle_user_id !== null;
    if (filter === 'unlinked') return matchesSearch && s.moodle_user_id === null;
    return matchesSearch;
  });

  // Paginação
  const totalPages = Math.ceil(filteredStudents.length / PER_PAGE);
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * PER_PAGE,
    currentPage * PER_PAGE
  );

  // Reset página ao mudar filtro ou busca
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filter]);

  const linkedCount = students.filter(s => s.moodle_user_id !== null).length;
  const unlinkedCount = students.filter(s => s.moodle_user_id === null).length;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

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
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="animate-pulse space-y-6">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <div className="h-8 bg-gray-200 rounded-lg w-48"></div>
              <div className="h-4 bg-gray-200 rounded w-64"></div>
            </div>
            <div className="h-10 bg-gray-200 rounded-xl w-44"></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-2xl"></div>
            ))}
          </div>
          <div className="h-12 bg-gray-200 rounded-xl w-full max-w-md"></div>
          <div className="bg-white rounded-2xl p-6 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div 
          className={`flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 transition-all duration-500 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
          }`}
        >
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#27273D] flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#2A658F] to-[#1a4a6e] rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
              Alunos
            </h1>
            <p className="text-gray-500 mt-1 ml-13">
              Gerencie e visualize todos os alunos cadastrados
            </p>
          </div>
          
          <button
            onClick={handleSyncMoodle}
            disabled={syncing}
            className="group flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#2A658F] to-[#3d7ba8] 
              text-white rounded-xl hover:from-[#1a4a6e] hover:to-[#2A658F] 
              disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300
              shadow-lg shadow-[#2A658F]/20 hover:shadow-xl hover:shadow-[#2A658F]/30
              hover:-translate-y-0.5"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
            <span className="font-medium">{syncing ? 'Sincronizando...' : 'Sincronizar Moodle'}</span>
          </button>
        </div>

        {/* Toast de sucesso */}
        {syncResult?.show && (
          <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 duration-300">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 shadow-lg flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-green-800">Sincronização concluída!</p>
                <p className="text-sm text-green-600 mt-0.5">
                  {syncResult.created} criados · {syncResult.updated} atualizados
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div 
          className={`grid grid-cols-1 sm:grid-cols-3 gap-4 transition-all duration-500 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '100ms' }}
        >
          <button
            onClick={() => setFilter('all')}
            className={`group relative bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-300 
              text-left overflow-hidden ${filter === 'all' ? 'ring-2 ring-[#2A658F]' : ''}`}
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#2A658F] to-[#3d7ba8]" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total de Alunos</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{students.length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center group-hover:bg-[#2A658F] transition-colors">
                <GraduationCap className="w-6 h-6 text-[#2A658F] group-hover:text-white transition-colors" />
              </div>
            </div>
          </button>

          <button
            onClick={() => setFilter('linked')}
            className={`group relative bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-300 
              text-left overflow-hidden ${filter === 'linked' ? 'ring-2 ring-green-500' : ''}`}
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-emerald-400" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Vinculados ao Moodle</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{linkedCount}</p>
              </div>
              <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center group-hover:bg-green-500 transition-colors">
                <UserCheck className="w-6 h-6 text-green-600 group-hover:text-white transition-colors" />
              </div>
            </div>
          </button>

          <button
            onClick={() => setFilter('unlinked')}
            className={`group relative bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-300 
              text-left overflow-hidden ${filter === 'unlinked' ? 'ring-2 ring-orange-500' : ''}`}
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-amber-400" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Não Vinculados</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{unlinkedCount}</p>
              </div>
              <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center group-hover:bg-orange-500 transition-colors">
                <UserX className="w-6 h-6 text-orange-600 group-hover:text-white transition-colors" />
              </div>
            </div>
          </button>
        </div>

        {/* Busca */}
        <div 
          className={`flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between transition-all duration-500 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '200ms' }}
        >
          <div className="relative w-full max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border-2 border-gray-200 rounded-xl
                focus:border-[#2A658F] focus:ring-4 focus:ring-[#2A658F]/10 
                transition-all duration-200 outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Filter className="w-4 h-4" />
            <span>
              Mostrando <span className="font-semibold text-gray-700">{paginatedStudents.length}</span> de{' '}
              <span className="font-semibold text-gray-700">{filteredStudents.length}</span> alunos
            </span>
          </div>
        </div>

        {/* Lista de Alunos */}
        <div 
          className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-500 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '300ms' }}
        >
          {paginatedStudents.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Nenhum aluno encontrado</h3>
              <p className="text-gray-500">
                {search ? 'Tente buscar com outros termos' : 'Sincronize com o Moodle para importar alunos'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50/80">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Aluno
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Contato
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Status Moodle
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedStudents.map((student, index) => (
                    <tr 
                      key={student.id} 
                      className="hover:bg-gray-50/50 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${getAvatarColor(student.name)} 
                            flex items-center justify-center text-white font-semibold text-sm
                            shadow-lg shadow-gray-200 group-hover:scale-110 transition-transform`}>
                            {getInitials(student.name)}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{student.name}</p>
                            <p className="text-sm text-gray-500">ID: {student.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Mail className="w-4 h-4 text-gray-400" />
                            <span>{student.email}</span>
                          </div>
                          {student.phone && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Phone className="w-4 h-4 text-gray-400" />
                              <span>{student.phone}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {student.moodle_user_id ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 
                            text-xs font-medium rounded-full border border-green-100">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Vinculado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 
                            text-xs font-medium rounded-full">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Não vinculado
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => router.push(`/risk/${student.id}`)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[#2A658F] 
                            hover:bg-[#2A658F]/10 rounded-lg transition-colors group/btn"
                        >
                          <span>Ver detalhes</span>
                          <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between bg-white rounded-xl shadow-sm p-4">
            <p className="text-sm text-gray-500">
              Mostrando {((currentPage - 1) * PER_PAGE) + 1} - {Math.min(currentPage * PER_PAGE, filteredStudents.length)} de {filteredStudents.length}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1 px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </button>
              <span className="px-4 py-2 text-sm text-gray-600">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1 px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
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
