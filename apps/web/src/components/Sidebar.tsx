'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import {
  LayoutDashboard,
  Ticket,
  AlertTriangle,
  Users,
  LogOut,
} from 'lucide-react';

const menuItems = [
  { label: 'Dashboard', href: '/', Icon: LayoutDashboard },
  { label: 'Tickets', href: '/tickets', Icon: Ticket },
  { label: 'Risco de Evasão', href: '/risk', Icon: AlertTriangle },
  { label: 'Alunos', href: '/students', Icon: Users },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const initial = (user?.name?.trim()?.[0] || 'A').toUpperCase();

  return (
    <aside className="w-64 bg-[#27273D] min-h-screen flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-white/10">
        <h1 className="text-2xl font-bold text-white tracking-wider">CENAT</h1>
        <p className="text-xs text-white/60 mt-1">Sistema de Retenção</p>
      </div>

      {/* Menu */}
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {menuItems.map(({ label, href, Icon }) => {
            const active = isActive(href);

            return (
              <li key={href}>
                <Link
                  href={href}
                  className={[
                    'group flex items-center gap-3 px-4 py-3 rounded-lg transition-all',
                    active
                      ? 'bg-[#2A658F] text-white shadow-sm'
                      : 'text-white/80 hover:bg-white/10 hover:text-white',
                  ].join(' ')}
                >
                  <Icon
                    size={18}
                    className={active ? 'text-white' : 'text-white/70 group-hover:text-white'}
                  />
                  <span className="font-medium">{label}</span>

                  {/* indicador de ativo */}
                  {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/90" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Info */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-[#2A658F] rounded-full flex items-center justify-center text-white font-bold">
            {initial}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-white font-medium truncate">{user?.name}</p>
            <p className="text-xs text-white/60 truncate">{user?.role}</p>
          </div>
        </div>

        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-red-300 hover:text-red-200 hover:bg-white/10 rounded-lg transition-colors"
          type="button"
        >
          <LogOut size={16} />
          Sair
        </button>
      </div>
    </aside>
  );
}
