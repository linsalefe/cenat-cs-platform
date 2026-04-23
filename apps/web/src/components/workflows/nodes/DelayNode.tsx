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

const UNIT_LABELS: Record<string, string> = {
  minutes: 'min',
  hours: 'h',
  days: 'dias',
};

function summaryOf(data: Record<string, unknown>): string {
  const amount = data?.amount;
  const unit = (data?.unit as string) || 'days';
  if (amount === undefined || amount === null || amount === '') return '';
  return `${amount} ${UNIT_LABELS[unit] || unit}`;
}

function DelayNode({ data, type, selected }: NodeProps) {
  const def = getNodeDef(type);
  if (!def) return null;

  const colors = COLOR_CLASSES[def.color];
  const Icon = def.icon;
  const valid = validateNodeData(type, data as Record<string, unknown>);
  const summary = summaryOf(data as Record<string, unknown>);

  return (
    <div
      className={cn(
        'relative min-w-[180px] rounded-xl border-2 bg-card shadow-sm transition-shadow',
        colors.border,
        selected && `ring-2 ring-offset-2 ring-offset-background ${colors.ring}`
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-primary !border-2 !border-background"
      />

      <div className="flex items-center gap-2 px-3 py-2">
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
            Aguardar
          </p>
          <p className="text-xs font-semibold text-foreground truncate">
            {summary || 'Configure…'}
          </p>
        </div>
        {!valid.valid && (
          <AlertCircle className="w-4 h-4 text-amber-500" strokeWidth={2} />
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-primary !border-2 !border-background"
      />
    </div>
  );
}

export default memo(DelayNode);
