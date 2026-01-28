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
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Carregando...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-800">CENAT - Sistema de Retenção</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-600">{user.name}</span>
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
              {user.role}
            </span>
            <button
              onClick={logout}
              className="text-red-600 hover:text-red-800 text-sm"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-semibold text-gray-800 mb-6">Dashboard</h2>
        <p className="text-gray-600">Bem-vindo ao sistema de retenção de alunos.</p>
      </main>
    </div>
  );
}
