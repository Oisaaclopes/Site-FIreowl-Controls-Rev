'use client';

import React, { useEffect, useRef, useState } from 'react';
import { UserRole } from '@/lib/types';
import { useTheme, ThemeMode } from '@/lib/theme';
import { useIsMobile } from '@/lib/useIsMobile';
import { userMenuVisibility } from '@/lib/userMenu';

/**
 * UserMenu — ponto central da PESSOA logada (conta, preferências, sessão).
 *
 * Complementa a sidebar (que é da EMPRESA/módulos). Desktop: popover ancorado
 * ao avatar. Mobile: bottom sheet responsivo com alvos de toque ≥ 44px.
 *
 * Visibilidade dos itens vem de userMenuVisibility (regras puras/testadas):
 * "Meu Ponto" só com uses_time_clock; "Configurações"/"Simular perfil" só com
 * acesso administrativo real — nada administrativo vaza para usuário comum.
 */
interface UserMenuProps {
  userName: string;
  userEmail?: string;
  userRole: UserRole;
  userCargo?: string;
  usesTimeClock?: boolean;
  canSwitchRole?: boolean;
  /** Abre o módulo Ponto ("Meu Ponto"). */
  onOpenPonto?: () => void;
  /** Abre a tela administrativa Configurações (aba 'conta'). */
  onOpenConfig?: () => void;
  /** Abre o modal de simulação de perfil (admin). */
  onSimularPerfil?: () => void;
  /** Fluxo de logout existente (usado por Sair e Trocar usuário). */
  onLogout?: () => void;
}

const ROLE_LABEL: Record<UserRole, string> = {
  ADMINISTRATIVO: 'Administrativo',
  GESTOR: 'Gestor',
  FINANCEIRO: 'Financeiro',
  TECNICO: 'Técnico',
};

function initials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const THEME_OPTS: { key: ThemeMode; label: string; icon: string }[] = [
  { key: 'light', label: 'Claro', icon: 'light_mode' },
  { key: 'dark', label: 'Escuro', icon: 'dark_mode' },
  { key: 'system', label: 'Sistema', icon: 'contrast' },
];

// Linha de ação — alvo de toque ≥ 44px, tokens theme-aware.
const MenuItem: React.FC<{ icon: string; label: string; hint?: string; onClick: () => void; danger?: boolean }> = ({
  icon,
  label,
  hint,
  onClick,
  danger,
}) => (
  <button
    onClick={onClick}
    className={`w-full min-h-[44px] flex items-center gap-3 px-3 rounded-xl text-left transition-colors ${
      danger ? 'text-danger hover:bg-danger-soft' : 'text-fg hover:bg-surface-2'
    }`}
  >
    <span className={`material-symbols-outlined text-[20px] ${danger ? 'text-danger' : 'text-fg-secondary'}`}>{icon}</span>
    <span className="flex-1 min-w-0">
      <span className="block text-sm font-semibold truncate">{label}</span>
      {hint && <span className="block text-[11px] text-fg-muted truncate">{hint}</span>}
    </span>
  </button>
);

export const UserMenu: React.FC<UserMenuProps> = ({
  userName,
  userEmail,
  userRole,
  userCargo,
  usesTimeClock = true,
  canSwitchRole = false,
  onOpenPonto,
  onOpenConfig,
  onSimularPerfil,
  onLogout,
}) => {
  const { theme, setTheme } = useTheme();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const vis = userMenuVisibility({ role: userRole, usesTimeClock, canSwitchRole });
  const badge = userCargo || ROLE_LABEL[userRole];

  // Fecha ao clicar fora (desktop) e com ESC (ambos).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const run = (fn?: () => void) => { setOpen(false); fn?.(); };

  const ini = initials(userName);

  // Cabeçalho do menu — identidade da pessoa (avatar, nome, cargo/perfil, e-mail).
  const Header = (
    <div className="flex items-center gap-3 p-3">
      <div className="w-11 h-11 rounded-full bg-primary text-white flex items-center justify-center shadow-sm shrink-0">
        {ini ? <span className="text-sm font-bold tracking-wide">{ini}</span> : <span className="material-symbols-outlined text-[22px]">person</span>}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-fg truncate">{userName || 'Usuário'}</p>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-primary truncate">{badge}</p>
        {userEmail && <p className="text-[11px] text-fg-muted truncate">{userEmail}</p>}
      </div>
    </div>
  );

  // Preferência de aparência (Claro / Escuro / Sistema) — pertence à pessoa.
  const Appearance = (
    <div className="px-3 py-2">
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-fg-muted">Aparência</p>
      <div className="grid grid-cols-3 gap-1.5">
        {THEME_OPTS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setTheme(opt.key)}
            aria-pressed={theme === opt.key}
            className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
              theme === opt.key
                ? 'border-primary bg-primary-soft text-primary'
                : 'border-border bg-surface-2 text-fg-secondary hover:border-border-strong'
            }`}
          >
            <span className="material-symbols-outlined text-lg">{opt.icon}</span>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );

  const Actions = (
    <div className="px-2 py-1.5 space-y-0.5">
      {vis.meuPonto && (
        <MenuItem icon="fingerprint" label="Meu ponto" hint="Registrar e ver meu espelho" onClick={() => run(onOpenPonto)} />
      )}
      {vis.configuracoes && (
        <MenuItem icon="settings" label="Configurações" hint="Administração da empresa" onClick={() => run(onOpenConfig)} />
      )}
      {vis.simularPerfil && (
        <MenuItem icon="switch_account" label="Simular perfil" hint="Pré-visualizar acesso" onClick={() => run(onSimularPerfil)} />
      )}
    </div>
  );

  const Session = (
    <div className="px-2 py-1.5 space-y-0.5 border-t border-border">
      {onLogout && (
        <>
          <MenuItem icon="sync_alt" label="Trocar usuário" hint="Sair e entrar com outra conta" onClick={() => run(onLogout)} />
          <MenuItem icon="logout" label="Sair" onClick={() => run(onLogout)} danger />
        </>
      )}
    </div>
  );

  const trigger = (
    <button
      onClick={() => setOpen((v) => !v)}
      aria-haspopup="menu"
      aria-expanded={open}
      title="Minha conta"
      className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white hover:ring-2 hover:ring-primary/40 transition-all shadow-sm"
    >
      {ini ? <span className="text-xs font-bold tracking-wide">{ini}</span> : <span className="material-symbols-outlined text-[20px]">person</span>}
    </button>
  );

  return (
    <div ref={rootRef} className="relative">
      {trigger}

      {open && isMobile && (
        <>
          {/* Bottom sheet (mobile) — acima da bottom nav, com safe-area. */}
          <div className="fixed inset-0 z-[60] bg-black/40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="menu"
            className="fixed inset-x-0 bottom-0 z-[61] max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-surface border-t border-border shadow-pop pb-[calc(env(safe-area-inset-bottom)+12px)]"
          >
            <div className="flex justify-center pt-2.5 pb-1"><span className="h-1 w-10 rounded-full bg-border-strong" /></div>
            {Header}
            <div className="border-t border-border" />
            {Actions}
            {Appearance}
            {Session}
          </div>
        </>
      )}

      {open && !isMobile && (
        // Popover (desktop) — ancorado ao avatar.
        <div
          role="menu"
          className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-1.5rem)] rounded-2xl bg-surface border border-border shadow-pop z-[60] overflow-hidden"
        >
          {Header}
          <div className="border-t border-border" />
          {Actions}
          {Appearance}
          {Session}
        </div>
      )}
    </div>
  );
};
