'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  getNodeDef,
  COLOR_CLASSES,
  validateNodeData,
} from '../node-definitions';
import { cn } from '@/lib/utils';
import { AlertCircle, Check, X } from 'lucide-react';

function WaitForReplyNode({ data, type, selected }: NodeProps) {
  const def = getNodeDef(type);
  if (!def) return null;

  const colors = COLOR_CLASSES[def.color];
  const Icon = def.icon;
  const valid = validateNodeData(type, data as Record<string, unknown>);

  const waitDays = (data as Record<string, unknown>)?.wait_days ?? '?';

  return (
    <div
      className={cn(
        'relative min-w-[240px] rounded-xl border-2 bg-card shadow-sm transition-shadow',
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
        {!valid.valid && (
          <AlertCircle className="w-4 h-4 text-amber-500" strokeWidth={2} />
        )}
      </div>

      {/* Body */}
      <div className="px-3 py-4 pb-5">
        <p className="text-xs text-foreground">
          Aguarda até <span className="font-semibold">{String(waitDays)} dia(s)</span> pela resposta do aluno.
        </p>
      </div>

      {/* Saída "Respondeu" (verde, topo direito) */}
      <div className="absolute -right-0.5 top-[52%] translate-x-full -translate-y-1/2 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1 pl-3">
        <Check className="w-3 h-3" /> Respondeu
      </div>
      <Handle
        id="yes"
        type="source"
        position={Position.Right}
        style={{ top: '52%' }}
        className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-background"
      />

      {/* Saída "Não respondeu" (vermelho, embaixo direito) */}
      <div className="absolute -right-0.5 top-[84%] translate-x-full -translate-y-1/2 text-[10px] font-semibold text-red-600 dark:text-red-400 inline-flex items-center gap-1 pl-3">
        <X className="w-3 h-3" /> Não respondeu
      </div>
      <Handle
        id="no"
        type="source"
        position={Position.Right}
        style={{ top: '84%' }}
        className="!w-3 !h-3 !bg-red-500 !border-2 !border-background"
      />
    </div>
  );
}

export default memo(WaitForReplyNode);
