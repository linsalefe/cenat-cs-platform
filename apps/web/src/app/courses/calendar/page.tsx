'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import AppLayout from '@/components/AppLayout';
import {
  ArrowLeft,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle2,
  FileText,
  Filter,
} from 'lucide-react';
import api from '@/lib/api';

interface Assignment {
  id: number;
  name: string;
  duedate: string;
  course_id: number;
  course_name: string;
  days_remaining: number;
}

export default function CalendarPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'overdue' | 'past'>('upcoming');

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
      loadCalendar();
    }
  }, [user]);

  const loadCalendar = async () => {
    try {
      const res = await api.get('/courses/calendar');
      setAssignments(res.data.assignments || []);
    } catch (error) {
      console.error('Erro ao carregar calendário:', error);
    } finally {
      setLoading(false);
    }
  };

  const upcoming = assignments.filter((a) => a.days_remaining >= 0);
  const overdue = assignments.filter((a) => a.days_remaining < 0 && a.days_remaining >= -30);
  const past = assignments.filter((a) => a.days_remaining < -30);

  const filtered = filter === 'all' ? assignments
    : filter === 'upcoming' ? upcoming
    : filter === 'overdue' ? overdue
    : past;

  // Agrupar por mês
  const grouped: Record<string, Assignment[]> = {};
  filtered.forEach((a) => {
    const date = new Date(a.duedate);
    const key = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(a);
  });

  const formatDate = (duedate: string) => {
    return new Date(duedate).toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    });
  };

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="animate-pulse space-y-8">
          <div className="h-8 bg-gray-100 rounded-lg w-64"></div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-100 rounded-2xl"></div>
            ))}
          </div>
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
      <div className="space-y-8">
        {/* Header */}
        <div
          className={`transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
          }`}
        >
          <button
            onClick={() => router.push('/courses')}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#2A658F] transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para Cursos
          </button>
          <p className="text-sm font-medium text-[#2A658F] mb-1">Acadêmico</p>
          <h1 className="text-3xl font-semibold text-[#27273D] tracking-tight">Calendário de Entregas</h1>
        </div>

        {/* Stats */}
        <div
          className={`grid grid-cols-1 sm:grid-cols-3 gap-4 transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '100ms' }}
        >
          <button
            onClick={() => setFilter('upcoming')}
            className={`bg-white rounded-2xl p-5 border text-left transition-all duration-300
              ${filter === 'upcoming' ? 'border-emerald-400 shadow-lg shadow-emerald-100' : 'border-gray-100 hover:border-gray-200'}`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                <Calendar className="w-5 h-5 text-emerald-600" />
              </div>
              {filter === 'upcoming' && <div className="w-2 h-2 bg-emerald-500 rounded-full" />}
            </div>
            <p className="text-2xl font-semibold text-[#27273D]">{upcoming.length}</p>
            <p className="text-sm text-gray-500">Próximas entregas</p>
          </button>

          <button
            onClick={() => setFilter('overdue')}
            className={`bg-white rounded-2xl p-5 border text-left transition-all duration-300
              ${filter === 'overdue' ? 'border-red-400 shadow-lg shadow-red-100' : 'border-gray-100 hover:border-gray-200'}`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              {filter === 'overdue' && <div className="w-2 h-2 bg-red-500 rounded-full" />}
            </div>
            <p className="text-2xl font-semibold text-[#27273D]">{overdue.length}</p>
            <p className="text-sm text-gray-500">Vencidas (últimos 30d)</p>
          </button>

          <button
            onClick={() => setFilter('all')}
            className={`bg-white rounded-2xl p-5 border text-left transition-all duration-300
              ${filter === 'all' ? 'border-[#2A658F] shadow-lg shadow-blue-100' : 'border-gray-100 hover:border-gray-200'}`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              {filter === 'all' && <div className="w-2 h-2 bg-[#2A658F] rounded-full" />}
            </div>
            <p className="text-2xl font-semibold text-[#27273D]">{assignments.length}</p>
            <p className="text-sm text-gray-500">Total de atividades</p>
          </button>
        </div>

        {/* Timeline */}
        <div
          className={`transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '200ms' }}
        >
          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Nenhuma atividade</h3>
              <p className="text-gray-500">Não há atividades neste filtro</p>
            </div>
          ) : (
            Object.entries(grouped).map(([month, items]) => (
              <div key={month} className="mb-8">
                <h3 className="text-sm font-semibold text-[#2A658F] uppercase tracking-wider mb-3 capitalize">
                  {month}
                </h3>
                <div className="space-y-2">
                  {items.map((a) => {
                    const isOverdue = a.days_remaining < 0;
                    const isToday = a.days_remaining === 0;
                    const isSoon = a.days_remaining > 0 && a.days_remaining <= 7;

                    return (
                      <div
                        key={`${a.id}-${a.course_id}`}
                        onClick={() => router.push(`/courses/${a.course_id}`)}
                        className={`group bg-white rounded-xl border p-4 cursor-pointer
                          hover:shadow-lg hover:shadow-gray-100/50 transition-all duration-300
                          ${isOverdue ? 'border-red-200 hover:border-red-300' :
                            isToday ? 'border-amber-200 hover:border-amber-300' :
                            isSoon ? 'border-blue-200 hover:border-blue-300' :
                            'border-gray-100 hover:border-gray-200'}`}
                      >
                        <div className="flex items-center gap-4">
                          {/* Date badge */}
                          <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center flex-shrink-0
                            ${isOverdue ? 'bg-red-50' :
                              isToday ? 'bg-amber-50' :
                              isSoon ? 'bg-blue-50' :
                              'bg-gray-50'}`}
                          >
                            <span className={`text-lg font-bold leading-none
                              ${isOverdue ? 'text-red-600' :
                                isToday ? 'text-amber-600' :
                                isSoon ? 'text-blue-600' :
                                'text-gray-600'}`}
                            >
                              {new Date(a.duedate).getDate()}
                            </span>
                            <span className="text-[10px] text-gray-500 uppercase mt-0.5">
                              {new Date(a.duedate).toLocaleDateString('pt-BR', { month: 'short' })}
                            </span>
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-[#27273D] group-hover:text-[#2A658F] transition-colors">
                              {a.name}
                            </h4>
                            <p className="text-sm text-gray-500 line-clamp-1 mt-0.5">
                              {a.course_name}
                            </p>
                          </div>

                          {/* Status */}
                          <span className={`text-xs font-medium px-3 py-1.5 rounded-full flex-shrink-0
                            ${isOverdue ? 'bg-red-50 text-red-600' :
                              isToday ? 'bg-amber-50 text-amber-600' :
                              isSoon ? 'bg-blue-50 text-blue-600' :
                              'bg-gray-100 text-gray-600'}`}
                          >
                            {isOverdue ? `${Math.abs(a.days_remaining)}d atrasado` :
                             isToday ? 'Hoje' :
                             `${a.days_remaining}d restantes`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}
