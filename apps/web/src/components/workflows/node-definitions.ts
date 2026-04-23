import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  Moon,
  Ticket,
  DollarSign,
  MessageSquare,
  Send,
  FilePlus,
  UserCheck,
  Route,
  GitBranch,
  BookOpen,
  Shield,
  Clock,
} from 'lucide-react';

/* ============================================================
   TYPES
   ============================================================ */

export type NodeKind = 'trigger' | 'action' | 'condition' | 'delay';

export type FieldSpec =
  | {
      key: string;
      type: 'number';
      label: string;
      placeholder?: string;
      min?: number;
      max?: number;
      step?: number;
      required?: boolean;
      helpText?: string;
    }
  | {
      key: string;
      type: 'text';
      label: string;
      placeholder?: string;
      required?: boolean;
      helpText?: string;
    }
  | {
      key: string;
      type: 'select';
      label: string;
      options: Array<{ value: string; label: string }>;
      required?: boolean;
      helpText?: string;
    }
  | {
      key: string;
      type: 'remoteSelect';
      label: string;
      endpoint: '/courses' | '/users' | '/whatsapp/templates';
      valueKey: string;
      labelKey: string;
      multiple?: boolean;
      required?: boolean;
      helpText?: string;
    };

export interface NodeDefinition {
  type: string;
  kind: NodeKind;
  label: string;
  description: string;
  icon: LucideIcon;
  color: 'red' | 'blue' | 'emerald' | 'amber' | 'violet' | 'slate';
  defaultData: Record<string, unknown>;
  fields: FieldSpec[];
}

/* ============================================================
   DEFINITIONS — 5 triggers + 4 actions + 2 conditions + 1 delay
   ============================================================ */

export const NODE_DEFINITIONS: Record<string, NodeDefinition> = {
  /* ---------- TRIGGERS ---------- */
  'trigger.risk_critical': {
    type: 'trigger.risk_critical',
    kind: 'trigger',
    label: 'Aluno em risco',
    description: 'Dispara quando um aluno atinge o nível de risco escolhido.',
    icon: AlertTriangle,
    color: 'red',
    defaultData: { min_level: 'alto' },
    fields: [
      {
        key: 'min_level',
        type: 'select',
        label: 'Nível mínimo',
        options: [
          { value: 'baixo', label: 'Baixo ou superior' },
          { value: 'medio', label: 'Médio ou superior' },
          { value: 'alto', label: 'Alto ou superior' },
          { value: 'critico', label: 'Crítico' },
        ],
        required: true,
      },
    ],
  },
  'trigger.inactive_moodle': {
    type: 'trigger.inactive_moodle',
    kind: 'trigger',
    label: 'Inativo no Moodle',
    description: 'Dispara quando o aluno não acessa o Moodle por N dias.',
    icon: Moon,
    color: 'amber',
    defaultData: { days: 7 },
    fields: [
      {
        key: 'days',
        type: 'number',
        label: 'Dias sem acesso',
        min: 1,
        max: 180,
        step: 1,
        required: true,
      },
    ],
  },
  'trigger.ticket_opened': {
    type: 'trigger.ticket_opened',
    kind: 'trigger',
    label: 'Ticket aberto',
    description: 'Dispara quando um ticket novo é criado.',
    icon: Ticket,
    color: 'blue',
    defaultData: { min_priority: 'baixa' },
    fields: [
      {
        key: 'min_priority',
        type: 'select',
        label: 'Prioridade mínima',
        options: [
          { value: 'baixa', label: 'Baixa ou superior' },
          { value: 'media', label: 'Média ou superior' },
          { value: 'alta', label: 'Alta ou superior' },
          { value: 'urgente', label: 'Urgente' },
        ],
        required: true,
      },
    ],
  },
  'trigger.payment_overdue': {
    type: 'trigger.payment_overdue',
    kind: 'trigger',
    label: 'Pagamento vencido',
    description: 'Dispara quando uma cobrança vence há N dias sem pagamento.',
    icon: DollarSign,
    color: 'red',
    defaultData: { days: 3 },
    fields: [
      {
        key: 'days',
        type: 'number',
        label: 'Dias em atraso',
        min: 1,
        max: 180,
        step: 1,
        required: true,
        helpText: 'Recomendado: 3 para primeiro contato, 7-15 para cobrança mais firme.',
      },
    ],
  },
  'trigger.nps_low': {
    type: 'trigger.nps_low',
    kind: 'trigger',
    label: 'NPS baixo',
    description: 'Dispara quando o aluno responde NPS com nota abaixo do limite.',
    icon: MessageSquare,
    color: 'amber',
    defaultData: { max_score: 6 },
    fields: [
      {
        key: 'max_score',
        type: 'number',
        label: 'Nota máxima',
        min: 0,
        max: 10,
        step: 1,
        required: true,
        helpText: '0-6 = detrator, 7-8 = neutro, 9-10 = promotor. Padrão: 6.',
      },
    ],
  },

  /* ---------- ACTIONS ---------- */
  'action.send_whatsapp': {
    type: 'action.send_whatsapp',
    kind: 'action',
    label: 'Enviar WhatsApp',
    description: 'Dispara um template aprovado via WhatsApp Cloud API.',
    icon: Send,
    color: 'emerald',
    defaultData: { template_name: '', channel: 'cs' },
    fields: [
      {
        key: 'template_name',
        type: 'remoteSelect',
        label: 'Template',
        endpoint: '/whatsapp/templates',
        valueKey: 'name',
        labelKey: 'name',
        required: true,
        helpText: 'Apenas templates aprovados pela Meta são listados.',
      },
      {
        key: 'channel',
        type: 'select',
        label: 'Canal de envio',
        options: [
          { value: 'cs', label: 'CS (+55 11 93618-0797)' },
          { value: 'financeiro', label: 'Financeiro (+55 11 93619-1990)' },
        ],
        required: true,
      },
    ],
  },
  'action.create_ticket': {
    type: 'action.create_ticket',
    kind: 'action',
    label: 'Criar ticket',
    description: 'Abre um ticket interno associado ao aluno.',
    icon: FilePlus,
    color: 'blue',
    defaultData: { title: '', priority: 'media', assigned_to: null },
    fields: [
      {
        key: 'title',
        type: 'text',
        label: 'Título do ticket',
        placeholder: 'Ex: Follow-up de aluno inativo',
        required: true,
      },
      {
        key: 'priority',
        type: 'select',
        label: 'Prioridade',
        options: [
          { value: 'baixa', label: 'Baixa' },
          { value: 'media', label: 'Média' },
          { value: 'alta', label: 'Alta' },
          { value: 'urgente', label: 'Urgente' },
        ],
        required: true,
      },
      {
        key: 'assigned_to',
        type: 'remoteSelect',
        label: 'Responsável',
        endpoint: '/users',
        valueKey: 'id',
        labelKey: 'name',
        helpText: 'Deixe em branco para usar atribuição automática por canal.',
      },
    ],
  },
  'action.assign_user': {
    type: 'action.assign_user',
    kind: 'action',
    label: 'Atribuir responsável',
    description: 'Define um responsável (atendente) para o aluno.',
    icon: UserCheck,
    color: 'violet',
    defaultData: { user_id: null },
    fields: [
      {
        key: 'user_id',
        type: 'remoteSelect',
        label: 'Usuário',
        endpoint: '/users',
        valueKey: 'id',
        labelKey: 'name',
        required: true,
      },
    ],
  },
  'action.set_onboarding_status': {
    type: 'action.set_onboarding_status',
    kind: 'action',
    label: 'Mudar status do onboarding',
    description: 'Move o aluno para uma etapa do funil de onboarding.',
    icon: Route,
    color: 'violet',
    defaultData: { status: 'em_andamento' },
    fields: [
      {
        key: 'status',
        type: 'select',
        label: 'Novo status',
        options: [
          { value: 'novo', label: 'Novo' },
          { value: 'em_contato', label: 'Em contato' },
          { value: 'em_andamento', label: 'Em andamento' },
          { value: 'follow_up', label: 'Follow-up' },
          { value: 'aguardando_doc', label: 'Aguardando documentação' },
          { value: 'concluido', label: 'Concluído' },
        ],
        required: true,
      },
    ],
  },

  /* ---------- CONDITIONS ---------- */
  'condition.course_is': {
    type: 'condition.course_is',
    kind: 'condition',
    label: 'Curso do aluno',
    description: 'Ramifica o fluxo se o aluno está nos cursos selecionados.',
    icon: BookOpen,
    color: 'slate',
    defaultData: { course_ids: [] },
    fields: [
      {
        key: 'course_ids',
        type: 'remoteSelect',
        label: 'Cursos',
        endpoint: '/courses',
        valueKey: 'id',
        labelKey: 'name',
        multiple: true,
        required: true,
        helpText: 'Selecione um ou mais cursos. Sai por “Sim” se o aluno estiver em qualquer um deles.',
      },
    ],
  },
  'condition.risk_level': {
    type: 'condition.risk_level',
    kind: 'condition',
    label: 'Nível de risco',
    description: 'Ramifica o fluxo pelo nível de risco do aluno.',
    icon: Shield,
    color: 'slate',
    defaultData: { min_level: 'alto' },
    fields: [
      {
        key: 'min_level',
        type: 'select',
        label: 'Nível mínimo para sair por "Sim"',
        options: [
          { value: 'baixo', label: 'Baixo ou superior' },
          { value: 'medio', label: 'Médio ou superior' },
          { value: 'alto', label: 'Alto ou superior' },
          { value: 'critico', label: 'Crítico' },
        ],
        required: true,
      },
    ],
  },

  /* ---------- DELAY ---------- */
  'delay.wait': {
    type: 'delay.wait',
    kind: 'delay',
    label: 'Aguardar',
    description: 'Pausa o fluxo por um tempo antes da próxima ação.',
    icon: Clock,
    color: 'slate',
    defaultData: { amount: 1, unit: 'days' },
    fields: [
      {
        key: 'amount',
        type: 'number',
        label: 'Quantidade',
        min: 1,
        max: 999,
        step: 1,
        required: true,
      },
      {
        key: 'unit',
        type: 'select',
        label: 'Unidade',
        options: [
          { value: 'minutes', label: 'Minutos' },
          { value: 'hours', label: 'Horas' },
          { value: 'days', label: 'Dias' },
        ],
        required: true,
      },
    ],
  },
};

/* ============================================================
   HELPERS
   ============================================================ */

export const KIND_META: Record<
  NodeKind,
  { label: string; order: number; emptyHint: string }
> = {
  trigger: {
    label: 'Gatilhos',
    order: 1,
    emptyHint: 'Arraste um gatilho para o canvas para começar um fluxo.',
  },
  condition: {
    label: 'Condições',
    order: 2,
    emptyHint: 'Use condições para ramificar o fluxo (sim/não).',
  },
  delay: {
    label: 'Atrasos',
    order: 3,
    emptyHint: 'Pause o fluxo antes de executar uma ação.',
  },
  action: {
    label: 'Ações',
    order: 4,
    emptyHint: 'Ações são o que acontece quando o gatilho dispara.',
  },
};

export const COLOR_CLASSES: Record<
  NodeDefinition['color'],
  { bg: string; iconBg: string; icon: string; border: string; ring: string }
> = {
  red: {
    bg: 'bg-red-50 dark:bg-red-500/10',
    iconBg: 'bg-red-100 dark:bg-red-500/20',
    icon: 'text-red-600 dark:text-red-400',
    border: 'border-red-200 dark:border-red-500/30',
    ring: 'ring-red-400',
  },
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-500/10',
    iconBg: 'bg-blue-100 dark:bg-blue-500/20',
    icon: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-500/30',
    ring: 'ring-blue-400',
  },
  emerald: {
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    iconBg: 'bg-emerald-100 dark:bg-emerald-500/20',
    icon: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-500/30',
    ring: 'ring-emerald-400',
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    iconBg: 'bg-amber-100 dark:bg-amber-500/20',
    icon: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-500/30',
    ring: 'ring-amber-400',
  },
  violet: {
    bg: 'bg-violet-50 dark:bg-violet-500/10',
    iconBg: 'bg-violet-100 dark:bg-violet-500/20',
    icon: 'text-violet-600 dark:text-violet-400',
    border: 'border-violet-200 dark:border-violet-500/30',
    ring: 'ring-violet-400',
  },
  slate: {
    bg: 'bg-muted/50',
    iconBg: 'bg-muted',
    icon: 'text-foreground/70',
    border: 'border-border',
    ring: 'ring-foreground/30',
  },
};

export function getNodeDef(type: string): NodeDefinition | undefined {
  return NODE_DEFINITIONS[type];
}

export function listNodeDefinitionsByKind(kind: NodeKind): NodeDefinition[] {
  return Object.values(NODE_DEFINITIONS).filter((d) => d.kind === kind);
}

/** Verifica se a data atual do node atende aos campos required. */
export function validateNodeData(
  type: string,
  data: Record<string, unknown>
): { valid: boolean; missing: string[] } {
  const def = getNodeDef(type);
  if (!def) return { valid: false, missing: ['type'] };

  const missing: string[] = [];
  for (const f of def.fields) {
    if (!('required' in f) || !f.required) continue;
    const v = data?.[f.key];
    if (v === undefined || v === null || v === '') {
      missing.push(f.key);
    } else if (Array.isArray(v) && v.length === 0) {
      missing.push(f.key);
    }
  }
  return { valid: missing.length === 0, missing };
}
