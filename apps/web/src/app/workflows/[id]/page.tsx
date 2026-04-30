'use client';

import {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from 'react';
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
  useReactFlow,
  type Node,
  type Edge,
  type Connection,
  type ReactFlowInstance,
} from '@xyflow/react';

// CSS obrigatório do React Flow
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
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

import NodeLibrary from '@/components/workflows/NodeLibrary';
import NodeConfigPanel, {
  defaultDataFor,
} from '@/components/workflows/NodeConfigPanel';
import { nodeTypes } from '@/components/workflows/nodes';
import { validateNodeData } from '@/components/workflows/node-definitions';

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

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [libraryCollapsed, setLibraryCollapsed] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);

  // Atalhos de teclado: +/= zoom in, - zoom out, 0 reset (fitView)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignorar se o foco está em um input/textarea/contenteditable
      const target = e.target as HTMLElement;
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      ) {
        return;
      }
      if (!rfInstance) return;

      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        rfInstance.zoomIn({ duration: 200 });
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        rfInstance.zoomOut({ duration: 200 });
      } else if (e.key === '0') {
        e.preventDefault();
        rfInstance.fitView({ duration: 300, padding: 0.2 });
      } else if (e.key === 'Escape' && fullScreen) {
        e.preventDefault();
        setFullScreen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [rfInstance, fullScreen]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [dirty, setDirty] = useState(false);
  const firstLoad = useRef(true);

  /* ---------- Load ---------- */
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
        setTimeout(() => {
          firstLoad.current = false;
        }, 50);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (firstLoad.current) return;
    setDirty(true);
  }, [nodes, edges, name]);

  /* ---------- React Flow handlers ---------- */
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            // edges com sourceHandle 'no' ficam vermelhas, 'yes' ficam verdes,
            // neutras ficam azuis (primary)
            style: {
              stroke:
                connection.sourceHandle === 'no'
                  ? 'var(--destructive)'
                  : connection.sourceHandle === 'yes'
                  ? '#10b981'
                  : 'var(--primary)',
              strokeWidth: 2,
            },
            animated: true,
          },
          eds
        )
      );
    },
    [setEdges]
  );

  /* ---------- Drag & drop da library ---------- */
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData('application/cenat-workflow-node');
      if (!type || !rfInstance) return;

      const position = rfInstance.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });

      const newNode: Node = {
        id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type,
        position,
        data: defaultDataFor(type),
      };

      setNodes((nds) => nds.concat(newNode));
      setSelectedNodeId(newNode.id);
    },
    [rfInstance, setNodes]
  );

  /* ---------- Selection & mutations ---------- */
  const updateNodeData = useCallback(
    (nodeId: string, data: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data } : n))
      );
    },
    [setNodes]
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) =>
        eds.filter((e) => e.source !== nodeId && e.target !== nodeId)
      );
      setSelectedNodeId(null);
    },
    [setNodes, setEdges]
  );

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) || null,
    [nodes, selectedNodeId]
  );

  /* ---------- Save / Toggle ---------- */
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
    // Validação antes de ativar
    if (workflow.status !== 'active') {
      const invalid = nodes.filter(
        (n) =>
          !validateNodeData(
            n.type || '',
            (n.data as Record<string, unknown>) || {}
          ).valid
      );
      const hasTrigger = nodes.some((n) => n.type?.startsWith('trigger.'));
      const hasAction = nodes.some((n) => n.type?.startsWith('action.'));
      if (!hasTrigger) {
        toast.error('Adicione pelo menos um gatilho antes de ativar.');
        return;
      }
      if (!hasAction) {
        toast.error('Adicione pelo menos uma ação antes de ativar.');
        return;
      }
      if (invalid.length > 0) {
        toast.error(
          `${invalid.length} nó(s) com configuração incompleta. Corrija antes de ativar.`
        );
        return;
      }
      if (dirty) {
        toast.error('Salve as alterações antes de ativar.');
        return;
      }
    }
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

  /* ---------- Render ---------- */
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
      <div className="space-y-3">
        {/* Toolbar */}
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

        {/* Editor: library + canvas + config */}
        <Card className="p-0 overflow-hidden h-[calc(100vh-200px)]">
          <div className="flex h-full">
            <NodeLibrary
              collapsed={libraryCollapsed}
              onToggleCollapsed={() => setLibraryCollapsed((v) => !v)}
            />

            <div className={fullScreen ? "fixed inset-0 z-50 bg-background" : "flex-1 relative"} ref={reactFlowWrapper}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onInit={setRfInstance}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onNodeClick={(_, n) => setSelectedNodeId(n.id)}
                onPaneClick={() => setSelectedNodeId(null)}
                nodeTypes={nodeTypes}
                fitView
                minZoom={0.3}
                maxZoom={2}
                className="bg-background"
                defaultEdgeOptions={{
                  style: { stroke: 'var(--primary)', strokeWidth: 2 },
                  animated: true,
                }}
              >
                <Background gap={16} size={1} />
                <Controls />
                <button
                  type="button"
                  onClick={() => setFullScreen((v) => !v)}
                  className="absolute top-3 right-3 z-10 inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-card border border-border rounded-lg text-xs font-medium text-foreground hover:bg-muted transition-colors shadow-sm"
                  title={fullScreen ? 'Sair da tela cheia (Esc)' : 'Tela cheia'}
                >
                  {fullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  <span>{fullScreen ? 'Sair' : 'Tela cheia'}</span>
                </button>
                <MiniMap
                  nodeColor="var(--primary)"
                  maskColor="rgba(0,0,0,0.05)"
                  pannable
                  zoomable
                />
              </ReactFlow>

              {nodes.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-card/95 backdrop-blur border rounded-lg px-5 py-4 max-w-xs text-center shadow-md">
                    <p className="text-sm font-medium text-foreground mb-1">
                      Canvas vazio
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Arraste um <span className="font-medium text-foreground">Gatilho</span>{' '}
                      da biblioteca para começar.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <NodeConfigPanel
              node={selectedNode}
              onUpdate={updateNodeData}
              onDelete={deleteNode}
              onClose={() => setSelectedNodeId(null)}
            />
          </div>
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
