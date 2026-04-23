'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import AppLayout from '@/components/AppLayout';
import { Avatar } from '@/components/ui';
import {
  ArrowLeft,
  Users,
  GraduationCap,
  BookOpen,
  FileText,
  Calendar,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Search,
} from 'lucide-react';
import api from '@/lib/api';

interface UserData {
  id: number;
  fullname: string;
  email: string;
  lastaccess: number | null;
  lastcourseaccess: number | null;
  roles: string[];
}

interface Module {
  id: number;
  name: string;
  modname: string;
  modplural: string;
  completion: number;
}

interface Section {
  id: number;
  name: string;
  summary: string;
  modules: Module[];
}

interface Assignment {
  id: number;
  name: string;
  duedate: string | null;
  course_id: number;
  course_name: string;
}

interface CourseDetail {
  course_id: number;
  students: UserData[];
  teachers: UserData[];
  total_students: number;
  total_teachers: number;
  sections: Section[];
  total_sections: number;
  assignments: Assignment[];
  total_assignments: number;
  module_types: Record<string, number>;
}

const moduleIcons: Record<string, string> = {
  assign: '📝',
  attendance: '✅',
  forum: '💬',
  resource: '📄',
  folder: '📁',
  page: '📃',
  book: '📖',
  url: '🔗',
  label: '🏷️',
  quiz: '❓',
};

export default function CourseDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const courseId = params.id as string;

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [courseName, setCourseName] = useState('');
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<'students' | 'content' | 'assignments'>('students');
  const [searchStudent, setSearchStudent] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && courseId) {
      loadCourse();
    }
  }, [user, courseId]);

  const loadCourse = async () => {
    try {
      const res = await api.get(`/courses/${courseId}`);
      setCourse(res.data);
      if (res.data.assignments?.length > 0) {
        setCourseName(res.data.assignments[0].course_name);
      }
    } catch (error) {
      console.error('Erro ao carregar curso:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return 'Nunca';
    return new Date(timestamp * 1000).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const daysAgo = (timestamp: number | null) => {
    if (!timestamp) return null;
    const diff = Math.floor((Date.now() / 1000 - timestamp) / 86400);
    if (diff === 0) return 'Hoje';
    if (diff === 1) return 'Ontem';
    return `${diff}d atrás`;
  };

  const toggleSection = (id: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredStudents = course?.students.filter(
    (s) =>
      s.fullname.toLowerCase().includes(searchStudent.toLowerCase()) ||
      s.email.toLowerCase().includes(searchStudent.toLowerCase())
  ) || [];

  const isOverdue = (duedate: string | null) => {
    if (!duedate) return false;
    return new Date(duedate) < new Date();
  };

  const formatDueDate = (duedate: string | null) => {
    if (!duedate) return 'Sem prazo';
    return new Date(duedate).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const daysRemaining = (duedate: string | null) => {
    if (!duedate) return null;
    const diff = Math.ceil((new Date(duedate).getTime() - Date.now()) / 86400000);
    if (diff < 0) return `${Math.abs(diff)}d atrasado`;
    if (diff === 0) return 'Hoje';
    return `${diff}d restantes`;
  };

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="animate-pulse space-y-8">
          <div className="h-8 bg-muted rounded-lg w-64"></div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded-2xl"></div>
            ))}
          </div>
          <div className="h-96 bg-muted rounded-2xl"></div>
        </div>
      </AppLayout>
    );
  }

  if (!course) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">Curso não encontrado</p>
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
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para Cursos
          </button>
          <p className="text-sm font-medium text-primary mb-1">Detalhe do Curso</p>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">
            {courseName || `Curso #${courseId}`}
          </h1>
        </div>

        {/* Stats */}
        <div
          className={`grid grid-cols-2 lg:grid-cols-4 gap-4 transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '100ms' }}
        >
          <div className="bg-card rounded-2xl p-5 border border-border">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mb-3">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-2xl font-semibold text-foreground">{course.total_students}</p>
            <p className="text-sm text-muted-foreground">Alunos</p>
          </div>

          <div className="bg-card rounded-2xl p-5 border border-border">
            <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center mb-3">
              <GraduationCap className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-2xl font-semibold text-foreground">{course.total_teachers}</p>
            <p className="text-sm text-muted-foreground">Professores</p>
          </div>

          <div className="bg-card rounded-2xl p-5 border border-border">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center mb-3">
              <BookOpen className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-2xl font-semibold text-foreground">{course.total_sections}</p>
            <p className="text-sm text-muted-foreground">Seções</p>
          </div>

          <div className="bg-card rounded-2xl p-5 border border-border">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center mb-3">
              <FileText className="w-5 h-5 text-amber-600" />
            </div>
            <p className="text-2xl font-semibold text-foreground">{course.total_assignments}</p>
            <p className="text-sm text-muted-foreground">Atividades</p>
          </div>
        </div>

        {/* Teachers */}
        {course.teachers.length > 0 && (
          <div
            className={`bg-card rounded-2xl border border-border p-5 transition-all duration-700 ease-out ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
            style={{ transitionDelay: '150ms' }}
          >
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Professores</h3>
            <div className="flex flex-wrap gap-3">
              {course.teachers.map((t) => (
                <div key={t.id} className="flex items-center gap-2 bg-purple-50 px-3 py-2 rounded-lg">
                  <Avatar name={t.fullname} size="sm" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{t.fullname}</p>
                    <p className="text-xs text-muted-foreground">{t.email}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div
          className={`transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '200ms' }}
        >
          <div className="flex gap-1 bg-muted p-1 rounded-xl w-fit">
            {[
              { key: 'students', label: 'Alunos', icon: Users },
              { key: 'content', label: 'Conteúdo', icon: BookOpen },
              { key: 'assignments', label: 'Atividades', icon: FileText },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  tab === t.key
                    ? 'bg-card text-primary shadow-sm'
                    : 'text-muted-foreground hover:text-foreground/90'
                }`}
              >
                <t.icon className="w-4 h-4" />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div
          className={`transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '300ms' }}
        >
          {/* Students Tab */}
          {tab === 'students' && (
            <div className="space-y-4">
              <div className="relative max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/70" />
                <input
                  type="text"
                  placeholder="Buscar aluno..."
                  value={searchStudent}
                  onChange={(e) => setSearchStudent(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-card border border-border rounded-xl
                    focus:border-primary focus:ring-4 focus:ring-primary/10 
                    transition-all duration-200 outline-none"
                />
              </div>

              <div className="bg-card rounded-2xl border border-border overflow-hidden">
                <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-muted/50 text-xs font-medium text-muted-foreground uppercase">
                  <div className="col-span-5">Aluno</div>
                  <div className="col-span-3">Último acesso</div>
                  <div className="col-span-2">Acesso curso</div>
                  <div className="col-span-2">Status</div>
                </div>

                {filteredStudents.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">Nenhum aluno encontrado</div>
                ) : (
                  filteredStudents.map((student) => {
                    const lastAccess = student.lastaccess || 0;
                    const daysSince = lastAccess ? Math.floor((Date.now() / 1000 - lastAccess) / 86400) : 999;
                    const statusColor = daysSince <= 7 ? 'bg-emerald-500' : daysSince <= 30 ? 'bg-amber-500' : 'bg-red-500';
                    const statusLabel = daysSince <= 7 ? 'Ativo' : daysSince <= 30 ? 'Irregular' : 'Inativo';

                    return (
                      <div
                        key={student.id}
                        className="grid grid-cols-12 gap-4 px-5 py-4 border-t border-gray-50 hover:bg-muted/50/50 transition-colors"
                      >
                        <div className="col-span-5 flex items-center gap-3">
                          <Avatar name={student.fullname} size="sm" />
                          <div>
                            <p className="text-sm font-medium text-foreground">{student.fullname}</p>
                            <p className="text-xs text-muted-foreground">{student.email}</p>
                          </div>
                        </div>
                        <div className="col-span-3 flex items-center">
                          <div>
                            <p className="text-sm text-foreground/90">{formatDate(student.lastaccess)}</p>
                            <p className="text-xs text-muted-foreground/70">{daysAgo(student.lastaccess)}</p>
                          </div>
                        </div>
                        <div className="col-span-2 flex items-center">
                          <div>
                            <p className="text-sm text-foreground/90">{formatDate(student.lastcourseaccess)}</p>
                            <p className="text-xs text-muted-foreground/70">{daysAgo(student.lastcourseaccess)}</p>
                          </div>
                        </div>
                        <div className="col-span-2 flex items-center">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full
                            ${daysSince <= 7 ? 'bg-emerald-50 text-emerald-700' : daysSince <= 30 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${statusColor}`}></span>
                            {statusLabel}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <p className="text-sm text-muted-foreground text-center">
                {filteredStudents.length} alunos
              </p>
            </div>
          )}

          {/* Content Tab */}
          {tab === 'content' && (
            <div className="space-y-2">
              {course.sections.filter((s) => s.name).map((section) => (
                <div key={section.id} className="bg-card rounded-xl border border-border overflow-hidden">
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {expandedSections.has(section.id) ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground/70" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground/70" />
                      )}
                      <h3 className="text-sm font-medium text-foreground text-left">{section.name}</h3>
                    </div>
                    <span className="text-xs text-muted-foreground/70">{section.modules.length} itens</span>
                  </button>

                  {expandedSections.has(section.id) && section.modules.length > 0 && (
                    <div className="px-5 pb-4 space-y-1">
                      {section.modules.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <span className="text-base">{moduleIcons[m.modname] || '📎'}</span>
                          <span className="text-sm text-foreground/90">{m.name}</span>
                          <span className="text-xs text-muted-foreground/70 ml-auto">{m.modname}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Assignments Tab */}
          {tab === 'assignments' && (
            <div className="space-y-3">
              {course.assignments.length === 0 ? (
                <div className="bg-card rounded-2xl border border-border p-12 text-center">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-muted-foreground/70" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">Nenhuma atividade</h3>
                  <p className="text-muted-foreground">Este curso não possui atividades avaliativas</p>
                </div>
              ) : (
                course.assignments.map((a) => {
                  const overdue = isOverdue(a.duedate);
                  const remaining = daysRemaining(a.duedate);

                  return (
                    <div
                      key={a.id}
                      className={`bg-card rounded-xl border p-5 transition-all ${
                        overdue ? 'border-red-200' : 'border-border'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            overdue ? 'bg-red-50' : 'bg-blue-50'
                          }`}>
                            <FileText className={`w-5 h-5 ${overdue ? 'text-red-600' : 'text-blue-600'}`} />
                          </div>
                          <div>
                            <h4 className="font-medium text-foreground">{a.name}</h4>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Calendar className="w-3.5 h-3.5" />
                                {formatDueDate(a.duedate)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {remaining && (
                          <span className={`text-xs font-medium px-3 py-1.5 rounded-full ${
                            overdue
                              ? 'bg-red-50 text-red-600'
                              : 'bg-emerald-50 text-emerald-600'
                          }`}>
                            {remaining}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
