'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, Loader2, GraduationCap, User, Mail, Phone, BookOpen } from 'lucide-react';

export default function OnboardingPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [course, setCourse] = useState('');
  const [courses, setCourses] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [studentName, setStudentName] = useState('');

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/onboarding/courses`)
      .then((r) => r.json())
      .then((data) => setCourses(data))
      .catch(() => {});
  }, []);

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const handleSubmit = async () => {
    setError('');
    if (!name.trim()) { setError('Informe o nome completo'); return; }
    if (!email.trim()) { setError('Informe o e-mail'); return; }
    if (!phone.trim() || phone.replace(/\D/g, '').length < 10) { setError('Informe um telefone válido'); return; }
    if (!course.trim()) { setError('Selecione o curso'); return; }

    try {
      setLoading(true);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone: phone.replace(/\D/g, ''), course }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Erro ao enviar');
      }

      setStudentName(name.split(' ')[0]);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar formulário');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary via-[#2A658F] to-primary/80 flex items-center justify-center p-4">
        <div className="bg-card rounded-3xl shadow-2xl p-10 max-w-md w-full text-center animate-in fade-in zoom-in duration-500">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">
            Bem-vindo(a), {studentName}! 🎉
          </h1>
          <p className="text-muted-foreground leading-relaxed">
            Seu cadastro foi realizado com sucesso! Em breve você receberá uma mensagem no WhatsApp com todas as informações para iniciar sua jornada no CENAT.
          </p>
          <div className="mt-8 p-4 bg-blue-50 rounded-xl">
            <p className="text-sm text-primary font-medium">
              📱 Fique de olho no seu WhatsApp!
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-[#2A658F] to-primary/80 flex items-center justify-center p-4">
      <div className="bg-card rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden">
        <div className="bg-gradient-to-r from-primary to-[#2A658F] p-8 text-center">
          <div className="w-16 h-16 bg-card/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">CENAT</h1>
          <p className="text-white/80 text-sm">Cadastro do Aluno</p>
        </div>

        <div className="p-8 space-y-5">
          <p className="text-muted-foreground text-sm text-center -mt-2 mb-4">
            Preencha os dados do aluno para iniciar o processo de onboarding.
          </p>

          <div>
            <label className="text-sm font-medium text-foreground/90 mb-1.5 flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              Nome completo
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Maria da Silva"
              className="w-full px-4 py-3 border border-border rounded-xl
                focus:border-primary focus:ring-4 focus:ring-primary/10
                transition-all outline-none text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground/90 mb-1.5 flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" />
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="aluno@email.com"
              className="w-full px-4 py-3 border border-border rounded-xl
                focus:border-primary focus:ring-4 focus:ring-primary/10
                transition-all outline-none text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground/90 mb-1.5 flex items-center gap-2">
              <Phone className="w-4 h-4 text-primary" />
              WhatsApp
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="(83) 99999-9999"
              className="w-full px-4 py-3 border border-border rounded-xl
                focus:border-primary focus:ring-4 focus:ring-primary/10
                transition-all outline-none text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground/90 mb-1.5 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              Curso
            </label>
            {courses.length > 0 ? (
              <select
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                className="w-full px-4 py-3 border border-border rounded-xl
                  focus:border-primary focus:ring-4 focus:ring-primary/10
                  transition-all outline-none text-sm"
              >
                <option value="">Selecione o curso...</option>
                {courses.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                placeholder="Nome do curso"
                className="w-full px-4 py-3 border border-border rounded-xl
                  focus:border-primary focus:ring-4 focus:ring-primary/10
                  transition-all outline-none text-sm"
              />
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm text-center">
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-semibold text-white
              bg-gradient-to-r from-primary to-primary/80 rounded-xl
              hover:shadow-lg hover:shadow-[#2A658F]/30 transition-all
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Cadastrar Aluno
              </>
            )}
          </button>

          <p className="text-xs text-muted-foreground/70 text-center">
            CENAT © 2026 - Sistema de Retenção
          </p>
        </div>
      </div>
    </div>
  );
}
