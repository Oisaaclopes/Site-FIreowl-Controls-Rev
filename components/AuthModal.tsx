'use client';

import React, { useState } from 'react';
import { UserRole } from '@/lib/types';
import { OfficialLogo } from '@/components/OfficialLogo';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRole: UserRole;
  onSelectRole: (role: UserRole) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentRole,
  onSelectRole
}) => {
  const [userId, setUserId] = useState('ADMIN_FIREOWL');
  const [password, setPassword] = useState('••••••••');
  const [selectedRole, setSelectedRole] = useState<UserRole>(currentRole);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  if (!isOpen) return null;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    setTilt({ x: -(y / 20), y: x / 20 });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSelectRole(selectedRole);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A1A72]/85 backdrop-blur-sm p-4">
      {/* Background blueprint grid */}
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-blueprint-grid"></div>

      {/* Login Container with 3D Perspective */}
      <div
        className="relative w-full max-w-[480px] z-10 transition-transform duration-200 ease-out"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`
        }}
      >
        {/* Corner Brackets */}
        <div className="absolute -top-4 -left-4 w-8 h-8 border-t-2 border-l-2 border-[#E63946]"></div>
        <div className="absolute -bottom-4 -right-4 w-8 h-8 border-b-2 border-r-2 border-[#E63946]"></div>

        <div className="bg-[#f8f9ff] p-8 shadow-2xl flex flex-col gap-6 border border-[#c5c6ce] relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-[#75777e] hover:text-[#000410] font-bold text-xl"
            title="Fechar"
          >
            ✕
          </button>

          {/* Logo Header — logo oficial da Fireowl Controls */}
          <div className="flex flex-col items-center gap-3">
            <OfficialLogo className="w-24 h-24" />
            <div className="text-center">
              <h1 className="font-display-lg text-2xl text-[#1A1A72] uppercase tracking-tight">
                FIREOWL <span className="text-[#E63946]">CONTROLS</span>
              </h1>
              <p className="font-data-mono text-[11px] text-[#75777e] tracking-widest uppercase mt-1">
                Autenticação de Operador de Campo &amp; Gestão
              </p>
            </div>
          </div>

          {/* Auth Form */}
          <form onSubmit={handleLoginSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-4">
              {/* Operator ID */}
              <div className="relative group">
                <label className="font-label-caps text-xs text-[#44474d] mb-1 block uppercase tracking-wider">
                  Identificação do Operador
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#E63946]"></div>
                  <input
                    className="w-full bg-[#eff4ff] border border-[#c5c6ce] p-3 font-data-mono text-sm text-[#131c28] focus:outline-none focus:border-[#000410] transition-colors pl-4"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    placeholder="USER_ID"
                    type="text"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="relative group">
                <label className="font-label-caps text-xs text-[#44474d] mb-1 block uppercase tracking-wider">
                  Chave de Acesso
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#E63946]"></div>
                  <input
                    className="w-full bg-[#eff4ff] border border-[#c5c6ce] p-3 font-data-mono text-sm text-[#131c28] focus:outline-none focus:border-[#000410] transition-colors pl-4"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    type="password"
                    required
                  />
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label className="font-label-caps text-xs text-[#44474d] mb-1 block uppercase tracking-wider">
                  Perfil de Acesso (RBAC)
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                  className="w-full bg-[#eff4ff] border border-[#c5c6ce] p-3 font-data-mono text-xs text-[#131c28] focus:outline-none"
                >
                  <option value="ADMINISTRATIVO">ADMINISTRATIVO - Acesso Total</option>
                  <option value="TECNICO">TÉCNICO DE CAMPO - Atendimento &amp; OS</option>
                  <option value="GESTOR">GESTOR DE CONTRATO - Supervisão</option>
                  <option value="FINANCEIRO">FINANCEIRO - Fluxo de Caixa &amp; DRE</option>
                </select>
              </div>
            </div>

            {/* Separator Line */}
            <div className="flex items-center gap-2">
              <div className="h-px bg-[#c5c6ce] flex-1 relative">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-2 bg-[#75777e]"></div>
              </div>
              <span className="font-data-mono text-[10px] text-[#75777e] uppercase">Auth_Seq_Alpha_v2.0</span>
              <div className="h-px bg-[#c5c6ce] flex-1 relative">
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[2px] h-2 bg-[#75777e]"></div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="submit"
                className="w-full bg-[#E63946] hover:bg-[#a51515] text-white font-headline-md text-lg py-3 transition-all active:scale-[0.98] uppercase tracking-widest shadow-lg flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-xl">login</span>
                ENTRAR
              </button>

              <div className="flex justify-between items-center text-[10px] font-data-mono">
                <span className="text-[#44474d] uppercase">Lat: -23.5505 | Long: -46.6333</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="text-green-700 font-bold uppercase">Servidor Online</span>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
