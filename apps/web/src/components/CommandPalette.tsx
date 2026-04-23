'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { usePermissions } from '@/hooks/usePermissions';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
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
  Send,
  Shield,
  FileText,
  Zap,
  LogOut,
} from 'lucide-react';

interface CommandItemDef {
  label: string;
  href?: string;
  action?: () => void;
  icon: any;
  module: string;
  group: string;
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { logout } = useAuth();
  const { can } = usePermissions();

  // Keyboard shortcut: ⌘K / Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const allCommands: CommandItemDef[] = [
    { label: 'Dashboard', href: '/', icon: LayoutDashboard, module: 'dashboard', group: 'Navegação' },
    { label: 'Conversas', href: '/conversations', icon: MessageCircle, module: 'conversations', group: 'Atendimento' },
    { label: 'Tickets', href: '/tickets', icon: Ticket, module: 'tickets', group: 'Atendimento' },
    { label: 'Tickets (Kanban)', href: '/tickets/kanban', icon: Ticket, module: 'tickets', group: 'Atendimento' },
    { label: 'Onboarding', href: '/onboarding', icon: UserPlus, module: 'students', group: 'Atendimento' },
    { label: 'Alunos', href: '/students', icon: Users, module: 'students', group: 'Alunos' },
    { label: 'Risco', href: '/risk', icon: AlertTriangle, module: 'students', group: 'Alunos' },
    { label: 'NPS/CSAT', href: '/feedback', icon: MessageSquare, module: 'students', group: 'Alunos' },
    { label: 'Cursos', href: '/courses', icon: BookOpen, module: 'students', group: 'Alunos' },
    { label: 'Financeiro', href: '/financial', icon: DollarSign, module: 'financial', group: 'Financeiro' },
    { label: 'Disparos', href: '/broadcasts', icon: Send, module: 'broadcasts', group: 'Comunicação' },
    { label: 'Novo Disparo', href: '/broadcasts/new', icon: Send, module: 'broadcasts', group: 'Comunicação' },
    { label: 'Automações', href: '/automations', icon: Zap, module: 'automations', group: 'Comunicação' },
    { label: 'Métricas', href: '/metrics', icon: BarChart3, module: 'reports', group: 'Gestão' },
    { label: 'Relatórios', href: '/reports', icon: FileText, module: 'reports', group: 'Gestão' },
    { label: 'Usuários', href: '/users', icon: Shield, module: 'users', group: 'Configuração' },
  ];

  const visible = allCommands.filter((c) => can(c.module));
  const grouped = visible.reduce<Record<string, CommandItemDef[]>>((acc, cmd) => {
    if (!acc[cmd.group]) acc[cmd.group] = [];
    acc[cmd.group].push(cmd);
    return acc;
  }, {});

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const handleLogout = () => {
    setOpen(false);
    logout();
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Buscar páginas, ações..." />
      <CommandList>
        <CommandEmpty>Nada encontrado.</CommandEmpty>
        {Object.entries(grouped).map(([groupName, items]) => (
          <CommandGroup key={groupName} heading={groupName}>
            {items.map((cmd) => {
              const Icon = cmd.icon;
              return (
                <CommandItem
                  key={cmd.label}
                  onSelect={() => cmd.href && go(cmd.href)}
                >
                  <Icon className="w-4 h-4" />
                  <span>{cmd.label}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
        <CommandGroup heading="Sessão">
          <CommandItem onSelect={handleLogout}>
            <LogOut className="w-4 h-4" />
            <span>Sair</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
