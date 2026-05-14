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
  MessageSquareText,
  MessageCircle,
  DollarSign,
  BarChart3,
  UserPlus,
  BookOpen,
  Send,
  LogOut,
  Shield,
  FileText,
  Search,
  Zap,
  Workflow,
  ClipboardList,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface MenuItem {
  href: string;
  label: string;
  icon: any;
  module: string;
  hasBadge?: boolean;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

const menuSections: MenuSection[] = [
  {
    title: 'Visão Geral',
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard, module: 'dashboard' },
      { href: '/metrics', label: 'Métricas', icon: BarChart3, module: 'reports' },
    ],
  },
  {
    title: 'Atendimento',
    items: [
      { href: '/conversations', label: 'Conversas', icon: MessageCircle, module: 'conversations', hasBadge: true },
      { href: '/tickets', label: 'Tickets', icon: Ticket, module: 'tickets' },
      { href: '/onboarding', label: 'Onboarding', icon: UserPlus, module: 'students' },
    ],
  },
  {
    title: 'Alunos',
    items: [
      { href: '/students', label: 'Alunos', icon: Users, module: 'students' },
      { href: '/risk', label: 'Risco', icon: AlertTriangle, module: 'students' },
      { href: '/feedback', label: 'NPS/CSAT', icon: MessageSquare, module: 'students' },
      { href: '/courses', label: 'Cursos', icon: BookOpen, module: 'students' },
    ],
  },
  {
    title: 'Financeiro',
    items: [
      { href: '/financial', label: 'Financeiro', icon: DollarSign, module: 'financial' },
    ],
  },
  {
    title: 'Comunicação',
    items: [
      { href: '/broadcasts', label: 'Disparos', icon: Send, module: 'broadcasts' },
      { href: '/automations', label: 'Automações', icon: Zap, module: 'automations' },
      { href: '/workflows', label: 'Workflows', icon: Workflow, module: 'workflows' },
      { href: '/templates', label: 'Templates', icon: MessageSquareText, module: 'workflows' },
    ],
  },
  {
    title: 'Gestão',
    items: [
      { href: '/reports', label: 'Relatórios', icon: FileText, module: 'reports' },
    ],
  },
  {
    title: 'Configuração',
    items: [
      { href: '/settings/onboarding-form', label: 'Formulário', icon: ClipboardList, module: 'onboarding_form' },
      { href: '/users', label: 'Usuários', icon: Shield, module: 'users' },
    ],
  },
];

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  gestor: 'Gestor',
  atendente: 'Atendente',
  visualizador: 'Visualizador',
};

function getInitials(name: string): string {
  return (name || '??')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function AppSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { can, role } = usePermissions();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user) {
      const fetchUnread = async () => {
        try {
          const res = await api.get('/conversations');
          const total = res.data.reduce(
            (acc: number, c: any) => acc + (c.unread_count || 0),
            0
          );
          setUnreadCount(total);
        } catch {}
      };
      fetchUnread();
      const interval = setInterval(fetchUnread, 15000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const visibleSections = menuSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => can(item.module)),
    }))
    .filter((section) => section.items.length > 0);

  const openSearch = () => {
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'k',
        metaKey: true,
        ctrlKey: true,
        bubbles: true,
      })
    );
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-chart-8 flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="text-white font-bold text-sm">C</span>
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="font-semibold text-[15px] tracking-wide leading-tight text-foreground">
              CENAT
            </span>
            <span className="text-[10px] text-muted-foreground font-medium">
              Sistema de Retenção
            </span>
          </div>
        </div>

        {/* Search button */}
        <button
          onClick={openSearch}
          className="sidebar-search mt-3 w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all duration-200
                     bg-muted/30 hover:bg-muted/60 border border-border/50 text-muted-foreground"
        >
          <Search className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1 text-left text-[13px] group-data-[collapsible=icon]:hidden">
            Buscar...
          </span>
          <kbd className="px-1.5 py-0.5 bg-background text-muted-foreground text-[10px] font-medium rounded border border-border group-data-[collapsible=icon]:hidden">
            ⌘K
          </kbd>
        </button>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {visibleSections.map((section) => (
          <SidebarGroup key={section.title}>
            <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {section.title}
            </SidebarGroupLabel>
            <SidebarMenu>
              {section.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/' && pathname.startsWith(item.href + '/'));
                const Icon = item.icon;
                const showBadge = item.hasBadge && unreadCount > 0;

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                      className={isActive ? 'sidebar-item-active' : ''}
                    >
                      <Link href={item.href}>
                        <div className={`sidebar-icon-wrap ${isActive ? 'bg-primary/10' : ''}`}>
                          <Icon
                            className={`w-[18px] h-[18px] sidebar-icon-colored transition-colors duration-150 ${
                              isActive ? 'text-primary' : 'text-muted-foreground/70'
                            }`}
                            strokeWidth={isActive ? 2 : 1.75}
                          />
                        </div>
                        <span className={`flex-1 ${isActive ? 'font-medium' : ''}`}>
                          {item.label}
                        </span>
                        {showBadge && (
                          <span className="badge-unread inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold text-white bg-destructive rounded-full">
                            {unreadCount}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="sidebar-user-card w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-accent transition-colors text-left">
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                  {getInitials(user?.name || '')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                <p className="text-sm font-medium text-foreground truncate">
                  {user?.name}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {ROLE_LABELS[role] || role}
                </p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{user?.name}</span>
                <span className="text-xs text-muted-foreground truncate">
                  {user?.email}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={logout}
              className="text-destructive focus:text-destructive focus:bg-destructive/10"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
