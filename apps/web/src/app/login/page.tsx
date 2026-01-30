'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { 
  Eye, 
  EyeOff, 
  Mail, 
  Lock, 
  ArrowRight, 
  CheckCircle2,
  AlertCircle,
  GraduationCap,
  Users,
  TrendingUp,
  Shield
} from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const { login } = useAuth();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      router.push('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Email ou senha incorretos. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: GraduationCap, title: 'Gestão de Alunos', desc: 'Acompanhe a jornada completa' },
    { icon: TrendingUp, title: 'Análise de Risco', desc: 'Predição de evasão com IA' },
    { icon: Users, title: 'Atendimento', desc: 'Tickets centralizados' },
    { icon: Shield, title: 'Retenção', desc: 'Playbooks automatizados' },
  ];

  return (
    <div className="min-h-screen flex">
      {/* ═══════════════════════════════════════════════════════════════════════
          PAINEL ESQUERDO - BRANDING
          ═══════════════════════════════════════════════════════════════════════ */}
      <div 
        className={`hidden lg:flex lg:w-[55%] relative overflow-hidden transition-all duration-1000 ${
          mounted ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          background: 'linear-gradient(135deg, #1a4a6e 0%, #2A658F 50%, #3d7ba8 100%)',
        }}
      >
        {/* Padrão de fundo decorativo */}
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Círculos decorativos */}
        <div className="absolute -top-20 -left-20 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full bg-white/5 blur-3xl" />
        <div className="absolute top-1/2 left-1/4 w-64 h-64 rounded-full bg-cyan-400/10 blur-2xl animate-pulse" />

        {/* Conteúdo */}
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo e título */}
          <div 
            className={`transition-all duration-700 delay-300 ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <GraduationCap className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-wide">CENAT</h1>
                <p className="text-cyan-200 text-sm">Centro de Ensino</p>
              </div>
            </div>
          </div>

          {/* Mensagem principal */}
          <div 
            className={`space-y-8 transition-all duration-700 delay-500 ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            <div>
              <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight">
                Sistema de
                <span className="block text-cyan-300">Retenção Inteligente</span>
              </h2>
              <p className="mt-4 text-lg text-cyan-100/80 max-w-md">
                Acompanhe seus alunos, identifique riscos de evasão e tome ações proativas para garantir o sucesso acadêmico.
              </p>
            </div>

            {/* Features grid */}
            <div className="grid grid-cols-2 gap-4 max-w-lg">
              {features.map((feature, index) => (
                <div
                  key={feature.title}
                  className={`group p-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 
                    hover:bg-white/15 hover:border-white/20 transition-all duration-300 cursor-default
                    ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                  style={{ transitionDelay: `${600 + index * 100}ms` }}
                >
                  <feature.icon className="w-6 h-6 text-cyan-300 mb-2 group-hover:scale-110 transition-transform" />
                  <h3 className="text-white font-semibold text-sm">{feature.title}</h3>
                  <p className="text-cyan-200/70 text-xs mt-1">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Rodapé */}
          <div 
            className={`text-cyan-200/50 text-sm transition-all duration-700 delay-1000 ${
              mounted ? 'opacity-100' : 'opacity-0'
            }`}
          >
            © {new Date().getFullYear()} CENAT · Todos os direitos reservados
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          PAINEL DIREITO - FORMULÁRIO DE LOGIN
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-gray-50">
        <div 
          className={`w-full max-w-md transition-all duration-700 delay-200 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          {/* Logo mobile */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#2A658F] flex items-center justify-center">
                <GraduationCap className="w-7 h-7 text-white" />
              </div>
              <div className="text-left">
                <h1 className="text-2xl font-bold text-[#27273D] tracking-wide">CENAT</h1>
                <p className="text-[#2A658F] text-sm">Sistema de Retenção</p>
              </div>
            </div>
          </div>

          {/* Header do formulário */}
          <div className="mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#27273D]">
              Bem-vindo de volta
            </h2>
            <p className="mt-2 text-gray-500">
              Entre com suas credenciais para acessar o sistema
            </p>
          </div>

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Mensagem de erro */}
            {error && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-100 animate-in slide-in-from-top-2 duration-300">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800">Erro ao entrar</p>
                  <p className="text-sm text-red-600 mt-0.5">{error}</p>
                </div>
              </div>
            )}

            {/* Campo Email */}
            <div className="space-y-2">
              <label 
                htmlFor="email" 
                className="block text-sm font-medium text-gray-700"
              >
                Email
              </label>
              <div className="relative">
                <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-200 ${
                  focusedField === 'email' ? 'text-[#2A658F]' : 'text-gray-400'
                }`}>
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl border-2 border-gray-200 
                    bg-white text-gray-900 placeholder-gray-400
                    focus:border-[#2A658F] focus:ring-4 focus:ring-[#2A658F]/10 
                    transition-all duration-200 outline-none"
                  placeholder="seu@email.com"
                  required
                  autoComplete="email"
                />
                {email && email.includes('@') && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  </div>
                )}
              </div>
            </div>

            {/* Campo Senha */}
            <div className="space-y-2">
              <label 
                htmlFor="password" 
                className="block text-sm font-medium text-gray-700"
              >
                Senha
              </label>
              <div className="relative">
                <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-200 ${
                  focusedField === 'password' ? 'text-[#2A658F]' : 'text-gray-400'
                }`}>
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  className="w-full pl-12 pr-12 py-3.5 rounded-xl border-2 border-gray-200 
                    bg-white text-gray-900 placeholder-gray-400
                    focus:border-[#2A658F] focus:ring-4 focus:ring-[#2A658F]/10 
                    transition-all duration-200 outline-none"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 
                    hover:text-gray-600 transition-colors p-1"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Link esqueci senha */}
            <div className="flex justify-end">
              <button
                type="button"
                className="text-sm text-[#2A658F] hover:text-[#1a4a6e] font-medium 
                  hover:underline underline-offset-4 transition-colors"
              >
                Esqueceu a senha?
              </button>
            </div>

            {/* Botão de submit */}
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="group relative w-full py-4 px-6 rounded-xl font-semibold text-white
                bg-gradient-to-r from-[#2A658F] to-[#3d7ba8]
                hover:from-[#1a4a6e] hover:to-[#2A658F]
                focus:ring-4 focus:ring-[#2A658F]/30 focus:outline-none
                disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-[#2A658F]
                transform hover:scale-[1.02] active:scale-[0.98]
                transition-all duration-200 shadow-lg shadow-[#2A658F]/25
                overflow-hidden"
            >
              {/* Efeito de brilho */}
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full 
                bg-gradient-to-r from-transparent via-white/20 to-transparent 
                transition-transform duration-700 ease-out" />
              
              <span className="relative flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <svg 
                      className="animate-spin h-5 w-5" 
                      viewBox="0 0 24 24" 
                      fill="none"
                    >
                      <circle 
                        className="opacity-25" 
                        cx="12" 
                        cy="12" 
                        r="10" 
                        stroke="currentColor" 
                        strokeWidth="4" 
                      />
                      <path 
                        className="opacity-75" 
                        fill="currentColor" 
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" 
                      />
                    </svg>
                    <span>Entrando...</span>
                  </>
                ) : (
                  <>
                    <span>Entrar no Sistema</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </span>
            </button>
          </form>

          {/* Divisor */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-gray-50 text-gray-500">Precisa de ajuda?</span>
            </div>
          </div>

          {/* Suporte */}
          <div className="text-center">
            <p className="text-gray-500 text-sm">
              Entre em contato com o suporte técnico
            </p>
            <a 
              href="mailto:suporte@cenat.edu.br" 
              className="inline-flex items-center gap-2 mt-2 text-[#2A658F] font-medium 
                hover:text-[#1a4a6e] transition-colors"
            >
              suporte@cenat.edu.br
            </a>
          </div>

          {/* Footer mobile */}
          <div className="lg:hidden mt-12 text-center text-gray-400 text-sm">
            © {new Date().getFullYear()} CENAT · Todos os direitos reservados
          </div>
        </div>
      </div>

      {/* Estilos de animação */}
      <style jsx>{`
        @keyframes slide-in-from-top-2 {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-in {
          animation: slide-in-from-top-2 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
