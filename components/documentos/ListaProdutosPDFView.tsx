'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Pedido, CompanyProfile } from '@/lib/types';
import { ListaProdutosPdfOptions } from './ListaProdutosDocument';

interface Props {
  pedido: Pedido;
  companyProfile: CompanyProfile;
  onClose: () => void;
  options?: ListaProdutosPdfOptions;
}

const ListaProdutosPdfInner = dynamic(() => import('./ListaProdutosPdfInner'), {
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

export const ListaProdutosPDFView: React.FC<Props> = ({ pedido, companyProfile, onClose, options }) => (
  <ListaProdutosPdfInner pedido={pedido} companyProfile={companyProfile} options={options} onClose={onClose} />
);
