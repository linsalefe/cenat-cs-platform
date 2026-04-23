'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import AppLayout from '@/components/AppLayout';
import {
  Users,
  Plus,
  Loader2,
  Shield,
  Eye,
  Headphones,
  Crown,
  Pencil,
  Trash2,
  X,
  Check,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

interface UserData {
  id: number;
  name: string;
  email: string;
  role: string;
  channel: string | null;
  is_active: boolean;
  created_at: string;
}

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  admin: { label: 'Admin', color: 'text-purple-700', bg: 'bg-purple-50', icon: Crown },
  gestor: { label: 'Gestor', color: 'text-blue-700', bg: 'bg-blue-50', icon: Shield },
  atendente: { label: 'Atendente', color: 'text-emerald-700', bg: 'bg-emerald-50', icon: Headphones },
  visualizador: { label: 'Visualizador', color: 'text-muted-foreground', bg: 'bg-muted', icon: Eye },
};

export default function UsersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'atendente', channel: '' });

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (!authLoading && !user) router.push('/login'); }, [user, authLoading, router]);
  useEffect(() => { if (user) loadUsers(); }, [user]);

  const loadUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } catch {
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingUser(null);
    setForm({ name: '', email: '', password: '', role: 'atendente', channel: '' });
    setShowModal(true);
  };

  const openEdit = (u: UserData) => {
    setEditingUser(u);
    setForm({ name: u.name, email: u.email, password: '', role: u.role, channel: u.channel || '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      if (editingUser) {
        const payload: any = { name: form.name, role: form.role, channel: form.channel || null };
        if (form.password) payload.password = form.password;
        await api.put(`/users/${editingUser.id}`, payload);
        toast.success('Usuário atualizado!');
      } else {
        if (!form.password) return toast.error('Senha obrigatória');
        await api.post('/users', form);
        toast.success('Usuário criado!');
      }
      setShowModal(false);
      loadUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Erro ao salvar');
    }
  };

  const handleToggleActive = async (u: UserData) => {
    try {
      await api.put(`/users/${u.id}`, { is_active: !u.is_active });
      toast.success(u.is_active ? 'Usuário desativado' : 'Usuário ativado');
      loadUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Erro');
    }
  };

  const handleDelete = async (u: UserData) => {
    if (!confirm(`Deletar ${u.name}? Esta ação não pode ser desfeita.`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      toast.success('Usuário deletado');
      loadUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Erro ao deletar');
    }
  };

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-muted-foreground/70 animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className={`flex items-end justify-between transition-all duration-700 ease-out ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
        }`}>
          <div>
            <p className="text-sm font-medium text-purple-600 mb-1">Gestão de Equipe</p>
            <h1 className="text-3xl font-semibold text-foreground tracking-tight">Usuários</h1>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-[#1E4F73] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Usuário
          </button>
        </div>

        {/* Role Legend */}
        <div className={`flex gap-3 transition-all duration-700 ease-out ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`} style={{ transitionDelay: '100ms' }}>
          {Object.entries(ROLE_CONFIG).map(([key, cfg]) => {
            const Icon = cfg.icon;
            const count = users.filter(u => u.role === key).length;
            return (
              <div key={key} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${cfg.bg}`}>
                <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                <span className={`text-sm font-medium ${cfg.color}`}>{cfg.label}</span>
                <span className={`text-xs ${cfg.color} opacity-70`}>({count})</span>
              </div>
            );
          })}
        </div>

        {/* Users Table */}
        <div className={`bg-card rounded-2xl border border-border overflow-hidden transition-all duration-700 ease-out ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`} style={{ transitionDelay: '200ms' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium text-muted-foreground uppercase border-b border-border">
                <th className="px-6 py-4">Usuário</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Canal</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Criado em</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((u) => {
                const cfg = ROLE_CONFIG[u.role] || ROLE_CONFIG.atendente;
                const Icon = cfg.icon;
                return (
                  <tr key={u.id} className="hover:bg-muted/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                          u.is_active ? 'bg-primary' : 'bg-gray-400'
                        }`}>
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{u.name}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                        <Icon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {u.channel ? u.channel.toUpperCase() : 'Todos'}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleActive(u)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          u.is_active
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'bg-red-50 text-red-700 hover:bg-red-100'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        {u.is_active ? 'Ativo' : 'Inativo'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString('pt-BR') : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(u)}
                          className="p-2 text-muted-foreground/70 hover:text-primary hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(u)}
                          className="p-2 text-muted-foreground/70 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card rounded-2xl w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">
                {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 text-muted-foreground/70 hover:text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground/90 mb-1">Nome</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Nome completo"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground/90 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  disabled={!!editingUser}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-muted/50 disabled:text-muted-foreground"
                  placeholder="email@exemplo.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground/90 mb-1">
                  {editingUser ? 'Nova Senha (deixe vazio para manter)' : 'Senha'}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground/90 mb-2">Perfil de Acesso</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(ROLE_CONFIG).map(([key, cfg]) => {
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={key}
                        onClick={() => setForm({ ...form, role: key })}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                          form.role === key
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-muted-foreground hover:border-border'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {(form.role === 'atendente' || form.role === 'visualizador') && (
                <div>
                  <label className="block text-sm font-medium text-foreground/90 mb-2">Canal</label>
                  <select
                    value={form.channel}
                    onChange={(e) => setForm({ ...form, channel: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">Todos os canais</option>
                    <option value="cs">CS</option>
                    <option value="financeiro">Financeiro</option>
                    <option value="pedagogico">Pedagógico</option>
                    <option value="atendimento">Atendimento</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-xl hover:bg-[#1E4F73] transition-colors"
              >
                <Check className="w-4 h-4" />
                {editingUser ? 'Salvar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}