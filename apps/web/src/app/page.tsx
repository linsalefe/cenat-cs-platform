'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';

export default function Home() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#E2ECF4]">
        <p className="text-[#2A658F]">Carregando...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#E2ECF4]">
      <header className="bg-[#27273D] shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-white tracking-wider">CENAT</h1>
          <div className="flex items-center gap-4">
            <span className="text-[#CCE4F4]">{user.name}</span>
            <span className="text-xs bg-[#2A658F] text-white px-2 py-1 rounded">{user.role}</span>
            <button onClick={logout} className="text-red-400 hover:text-red-300 text-sm">Sair</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-semibold text-[#27273D] mb-6">Dashboard</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <a href="/tickets" className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow border-l-4 border-[#2A658F]">
            <h3 className="text-lg font-semibold text-[#27273D] mb-2">Fila de Tickets</h3>
            <p className="text-gray-600 text-sm">Gerencie os chamados dos alunos</p>
          </a>
          
          <div className="bg-white p-6 rounded-lg shadow border-l-4 border-[#CCE4F4]">
            <h3 className="text-lg font-semibold text-[#27273D] mb-2">Alunos</h3>
            <p className="text-gray-600 text-sm">Visão 360 dos alunos</p>
            <span className="text-xs text-gray-400 mt-2 block">Em breve</span>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow border-l-4 border-[#CCE4F4]">
            <h3 className="text-lg font-semibold text-[#27273D] mb-2">Risco de Evasão</h3>
            <p className="text-gray-600 text-sm">Alunos em risco alto</p>
            <span className="text-xs text-gray-400 mt-2 block">Em breve</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-[#27273D] mb-4">Bem-vindo ao Sistema de Retenção</h3>
          <p className="text-gray-600">
            Este sistema ajuda a identificar alunos em risco de evasão e organizar o atendimento 
            de forma profissional, garantindo que nenhuma solicitação se perca.
          </p>
        </div>
      </main>
    </div>
  );
}
