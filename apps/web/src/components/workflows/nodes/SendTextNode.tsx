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

function SendTextNode({ data, type, selected }: NodeProps) {
  const def = getNodeDef(type);
  if (!def) return null;

  const colors = COLOR_CLASSES[def.color];
  const Icon = def.icon;
  const valid = validateNodeData(type, data as Record<string, unknown>);

  const d = (data as Record<string, unknown>) || {};
  const message = (d.message as string) || '';
  const channel = (d.channel as string) || 'cs';

  // Preview truncado
  const preview = message.length > 80 ? message.slice(0, 80) + '…' : message;

  return (
    <div
      className={cn(
        'relative min-w-[260px] rounded-xl border-2 bg-card shadow-sm transition-shadow',
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
            Ação · texto livre
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
      <div className="px-3 pt-3 pb-5">
        {message ? (
          <p className="text-xs text-foreground whitespace-pre-wrap break-words italic line-clamp-3">
            “{preview}”
          </p>
        ) : (
          <p className="text-xs italic text-muted-foreground">
            Defina a mensagem no painel.
          </p>
        )}
        <p className="text-[10px] text-muted-foreground mt-2">
          Canal: <span className="font-mono">{channel}</span>
        </p>
      </div>

      {/* Saída "Enviou" (verde) */}
      <div className="absolute -right-0.5 top-[40%] translate-x-full -translate-y-1/2 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1 pl-3">
        <Check className="w-3 h-3" /> Enviou
      </div>
      <Handle
        id="sent"
        type="source"
        position={Position.Right}
        style={{ top: '40%' }}
        className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-background"
      />

      {/* Saída "Janela fechada" (vermelho) */}
      <div className="absolute -right-0.5 top-[75%] translate-x-full -translate-y-1/2 text-[10px] font-semibold text-red-600 dark:text-red-400 inline-flex items-center gap-1 pl-3">
        <X className="w-3 h-3" /> Janela fechada
      </div>
      <Handle
        id="out_of_window"
        type="source"
        position={Position.Right}
        style={{ top: '75%' }}
        className="!w-3 !h-3 !bg-red-500 !border-2 !border-background"
      />
    </div>
  );
}

export default memo(SendTextNode);
