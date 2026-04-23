'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import api from '@/lib/api';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface NotificationPreview {
  id: string | number;
  title: string;
  description?: string;
  href: string;
}

export default function NotificationBell() {
  const { user } = useAuth();
  const [previews, setPreviews] = useState<NotificationPreview[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      try {
        const [convRes] = await Promise.all([
          api.get('/conversations').catch(() => ({ data: [] })),
        ]);

        const convs: any[] = Array.isArray(convRes.data) ? convRes.data : [];
        const unreadConvs = convs.filter((c) => (c.unread_count || 0) > 0);

        const total = unreadConvs.reduce((a, c) => a + (c.unread_count || 0), 0);
        setUnreadCount(total);

        const list: NotificationPreview[] = unreadConvs.slice(0, 5).map((c) => ({
          id: c.id,
          title: c.contact_name || c.phone_number || 'Conversa sem título',
          description: `${c.unread_count} nova${c.unread_count > 1 ? 's' : ''} mensagem${c.unread_count > 1 ? 's' : ''}`,
          href: `/conversations?id=${c.id}`,
        }));
        setPreviews(list);
      } catch {
        // silent
      }
    };

    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [user]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative inline-flex items-center justify-center w-9 h-9 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Notificações"
        >
          <Bell className="w-[18px] h-[18px]" />
          {unreadCount > 0 && (
            <span className="badge-unread absolute top-1 right-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-bold text-white bg-destructive rounded-full">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notificações</span>
          {unreadCount > 0 && (
            <span className="text-xs font-normal text-muted-foreground">
              {unreadCount} não lidas
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {previews.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            Nenhuma notificação nova.
          </div>
        ) : (
          previews.map((p) => (
            <DropdownMenuItem key={p.id} asChild>
              <Link href={p.href} className="flex flex-col items-start gap-0.5">
                <span className="text-sm font-medium">{p.title}</span>
                {p.description && (
                  <span className="text-xs text-muted-foreground">
                    {p.description}
                  </span>
                )}
              </Link>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/conversations" className="justify-center text-sm">
            Ver todas as conversas
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
