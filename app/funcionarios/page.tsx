'use client';

import React, { useEffect, useState } from 'react';
import { CrmApp } from '@/components/CrmApp';
import { UserRole } from '@/lib/types';

/**
 * ATENÇÃO — SEGURANÇA:
 * Esta autenticação é feita 100% no navegador (front-end) e serve apenas
 * para separar visualmente a área de funcionários da área de clientes.
 * NÃO é uma proteção real: qualquer pessoa com conhecimento técnico
 * consegue contornar. Para uso em produção, mova a validação de
 * usuário/senha para um back-end (ex.: Supabase Auth, que já está
 * configurado neste projeto em lib/supabaseClient.ts).
 */

interface Funcionario {
  senha: string;
  nome: string;
  role: UserRole;
}

// Usuários de demonstração (substituir por autenticação real no back-end).
const FUNCIONARIOS: Record<string, Funcionario> = {
  admin: { senha: 'fireowl123', nome: 'Administrador', role: 'ADMINISTRATIVO' },
  tecnico: { senha: 'campo123', nome: 'Técnico de Campo', role: 'TECNICO' },
  gestor: { senha: 'gestao123', nome: 'Gestor de Contrato', role: 'GESTOR' },
  financeiro: { senha: 'caixa123', nome: 'Financeiro', role: 'FINANCEIRO' },
};

const STORAGE_KEY = 'fireowl_func_auth';

export default function FuncionariosPage() {
  const [authRole, setAuthRole] = useState<UserRole | null>(null);
  const [ready, setReady] = useState(false);

  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  // Restaura sessão anterior (se houver) ao montar
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) setAuthRole(saved as UserRole);
    } catch {
      /* sessionStorage indisponível */
    }
    setReady(true);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    setTilt({ x: -(y / 25), y: x / 25 });
  };

  const handleMouseLeave = () => setTilt({ x: 0, y: 0 });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const user = FUNCIONARIOS[usuario.trim().toLowerCase()];
    if (user && user.senha === senha) {
      setErro('');
      try {
        sessionStorage.setItem(STORAGE_KEY, user.role);
      } catch {
        /* ignore */
      }
      setAuthRole(user.role);
    } else {
      setErro('Usuário ou chave de acesso inválidos.');
    }
  };

  const handleLogout = () => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setAuthRole(null);
    setUsuario('');
    setSenha('');
  };

  // Evita "flash" da tela de login antes de restaurar a sessão
  if (!ready) return null;

  // Autenticado → abre o sistema de gestão
  if (authRole) {
    return <CrmApp initialRole={authRole} onLogout={handleLogout} />;
  }

  // Tela de login do operador
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1e38] p-4">
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-blueprint-grid" />

      <div
        className="relative w-full max-w-[480px] z-10 transition-transform duration-200 ease-out"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        }}
      >
        <div className="absolute -top-4 -left-4 w-8 h-8 border-t-2 border-l-2 border-[#ba1a1a]" />
        <div className="absolute -bottom-4 -right-4 w-8 h-8 border-b-2 border-r-2 border-[#ba1a1a]" />

        <div className="bg-[#f8f9ff] p-8 shadow-2xl flex flex-col gap-6 border border-[#c5c6ce] relative">
          {/* Voltar ao site */}
          <a
            href="/"
            className="absolute top-4 right-4 text-[#75777e] hover:text-[#000410] font-semibold text-xs flex items-center gap-1"
            title="Voltar ao site"
          >
            ← Voltar ao site
          </a>

          {/* Logo Header */}
          <div className="flex flex-col items-center gap-3 mt-2">
            <div className="w-24 h-24 relative flex items-center justify-center bg-[#0b1e38] rounded-full p-2 border-2 border-[#ba1a1a]">
              <span className="material-symbols-outlined text-[#ba1a1a] text-6xl">
                local_fire_department
              </span>
            </div>
            <div className="text-center">
              <h1 className="font-headline-lg text-2xl text-[#131c28] uppercase tracking-tight">
                FIREOWL <span className="text-[#ba1a1a]">CONTROLS</span>
              </h1>
              <p className="font-data-mono text-[11px] text-[#75777e] tracking-widest uppercase mt-1">
                Área do Funcionário &middot; Acesso Restrito
              </p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            <div className="flex flex-col gap-4">
              {/* Usuário */}
              <div className="relative group">
                <label className="font-label-caps text-xs text-[#44474d] mb-1 block uppercase tracking-wider">
                  Identificação do Operador
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#ba1a1a]" />
                  <input
                    className="w-full bg-[#eff4ff] border border-[#c5c6ce] p-3 font-data-mono text-sm text-[#131c28] focus:outline-none focus:border-[#000410] transition-colors pl-4"
                    value={usuario}
                    onChange={(e) => setUsuario(e.target.value)}
                    placeholder="usuário"
                    type="text"
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              {/* Senha */}
              <div className="relative group">
                <label className="font-label-caps text-xs text-[#44474d] mb-1 block uppercase tracking-wider">
                  Chave de Acesso
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#ba1a1a]" />
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
              <div className="bg-red-50 border border-[#ba1a1a]/40 text-[#ba1a1a] text-xs font-semibold px-3 py-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-base">error</span>
                {erro}
              </div>
            )}

            <div className="flex items-center gap-2">
              <div className="h-px bg-[#c5c6ce] flex-1" />
              <span className="font-data-mono text-[10px] text-[#75777e] uppercase">
                Auth_Seq_Alpha_v2.0
              </span>
              <div className="h-px bg-[#c5c6ce] flex-1" />
            </div>

            <button
              type="submit"
              className="w-full bg-[#ba1a1a] hover:bg-[#a51515] text-white font-headline-md text-lg py-3 transition-all active:scale-[0.98] uppercase tracking-widest shadow-lg flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-xl">login</span>
              ENTRAR
            </button>
          </form>

          {/* Dica de acesso de demonstração — remover em produção */}
          <div className="bg-[#eff4ff] border border-[#c5c6ce] p-3 text-[10px] font-data-mono text-[#44474d] leading-relaxed">
            <p className="font-bold uppercase text-[#0b1e38] mb-1">
              Acessos de demonstração
            </p>
            <p>admin / fireowl123 &nbsp;·&nbsp; tecnico / campo123</p>
            <p>gestor / gestao123 &nbsp;·&nbsp; financeiro / caixa123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
