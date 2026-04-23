'use client';

import { useState } from 'react';
import {
  NODE_DEFINITIONS,
  KIND_META,
  COLOR_CLASSES,
  type NodeDefinition,
  type NodeKind,
} from './node-definitions';
import { cn } from '@/lib/utils';
import { ChevronDown, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NodeLibraryProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export default function NodeLibrary({
  collapsed,
  onToggleCollapsed,
}: NodeLibraryProps) {
  const [openGroups, setOpenGroups] = useState<Record<NodeKind, boolean>>({
    trigger: true,
    condition: true,
    delay: true,
    action: true,
  });

  const kindsOrdered = (Object.entries(KIND_META) as Array<
    [NodeKind, typeof KIND_META[NodeKind]]
  >).sort((a, b) => a[1].order - b[1].order);

  const onDragStart = (
    e: React.DragEvent<HTMLButtonElement>,
    def: NodeDefinition
  ) => {
    e.dataTransfer.setData('application/cenat-workflow-node', def.type);
    e.dataTransfer.effectAllowed = 'move';
  };

  if (collapsed) {
    return (
      <div className="w-10 flex flex-col items-center py-2 bg-muted/30 border-r">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleCollapsed}
          title="Abrir biblioteca"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="w-60 shrink-0 flex flex-col border-r bg-muted/30 h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Biblioteca
        </h4>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleCollapsed}
          title="Fechar biblioteca"
        >
          <PanelLeftClose className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {kindsOrdered.map(([kind, meta]) => {
          const items = Object.values(NODE_DEFINITIONS).filter(
            (d) => d.kind === kind
          );
          if (items.length === 0) return null;
          const open = openGroups[kind];
          return (
            <div key={kind}>
              <button
                onClick={() =>
                  setOpenGroups((o) => ({ ...o, [kind]: !o[kind] }))
                }
                className="w-full flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-1 py-1 hover:text-foreground transition-colors"
              >
                <span>{meta.label}</span>
                <ChevronDown
                  className={cn(
                    'w-3.5 h-3.5 transition-transform',
                    !open && '-rotate-90'
                  )}
                />
              </button>

              {open && (
                <div className="space-y-1 mt-1">
                  {items.map((def) => {
                    const colors = COLOR_CLASSES[def.color];
                    const Icon = def.icon;
                    return (
                      <button
                        key={def.type}
                        type="button"
                        draggable
                        onDragStart={(e) => onDragStart(e, def)}
                        className={cn(
                          'group w-full flex items-start gap-2 p-2 rounded-lg border text-left cursor-grab active:cursor-grabbing',
                          'bg-card hover:ring-1 hover:ring-foreground/20',
                          colors.border,
                          'transition-all'
                        )}
                        title={def.description}
                      >
                        <div
                          className={cn(
                            'w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0',
                            colors.iconBg
                          )}
                        >
                          <Icon
                            className={cn('w-4 h-4', colors.icon)}
                            strokeWidth={1.75}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground leading-tight">
                            {def.label}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                            {def.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-3 border-t bg-card/50">
        <p className="text-[10px] text-muted-foreground leading-snug">
          Arraste um nó para o canvas. Conecte os pontos das laterais
          para criar o fluxo.
        </p>
      </div>
    </div>
  );
}
