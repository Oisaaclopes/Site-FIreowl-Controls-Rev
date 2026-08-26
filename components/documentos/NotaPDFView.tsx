'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Pedido, CompanyProfile } from '@/lib/types';
import { NotaVariante, NotaPdfOptions } from './NotaDocument';

interface Props {
  pedido: Pedido;
  companyProfile: CompanyProfile;
  variante: NotaVariante;
  onClose: () => void;
  options?: NotaPdfOptions;
}

const NotaPdfInner = dynamic(() => import('./NotaPdfInner'), {
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

export const NotaPDFView: React.FC<Props> = ({ pedido, companyProfile, variante, onClose, options }) => (
  <NotaPdfInner pedido={pedido} companyProfile={companyProfile} variante={variante} options={options} onClose={onClose} />
);
