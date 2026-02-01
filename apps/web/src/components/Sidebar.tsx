'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import {
  LayoutDashboard,
  Ticket,
  Users,
  AlertTriangle,
  MessageSquare,
  BarChart3,
  BookOpen,
  LogOut,
  ChevronRight,
} from 'lucide-react';

const menuItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/tickets', label: 'Tickets', icon: Ticket },
  { href: '/students', label: 'Alunos', icon: Users },
  { href: '/risk', label: 'Risco', icon: AlertTriangle },
  { href: '/feedback', label: 'NPS/CSAT', icon: MessageSquare },
  { href: '/metrics', label: 'Métricas', icon: BarChart3 },
  { href: '/courses', label: 'Cursos', icon: BookOpen },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

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
          {menuItems.map((item) => {
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
                  {isActive && <ChevronRight className="w-4 h-4 opacity-70" />}
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
            <p className="text-[#6b6b80] text-xs truncate">{user?.email}</p>
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
