'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import AppLayout from '@/components/AppLayout';
import PageHeader from '@/components/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ClipboardList,
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  Eye,
  EyeOff,
  AlignLeft,
  ListFilter,
  Loader2,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface FormField {
  id: number;
  key: string;
  label: string;
  type: 'text' | 'select';
  placeholder: string | null;
  required: boolean;
  options: string[];
  order_index: number;
  active: boolean;
}

const TYPE_META: Record<FormField['type'], { label: string; icon: typeof AlignLeft }> = {
  text: { label: 'Texto curto', icon: AlignLeft },
  select: { label: 'Dropdown', icon: ListFilter },
};

function FieldRow({
  field,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  field: FormField;
  onEdit: (f: FormField) => void;
  onToggleActive: (f: FormField) => void;
  onDelete: (f: FormField) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const Icon = TYPE_META[field.type].icon;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        'p-3 flex items-center gap-3',
        !field.active && 'opacity-60',
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1"
        title="Arrastar para reordenar"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground truncate">
            {field.label}
          </h3>
          {field.required && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30 uppercase">
              Obrigatório
            </span>
          )}
          {!field.active && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-muted text-muted-foreground border-border uppercase">
              Inativo
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
          <span className="font-mono">{field.key}</span>
          <span>·</span>
          <span>{TYPE_META[field.type].label}</span>
          {field.type === 'select' && (
            <>
              <span>·</span>
              <span>{field.options.length} opções</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <Button variant="ghost" size="sm" onClick={() => onToggleActive(field)} title={field.active ? 'Desativar' : 'Ativar'}>
          {field.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onEdit(field)} title="Editar">
          <Pencil className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onDelete(field)} className="text-destructive hover:text-destructive hover:bg-destructive/10" title="Remover">
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
}

export default function OnboardingFormBuilderPage() {
  const [fields, setFields] = useState<FormField[]>([]);
  const [loading, setLoading] = useState(true);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<FormField | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FormField | null>(null);

  // Form state
  const [fKey, setFKey] = useState('');
  const [fLabel, setFLabel] = useState('');
  const [fType, setFType] = useState<'text' | 'select'>('text');
  const [fPlaceholder, setFPlaceholder] = useState('');
  const [fRequired, setFRequired] = useState(false);
  const [fOptionsRaw, setFOptionsRaw] = useState('');
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get('/onboarding-form/fields');
      setFields(res.data || []);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao carregar campos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setFKey('');
    setFLabel('');
    setFType('text');
    setFPlaceholder('');
    setFRequired(false);
    setFOptionsRaw('');
    setEditorOpen(true);
  };

  const openEdit = (f: FormField) => {
    setEditing(f);
    setFKey(f.key);
    setFLabel(f.label);
    setFType(f.type);
    setFPlaceholder(f.placeholder || '');
    setFRequired(f.required);
    setFOptionsRaw((f.options || []).join('\n'));
    setEditorOpen(true);
  };

  const handleSave = async () => {
    const options = fType === 'select'
      ? fOptionsRaw.split('\n').map((o) => o.trim()).filter(Boolean)
      : null;

    if (!fLabel.trim()) {
      toast.error('Informe o label do campo');
      return;
    }
    if (fType === 'select' && (!options || options.length === 0)) {
      toast.error('Adicione pelo menos uma opção para o dropdown');
      return;
    }
    if (!editing && !/^[a-z][a-z0-9_]*$/.test(fKey)) {
      toast.error('A chave deve conter apenas letras minúsculas, números e underscore (ex: cpf, area_atuacao)');
      return;
    }

    try {
      setSaving(true);
      if (editing) {
        await api.put(`/onboarding-form/fields/${editing.id}`, {
          label: fLabel.trim(),
          type: fType,
          placeholder: fPlaceholder.trim() || null,
          required: fRequired,
          options,
        });
        toast.success('Campo atualizado');
      } else {
        await api.post('/onboarding-form/fields', {
          key: fKey.trim(),
          label: fLabel.trim(),
          type: fType,
          placeholder: fPlaceholder.trim() || null,
          required: fRequired,
          options,
        });
        toast.success('Campo criado');
      }
      setEditorOpen(false);
      load();
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string } } };
      toast.error(err?.response?.data?.detail || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (f: FormField) => {
    try {
      await api.put(`/onboarding-form/fields/${f.id}`, { active: !f.active });
      toast.success(f.active ? 'Campo desativado' : 'Campo ativado');
      load();
    } catch (e) {
      console.error(e);
      toast.error('Erro ao alterar status');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/onboarding-form/fields/${deleteTarget.id}`);
      toast.success('Campo removido');
      setDeleteTarget(null);
      load();
    } catch (e) {
      console.error(e);
      toast.error('Erro ao remover');
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = fields.findIndex((f) => f.id === Number(active.id));
    const newIndex = fields.findIndex((f) => f.id === Number(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    const next = arrayMove(fields, oldIndex, newIndex);
    setFields(next);

    try {
      await api.patch('/onboarding-form/fields/reorder', {
        field_ids: next.map((f) => f.id),
      });
    } catch (e) {
      console.error(e);
      toast.error('Erro ao reordenar — recarregando');
      load();
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Configuração"
          title="Formulário de onboarding"
          description="Adicione campos customizados que aparecerão no formulário público e no cadastro manual de alunos."
          actions={
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1" />
              Novo campo
            </Button>
          }
        />

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : fields.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <ClipboardList className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">
              Nenhum campo customizado
            </h3>
            <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto">
              O formulário de onboarding já pede nome, email, telefone e curso por padrão.
              Aqui você adiciona campos extras (ex: CPF, área de atuação, como conheceu).
            </p>
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1" />
              Criar primeiro campo
            </Button>
          </Card>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {fields.map((f) => (
                  <FieldRow
                    key={f.id}
                    field={f}
                    onEdit={openEdit}
                    onToggleActive={handleToggleActive}
                    onDelete={setDeleteTarget}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Editor dialog */}
      <Dialog open={editorOpen} onOpenChange={(o) => !o && !saving && setEditorOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar campo' : 'Novo campo'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Atualiza a configuração deste campo. A chave não pode ser alterada depois de criada.'
                : 'Cria um novo campo que aparecerá no formulário público e no cadastro manual.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">
                Chave técnica <span className="text-destructive">*</span>
              </label>
              <Input
                value={fKey}
                onChange={(e) => setFKey(e.target.value)}
                placeholder="cpf, area_atuacao, como_conheceu..."
                disabled={!!editing}
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Apenas letras minúsculas, números e underscore. Não pode ser alterada depois.
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">
                Label (exibição) <span className="text-destructive">*</span>
              </label>
              <Input
                value={fLabel}
                onChange={(e) => setFLabel(e.target.value)}
                placeholder="Ex: CPF, Área de atuação"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">
                Tipo
              </label>
              <Select value={fType} onValueChange={(v) => setFType(v as 'text' | 'select')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Texto curto</SelectItem>
                  <SelectItem value="select">Dropdown (seleção única)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">
                Placeholder <span className="text-muted-foreground/60">(opcional)</span>
              </label>
              <Input
                value={fPlaceholder}
                onChange={(e) => setFPlaceholder(e.target.value)}
                placeholder="Texto de exemplo no campo vazio"
              />
            </div>

            {fType === 'select' && (
              <div>
                <label className="text-xs font-medium text-foreground block mb-1.5">
                  Opções <span className="text-destructive">*</span>
                </label>
                <textarea
                  value={fOptionsRaw}
                  onChange={(e) => setFOptionsRaw(e.target.value)}
                  rows={5}
                  placeholder="Uma opção por linha&#10;Psicologia&#10;Psicopedagogia&#10;Neuropsicologia"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Uma opção por linha. Linhas vazias são ignoradas.
                </p>
              </div>
            )}

            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={fRequired}
                onChange={(e) => setFRequired(e.target.checked)}
                className="w-4 h-4 rounded border-border"
              />
              <span className="text-sm text-foreground">Campo obrigatório</span>
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              {editing ? 'Salvar alterações' : 'Criar campo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de delete */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover campo?</DialogTitle>
            <DialogDescription>
              O campo <span className="font-medium text-foreground">{deleteTarget?.label}</span> será ocultado do formulário.
              Respostas já coletadas dos alunos serão preservadas no banco.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
