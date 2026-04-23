'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  getNodeDef,
  COLOR_CLASSES,
  validateNodeData,
} from '../node-definitions';
import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';

function summaryOf(type: string, data: Record<string, unknown>): string {
  const def = getNodeDef(type);
  if (!def) return '';
  const parts: string[] = [];
  for (const f of def.fields) {
    const v = data?.[f.key];
    if (v === undefined || v === null || v === '') continue;

    if (f.type === 'select') {
      const opt = f.options.find((o) => o.value === v);
      if (opt) parts.push(opt.label);
    } else if (f.type === 'number') {
      parts.push(`${v}`);
    } else if (f.type === 'text') {
      parts.push(String(v));
    } else if (f.type === 'remoteSelect') {
      if (Array.isArray(v)) parts.push(`${v.length} item(ns)`);
      else parts.push(String(v));
    }
  }
  return parts.join(' · ');
}

function TriggerNode({ data, type, selected }: NodeProps) {
  const def = getNodeDef(type);
  if (!def) return null;

  const colors = COLOR_CLASSES[def.color];
  const Icon = def.icon;
  const valid = validateNodeData(type, data as Record<string, unknown>);
  const summary = summaryOf(type, data as Record<string, unknown>);

  return (
    <div
      className={cn(
        'relative min-w-[220px] rounded-xl border-2 bg-card shadow-sm transition-shadow',
        colors.border,
        selected && `ring-2 ring-offset-2 ring-offset-background ${colors.ring}`
      )}
    >
      {/* Header com cor do tom */}
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
            Gatilho
          </p>
          <p className="text-xs font-semibold text-foreground truncate">
            {def.label}
          </p>
        </div>
        {!valid.valid && (
          <AlertCircle
            className="w-4 h-4 text-amber-500"
            strokeWidth={2}
          />
        )}
      </div>

      {/* Body */}
      <div className="px-3 py-2">
        {summary ? (
          <p className="text-xs text-foreground">{summary}</p>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            Configure o gatilho…
          </p>
        )}
      </div>

      {/* Output handle (trigger só tem saída) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-primary !border-2 !border-background"
      />
    </div>
  );
}

export default memo(TriggerNode);
