'use client';

import { useEffect, useState } from 'react';
import type { Node } from '@xyflow/react';
import {
  getNodeDef,
  NODE_DEFINITIONS,
  COLOR_CLASSES,
  slugifyButtonText,
  type FieldSpec,
  type TemplateButtonInfo,
} from './node-definitions';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Trash2, X, Info, Check, MessageCircle, Link as LinkIcon, Phone } from 'lucide-react';

interface NodeConfigPanelProps {
  node: Node | null;
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void;
  onDelete: (nodeId: string) => void;
  onClose: () => void;
}

// Cache de endpoints remotos. Válido enquanto o editor está aberto.
const remoteCache: Map<string, Array<Record<string, unknown>>> = new Map();

async function fetchRemote(
  endpoint: string
): Promise<Array<Record<string, unknown>>> {
  if (remoteCache.has(endpoint)) return remoteCache.get(endpoint)!;
  try {
    const res = await api.get(endpoint);
    let items: Array<Record<string, unknown>> = [];
    if (Array.isArray(res.data)) {
      items = res.data;
    } else if (res.data?.templates && Array.isArray(res.data.templates)) {
      items = res.data.templates;
    } else if (res.data?.results && Array.isArray(res.data.results)) {
      items = res.data.results;
    }
    remoteCache.set(endpoint, items);
    return items;
  } catch (e) {
    console.error('Erro ao carregar', endpoint, e);
    return [];
  }
}

export default function NodeConfigPanel({
  node,
  onUpdate,
  onDelete,
  onClose,
}: NodeConfigPanelProps) {
  if (!node) {
    return (
      <div className="w-80 shrink-0 border-l bg-muted/30 p-6 hidden lg:flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
          <Info className="w-5 h-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">
          Nenhum nó selecionado
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Clique em um nó no canvas para editá-lo, ou arraste novos itens da
          biblioteca.
        </p>
      </div>
    );
  }

  const def = getNodeDef(node.type || '');
  if (!def) {
    return (
      <div className="w-80 shrink-0 border-l bg-muted/30 p-6">
        <p className="text-sm text-destructive">
          Tipo de nó desconhecido: <code>{node.type}</code>
        </p>
      </div>
    );
  }

  const data = (node.data as Record<string, unknown>) || {};
  const Icon = def.icon;
  const colors = COLOR_CLASSES[def.color];

  const setField = (key: string, value: unknown) => {
    // Caso especial: ao trocar template_name num node de botões, popula
    // data.buttons[] a partir do cache de /whatsapp/templates.
    if (
      node.type === 'action.send_whatsapp_buttons' &&
      key === 'template_name' &&
      typeof value === 'string'
    ) {
      const templates = remoteCache.get('/whatsapp/templates') || [];
      const tpl = templates.find((t) => t.name === value);
      const rawButtons = (tpl?.buttons as Array<Record<string, unknown>> | undefined) || [];
      const normalized: TemplateButtonInfo[] = rawButtons.map((b) => {
        const text = String(b.text ?? '');
        return {
          text,
          slug: slugifyButtonText(text),
          type: typeof b.type === 'string' ? b.type : undefined,
        };
      });
      onUpdate(node.id, { ...data, template_name: value, buttons: normalized });
      return;
    }

    onUpdate(node.id, { ...data, [key]: value });
  };

  return (
    <div className="w-80 shrink-0 border-l bg-muted/30 flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-card">
        <div
          className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center',
            colors.iconBg
          )}
        >
          <Icon className={cn('w-4 h-4', colors.icon)} strokeWidth={1.75} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {def.kind === 'trigger'
              ? 'Gatilho'
              : def.kind === 'action'
              ? 'Ação'
              : def.kind === 'condition'
              ? 'Condição'
              : 'Atraso'}
          </p>
          <p className="text-sm font-semibold text-foreground truncate">
            {def.label}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          {def.description}
        </p>

        {def.fields.map((f) => (
          <FieldRenderer
            key={f.key}
            field={f}
            value={data[f.key]}
            onChange={(v) => setField(f.key, v)}
          />
        ))}
      </div>

      <div className="p-3 border-t bg-card">
        <Button
          variant="outline"
          size="sm"
          className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={() => {
            onDelete(node.id);
            onClose();
          }}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Remover nó
        </Button>
      </div>
    </div>
  );
}

/* ============================================================
   Field renderer (data-driven)
   ============================================================ */

function FieldRenderer({
  field,
  value,
  onChange,
}: {
  field: FieldSpec;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const label = (
    <label className="text-xs font-medium text-foreground block mb-1.5">
      {field.label}
      {'required' in field && field.required && (
        <span className="text-destructive ml-0.5">*</span>
      )}
    </label>
  );

  const help =
    'helpText' in field && field.helpText ? (
      <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
        {field.helpText}
      </p>
    ) : null;

  if (field.type === 'number') {
    return (
      <div>
        {label}
        <Input
          type="number"
          value={(value as number | string | undefined) ?? ''}
          min={field.min}
          max={field.max}
          step={field.step || 1}
          placeholder={field.placeholder}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === '' ? '' : Number(v));
          }}
        />
        {help}
      </div>
    );
  }

  if (field.type === 'text') {
    return (
      <div>
        {label}
        <Input
          type="text"
          value={(value as string | undefined) ?? ''}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
        {help}
      </div>
    );
  }

  if (field.type === 'select') {
    return (
      <div>
        {label}
        <Select
          value={(value as string | undefined) ?? ''}
          onValueChange={(v) => onChange(v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione…" />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {help}
      </div>
    );
  }

  if (field.type === 'remoteSelect') {
    return (
      <div>
        {label}
        <RemoteSelect
          endpoint={field.endpoint}
          valueKey={field.valueKey}
          labelKey={field.labelKey}
          multiple={field.multiple}
          value={value}
          onChange={onChange}
        />
        {help}
      </div>
    );
  }

  if (field.type === 'buttonsList') {
    const buttons: TemplateButtonInfo[] = Array.isArray(value)
      ? (value as TemplateButtonInfo[])
      : [];
    return (
      <div>
        {label}
        {buttons.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-2 px-3 rounded-lg bg-muted/40 border border-dashed border-border">
            Nenhum botão. Selecione um template que tenha botões aprovados pela Meta.
          </p>
        ) : (
          <div className="space-y-1.5">
            {buttons.map((btn, i) => {
              const Icon =
                btn.type === 'URL'
                  ? LinkIcon
                  : btn.type === 'PHONE_NUMBER'
                  ? Phone
                  : MessageCircle;
              return (
                <div
                  key={i}
                  className="flex items-center gap-2 px-2.5 py-1.5 bg-muted/40 rounded-md border border-border"
                >
                  <Icon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground truncate">
                      {btn.text}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-mono truncate">
                      {btn.slug}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {help}
      </div>
    );
  }

  return null;
}

/* ============================================================
   RemoteSelect — single/multi, busca endpoint, cacheia resultado
   ============================================================ */

function RemoteSelect({
  endpoint,
  valueKey,
  labelKey,
  multiple,
  value,
  onChange,
}: {
  endpoint: string;
  valueKey: string;
  labelKey: string;
  multiple?: boolean;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchRemote(endpoint).then((data) => {
      if (alive) {
        setItems(data);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [endpoint]);

  if (loading) {
    return <Skeleton className="h-9 w-full" />;
  }

  if (items.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic py-1">
        Nenhum registro disponível em{' '}
        <code className="text-[10px]">{endpoint}</code>.
      </p>
    );
  }

  if (!multiple) {
    const currentStr =
      value === null || value === undefined ? '' : String(value);
    return (
      <Select
        value={currentStr}
        onValueChange={(v) => {
          // Converte para number se o valueKey apontar para número
          const match = items.find((i) => String(i[valueKey]) === v);
          if (match) onChange(match[valueKey]);
          else onChange(v);
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Selecione…" />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => {
            const itemVal = String(item[valueKey]);
            const itemLabel = String(item[labelKey] ?? itemVal);
            return (
              <SelectItem key={itemVal} value={itemVal}>
                {itemLabel}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    );
  }

  // Multiple: lista com checkboxes simples
  const selected: unknown[] = Array.isArray(value) ? value : [];
  const selectedSet = new Set(selected.map(String));

  const toggle = (v: unknown) => {
    const key = String(v);
    if (selectedSet.has(key)) {
      onChange(selected.filter((s) => String(s) !== key));
    } else {
      onChange([...selected, v]);
    }
  };

  return (
    <div className="max-h-48 overflow-y-auto border rounded-lg bg-card divide-y">
      {items.map((item) => {
        const itemVal = item[valueKey];
        const itemLabel = String(item[labelKey] ?? itemVal);
        const checked = selectedSet.has(String(itemVal));
        return (
          <button
            key={String(itemVal)}
            type="button"
            onClick={() => toggle(itemVal)}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-muted/50 transition-colors',
              checked && 'bg-primary/5'
            )}
          >
            <span
              className={cn(
                'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0',
                checked ? 'bg-primary border-primary' : 'border-border'
              )}
            >
              {checked && <Check className="w-3 h-3 text-primary-foreground" />}
            </span>
            <span className="truncate">{itemLabel}</span>
          </button>
        );
      })}
    </div>
  );
}

/* Exporta um util para popular o `data` default de um tipo ao dropar
   um node na canvas. */
export function defaultDataFor(type: string): Record<string, unknown> {
  const def = NODE_DEFINITIONS[type];
  return def ? { ...def.defaultData } : {};
}
