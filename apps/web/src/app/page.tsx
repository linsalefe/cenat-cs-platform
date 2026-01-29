'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link'; // UX: Navegação sem recarregar a página
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';

import { Ticket, AlertTriangle, Users } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';

interface RiskSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
}

// Cores exatas do Tailwind para sincronizar gráfico e cards
const COLORS = {
  critical: '#ef4444', // red-500
  high: '#f97316',     // orange-500
  medium: '#eab308',   // yellow-500
  low: '#22c55e',      // green-500
};

export default function Home() {
  const [riskSummary, setRiskSummary] = useState<RiskSummary | null>(null);
  const [ticketCount, setTicketCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true); // UX: Estado de carregamento

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [riskRes, ticketsRes] = await Promise.all([
        api.get('/risk/summary').catch(() => null),
        // UX: Idealmente sua API deveria ter um endpoint /tickets/count ou retornar meta.total
        api.get('/tickets?limit=1').catch(() => null),
      ]);
      
      if (riskRes) setRiskSummary(riskRes.data);
      // Fallback simples para contagem baseada na resposta atual
      if (ticketsRes) setTicketCount(ticketsRes.data?.length || 0); 
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const riskChartData = useMemo(() => {
    const s = riskSummary;
    return [
      { name: 'Crítico', value: s?.critical ?? 0, color: COLORS.critical },
      { name: 'Alto', value: s?.high ?? 0, color: COLORS.high },
      { name: 'Médio', value: s?.medium ?? 0, color: COLORS.medium },
      { name: 'Baixo', value: s?.low ?? 0, color: COLORS.low },
    ];
  }, [riskSummary]);

  // UX: Saudação baseada na hora do dia
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  }, []);

  // Componente de Skeleton para Loading
  if (isLoading) {
    return (
      <AppLayout>
        <div className="animate-pulse space-y-8">
            <div className="h-20 bg-gray-200 rounded-xl w-1/3"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="space-y-6"><div className="h-96 bg-gray-200 rounded-xl"></div></div>
                <div className="lg:col-span-2 h-96 bg-gray-200 rounded-xl"></div>
            </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#27273D]">{greeting}, bem-vindo(a)!</h1>
        <p className="text-gray-600 mt-1">Visão geral do Sistema de Retenção</p>
      </div>

      {/* Cards Resumo */}
      {/* UX: Adicionado hover:-translate-y-1 para feedback tátil */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Link href="/risk?level=critical" className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1 border-l-4 border-red-500 group">
          <p className="text-sm font-medium text-gray-500 uppercase group-hover:text-red-500 transition-colors">Risco Crítico</p>
          <p className="text-3xl font-bold text-gray-800 mt-2">{riskSummary?.critical || 0}</p>
          <p className="text-xs text-gray-400 mt-1">alunos</p>
        </Link>

        <Link href="/risk?level=high" className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1 border-l-4 border-orange-500 group">
          <p className="text-sm font-medium text-gray-500 uppercase group-hover:text-orange-500 transition-colors">Risco Alto</p>
          <p className="text-3xl font-bold text-gray-800 mt-2">{riskSummary?.high || 0}</p>
          <p className="text-xs text-gray-400 mt-1">alunos</p>
        </Link>

        <Link href="/risk?level=medium" className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1 border-l-4 border-yellow-500 group">
          <p className="text-sm font-medium text-gray-500 uppercase group-hover:text-yellow-500 transition-colors">Risco Médio</p>
          <p className="text-3xl font-bold text-gray-800 mt-2">{riskSummary?.medium || 0}</p>
          <p className="text-xs text-gray-400 mt-1">alunos</p>
        </Link>

        <Link href="/risk?level=low" className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1 border-l-4 border-green-500 group">
          <p className="text-sm font-medium text-gray-500 uppercase group-hover:text-green-500 transition-colors">Risco Baixo</p>
          <p className="text-3xl font-bold text-gray-800 mt-2">{riskSummary?.low || 0}</p>
          <p className="text-xs text-gray-400 mt-1">alunos</p>
        </Link>
      </div>

      {/* Linha: Ações + Gráfico */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Cards de Ação */}
        <div className="lg:col-span-1 space-y-6">
          <Link href="/tickets" className="block bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1 group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-[#2A658F] transition-colors">
                <Ticket className="text-[#2A658F] group-hover:text-white transition-colors" size={22} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Fila de Tickets</h3>
                <p className="text-sm text-gray-500">Gerencie os chamados</p>
                {/* UX: Feedback visual se houver tickets na fila */}
                {ticketCount > 0 && (
                     <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                        {ticketCount} ativo(s)
                     </span>
                )}
              </div>
            </div>
          </Link>

          <Link href="/risk" className="block bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1 group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center group-hover:bg-orange-500 transition-colors">
                <AlertTriangle className="text-orange-700 group-hover:text-white transition-colors" size={22} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Risco de Evasão</h3>
                <p className="text-sm text-gray-500">Monitore alunos em risco</p>
              </div>
            </div>
          </Link>

          <Link href="/students" className="block bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1 group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-500 transition-colors">
                <Users className="text-green-700 group-hover:text-white transition-colors" size={22} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Alunos</h3>
                <p className="text-sm text-gray-500">Visão 360 dos alunos</p>
              </div>
            </div>
          </Link>
        </div>

        {/* Gráfico */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm flex flex-col">
          <div className="mb-6 flex justify-between items-end">
            <div>
                <h3 className="text-lg font-semibold text-gray-800">Distribuição de Risco</h3>
                <p className="text-sm text-gray-500">Panorama atual da base de alunos</p>
            </div>
          </div>

          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskChartData} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#6B7280', fontSize: 12 }} 
                    dy={10}
                />
                <YAxis 
                    allowDecimals={false} 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#6B7280', fontSize: 12 }}
                />
                <Tooltip 
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                />
                {/* UX: Radius nas barras e cores mapeadas individualmente */}
                <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={60}>
                    {riskChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-sm font-semibold text-gray-800 mb-2 uppercase tracking-wide">Sobre o Sistema</h3>
        <p className="text-sm text-gray-600 leading-relaxed">
          Este sistema utiliza inteligência de dados para identificar alunos em risco de evasão. 
          Priorize o atendimento aos alunos de <span className="font-medium text-red-600">Risco Crítico</span> e <span className="font-medium text-orange-600">Alto</span> para maximizar a retenção.
        </p>
      </div>
    </AppLayout>
  );
}