'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { Avatar } from '@/components/ui';
import api from '@/lib/api';
import {
  Search,
  Users,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Mail,
  GraduationCap,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Filter,
  MessageCircle,
  LogIn,
  FileText,
  DollarSign,
  X,
  ChevronDown,
} from 'lucide-react';

interface Student {
  id: number;
  name: string;
  email: string;
  phone: string;
  moodle_user_id: number | null;
  moodle_first_access: string | null;
  documents_count: number;
  documents_total: number;
  primary_course_id: number | null;
  primary_course_name: string | null;
  financial_status: string | null;
  abandonment_status: string | null;
  risk_trend: string | null;
}

interface Course {
  id: number;
  name: string;
  count: number;
}

interface Stats {
  total: number;
  linked: number;
  unlinked: number;
  never_logged: number;
  documents: { complete: number; incomplete: number; none: number };
  financial: { inadimplente: number };
}

interface Pagination {
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

const PER_PAGE = 30;

export default function StudentsPage() {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [syncResult, setSyncResult] = useState<{ show: boolean; created: number; updated: number } | null>(null);

  // Filtros
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [filterMoodle, setFilterMoodle] = useState('');
  const [filterLogin, setFilterLogin] = useState('');
  const [filterDocs, setFilterDocs] = useState('');
  const [filterFinancial, setFilterFinancial] = useState('');
  const [filterCourse, setFilterCourse] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Carrega stats e cursos uma vez
  useEffect(() => {
    loadStats();
    loadCourses();
  }, []);

  // Carrega alunos quando filtros mudam
  useEffect(() => {
    loadStudents();
  }, [currentPage, search, filterMoodle, filterLogin, filterDocs, filterFinancial, filterCourse]);

  // Reset página ao mudar filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterMoodle, filterLogin, filterDocs, filterFinancial, filterCourse]);

  const loadStats = async () => {
    try {
      const res = await api.get('/students/stats');
      setStats(res.data);
    } catch (err) {
      console.error('Erro ao carregar stats:', err);
    }
  };

  const loadCourses = async () => {
    try {
      const res = await api.get('/students/courses');
      setCourses(res.data);
    } catch (err) {
      console.error('Erro ao carregar cursos:', err);
    }
  };

  const loadStudents = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('skip', String((currentPage - 1) * PER_PAGE));
      params.set('limit', String(PER_PAGE));
      if (search) params.set('search', search);
      if (filterMoodle) params.set('moodle_status', filterMoodle);
      if (filterLogin) params.set('login_status', filterLogin);
      if (filterDocs) params.set('docs_status', filterDocs);
      if (filterFinancial) params.set('financial_status', filterFinancial);
      if (filterCourse) params.set('course_id', filterCourse);

      const res = await api.get(`/students?${params.toString()}`);
      setStudents(res.data.data);
      setPagination({
        total: res.data.total,
        page: res.data.page,
        per_page: res.data.per_page,
        total_pages: res.data.total_pages,
      });
    } catch (error) {
      console.error('Erro ao carregar alunos:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, search, filterMoodle, filterLogin, filterDocs, filterFinancial, filterCourse]);

  const handleSyncMoodle = async () => {
    try {
      setSyncing(true);
      const res = await api.post('/moodle/sync-students');
      setSyncResult({ show: true, created: res.data.created, updated: res.data.updated });
      await Promise.all([loadStudents(), loadStats(), loadCourses()]);
      setTimeout(() => setSyncResult(null), 5000);
    } catch (error) {
      console.error('Erro ao sincronizar:', error);
    } finally {
      setSyncing(false);
    }
  };

  const activeFilterCount = [filterMoodle, filterLogin, filterDocs, filterFinancial, filterCourse].filter(Boolean).length;

  const clearFilters = () => {
    setFilterMoodle('');
    setFilterLogin('');
    setFilterDocs('');
    setFilterFinancial('');
    setFilterCourse('');
    setSearch('');
  };

  const getDocsStatus = (s: Student) => {
    if (s.documents_count >= s.documents_total) return { label: `${s.documents_count}/${s.documents_total}`, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100' };
    if (s.documents_count > 0) return { label: `${s.documents_count}/${s.documents_total}`, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-100' };
    return { label: `0/${s.documents_total}`, color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-100' };
  };

  if (loading && !students.length) {
    return (
      <AppLayout>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-100 rounded-lg w-48"></div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-100 rounded-2xl"></div>
            ))}
          </div>
          <div className="h-12 bg-gray-100 rounded-xl"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-xl"></div>
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
          className={`flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
          }`}
        >
          <div>
            <p className="text-sm font-medium text-[#2A658F] mb-1">Gestão</p>
            <h1 className="text-3xl font-semibold text-[#27273D] tracking-tight">Alunos</h1>
          </div>
          <button
            onClick={handleSyncMoodle}
            disabled={syncing}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#2A658F] text-white rounded-xl
              hover:bg-[#1E4F73] disabled:opacity-50 transition-all duration-300
              shadow-lg shadow-[#2A658F]/20"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            <span className="font-medium">{syncing ? 'Sincronizando...' : 'Sincronizar Moodle'}</span>
          </button>
        </div>

        {/* Toast de sucesso */}
        {syncResult?.show && (
          <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 shadow-lg flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
              <div>
                <p className="font-medium text-green-800">Sincronização concluída!</p>
                <p className="text-sm text-green-600">{syncResult.created} criados · {syncResult.updated} atualizados</p>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div
          className={`grid grid-cols-2 lg:grid-cols-4 gap-4 transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '100ms' }}
        >
          <button
            onClick={() => { clearFilters(); }}
            className={`bg-white rounded-2xl p-5 border transition-all duration-300 text-left
              ${!activeFilterCount ? 'border-[#2A658F]/30 shadow-lg' : 'border-gray-100 hover:border-gray-200'}`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-[#2A658F]" />
              </div>
            </div>
            <p className="text-2xl font-semibold text-[#27273D]">{stats?.total || 0}</p>
            <p className="text-sm text-gray-500">Total</p>
          </button>

          <button
            onClick={() => { clearFilters(); setFilterLogin('never_logged'); }}
            className={`bg-white rounded-2xl p-5 border transition-all duration-300 text-left
              ${filterLogin === 'never_logged' ? 'border-orange-200 shadow-lg' : 'border-gray-100 hover:border-gray-200'}`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
                <LogIn className="w-5 h-5 text-orange-600" />
              </div>
            </div>
            <p className="text-2xl font-semibold text-[#27273D]">{stats?.never_logged || 0}</p>
            <p className="text-sm text-gray-500">Nunca logaram</p>
          </button>

          <button
            onClick={() => { clearFilters(); setFilterDocs('none'); }}
            className={`bg-white rounded-2xl p-5 border transition-all duration-300 text-left
              ${filterDocs === 'none' ? 'border-red-200 shadow-lg' : 'border-gray-100 hover:border-gray-200'}`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                <FileText className="w-5 h-5 text-red-600" />
              </div>
            </div>
            <p className="text-2xl font-semibold text-[#27273D]">{stats?.documents?.none || 0}</p>
            <p className="text-sm text-gray-500">Sem documentos</p>
          </button>

          <button
            onClick={() => { clearFilters(); setFilterFinancial('inadimplente'); }}
            className={`bg-white rounded-2xl p-5 border transition-all duration-300 text-left
              ${filterFinancial === 'inadimplente' ? 'border-red-200 shadow-lg' : 'border-gray-100 hover:border-gray-200'}`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-red-600" />
              </div>
            </div>
            <p className="text-2xl font-semibold text-[#27273D]">{stats?.financial?.inadimplente || 0}</p>
            <p className="text-sm text-gray-500">Inadimplentes</p>
          </button>
        </div>

        {/* Search + Filters */}
        <div
          className={`space-y-4 transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '200ms' }}
        >
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nome ou email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl
                  focus:border-[#2A658F] focus:ring-4 focus:ring-[#2A658F]/10
                  transition-all duration-200 outline-none"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <XCircle className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-3 border rounded-xl transition-all
                ${showFilters || activeFilterCount > 0
                  ? 'border-[#2A658F] bg-[#E2ECF4] text-[#2A658F]'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
            >
              <Filter className="w-4 h-4" />
              <span className="text-sm font-medium">Filtros</span>
              {activeFilterCount > 0 && (
                <span className="w-5 h-5 bg-[#2A658F] text-white text-xs rounded-full flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>

            {/* Clear Filters */}
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-3 py-3 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X className="w-4 h-4" />
                Limpar
              </button>
            )}
          </div>

          {/* Filter Dropdowns */}
          {showFilters && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Curso */}
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase mb-1.5 block">Curso</label>
                <select
                  value={filterCourse}
                  onChange={(e) => setFilterCourse(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white
                    focus:border-[#2A658F] focus:ring-2 focus:ring-[#2A658F]/10 outline-none"
                >
                  <option value="">Todos os cursos</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name.length > 50 ? c.name.slice(0, 50) + '...' : c.name} ({c.count})
                    </option>
                  ))}
                </select>
              </div>

              {/* Login */}
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase mb-1.5 block">Login</label>
                <select
                  value={filterLogin}
                  onChange={(e) => setFilterLogin(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white
                    focus:border-[#2A658F] focus:ring-2 focus:ring-[#2A658F]/10 outline-none"
                >
                  <option value="">Todos</option>
                  <option value="never_logged">Nunca logou</option>
                  <option value="logged">Já logou</option>
                </select>
              </div>

              {/* Documentos */}
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase mb-1.5 block">Documentos</label>
                <select
                  value={filterDocs}
                  onChange={(e) => setFilterDocs(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white
                    focus:border-[#2A658F] focus:ring-2 focus:ring-[#2A658F]/10 outline-none"
                >
                  <option value="">Todos</option>
                  <option value="complete">Completos</option>
                  <option value="incomplete">Parciais</option>
                  <option value="none">Nenhum enviado</option>
                </select>
              </div>

              {/* Financeiro */}
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase mb-1.5 block">Financeiro</label>
                <select
                  value={filterFinancial}
                  onChange={(e) => setFilterFinancial(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white
                    focus:border-[#2A658F] focus:ring-2 focus:ring-[#2A658F]/10 outline-none"
                >
                  <option value="">Todos</option>
                  <option value="em_dia">Em dia</option>
                  <option value="pendente">Pendente</option>
                  <option value="inadimplente">Inadimplente</option>
                </select>
              </div>
            </div>
          )}

          {/* Active filter pills */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-2">
              {filterLogin === 'never_logged' && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-orange-50 text-orange-700 text-sm rounded-full border border-orange-100">
                  <LogIn className="w-3 h-3" /> Nunca logou
                  <button onClick={() => setFilterLogin('')} className="ml-1 hover:text-orange-900"><X className="w-3 h-3" /></button>
                </span>
              )}
              {filterLogin === 'logged' && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-700 text-sm rounded-full border border-emerald-100">
                  <LogIn className="w-3 h-3" /> Já logou
                  <button onClick={() => setFilterLogin('')} className="ml-1 hover:text-emerald-900"><X className="w-3 h-3" /></button>
                </span>
              )}
              {filterDocs && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 text-sm rounded-full border border-blue-100">
                  <FileText className="w-3 h-3" /> Docs: {filterDocs === 'complete' ? 'Completos' : filterDocs === 'incomplete' ? 'Parciais' : 'Nenhum'}
                  <button onClick={() => setFilterDocs('')} className="ml-1 hover:text-blue-900"><X className="w-3 h-3" /></button>
                </span>
              )}
              {filterFinancial && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-50 text-red-700 text-sm rounded-full border border-red-100">
                  <DollarSign className="w-3 h-3" /> {filterFinancial === 'em_dia' ? 'Em dia' : filterFinancial === 'pendente' ? 'Pendente' : 'Inadimplente'}
                  <button onClick={() => setFilterFinancial('')} className="ml-1 hover:text-red-900"><X className="w-3 h-3" /></button>
                </span>
              )}
              {filterCourse && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-50 text-purple-700 text-sm rounded-full border border-purple-100">
                  <GraduationCap className="w-3 h-3" /> {courses.find(c => String(c.id) === filterCourse)?.name?.slice(0, 30) || 'Curso'}...
                  <button onClick={() => setFilterCourse('')} className="ml-1 hover:text-purple-900"><X className="w-3 h-3" /></button>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Results count */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>
            Mostrando <span className="font-semibold text-gray-700">{students.length}</span> de{' '}
            <span className="font-semibold text-gray-700">{pagination?.total || 0}</span> alunos
          </span>
        </div>

        {/* Students List */}
        <div
          className={`transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '300ms' }}
        >
          {students.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Nenhum aluno encontrado</h3>
              <p className="text-gray-500">Tente ajustar os filtros</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50/80 border-b border-gray-100">
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Aluno</th>
                      <th className="px-4 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Curso</th>
                      <th className="px-4 py-4 text-center text-xs font-semibold text-gray-500 uppercase">Login</th>
                      <th className="px-4 py-4 text-center text-xs font-semibold text-gray-500 uppercase">Docs</th>
                      <th className="px-4 py-4 text-center text-xs font-semibold text-gray-500 uppercase">Financeiro</th>
                      <th className="px-4 py-4 text-right text-xs font-semibold text-gray-500 uppercase">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {students.map((student) => {
                      const docs = getDocsStatus(student);
                      const neverLogged = student.moodle_user_id && !student.moodle_first_access;

                      return (
                        <tr
                          key={student.id}
                          className="hover:bg-gray-50/50 transition-colors group cursor-pointer"
                          onClick={() => router.push(`/risk/${student.id}`)}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <Avatar name={student.name} size="sm" />
                              <div className="min-w-0">
                                <p className="font-medium text-gray-900 group-hover:text-[#2A658F] transition-colors truncate">
                                  {student.name}
                                </p>
                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                  <span className="truncate">{student.email}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            {student.primary_course_name ? (
                              <span className="text-xs text-gray-600 line-clamp-2" title={student.primary_course_name}>
                                {student.primary_course_name.length > 40
                                  ? student.primary_course_name.slice(0, 40) + '...'
                                  : student.primary_course_name}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-center">
                            {!student.moodle_user_id ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded-full">
                                <AlertCircle className="w-3 h-3" /> Sem Moodle
                              </span>
                            ) : neverLogged ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 text-orange-700 text-xs font-medium rounded-full border border-orange-100">
                                <XCircle className="w-3 h-3" /> Nunca logou
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 text-xs rounded-full border border-emerald-100">
                                <CheckCircle2 className="w-3 h-3" /> OK
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${docs.bg} ${docs.color} border ${docs.border}`}>
                              <FileText className="w-3 h-3" />
                              {docs.label}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center">
                            {student.financial_status === 'inadimplente' ? (
                              <span className="inline-flex items-center px-2 py-1 bg-red-50 text-red-700 text-xs font-medium rounded-full border border-red-100">
                                Inadimplente
                              </span>
                            ) : student.financial_status === 'pendente' ? (
                              <span className="inline-flex items-center px-2 py-1 bg-amber-50 text-amber-700 text-xs font-medium rounded-full border border-amber-100">
                                Pendente
                              </span>
                            ) : student.financial_status === 'em_dia' ? (
                              <span className="inline-flex items-center px-2 py-1 bg-emerald-50 text-emerald-700 text-xs rounded-full border border-emerald-100">
                                Em dia
                              </span>
                            ) : (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-right">
                            <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                              {student.phone && (
                                <a
                                  href={`https://wa.me/55${student.phone.replace(/\D/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all"
                                  title="WhatsApp"
                                >
                                  <MessageCircle className="w-4 h-4" />
                                </a>
                              )}
                              <a
                                href={`mailto:${student.email}`}
                                className="p-2 text-gray-400 hover:text-[#2A658F] hover:bg-[#E2ECF4] rounded-lg transition-all"
                                title="Email"
                              >
                                <Mail className="w-4 h-4" />
                              </a>
                              <button
                                onClick={() => router.push(`/risk/${student.id}`)}
                                className="p-2 text-gray-400 hover:text-[#2A658F] hover:bg-[#E2ECF4] rounded-lg transition-all"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination && pagination.total_pages > 1 && (
          <div className="flex items-center justify-between bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-sm text-gray-500">
              {((pagination.page - 1) * PER_PAGE) + 1} - {Math.min(pagination.page * PER_PAGE, pagination.total)} de {pagination.total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-600
                  border border-gray-200 rounded-lg hover:bg-gray-50
                  disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-4 h-4" /> Anterior
              </button>
              <span className="px-3 py-2 text-sm text-gray-600">{pagination.page} / {pagination.total_pages}</span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(pagination.total_pages, p + 1))}
                disabled={currentPage === pagination.total_pages}
                className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-600
                  border border-gray-200 rounded-lg hover:bg-gray-50
                  disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Próximo <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}