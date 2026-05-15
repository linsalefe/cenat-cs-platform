'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Upload,
  FileText,
  Loader2,
  X,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

interface DispatchBatchStatus {
  id: number;
  status: 'queued' | 'running' | 'completed' | 'failed' | string;
  total_recipients: number;
  dispatched: number;
  skipped_active: number;
  skipped_no_student: number;
  skipped_no_phone: number;
  failed: number;
  processed: number;
  progress_pct: number;
  error_message: string | null;
  finished_at: string | null;
}

interface DispatchDrawerProps {
  open: boolean;
  workflowId: number;
  workflowName: string;
  onClose: () => void;
}

export default function DispatchDrawer({
  open,
  workflowId,
  workflowName,
  onClose,
}: DispatchDrawerProps) {
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [batch, setBatch] = useState<DispatchBatchStatus | null>(null);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = () => {
    if (pollingRef.current) {
      clearTimeout(pollingRef.current);
      pollingRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  const handleClose = () => {
    if (sending) return;
    stopPolling();
    setFile(null);
    setBatch(null);
    setSending(false);
    onClose();
  };

  const handleFileSelect = (f: File | null) => {
    if (!f) {
      setFile(null);
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error('Arquivo maior que 5 MB');
      return;
    }
    setFile(f);
  };

  const pollBatch = async (batchId: number) => {
    try {
      const res = await api.get(`/workflows/dispatch-batches/${batchId}`);
      setBatch(res.data);
      if (res.data.status === 'completed' || res.data.status === 'failed') {
        stopPolling();
        return;
      }
      pollingRef.current = setTimeout(() => pollBatch(batchId), 3000);
    } catch {
      pollingRef.current = setTimeout(() => pollBatch(batchId), 5000);
    }
  };

  const handleDispatch = async () => {
    if (!file) {
      toast.error('Selecione um CSV antes');
      return;
    }
    setSending(true);
    setBatch(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post(`/workflows/${workflowId}/dispatch-csv`, fd);
      toast.success('Disparo iniciado em background');
      const batchId = res.data.batch_id;
      pollBatch(batchId);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      toast.error(err?.response?.data?.detail || 'Erro ao iniciar disparo');
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={handleClose}
      />

      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-card border-l border-border shadow-xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Disparar workflow</h2>
            <p className="text-[11px] text-muted-foreground truncate">{workflowName}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleClose} disabled={sending}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {!file ? (
            <label className="block cursor-pointer">
              <div className="border-2 border-dashed border-border hover:border-primary/50 rounded-xl px-6 py-10 text-center transition-colors bg-muted/30 hover:bg-primary/5">
                <Upload className="w-8 h-8 mx-auto text-muted-foreground/70 mb-3" />
                <p className="text-sm font-medium text-foreground">Clique para selecionar um CSV</p>
                <p className="text-[11px] text-muted-foreground/70 mt-1">
                  Coluna <code className="bg-muted px-1 rounded">numero</code> obrigatória. Outras colunas são ignoradas.
                </p>
              </div>
              <input
                type="file"
                accept=".csv,.txt,text/csv"
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
              />
            </label>
          ) : (
            <div className="border border-border rounded-xl p-4 bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                  <p className="text-[11px] text-muted-foreground/70">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                {!sending && !batch && (
                  <button
                    onClick={() => setFile(null)}
                    className="p-1.5 text-muted-foreground/70 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                    aria-label="Remover arquivo"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {batch && (
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-foreground">
                  Batch #{batch.id}
                </p>
                {batch.status === 'completed' ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded">
                    <CheckCircle2 className="w-3 h-3" /> concluído
                  </span>
                ) : batch.status === 'failed' ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-2 py-0.5 rounded">
                    <AlertTriangle className="w-3 h-3" /> falhou
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 rounded">
                    <Loader2 className="w-3 h-3 animate-spin" /> {batch.status}
                  </span>
                )}
              </div>

              <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-4">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${batch.progress_pct}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total:</span>
                  <strong>{batch.total_recipients}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Processados:</span>
                  <strong>{batch.processed}</strong>
                </div>
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                  <span className="opacity-70">Disparados:</span>
                  <strong>{batch.dispatched}</strong>
                </div>
                <div className="flex justify-between text-amber-700 dark:text-amber-400">
                  <span className="opacity-70">Já em régua:</span>
                  <strong>{batch.skipped_active}</strong>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span className="opacity-70">Sem aluno:</span>
                  <strong>{batch.skipped_no_student}</strong>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span className="opacity-70">Sem fone:</span>
                  <strong>{batch.skipped_no_phone}</strong>
                </div>
                {batch.failed > 0 && (
                  <div className="flex justify-between text-red-700 dark:text-red-400 col-span-2">
                    <span className="opacity-70">Falharam:</span>
                    <strong>{batch.failed}</strong>
                  </div>
                )}
              </div>

              {batch.error_message && (
                <p className="text-[11px] text-red-600 dark:text-red-400 mt-3">
                  {batch.error_message}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border flex gap-2 justify-end">
          <Button variant="outline" onClick={handleClose} disabled={sending}>
            {batch?.status === 'completed' || batch?.status === 'failed' ? 'Fechar' : 'Cancelar'}
          </Button>
          {!batch && (
            <Button onClick={handleDispatch} disabled={!file || sending}>
              {sending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Disparar agora
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
