'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Mail, Lock, Eye, EyeOff, Shield, Users, BarChart3, Zap } from 'lucide-react';

const features = [
  { icon: Shield, title: 'Gestão de Risco', desc: 'Identifique alunos em risco de evasão' },
  { icon: Users, title: 'Atendimento', desc: 'Tickets e comunicação integrada' },
  { icon: BarChart3, title: 'Métricas', desc: 'NPS, CSAT e dashboards completos' },
  { icon: Zap, title: 'Automação', desc: 'Triggers e playbooks automáticos' },
];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  const { login, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      router.push('/');
    } catch (err) {
      setError('Email ou senha inválidos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Painel Esquerdo - Branding */}
      <div 
        className={`hidden lg:flex lg:w-[55%] bg-gradient-to-br from-primary via-[#2A658F] to-primary/90 
          relative overflow-hidden transition-all duration-700 ${
          mounted ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Grid Pattern */}
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        {/* Círculos decorativos */}
        <div className="absolute -top-20 -left-20 w-96 h-96 bg-card/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] bg-primary/30 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-card/5 rounded-full blur-2xl" />

        {/* Conteúdo */}
        <div className="relative z-10 flex flex-col justify-center px-16 w-full">
          <div 
            className={`transition-all duration-700 delay-200 ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
          >
            <h1 className="text-5xl font-bold text-white mb-2 tracking-tight">CENAT</h1>
            <p className="text-[#CCE4F4] text-xl mb-2">Sistema de Retenção</p>
            <p className="text-white/60 text-sm mb-12">Plataforma de Gestão de Permanência Acadêmica</p>
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-2 gap-4">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className={`bg-card/10 backdrop-blur-sm rounded-xl p-4 border border-white/10
                  hover:bg-card/15 transition-all duration-300 hover:-translate-y-1
                  ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                style={{ transitionDelay: `${300 + index * 100}ms` }}
              >
                <feature.icon className="w-8 h-8 text-[#CCE4F4] mb-3" />
                <h3 className="text-white font-semibold mb-1">{feature.title}</h3>
                <p className="text-white/60 text-sm">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Painel Direito - Form */}
      <div 
        className={`w-full lg:w-[45%] flex items-center justify-center p-8 bg-primary/10
          transition-all duration-500 ${mounted ? 'opacity-100' : 'opacity-0'}`}
      >
        <div className="w-full max-w-md">
          {/* Logo mobile */}
          <div className="lg:hidden text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground">CENAT</h1>
            <p className="text-primary">Sistema de Retenção</p>
          </div>

          <div 
            className={`bg-card rounded-2xl shadow-xl p-8 transition-all duration-500 delay-300 ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
          >
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-foreground">Bem-vindo de volta</h2>
              <p className="text-muted-foreground mt-1">Faça login para continuar</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-foreground/90 mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/70" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 border-2 border-border rounded-xl
                      focus:border-primary focus:ring-4 focus:ring-primary/10 
                      transition-all duration-200 outline-none"
                    placeholder="seu@email.com"
                    required
                  />
                </div>
              </div>

              {/* Senha */}
              <div>
                <label className="block text-sm font-medium text-foreground/90 mb-1.5">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/70" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-12 py-3 border-2 border-border rounded-xl
                      focus:border-primary focus:ring-4 focus:ring-primary/10 
                      transition-all duration-200 outline-none"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 
                      hover:text-muted-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Erro */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm text-center">
                  {error}
                </div>
              )}

              {/* Botão */}
              <button
                type="submit"
                disabled={loading}
                className="relative w-full py-3 bg-gradient-to-r from-primary to-primary/80 
                  text-white font-semibold rounded-xl shadow-lg shadow-[#2A658F]/30
                  hover:shadow-xl hover:shadow-[#2A658F]/40 hover:-translate-y-0.5
                  disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0
                  transition-all duration-300 overflow-hidden group"
              >
                {/* Shine effect */}
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full 
                  bg-gradient-to-r from-transparent via-white/20 to-transparent 
                  transition-transform duration-700" />
                
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Entrando...
                  </span>
                ) : (
                  'Entrar'
                )}
              </button>
            </form>
          </div>

          {/* Footer */}
          <p className="text-center text-muted-foreground text-sm mt-6">
            CENAT © {new Date().getFullYear()} - Todos os direitos reservados
          </p>
        </div>
      </div>
    </div>
  );
}
