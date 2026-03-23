'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { usePermissions } from '@/hooks/usePermissions';
import api from '@/lib/api';
import {
  LayoutDashboard,
  Ticket,
  Users,
  AlertTriangle,
  MessageSquare,
  MessageCircle,
  DollarSign,
  BarChart3,
  UserPlus,
  BookOpen,
  Zap,
  Send,
  LogOut,
  ChevronRight,
  Shield,
} from 'lucide-react';

const menuItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, module: 'dashboard' },
  { href: '/tickets', label: 'Tickets', icon: Ticket, module: 'tickets' },
  { href: '/students', label: 'Alunos', icon: Users, module: 'students' },
  { href: '/risk', label: 'Risco', icon: AlertTriangle, module: 'students' },
  { href: '/feedback', label: 'NPS/CSAT', icon: MessageSquare, module: 'students' },
  { href: '/metrics', label: 'Métricas', icon: BarChart3, module: 'reports' },
  { href: '/courses', label: 'Cursos', icon: BookOpen, module: 'students' },
  { href: '/automations', label: 'Automações', icon: Zap, module: 'automations' },
  { href: '/reports', label: 'Relatórios', icon: BarChart3, module: 'reports' },
  { href: '/broadcasts', label: 'Disparos', icon: Send, module: 'broadcasts' },
  { href: '/conversations', label: 'Conversas', icon: MessageCircle, module: 'conversations' },
  { href: '/onboarding', label: 'Onboarding', icon: UserPlus, module: 'students' },
  { href: '/financial', label: 'Financeiro', icon: DollarSign, module: 'financial' },
  { href: '/users', label: 'Usuários', icon: Shield, module: 'users' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { can, role } = usePermissions();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user) {
      const fetchUnread = async () => {
        try {
          const res = await api.get('/conversations');
          const total = res.data.reduce((acc: number, c: any) => acc + (c.unread_count || 0), 0);
          setUnreadCount(total);
        } catch {}
      };
      fetchUnread();
      const interval = setInterval(fetchUnread, 15000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const ROLE_LABELS: Record<string, string> = {
    admin: 'Administrador',
    gestor: 'Gestor',
    atendente: 'Atendente',
    visualizador: 'Visualizador',
  };

  const visibleItems = menuItems.filter((item) => can(item.module));

  return (
    <aside className="w-64 bg-gradient-to-b from-[#27273D] to-[#1a1a2e] min-h-screen flex flex-col">
      {/* Logo */}
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-[#2A658F] to-[#3d7ba8] rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-lg">C</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-wide">CENAT</h1>
            <p className="text-[#8b8ba3] text-xs">Sistema de Retenção</p>
          </div>
        </div>
      </div>

      {/* Menu */}
      <nav className="flex-1 px-3 py-4">
        <p className="px-4 text-xs font-medium text-[#6b6b80] uppercase tracking-wider mb-3">
          Menu
        </p>
        <ul className="space-y-1">
          {visibleItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`group flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-[#2A658F] text-white shadow-lg shadow-[#2A658F]/20'
                      : 'text-[#a0a0b8] hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-[#6b6b80] group-hover:text-white'}`} />
                    <span className="font-medium">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.href === '/conversations' && unreadCount > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold text-white bg-red-500 rounded-full">
                        {unreadCount}
                      </span>
                    )}
                    {isActive && <ChevronRight className="w-4 h-4 opacity-70" />}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User */}
      <div className="p-4 mx-3 mb-4 bg-white/5 rounded-xl">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2A658F] to-[#3d7ba8] flex items-center justify-center text-white font-semibold text-sm shadow-lg">
            {user?.name ? getInitials(user.name) : 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.name}</p>
            <p className="text-[#6b6b80] text-xs truncate">{ROLE_LABELS[role] || role}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium
            text-[#a0a0b8] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all duration-200"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </aside>
  );
}