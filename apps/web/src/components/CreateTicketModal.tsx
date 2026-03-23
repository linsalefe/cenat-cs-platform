'use client';

import { useState, useEffect } from 'react';
import { X, Search, User, Tag, AlertCircle, MessageSquare, Loader2 } from 'lucide-react';
import api from '@/lib/api';

interface Student {
  id: number;
  name: string;
  email: string;
}

interface CreateTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const categories = [
  { value: 'financial', label: 'Financeiro' },
  { value: 'academic', label: 'Acadêmico' },
  { value: 'technical', label: 'Técnico' },
  { value: 'administrative', label: 'Administrativo' },
  { value: 'other', label: 'Outro' },
];

const priorities = [
  { value: 'low', label: 'Baixa', color: 'text-gray-600' },
  { value: 'medium', label: 'Média', color: 'text-amber-600' },
  { value: 'high', label: 'Alta', color: 'text-orange-600' },
  { value: 'urgent', label: 'Urgente', color: 'text-red-600' },
];

export default function CreateTicketModal({ isOpen, onClose, onSuccess }: CreateTicketModalProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [category, setCategory] = useState('academic');
  const [priority, setPriority] = useState('medium');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadStudents();
      resetForm();
    }
  }, [isOpen]);

  useEffect(() => {
    if (searchTerm.length >= 2) {
      const filtered = students.filter(
        (s) =>
          s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredStudents(filtered.slice(0, 10));
      setShowDropdown(true);
    } else {
      setFilteredStudents([]);
      setShowDropdown(false);
    }
  }, [searchTerm, students]);

  const loadStudents = async () => {
    try {
      setLoadingStudents(true);
      const res = await api.get('/students?limit=5000');
      setStudents(res.data.data || []);
    } catch (err) {
      console.error('Erro ao carregar alunos:', err);
    } finally {
      setLoadingStudents(false);
    }
  };

  const resetForm = () => {
    setSelectedStudent(null);
    setSearchTerm('');
    setCategory('academic');
    setPriority('medium');
    setSubject('');
    setMessage('');
    setError('');
  };

  const handleSelectStudent = (student: Student) => {
    setSelectedStudent(student);
    setSearchTerm(student.name);
    setShowDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedStudent) {
      setError('Selecione um aluno');
      return;
    }

    if (!subject.trim()) {
      setError('Informe o assunto');
      return;
    }

    if (!message.trim()) {
      setError('Informe a mensagem');
      return;
    }

    try {
      setLoading(true);
      await api.post('/tickets', {
        student_id: selectedStudent.id,
        category,
        priority,
        subject,
        message,
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError('Erro ao criar ticket');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg transform transition-all"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <div>
              <h2 className="text-xl font-semibold text-[#27273D]">Novo Ticket</h2>
              <p className="text-sm text-gray-500 mt-0.5">Criar ticket manualmente</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Aluno */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <User className="w-4 h-4 text-gray-400" />
                Aluno
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setSelectedStudent(null);
                  }}
                  onFocus={() => searchTerm.length >= 2 && setShowDropdown(true)}
                  placeholder="Buscar por nome ou email..."
                  className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl
                    focus:border-[#2A658F] focus:ring-4 focus:ring-[#2A658F]/10 
                    transition-all outline-none"
                />
                {loadingStudents && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 animate-spin" />
                )}

                {/* Dropdown */}
                {showDropdown && filteredStudents.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {filteredStudents.map((student) => (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => handleSelectStudent(student)}
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2A658F] to-[#3d7ba8] flex items-center justify-center text-white text-xs font-semibold">
                          {student.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{student.name}</p>
                          <p className="text-xs text-gray-500">{student.email}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedStudent && (
                <p className="mt-2 text-sm text-emerald-600 flex items-center gap-1">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                  {selectedStudent.name} selecionado
                </p>
              )}
            </div>

            {/* Categoria e Prioridade */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <Tag className="w-4 h-4 text-gray-400" />
                  Categoria
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl
                    focus:border-[#2A658F] focus:ring-4 focus:ring-[#2A658F]/10 
                    transition-all outline-none"
                >
                  {categories.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <AlertCircle className="w-4 h-4 text-gray-400" />
                  Prioridade
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl
                    focus:border-[#2A658F] focus:ring-4 focus:ring-[#2A658F]/10 
                    transition-all outline-none"
                >
                  {priorities.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Assunto */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                Assunto
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ex: Dúvida sobre certificado"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl
                  focus:border-[#2A658F] focus:ring-4 focus:ring-[#2A658F]/10 
                  transition-all outline-none"
              />
            </div>

            {/* Mensagem */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <MessageSquare className="w-4 h-4 text-gray-400" />
                Mensagem inicial
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Descreva o motivo do contato..."
                rows={4}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl
                  focus:border-[#2A658F] focus:ring-4 focus:ring-[#2A658F]/10 
                  transition-all outline-none resize-none"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm text-center">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 text-sm font-medium text-gray-700 bg-gray-100 
                  hover:bg-gray-200 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-3 text-sm font-medium text-white 
                  bg-gradient-to-r from-[#2A658F] to-[#3d7ba8] rounded-xl
                  hover:shadow-lg hover:shadow-[#2A658F]/30 transition-all
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Criando...
                  </span>
                ) : (
                  'Criar Ticket'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
