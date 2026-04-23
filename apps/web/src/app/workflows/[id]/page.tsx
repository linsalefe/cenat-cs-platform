'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Node,
  Edge,
  Connection,
} from '@xyflow/react';

// CSS do React Flow — importante para o canvas renderizar corretamente
import '@xyflow/react/dist/style.css';

import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  ArrowLeft,
  Save,
  Play,
  Pause,
  Loader2,
  Info,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

interface Workflow {
  id: number;
  name: string;
  description: string | null;
  status: 'draft' | 'active' | 'paused';
  nodes: Node[];
  edges: Edge[];
  updated_at: string;
}

function WorkflowEditor() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params?.id);

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [dirty, setDirty] = useState(false);
  const firstLoad = useRef(true);

  // Carregar workflow
  useEffect(() => {
    if (!id || Number.isNaN(id)) return;
    (async () => {
      try {
        const res = await api.get(`/workflows/${id}`);
        const wf: Workflow = res.data;
        setWorkflow(wf);
        setName(wf.name);
        setNodes(wf.nodes || []);
        setEdges(wf.edges || []);
      } catch (e) {
        console.error(e);
        toast.error('Workflow não encontrado');
        router.push('/workflows');
      } finally {
        setLoading(false);
        // Evita que o primeiro setNodes/setEdges marque dirty
        setTimeout(() => {
          firstLoad.current = false;
        }, 0);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Marca dirty sempre que nodes/edges/nome mudam (após o carregamento inicial)
  useEffect(() => {
    if (firstLoad.current) return;
    setDirty(true);
  }, [nodes, edges, name]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds));
    },
    [setEdges]
  );

  const handleSave = async () => {
    if (!workflow) return;
    try {
      setSaving(true);
      const res = await api.put(`/workflows/${workflow.id}`, {
        name,
        nodes,
        edges,
      });
      setWorkflow(res.data);
      setDirty(false);
      toast.success('Workflow salvo');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async () => {
    if (!workflow) return;
    try {
      const res = await api.patch(`/workflows/${workflow.id}/toggle`);
      setWorkflow(res.data);
      toast.success(
        res.data.status === 'active' ? 'Workflow ativado' : 'Workflow pausado'
      );
    } catch (e) {
      console.error(e);
      toast.error('Erro ao alterar status');
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!workflow) return null;

  const isActive = workflow.status === 'active';
  const statusBadge =
    workflow.status === 'active'
      ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
      : workflow.status === 'paused'
      ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20'
      : 'bg-muted text-muted-foreground border-border';
  const statusLabel =
    workflow.status === 'active'
      ? 'Ativo'
      : workflow.status === 'paused'
      ? 'Pausado'
      : 'Rascunho';

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Editor toolbar */}
        <Card className="p-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/workflows">
                <ArrowLeft className="w-4 h-4" />
              </Link>
            </Button>

            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do workflow"
              className="max-w-md font-medium"
            />

            <span
              className={cn(
                'text-[10px] font-semibold px-1.5 py-0.5 rounded border uppercase tracking-wide',
                statusBadge
              )}
            >
              {statusLabel}
            </span>

            {dirty && (
              <span className="text-xs text-amber-600 dark:text-amber-400">
                • alterações não salvas
              </span>
            )}

            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggle}
                disabled={nodes.length === 0}
                title={
                  nodes.length === 0
                    ? 'Adicione nós antes de ativar'
                    : isActive
                    ? 'Pausar'
                    : 'Ativar'
                }
              >
                {isActive ? (
                  <>
                    <Pause className="w-4 h-4 mr-1" />
                    Pausar
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-1" />
                    Ativar
                  </>
                )}
              </Button>
              <Button onClick={handleSave} disabled={saving || !dirty} size="sm">
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-1" />
                )}
                Salvar
              </Button>
            </div>
          </div>
        </Card>

        {/* Canvas */}
        <Card className="p-0 overflow-hidden h-[calc(100vh-220px)]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
            className="bg-background"
          >
            <Background gap={16} size={1} />
            <Controls />
            <MiniMap
              nodeColor="var(--primary)"
              maskColor="hsl(var(--muted) / 0.5)"
              pannable
              zoomable
            />
          </ReactFlow>

          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-card/95 backdrop-blur border rounded-lg p-6 max-w-sm text-center shadow-md">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Info className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1">
                  Canvas vazio
                </h3>
                <p className="text-xs text-muted-foreground">
                  A biblioteca de gatilhos e ações específica para retenção de
                  alunos será adicionada no próximo passo (Prompt A.2).
                  <br />
                  <br />
                  Por ora, este editor valida que o React Flow está rodando e
                  que salvar/carregar funcionam.
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}

export default function WorkflowEditorPage() {
  return (
    <ReactFlowProvider>
      <WorkflowEditor />
    </ReactFlowProvider>
  );
}
