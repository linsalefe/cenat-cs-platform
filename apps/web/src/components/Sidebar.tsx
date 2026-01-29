'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';

const menuItems = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/tickets', label: 'Tickets', icon: '🎫' },
  { href: '/students', label: 'Alunos', icon: '👥' },
  { href: '/risk', label: 'Risco', icon: '⚠️' },
  { href: '/feedback', label: 'NPS/CSAT', icon: '📈' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="w-64 bg-[#27273D] min-h-screen flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-gray-700">
        <h1 className="text-2xl font-bold text-white tracking-wider">CENAT</h1>
        <p className="text-[#CCE4F4] text-xs mt-1">Sistema de Retenção</p>
      </div>

      {/* Menu */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== '/' && pathname.startsWith(item.href));
            
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-[#2A658F] text-white'
                      : 'text-[#CCE4F4] hover:bg-[#2A658F]/50'
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User */}
      <div className="p-4 border-t border-gray-700">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-[#2A658F] flex items-center justify-center text-white font-bold">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.name}</p>
            <p className="text-[#CCE4F4] text-xs truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
        >
          Sair
        </button>
      </div>
    </aside>
  );
}
