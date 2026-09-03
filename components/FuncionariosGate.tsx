'use client';

import React, { useEffect, useState } from 'react';
import { CrmApp } from '@/components/CrmApp';
import { OfficialLogo } from '@/components/OfficialLogo';
import { signIn, signOut, getSessionUser, onSessionLost, authErrorMessage, AuthUser } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/inventory';
import { isStandalone } from '@/lib/pwa';
import { TabPath } from '@/lib/types';
import { FirstAccessRequired } from '@/components/FirstAccessRequired';
import { RealtimeProvider } from '@/lib/realtime/RealtimeProvider';

/**
 * Porta de entrada da Área do Funcionário e barreira de autenticação.
 * Máquina de estados: CHECKING (splash) → UNAUTHENTICATED (login) | AUTHENTICATED
 * (CrmApp). Nenhum conteúdo operacional é montado antes da autorização — nem no
 * PWA instalado, nem offline, nem via URL direta (Fase 4.1 §4/§5/§10).
 */
export function FuncionariosGate({ initialTab }: { initialTab?: TabPath }) {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const [standalone, setStandalone] = useState(false);

  // Restaura a sessão do Supabase (se houver) ao montar.
  useEffect(() => {
    if (!isSupabaseConfigured()) { setReady(true); return; }
    let active = true;
    getSessionUser()
      .then((u) => { if (active) setAuthUser(u); })
      .catch(() => {})
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  // Detecta modo standalone (app instalado) para esconder "Voltar ao site" (§16).
  useEffect(() => { setStandalone(isStandalone()); }, []);

  // Sessão perdida/expirada em qualquer momento → volta ao login, sem deixar a
  // tela anterior acessível (§6). Também cobre logout em outra aba.
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    return onSessionLost(() => setAuthUser(null));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setErro('');
    if (!isSupabaseConfigured()) { setErro('Serviço de autenticação indisponível no momento. Tente novamente mais tarde.'); return; }
    setLoading(true);
    try {
      const user = await signIn(email.trim(), senha);
      setAuthUser(user);
    } catch (err) {
      setErro(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try { await signOut(); } catch { /* ignore */ }
    setAuthUser(null);
    setEmail(''); setSenha(''); setShowSenha(false); setErro('');
  };

  // CHECKING_SESSION → splash institucional (nunca a tela em branco nem o app).
  if (!ready) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-[#1A1A72]"
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="absolute inset-0 pointer-events-none opacity-20 bg-blueprint-grid" />
        <div className="relative flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-2xl bg-white flex items-center justify-center shadow-2xl">
            <OfficialLogo className="w-14 h-14" />
          </div>
          <div className="text-center">
            <p className="font-display-lg text-xl text-white uppercase tracking-tight">FIREOWL <span className="text-[#E63946]">CONTROLS</span></p>
            <p className="font-data-mono text-[10px] text-white/60 tracking-widest uppercase mt-1">Guardian</p>
          </div>
          <span className="material-symbols-outlined animate-spin text-white/70 text-2xl mt-1">progress_activity</span>
        </div>
      </div>
    );
  }

  // AUTHENTICATED → abre o sistema de gestão.
  if (authUser) {
    if (!authUser.firstAccessCompleted) return <FirstAccessRequired user={authUser} onCompleted={setAuthUser} />;
    return (
      <RealtimeProvider><CrmApp
        initialRole={authUser.role}
        userId={authUser.id}
        userName={authUser.name}
        userEmail={authUser.email}
        userCargo={authUser.cargo}
        userSchedule={authUser.schedule}
        usesTimeClock={authUser.usesTimeClock}
        initialTab={initialTab}
        onLogout={handleLogout}
      /></RealtimeProvider>
    );
  }

  // UNAUTHENTICATED → login do operador (mobile-first, seguro no PWA).
  return (
    <div
      className="min-h-[100dvh] w-full overflow-y-auto bg-[#1A1A72] flex items-center justify-center px-3"
      style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-blueprint-grid" />

      <div className="relative z-10 w-full max-w-[400px] my-auto">
        <div className="absolute -top-3 -left-3 w-7 h-7 border-t-2 border-l-2 border-[#E63946]" />
        <div className="absolute -bottom-3 -right-3 w-7 h-7 border-b-2 border-r-2 border-[#E63946]" />

        <div className="bg-[#f8f9ff] rounded-2xl p-6 sm:p-7 shadow-2xl flex flex-col gap-5 border border-[#c5c6ce] relative">
          {/* Voltar ao site — apenas no navegador; sem sentido no app instalado (§16) */}
          {!standalone && (
            <a href="/" className="absolute top-3.5 right-3.5 text-[#75777e] hover:text-[#000410] font-semibold text-[11px] flex items-center gap-1" title="Voltar ao site">
              ← Voltar ao site
            </a>
          )}

          {/* Cabeçalho compacto — logo + nome da empresa */}
          <div className="flex flex-col items-center gap-2.5 mt-1">
            <OfficialLogo className="w-16 h-16" />
            <div className="text-center">
              <h1 className="font-display-lg text-xl text-[#1A1A72] uppercase tracking-tight">
                FIREOWL <span className="text-[#E63946]">CONTROLS</span>
              </h1>
              <p className="font-data-mono text-[10px] text-[#75777e] tracking-widest uppercase mt-1">
                Área do Funcionário &middot; Acesso Restrito
              </p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            {/* E-mail */}
            <div>
              <label htmlFor="fo-email" className="font-label-caps text-[11px] text-[#44474d] mb-1 block uppercase tracking-wider">E-mail corporativo</label>
              <div className="relative flex items-center">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#E63946] rounded-l" />
                <input
                  id="fo-email"
                  className="w-full bg-[#eff4ff] border border-[#c5c6ce] rounded-md py-3 pl-4 pr-3 font-data-mono text-sm text-[#131c28] focus:outline-none focus:border-[#1A1A72] transition-colors"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@fireowlcontrols.com.br"
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                />
              </div>
            </div>

            {/* Senha com mostrar/ocultar */}
            <div>
              <label htmlFor="fo-senha" className="font-label-caps text-[11px] text-[#44474d] mb-1 block uppercase tracking-wider">Senha</label>
              <div className="relative flex items-center">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#E63946] rounded-l" />
                <input
                  id="fo-senha"
                  className="w-full bg-[#eff4ff] border border-[#c5c6ce] rounded-md py-3 pl-4 pr-11 font-data-mono text-sm text-[#131c28] focus:outline-none focus:border-[#1A1A72] transition-colors"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••"
                  type={showSenha ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowSenha((v) => !v)}
                  aria-label={showSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  aria-pressed={showSenha}
                  className="absolute right-1 h-9 w-9 flex items-center justify-center rounded-md text-[#75777e] hover:text-[#1A1A72] hover:bg-[#1A1A72]/5"
                >
                  <span className="material-symbols-outlined text-xl">{showSenha ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>

            {erro && (
              <div className="bg-red-50 border border-[#E63946]/40 text-[#E63946] rounded-md text-xs font-semibold px-3 py-2 flex items-center gap-2" role="alert">
                <span className="material-symbols-outlined text-base shrink-0">error</span>
                <span>{erro}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#E63946] hover:bg-[#a51515] text-white font-headline-md text-base min-h-[52px] rounded-md transition-all active:scale-[0.98] uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <span className={`material-symbols-outlined text-xl ${loading ? 'animate-spin' : ''}`}>{loading ? 'progress_activity' : 'login'}</span>
              {loading ? 'ENTRANDO...' : 'ENTRAR'}
            </button>
          </form>

          <p className="text-[10px] font-data-mono text-[#75777e] text-center leading-relaxed">
            Acesso restrito a funcionários autorizados.
          </p>
        </div>
      </div>
    </div>
  );
}
