'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Client, CompanyProfile, OrdemServico, Pedido } from '@/lib/types';
import type { OsDocKind } from './OsDocumentsPdfInner';
export type { OsDocKind } from './OsDocumentsPdfInner';

interface Props {
  os: OrdemServico;
  company: CompanyProfile | null;
  client?: Client;
  pedido?: Pedido;
  initialKind?: OsDocKind;
  onClose: () => void;
}

// React-PDF só no cliente (ssr:false), como os demais documentos.
const OsDocumentsPdfInner = dynamic(() => import('./OsDocumentsPdfInner'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-[80] bg-slate-900/85 flex items-center justify-center">
      <div className="text-center text-white">
        <span className="material-symbols-outlined text-4xl animate-spin inline-block">progress_activity</span>
        <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-slate-300">Preparando os documentos…</p>
      </div>
    </div>
  ),
});

export const OsDocumentsView: React.FC<Props> = (props) => <OsDocumentsPdfInner {...props} />;
