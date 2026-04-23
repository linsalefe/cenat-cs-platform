'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  GitBranch,
  Plus,
  Power,
  Trash2,
  ChevronRight,
  Users,
  Clock,
  MessageSquare,
  Loader2,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

interface JourneyRule {
  id: number;
  name: string;
  description: string | null;
  trigger_type: string;
  channel: string;
  on_reply: string;
  is_active: boolean;
  steps_count: number;
  active_students: number;
  total_students: number;
  created_at: string;
}

const triggerLabels: Record<string, string> = {
  new_enrollment: 'Matrícula nova',
  first_login: 'Primeiro login',
  payment_overdue: 'Pagamento atrasado',
  days_without_access: 'Dias sem acesso',
};

const replyLabels: Record<string, string> = {
  pause: 'Pausa e direciona para humano',
  continue: 'Continua normalmente',
  stop: 'Para a régua',
};

export default function JourneysTab() {
  const router = useRouter();
  const [journeys, setJourneys] = useState<JourneyRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadJourneys();
  }, []);

  const loadJourneys = async () => {
    try {
      const res = await api.get('/journeys');
      setJourneys(res.data.data || []);
    } catch (error) {
      console.error('Erro ao carregar réguas:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleJourney = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await api.post(`/journeys/${id}/toggle`);
      setJourneys((prev) =>
        prev.map((j) => (j.id === id ? { ...j, is_active: res.data.is_active } : j))
      );
      toast.success(res.data.message);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Erro ao atualizar');
    }
  };

  const deleteJourney = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Tem certeza que deseja excluir esta régua?')) return;
    try {
      await api.delete(`/journeys/${id}`);
      setJourneys((prev) => prev.filter((j) => j.id !== id));
      toast.success('Régua removida');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Erro ao remover');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-muted-foreground/70 animate-spin" />
      </div>
    );
  }

  const activeCount = journeys.filter((j) => j.is_active).length;
  const totalStudents = journeys.reduce((sum, j) => sum + j.active_students, 0);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-2xl p-5 border border-border">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center mb-3">
            <GitBranch className="w-5 h-5 text-indigo-600" />
          </div>
          <p className="text-2xl font-semibold text-foreground">{journeys.length}</p>
          <p className="text-sm text-muted-foreground">Total de réguas</p>
        </div>

        <div className="bg-card rounded-2xl p-5 border border-border">
          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center mb-3">
            <Power className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-2xl font-semibold text-foreground">{activeCount}</p>
          <p className="text-sm text-muted-foreground">Ativas</p>
        </div>

        <div className="bg-card rounded-2xl p-5 border border-border">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mb-3">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-semibold text-foreground">{totalStudents}</p>
          <p className="text-sm text-muted-foreground">Alunos em jornada</p>
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {journeys.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-12 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <GitBranch className="w-8 h-8 text-muted-foreground/70" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">Nenhuma régua criada</h3>
            <p className="text-muted-foreground mb-4">Crie sua primeira régua de jornada</p>
            <button
              onClick={() => router.push('/automations/journeys/new')}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary
                bg-primary/10 hover:bg-primary/15 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Criar régua
            </button>
          </div>
        ) : (
          journeys.map((journey) => (
            <div
              key={journey.id}
              onClick={() => router.push(`/automations/journeys/${journey.id}`)}
              className={`group bg-card rounded-xl border p-5 cursor-pointer
                hover:shadow-lg hover:shadow-foreground/5/50 transition-all duration-300
                ${journey.is_active ? 'border-border hover:border-border' : 'border-border opacity-60'}`}
            >
              <div className="flex items-center gap-4">
                {/* Icon */}
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  journey.is_active ? 'bg-gradient-to-br from-indigo-500 to-purple-600' : 'bg-muted-foreground/20'
                }`}>
                  <GitBranch className="w-6 h-6 text-white" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">
                      {journey.name}
                    </h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      journey.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-muted text-muted-foreground'
                    }`}>
                      {journey.is_active ? 'Ativa' : 'Inativa'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {triggerLabels[journey.trigger_type] || journey.trigger_type}
                    </span>
                    <span className="text-muted-foreground/50">→</span>
                    <span className="flex items-center gap-1 text-indigo-600">
                      <MessageSquare className="w-3.5 h-3.5" />
                      {journey.steps_count} mensagens
                    </span>
                    <span className="text-muted-foreground/50">|</span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {journey.active_students} ativos
                    </span>
                  </div>
                  {journey.description && (
                    <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-1">{journey.description}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={(e) => toggleJourney(journey.id, e)}
                    className={`p-2 rounded-lg transition-colors ${
                      journey.is_active
                        ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                        : 'bg-muted text-muted-foreground/70 hover:bg-muted-foreground/20'
                    }`}
                    title={journey.is_active ? 'Desativar' : 'Ativar'}
                  >
                    <Power className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => deleteJourney(journey.id, e)}
                    className="p-2 rounded-lg text-muted-foreground/70 hover:bg-red-50 hover:text-red-600 transition-colors"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}