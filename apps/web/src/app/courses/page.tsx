'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import AppLayout from '@/components/AppLayout';
import {
  BookOpen,
  Users,
  GraduationCap,
  Search,
  ArrowRight,
  Calendar,
  EyeOff,
} from 'lucide-react';
import api from '@/lib/api';

interface Course {
  id: number;
  fullname: string;
  shortname: string;
  startdate: number | null;
  enddate: number | null;
  visible: number;
  total_students: number;
  total_teachers: number;
  teachers: string[];
}

export default function CoursesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');

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
      loadCourses();
    }
  }, [user]);

  const loadCourses = async () => {
    try {
      const res = await api.get('/courses');
      setCourses(res.data);
    } catch (error) {
      console.error('Erro ao carregar cursos:', error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = courses.filter((c) =>
    c.fullname.toLowerCase().includes(search.toLowerCase())
  );

  const totalStudents = courses.reduce((sum, c) => sum + c.total_students, 0);
  const totalTeachers = new Set(courses.flatMap((c) => c.teachers)).size;

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="animate-pulse space-y-8">
          <div className="h-8 bg-muted rounded-lg w-48"></div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded-2xl"></div>
            ))}
          </div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded-xl"></div>
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
            <p className="text-sm font-medium text-primary mb-1">Acadêmico</p>
            <h1 className="text-3xl font-semibold text-foreground tracking-tight">Cursos</h1>
          </div>

          <button
            onClick={() => router.push('/courses/calendar')}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white
              bg-gradient-to-r from-primary to-primary/80 rounded-xl
              hover:shadow-lg hover:shadow-[#2A658F]/30 hover:-translate-y-0.5
              transition-all duration-200"
          >
            <Calendar className="w-4 h-4" />
            Calendário de Entregas
          </button>
        </div>

        {/* Stats */}
        <div
          className={`grid grid-cols-1 sm:grid-cols-3 gap-4 transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '100ms' }}
        >
          <div className="bg-card rounded-2xl p-5 border border-border">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <p className="text-2xl font-semibold text-foreground">{courses.length}</p>
            <p className="text-sm text-muted-foreground">Cursos ativos</p>
          </div>

          <div className="bg-card rounded-2xl p-5 border border-border">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
            <p className="text-2xl font-semibold text-foreground">{totalStudents}</p>
            <p className="text-sm text-muted-foreground">Matrículas totais</p>
          </div>

          <div className="bg-card rounded-2xl p-5 border border-border">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-purple-600" />
              </div>
            </div>
            <p className="text-2xl font-semibold text-foreground">{totalTeachers}</p>
            <p className="text-sm text-muted-foreground">Professores</p>
          </div>
        </div>

        {/* Search */}
        <div
          className={`transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '200ms' }}
        >
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/70" />
            <input
              type="text"
              placeholder="Buscar curso..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-card border border-border rounded-xl
                focus:border-primary focus:ring-4 focus:ring-primary/10 
                transition-all duration-200 outline-none"
            />
          </div>
        </div>

        {/* Courses List */}
        <div
          className={`space-y-3 transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '300ms' }}
        >
          {filtered.length === 0 ? (
            <div className="bg-card rounded-2xl border border-border p-12 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-8 h-8 text-muted-foreground/70" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">Nenhum curso encontrado</h3>
              <p className="text-muted-foreground">Tente ajustar a busca</p>
            </div>
          ) : (
            filtered.map((course) => (
              <div
                key={course.id}
                onClick={() => router.push(`/courses/${course.id}`)}
                className="group bg-card rounded-xl border border-border p-5
                  hover:border-border hover:shadow-lg hover:shadow-foreground/5/50
                  transition-all duration-300 cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                    {course.fullname.charAt(0)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">
                      {course.fullname}
                    </h3>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Users className="w-3.5 h-3.5" />
                        {course.total_students} alunos
                      </span>
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        <GraduationCap className="w-3.5 h-3.5" />
                        {course.teachers.length > 0 ? course.teachers[0] : 'Sem professor'}
                      </span>
                      {!course.visible && (
                        <span className="flex items-center gap-1 text-xs text-amber-600">
                          <EyeOff className="w-3 h-3" />
                          Oculto
                        </span>
                      )}
                    </div>
                  </div>

                  <ArrowRight className="w-5 h-5 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0" />
                </div>
              </div>
            ))
          )}
        </div>

        <p className="text-sm text-muted-foreground text-center">
          Mostrando {filtered.length} de {courses.length} cursos
        </p>
      </div>
    </AppLayout>
  );
}
