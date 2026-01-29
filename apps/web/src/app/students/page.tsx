'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import LoadingState from '@/components/LoadingState';
import EmptyState from '@/components/EmptyState';

// --- Interfaces ---
interface Student {
  id: number;
  name: string;
  email: string;
  phone: string;
  moodle_user_id: number | null;
}

// --- Helpers ---
function normalizePhoneToWa(phone?: string | null) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('55')) return digits;
  return `55${digits}`;
}

// --- Componente: Card Mobile ---
function MobileStudentCard({ 
  student, 
  onNavigate 
}: { 
  student: Student; 
  onNavigate: () => void; 
}) {
  const wa = normalizePhoneToWa(student.phone);

  return (
    <div 
      onClick={onNavigate}
      className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-3 active:scale-[0.98] transition-transform cursor-pointer"
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-semibold text-[#27273D]">{student.name}</h3>
          <p className="text-xs text-gray-500">{student.email}</p>
        </div>
        {student.moodle_user_id ? (
          <span className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold uppercase rounded-full">
            Moodle ON
          </span>
        ) : (
          <span className="px-2 py-1 bg-gray-100 text-gray-500 text-[10px] font-bold uppercase rounded-full">
            Moodle OFF
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
        <span>{student.phone || 'Sem telefone'}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-50">
        <button className="flex justify-center items-center py-2 rounded-lg border border-[#2A658F] text-[#2A658F] text-xs font-medium bg-white">
           Ver Detalhes
        </button>

        <div className="flex gap-2">
            <a 
              href={`mailto:${student.email}`}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 flex justify-center items-center bg-gray-50 rounded-lg text-gray-600 border border-transparent active:bg-gray-100"
            >
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            </a>
            {wa && (
              <a 
                href={`https://wa.me/${wa}`}
                target="_blank" 
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex-1 flex justify-center items-center bg-green-50 rounded-lg text-green-600 border border-transparent active:bg-green-100"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
              </a>
            )}
        </div>
      </div>
    </div>
  );
}

export default function StudentsPage() {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    try {
      setLoading(true);
      setLoadError(false);
      const res = await api.get('/students?limit=100');
      setStudents(res.data);
    } catch (error) {
      console.error('Erro ao carregar alunos:', error);
      toast.error('Erro ao carregar lista de alunos');
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = useMemo(() => {
    return students.filter(
        (s) =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.email.toLowerCase().includes(search.toLowerCase())
    );
  }, [students, search]);

  const clearSearch = () => setSearch('');

  return (
    <AppLayout>
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#27273D]">Alunos</h1>
          <p className="text-gray-600 mt-1">Gerencie e visualize a base de alunos</p>
        </div>

        <button 
          onClick={loadStudents}
          className="text-sm text-[#2A658F] hover:text-[#27273D] flex items-center gap-2 font-medium transition-colors"
        >
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Atualizar lista
        </button>
      </div>

      {/* Busca */}
      <div className="bg-white p-4 rounded-xl shadow-sm mb-6">
        <label className="block text-sm font-medium text-[#27273D] mb-1">Buscar</label>
        <div className="relative">
            <input
            type="text"
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-gray-300 rounded-md pl-9 pr-3 py-2 text-sm focus:ring-[#2A658F] focus:border-[#2A658F] transition-all"
            />
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {search && (
                <button onClick={clearSearch} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            )}
        </div>
      </div>

      {/* Lista */}
      <div className="bg-transparent md:bg-white md:rounded-xl md:shadow-sm overflow-hidden min-h-[400px]">
        {loading ? (
          <LoadingState label="Carregando alunos..." />
        ) : loadError ? (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white rounded-xl">
            <EmptyState
              title="Não foi possível carregar os alunos"
              description="Verifique sua conexão e tente novamente."
            />
            <button
              onClick={loadStudents}
              className="mt-4 px-4 py-2 rounded-md bg-[#2A658F] text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Tentar novamente
            </button>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="py-10 bg-white rounded-xl">
             <EmptyState
                title="Nenhum aluno encontrado"
                description={search ? "Tente buscar por outro termo." : "A base de alunos está vazia."}
             />
             {search && (
                <div className="flex justify-center mt-4">
                   <button onClick={clearSearch} className="text-[#2A658F] hover:underline text-sm">Limpar busca</button>
                </div>
             )}
          </div>
        ) : (
          <>
            {/* VERSÃO MOBILE: Cards */}
            <div className="md:hidden space-y-3">
                {filteredStudents.map((student) => (
                    <MobileStudentCard
                        key={student.id}
                        student={student}
                        onNavigate={() => router.push(`/risk/${student.id}`)}
                    />
                ))}
            </div>

            {/* VERSÃO DESKTOP: Tabela */}
            <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-[#CCE4F4]">
                    <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-[#27273D] uppercase tracking-wider">
                        Nome
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-[#27273D] uppercase tracking-wider">
                        Contato
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-[#27273D] uppercase tracking-wider">
                        Moodle
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-[#27273D] uppercase tracking-wider">
                        Ações
                    </th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {filteredStudents.map((student) => {
                       const wa = normalizePhoneToWa(student.phone);
                       return (
                        <tr 
                            key={student.id} 
                            onClick={() => router.push(`/risk/${student.id}`)}
                            className="hover:bg-[#E2ECF4] cursor-pointer transition-colors group"
                        >
                            <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                                <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-[#2A658F] font-bold text-xs mr-3">
                                    {student.name.charAt(0)}
                                </div>
                                <div>
                                    <p className="font-medium text-[#27273D] group-hover:text-[#2A658F] transition-colors">{student.name}</p>
                                    <p className="text-xs text-gray-500">ID: {student.id}</p>
                                </div>
                            </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-600">{student.email}</div>
                                <div className="text-xs text-gray-400">{student.phone || '-'}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                            {student.moodle_user_id ? (
                                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                                Vinculado
                                </span>
                            ) : (
                                <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs font-medium rounded-full">
                                Pendente
                                </span>
                            )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => router.push(`/risk/${student.id}`)}
                                        className="text-[#2A658F] hover:text-[#27273D] hover:underline"
                                    >
                                        Detalhes
                                    </button>
                                    
                                    <div className="h-4 w-px bg-gray-300"></div>

                                    <a href={`mailto:${student.email}`} className="text-gray-400 hover:text-[#27273D]" title="Enviar Email">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                    </a>

                                    {wa && (
                                        <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="text-green-500 hover:text-green-600" title="WhatsApp">
                                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                                    </a>
                                    )}
                                </div>
                            </td>
                        </tr>
                       );
                    })}
                </tbody>
                </table>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}