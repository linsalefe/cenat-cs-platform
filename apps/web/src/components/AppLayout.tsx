'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { TooltipProvider } from '@/components/ui/tooltip';
import AppSidebar from './Sidebar';
import NotificationBell from './NotificationBell';
import CommandPalette from './CommandPalette';
import ThemeToggle from './ThemeToggle';

interface AppLayoutProps {
  children: React.ReactNode;
}

/* ============================================================
   PAGE TITLES — usado no breadcrumb do topbar
   ============================================================ */
const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/conversations': 'Conversas',
  '/tickets': 'Tickets',
  '/tickets/kanban': 'Tickets (Kanban)',
  '/onboarding': 'Onboarding',
  '/students': 'Alunos',
  '/risk': 'Risco',
  '/feedback': 'NPS/CSAT',
  '/courses': 'Cursos',
  '/courses/calendar': 'Calendário de Cursos',
  '/financial': 'Financeiro',
  '/broadcasts': 'Disparos',
  '/broadcasts/new': 'Novo Disparo',
  '/metrics': 'Métricas',
  '/reports': 'Relatórios',
  '/reports/courses': 'Relatório de Cursos',
  '/reports/inadimplencia': 'Relatório de Inadimplência',
  '/automations': 'Automações',
  '/automations/new': 'Nova Automação',
  '/automations/journeys': 'Jornadas',
  '/workflows': 'Workflows',
  '/workflows/[id]': 'Editor de Workflow',
  '/users': 'Usuários',
  '/settings/onboarding-form': 'Formulário de onboarding',
};

function getPageTitle(pathname: string): string {
  // Match exato
  if (pageTitles[pathname]) return pageTitles[pathname];
  // Match prefixo mais específico primeiro
  const sortedKeys = Object.keys(pageTitles).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (key !== '/' && pathname.startsWith(key + '/')) {
      return pageTitles[key];
    }
  }
  return 'CENAT';
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const pageTitle = getPageTitle(pathname);

  return (
    <TooltipProvider delayDuration={0}>
      <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <h1 className="text-sm font-medium text-foreground">{pageTitle}</h1>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <NotificationBell />
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </main>

        {/* Command palette — global ⌘K */}
        <CommandPalette />
      </SidebarInset>
    </SidebarProvider>
    </TooltipProvider>
  );
}
