'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';

interface RiskSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
}

export default function Home() {
  const [riskSummary, setRiskSummary] = useState<RiskSummary | null>(null);
  const [ticketCount, setTicketCount] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [riskRes, ticketsRes] = await Promise.all([
        api.get('/risk/summary').catch(() => null),
        api.get('/tickets?limit=1').catch(() => null),
      ]);
      if (riskRes) setRiskSummary(riskRes.data);
      if (ticketsRes) setTicketCount(ticketsRes.data?.length || 0);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
  };

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#27273D]">Dashboard</h1>
        <p className="text-gray-600 mt-1">Bem-vindo ao Sistema de Retenção</p>
      </div>

      {/* Cards Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <a href="/risk" className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow border-l-4 border-red-500">
          <p className="text-sm font-medium text-gray-500 uppercase">Risco Crítico</p>
          <p className="text-3xl font-bold text-gray-800 mt-2">{riskSummary?.critical || 0}</p>
          <p className="text-xs text-gray-400 mt-1">alunos</p>
        </a>

        <a href="/risk" className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow border-l-4 border-orange-500">
          <p className="text-sm font-medium text-gray-500 uppercase">Risco Alto</p>
          <p className="text-3xl font-bold text-gray-800 mt-2">{riskSummary?.high || 0}</p>
          <p className="text-xs text-gray-400 mt-1">alunos</p>
        </a>

        <a href="/risk" className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow border-l-4 border-yellow-500">
          <p className="text-sm font-medium text-gray-500 uppercase">Risco Médio</p>
          <p className="text-3xl font-bold text-gray-800 mt-2">{riskSummary?.medium || 0}</p>
          <p className="text-xs text-gray-400 mt-1">alunos</p>
        </a>

        <a href="/risk" className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow border-l-4 border-green-500">
          <p className="text-sm font-medium text-gray-500 uppercase">Risco Baixo</p>
          <p className="text-3xl font-bold text-gray-800 mt-2">{riskSummary?.low || 0}</p>
          <p className="text-xs text-gray-400 mt-1">alunos</p>
        </a>
      </div>

      {/* Cards de Ação */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <a href="/tickets" className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-2xl">
              🎫
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Fila de Tickets</h3>
              <p className="text-sm text-gray-500">Gerencie os chamados</p>
            </div>
          </div>
        </a>

        <a href="/risk" className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center text-2xl">
              ⚠️
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Risco de Evasão</h3>
              <p className="text-sm text-gray-500">Monitore alunos em risco</p>
            </div>
          </div>
        </a>

        <a href="/students" className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-2xl">
              👥
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Alunos</h3>
              <p className="text-sm text-gray-500">Visão 360 dos alunos</p>
            </div>
          </div>
        </a>
      </div>

      {/* Info Box */}
      <div className="bg-white p-6 rounded-xl shadow-sm">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Sobre o Sistema</h3>
        <p className="text-gray-600">
          Este sistema ajuda a identificar alunos em risco de evasão e organizar o atendimento 
          de forma profissional, garantindo que nenhuma solicitação se perca.
        </p>
      </div>
    </AppLayout>
  );
}
