'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Pedido, CompanyProfile } from '@/lib/types';
import { PersonalizadoData } from './PersonalizadoConfigModal';

interface Props {
  pedido: Pedido;
  companyProfile: CompanyProfile;
  data: PersonalizadoData;
  showLogo?: boolean;
  onClose: () => void;
}

const PersonalizadoPdfInner = dynamic(() => import('./PersonalizadoPdfInner'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-50 bg-slate-900/85 flex items-center justify-center">
      <div className="text-center text-white">
        <span className="material-symbols-outlined text-4xl animate-spin inline-block">progress_activity</span>
        <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-slate-300">Preparando o documento…</p>
      </div>
    </div>
  ),
});

export const PersonalizadoPDFView: React.FC<Props> = ({ pedido, companyProfile, data, showLogo, onClose }) => (
  <PersonalizadoPdfInner pedido={pedido} companyProfile={companyProfile} data={data} showLogo={showLogo} onClose={onClose} />
);
