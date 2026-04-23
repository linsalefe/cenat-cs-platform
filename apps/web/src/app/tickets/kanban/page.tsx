'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import AppLayout from '@/components/AppLayout';
import { Avatar } from '@/components/ui';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent, DragOverEvent } from '@dnd-kit/core';
import {
  Inbox,
  Timer,
  Clock,
  CheckCircle2,
  List,
  Columns3,
  Search,
  AlertCircle,
  User,
  Plus,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

interface TicketItem {
  id: number;
  protocol: string;
  subject: string;
  status: string;
  category: string;
  priority: string;
  sla_deadline: string;
  created_at: string;
  student: { id: number; name: string; email: string };
  assigned_to: { id: number; name: string } | null;
}

const columns = [
  { id: 'open', label: 'Aberto', color: 'text-blue-700', bg: 'bg-blue-50', headerBg: 'bg-blue-500', icon: Inbox },
  { id: 'in_progress', label: 'Em Andamento', color: 'text-amber-700', bg: 'bg-amber-50', headerBg: 'bg-amber-500', icon: Timer },
  { id: 'waiting_student', label: 'Aguardando Aluno', color: 'text-purple-700', bg: 'bg-purple-50', headerBg: 'bg-purple-500', icon: Clock },
  { id: 'resolved', label: 'Resolvido', color: 'text-emerald-700', bg: 'bg-emerald-50', headerBg: 'bg-emerald-500', icon: CheckCircle2 },
];

const priorityConfig: Record<string, { label: string; color: string; dot: string }> = {
  low: { label: 'Baixa', color: 'text-muted-foreground', dot: 'bg-gray-400' },
  medium: { label: 'Média', color: 'text-amber-600', dot: 'bg-amber-400' },
  high: { label: 'Alta', color: 'text-orange-600', dot: 'bg-orange-500' },
  urgent: { label: 'Urgente', color: 'text-red-600', dot: 'bg-red-500' },
};

const categoryLabels: Record<string, string> = {
  financial: 'Financeiro',
  academic: 'Acadêmico',
  technical: 'Técnico',
  administrative: 'Administrativo',
  other: 'Outro',
};

function DraggableCard({ ticket, onClick }: { ticket: TicketItem; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `ticket-${ticket.id}`,
    data: { ticket },
  });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: isDragging ? 999 : undefined }
    : undefined;

  const priority = priorityConfig[ticket.priority] || priorityConfig.medium;
  const isOverdue =
    new Date(ticket.sla_deadline) < new Date() && !['resolved', 'closed'].includes(ticket.status);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`bg-card rounded-xl border border-border p-3.5 cursor-grab active:cursor-grabbing
        hover:border-border hover:shadow-md transition-shadow duration-200 group touch-none
        ${isDragging ? 'opacity-50 shadow-xl' : ''}`}
    >
      <div onClick={(e) => { if (!isDragging) onClick(); }} className="cursor-pointer">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-medium text-primary">{ticket.protocol}</span>
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${priority.dot}`} />
            <span className={`text-[10px] font-medium ${priority.color}`}>{priority.label}</span>
          </div>
        </div>
        <h4 className="text-sm font-medium text-foreground leading-snug mb-2 line-clamp-2 group-hover:text-primary transition-colors">
          {ticket.subject}
        </h4>
        <div className="flex items-center gap-2 mb-2">
          <Avatar name={ticket.student.name} size="xs" />
          <span className="text-xs text-muted-foreground truncate">{ticket.student.name}</span>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-gray-50">
          <span className="text-[10px] text-muted-foreground/70">{categoryLabels[ticket.category] || ticket.category}</span>
          <div className="flex items-center gap-2">
            {ticket.assigned_to && (
              <span className="text-[10px] text-muted-foreground/70 flex items-center gap-1">
                <User className="w-3 h-3" />
                {ticket.assigned_to.name.split(' ')[0]}
              </span>
            )}
            {isOverdue && (
              <span className="text-[10px] text-red-500 font-medium flex items-center gap-0.5 animate-pulse">
                <AlertCircle className="w-3 h-3" />
                SLA
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TicketCardOverlay({ ticket }: { ticket: TicketItem }) {
  const priority = priorityConfig[ticket.priority] || priorityConfig.medium;
  return (
    <div className="bg-card rounded-xl border-2 border-primary p-3.5 shadow-2xl w-72 rotate-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-medium text-primary">{ticket.protocol}</span>
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${priority.dot}`} />
          <span className={`text-[10px] font-medium ${priority.color}`}>{priority.label}</span>
        </div>
      </div>
      <h4 className="text-sm font-medium text-foreground leading-snug mb-2 line-clamp-2">{ticket.subject}</h4>
      <div className="flex items-center gap-2">
        <Avatar name={ticket.student.name} size="xs" />
        <span className="text-xs text-muted-foreground truncate">{ticket.student.name}</span>
      </div>
    </div>
  );
}

function KanbanColumn({
  column,
  tickets,
  onTicketClick,
  isOver,
}: {
  column: (typeof columns)[0];
  tickets: TicketItem[];
  onTicketClick: (id: number) => void;
  isOver: boolean;
}) {
  const Icon = column.icon;
  const { setNodeRef } = useDroppable({ id: column.id });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-2xl min-w-[280px] w-[280px] max-h-full transition-all duration-200 ${
        isOver ? 'bg-blue-50/80 ring-2 ring-primary/30 scale-[1.01]' : 'bg-muted/50/80'
      }`}
    >
      <div className="px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${column.headerBg}`} />
          <h3 className={`text-sm font-semibold ${column.color}`}>{column.label}</h3>
        </div>
        <span className={`inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 text-[11px] font-bold rounded-full ${column.bg} ${column.color}`}>
          {tickets.length}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2.5 min-h-[200px]">
        {tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Icon className="w-8 h-8 text-muted-foreground/50 mb-2" />
            <p className="text-xs text-muted-foreground/70">{isOver ? 'Solte aqui' : 'Nenhum ticket'}</p>
          </div>
        ) : (
          tickets.map((ticket) => (
            <DraggableCard key={ticket.id} ticket={ticket} onClick={() => onTicketClick(ticket.id)} />
          ))
        )}
      </div>
    </div>
  );
}

export default function KanbanPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTicket, setActiveTicket] = useState<TicketItem | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (!authLoading && !user) router.push('/login'); }, [user, authLoading, router]);
  useEffect(() => { if (user) loadTickets(); }, [user]);

  const loadTickets = async () => {
    try {
      const res = await api.get('/tickets');
      setTickets(res.data);
    } catch (error) {
      console.error('Erro ao carregar tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTickets = useMemo(() => {
    if (!search) return tickets;
    const s = search.toLowerCase();
    return tickets.filter(
      (t) => t.protocol.toLowerCase().includes(s) || t.subject.toLowerCase().includes(s) || t.student.name.toLowerCase().includes(s)
    );
  }, [tickets, search]);

  const ticketsByStatus = useMemo(() => {
    const grouped: Record<string, TicketItem[]> = {};
    columns.forEach((col) => { grouped[col.id] = filteredTickets.filter((t) => t.status === col.id); });
    return grouped;
  }, [filteredTickets]);

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.ticket) setActiveTicket(data.ticket);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (!over) { setOverColumnId(null); return; }
    const isColumn = columns.some((c) => c.id === over.id.toString());
    if (isColumn) {
      setOverColumnId(over.id.toString());
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTicket(null);
    setOverColumnId(null);
    if (!over) return;

    const data = active.data.current;
    const ticket = data?.ticket as TicketItem | undefined;
    if (!ticket) return;

    const sourceColumn = ticket.status;
    let targetColumn: string | null = null;

    const isColumn = columns.some((c) => c.id === over.id.toString());
    if (isColumn) {
      targetColumn = over.id.toString();
    }

    if (!targetColumn || sourceColumn === targetColumn) return;

    setTickets((prev) => prev.map((t) => (t.id === ticket.id ? { ...t, status: targetColumn! } : t)));

    try {
      await api.patch(`/tickets/${ticket.id}/status?status=${targetColumn}`);
      toast.success(`Ticket movido para "${columns.find((c) => c.id === targetColumn)?.label}"`);
    } catch (error) {
      toast.error('Erro ao mover ticket');
      loadTickets();
    }
  };

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded-lg w-48"></div>
          <div className="flex gap-4">
            {[...Array(4)].map((_, i) => (<div key={i} className="w-72 h-96 bg-muted rounded-2xl flex-shrink-0"></div>))}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className={`transition-all duration-700 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <p className="text-sm font-medium text-primary mb-1">Atendimento</p>
            <h1 className="text-3xl font-semibold text-foreground tracking-tight">Tickets</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
              <input type="text" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm w-56 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all duration-200 outline-none" />
            </div>
            <div className="flex bg-card border border-border rounded-xl overflow-hidden">
              <button onClick={() => router.push('/tickets')} className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors">
                <List className="w-4 h-4" />Lista
              </button>
              <button className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium bg-primary text-white">
                <Columns3 className="w-4 h-4" />Kanban
              </button>
            </div>
            <button onClick={() => router.push('/tickets?create=true')}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-primary to-primary/80 rounded-xl hover:shadow-lg hover:shadow-[#2A658F]/30 hover:-translate-y-0.5 transition-all duration-200">
              <Plus className="w-4 h-4" />Novo
            </button>
          </div>
        </div>

        <div className="overflow-x-auto pb-4" style={{ height: 'calc(100vh - 220px)' }}>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
            <div className="flex gap-4 h-full min-w-max">
              {columns.map((column) => (
                <KanbanColumn key={column.id} column={column} tickets={ticketsByStatus[column.id] || []} onTicketClick={(id) => router.push(`/tickets/${id}`)} isOver={overColumnId === column.id} />
              ))}
            </div>
            <DragOverlay dropAnimation={null}>
              {activeTicket ? <TicketCardOverlay ticket={activeTicket} /> : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>
    </AppLayout>
  );
}
