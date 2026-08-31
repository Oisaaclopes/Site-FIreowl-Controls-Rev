'use client';

import React, { useEffect, useState } from 'react';
import { CrmApp } from '@/components/CrmApp';
import { OfficialLogo } from '@/components/OfficialLogo';
import { signIn, signOut, getSessionUser, AuthUser } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/inventory';
import { TabPath } from '@/lib/types';

/**
 * Porta de entrada da Área do Funcionário: restaura a sessão, mostra o login
 * quando necessário e abre o CRM autenticado. `initialTab` vem da rota
 * (/funcionarios/<aba>) para que cada aba tenha seu próprio link.
 */
export function FuncionariosGate({ initialTab }: { initialTab?: TabPath }) {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  // Restaura a sessão do Supabase (se houver) ao montar
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setReady(true);
      return;
    }
    let active = true;
    getSessionUser()
      .then((u) => {
        if (active) setAuthUser(u);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    setTilt({ x: -(y / 25), y: x / 25 });
  };

  const handleMouseLeave = () => setTilt({ x: 0, y: 0 });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setErro('');
    if (!isSupabaseConfigured()) {
      setErro('Serviço de autenticação indisponível no momento. Tente novamente mais tarde.');
      return;
    }
    setLoading(true);
    try {
      const user = await signIn(email.trim(), senha);
      setAuthUser(user);
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (/invalid login credentials/i.test(msg)) {
        setErro('E-mail ou senha inválidos.');
      } else if (/email not confirmed/i.test(msg)) {
        setErro('E-mail ainda não confirmado. Confirme o cadastro ou peça ao administrador.');
      } else if (/PROFILE_INATIVO/.test(msg)) {
        setErro('Seu acesso está temporariamente inativo. Entre em contato com o administrador.');
      } else if (/PROFILE_DESLIGADO/.test(msg)) {
        setErro('Este usuário não possui mais acesso ao sistema.');
      } else if (/PROFILE_NOT_AUTHORIZED/.test(msg)) {
        setErro('Acesso não autorizado. Fale com o administrador do sistema.');
      } else {
        setErro('Não foi possível entrar. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } catch {
      /* ignore */
    }
    setAuthUser(null);
    setEmail('');
    setSenha('');
  };

  // Evita "flash" da tela de login antes de restaurar a sessão
  if (!ready) return null;

  // Autenticado → abre o sistema de gestão
  if (authUser) {
    return (
      <CrmApp
        initialRole={authUser.role}
        userName={authUser.name}
        userEmail={authUser.email}
        userSchedule={authUser.schedule}
        initialTab={initialTab}
        onLogout={handleLogout}
      />
    );
  }

  // Tela de login do operador
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A1A72] p-4">
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-blueprint-grid" />

      <div
        className="relative w-full max-w-[480px] z-10 transition-transform duration-200 ease-out"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        }}
      >
        <div className="absolute -top-4 -left-4 w-8 h-8 border-t-2 border-l-2 border-[#E63946]" />
        <div className="absolute -bottom-4 -right-4 w-8 h-8 border-b-2 border-r-2 border-[#E63946]" />

        <div className="bg-[#f8f9ff] p-8 shadow-2xl flex flex-col gap-6 border border-[#c5c6ce] relative">
          {/* Voltar ao site */}
          <a
            href="/"
            className="absolute top-4 right-4 text-[#75777e] hover:text-[#000410] font-semibold text-xs flex items-center gap-1"
            title="Voltar ao site"
          >
            ← Voltar ao site
          </a>

          {/* Logo Header — logo oficial da Fireowl Controls */}
          <div className="flex flex-col items-center gap-3 mt-2">
            <OfficialLogo className="w-24 h-24" />
            <div className="text-center">
              <h1 className="font-display-lg text-2xl text-[#1A1A72] uppercase tracking-tight">
                FIREOWL <span className="text-[#E63946]">CONTROLS</span>
              </h1>
              <p className="font-data-mono text-[11px] text-[#75777e] tracking-widest uppercase mt-1">
                Área do Funcionário &middot; Acesso Restrito
              </p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            <div className="flex flex-col gap-4">
              {/* E-mail */}
              <div className="relative group">
                <label className="font-label-caps text-xs text-[#44474d] mb-1 block uppercase tracking-wider">
                  E-mail corporativo
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#E63946]" />
                  <input
                    className="w-full bg-[#eff4ff] border border-[#c5c6ce] p-3 font-data-mono text-sm text-[#131c28] focus:outline-none focus:border-[#000410] transition-colors pl-4"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nome@fireowlcontrols.com.br"
                    type="email"
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              {/* Senha */}
              <div className="relative group">
                <label className="font-label-caps text-xs text-[#44474d] mb-1 block uppercase tracking-wider">
                  Senha
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#E63946]" />
                  <input
                    className="w-full bg-[#eff4ff] border border-[#c5c6ce] p-3 font-data-mono text-sm text-[#131c28] focus:outline-none focus:border-[#000410] transition-colors pl-4"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="••••••••"
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                </div>
              </div>
            </div>

            {erro && (
              <div className="bg-red-50 border border-[#E63946]/40 text-[#E63946] text-xs font-semibold px-3 py-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-base">error</span>
                {erro}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#E63946] hover:bg-[#a51515] text-white font-headline-md text-lg py-3 transition-all active:scale-[0.98] uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <span className={`material-symbols-outlined text-xl ${loading ? 'animate-spin' : ''}`}>
                {loading ? 'progress_activity' : 'login'}
              </span>
              {loading ? 'ENTRANDO...' : 'ENTRAR'}
            </button>
          </form>

          <p className="text-[10px] font-data-mono text-[#75777e] text-center leading-relaxed">
            Acesso restrito a funcionários.
          </p>
        </div>
      </div>
    </div>
  );
}
