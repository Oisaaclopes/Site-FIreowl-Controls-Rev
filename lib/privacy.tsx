'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

/**
 * Modo Privacidade — oculta valores monetários sensíveis na interface.
 *
 * Uso:
 *   const { isPrivacyModeActive, togglePrivacy, maskMoney } = usePrivacy();
 *   <span>{maskMoney(brl(valor))}</span>
 *
 * Quando ativo, `maskMoney` substitui qualquer string monetária já formatada
 * pela máscara padronizada, mantendo o prefixo "R$".
 */

/** Máscara padrão exibida no lugar dos valores reais. */
export const MONEY_MASK = 'R$ •••••••';

interface PrivacyContextValue {
  isPrivacyModeActive: boolean;
  togglePrivacy: () => void;
  setPrivacy: (active: boolean) => void;
  /** Retorna a máscara quando o modo está ativo; caso contrário, o valor original. */
  maskMoney: (formatted: string) => string;
}

const PrivacyContext = createContext<PrivacyContextValue | null>(null);

const STORAGE_KEY = 'fireowl_privacy_mode';

export const PrivacyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isPrivacyModeActive, setPrivacy] = useState(false);

  // Restaura a preferência salva no navegador.
  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') setPrivacy(true);
    } catch {
      /* localStorage indisponível */
    }
  }, []);

  const persist = (active: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEY, active ? '1' : '0');
    } catch {
      /* ignore */
    }
  };

  const togglePrivacy = () =>
    setPrivacy((prev) => {
      const next = !prev;
      persist(next);
      return next;
    });

  const setPrivacyPersisted = (active: boolean) => {
    setPrivacy(active);
    persist(active);
  };

  const maskMoney = (formatted: string) => (isPrivacyModeActive ? MONEY_MASK : formatted);

  return (
    <PrivacyContext.Provider
      value={{
        isPrivacyModeActive,
        togglePrivacy,
        setPrivacy: setPrivacyPersisted,
        maskMoney,
      }}
    >
      {children}
    </PrivacyContext.Provider>
  );
};

export function usePrivacy(): PrivacyContextValue {
  const ctx = useContext(PrivacyContext);
  if (!ctx) {
    throw new Error('usePrivacy deve ser usado dentro de um <PrivacyProvider>.');
  }
  return ctx;
}
