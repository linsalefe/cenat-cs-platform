'use client';

import { memo } from 'react';
import { useEdges, Handle, Position, type NodeProps } from '@xyflow/react';
import {
  getNodeDef,
  COLOR_CLASSES,
  validateNodeData,
  type TemplateButtonInfo,
} from '../node-definitions';
import { cn } from '@/lib/utils';
import { AlertCircle, AlertTriangle, MessageCircle, Link as LinkIcon, Phone, Clock } from 'lucide-react';

/* Cores fixas por posição do botão.
   Mantemos só 3 cores; se um template ousar ter >3 quick replies (Meta permite até 3
   por categoria, então cap natural), o 4º cairia em violet também — não bloqueia. */
const BUTTON_COLORS = [
  { dot: '!bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
  { dot: '!bg-blue-500', text: 'text-blue-600 dark:text-blue-400' },
  { dot: '!bg-violet-500', text: 'text-violet-600 dark:text-violet-400' },
];

function SendWhatsAppButtonsNode({ id, data, type, selected }: NodeProps) {
  const def = getNodeDef(type);
  const edges = useEdges();
  if (!def) return null;

  const colors = COLOR_CLASSES[def.color];
  const Icon = def.icon;
  const valid = validateNodeData(type, data as Record<string, unknown>);

  const d = (data as Record<string, unknown>) || {};
  const templateName = (d.template_name as string) || '';
  const waitDays = d.wait_days ?? '?';
  const buttons: TemplateButtonInfo[] = Array.isArray(d.buttons)
    ? (d.buttons as TemplateButtonInfo[])
    : [];

  // Slugs válidos = botões atuais + timeout
  const validSlugs = new Set<string>([...buttons.map((b) => b.slug), 'timeout']);

  // Edges órfãs: saem desse node por sourceHandle que não corresponde a botão atual
  const orphanEdges = edges.filter(
    (e) => e.source === id && (!e.sourceHandle || !validSlugs.has(e.sourceHandle))
  );

  // Distribuição vertical dos handles no body.
  // Layout: [header ~50px] [body com botões] [linha timeout]
  // Cada botão ocupa uma "row" no body. Calculamos top% baseado no item.
  // O total de "rows" no body = max(buttons.length, 1) + 1 (timeout)
  const totalRows = Math.max(buttons.length, 1) + 1;
  const headerEstimate = 18; // % aproximado do header sobre o card
  const rowSpan = (100 - headerEstimate) / totalRows;
  const buttonTop = (i: number) => headerEstimate + rowSpan * (i + 0.5);
  const timeoutTop = headerEstimate + rowSpan * (totalRows - 0.5);

  return (
    <div
      className={cn(
        'relative min-w-[280px] rounded-xl border-2 bg-card shadow-sm transition-shadow',
        colors.border,
        selected && `ring-2 ring-offset-2 ring-offset-background ${colors.ring}`
      )}
    >
      {/* Input */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-primary !border-2 !border-background"
      />

      {/* Header */}
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-t-[10px] border-b',
          colors.bg,
          colors.border
        )}
      >
        <div
          className={cn(
            'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0',
            colors.iconBg
          )}
        >
          <Icon className={cn('w-4 h-4', colors.icon)} strokeWidth={1.75} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Ação
          </p>
          <p className="text-xs font-semibold text-foreground truncate">
            {def.label}
          </p>
        </div>
        {orphanEdges.length > 0 && (
          <div
            title={`${orphanEdges.length} conexão(ões) sem botão correspondente`}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30"
          >
            <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">
              {orphanEdges.length} órfã{orphanEdges.length > 1 ? 's' : ''}
            </span>
          </div>
        )}
        {!valid.valid && orphanEdges.length === 0 && (
          <AlertCircle className="w-4 h-4 text-amber-500" strokeWidth={2} />
        )}
      </div>

      {/* Body */}
      <div className="px-3 pt-3 pb-2">
        <p className="text-[11px] text-muted-foreground mb-1">Template</p>
        <p className="text-xs font-mono font-medium text-foreground truncate mb-3">
          {templateName || <span className="italic text-muted-foreground/70">não selecionado</span>}
        </p>

        {buttons.length === 0 ? (
          <p className="text-[11px] italic text-muted-foreground py-2">
            Selecione um template com botões.
          </p>
        ) : (
          <div className="space-y-1.5 pb-1">
            {buttons.map((btn, i) => {
              const c = BUTTON_COLORS[Math.min(i, BUTTON_COLORS.length - 1)];
              const ButtonIcon =
                btn.type === 'URL'
                  ? LinkIcon
                  : btn.type === 'PHONE_NUMBER'
                  ? Phone
                  : MessageCircle;
              return (
                <div key={btn.slug} className="flex items-center gap-1.5 text-[11px]">
                  <ButtonIcon className={cn('w-3 h-3 flex-shrink-0', c.text)} />
                  <span className="text-foreground truncate flex-1">{btn.text}</span>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-2 pt-2 border-t border-border">
          <div className="flex items-center gap-1.5 text-[11px] text-red-600 dark:text-red-400">
            <Clock className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">
              Timeout em <span className="font-semibold">{String(waitDays)} dia(s)</span>
            </span>
          </div>
        </div>
      </div>

      {/* Handles dinâmicos: 1 por botão */}
      {buttons.map((btn, i) => {
        const c = BUTTON_COLORS[Math.min(i, BUTTON_COLORS.length - 1)];
        const top = buttonTop(i);
        return (
          <Handle
            key={btn.slug}
            id={btn.slug}
            type="source"
            position={Position.Right}
            style={{ top: `${top}%` }}
            className={cn('!w-3 !h-3 !border-2 !border-background', c.dot)}
          />
        );
      })}

      {/* Handle timeout — sempre presente */}
      <Handle
        id="timeout"
        type="source"
        position={Position.Right}
        style={{ top: `${timeoutTop}%` }}
        className="!w-3 !h-3 !bg-red-500 !border-2 !border-background"
      />
    </div>
  );
}

export default memo(SendWhatsAppButtonsNode);
