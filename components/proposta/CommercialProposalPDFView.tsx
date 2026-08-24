'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Pedido, CompanyProfile } from '@/lib/types';

/**
 * Geração de PDF via @react-pdf/renderer (arquivo PDF real, com paginação
 * "Página X de Y" nativa e quebras inteligentes). A engine pesada é carregada
 * só no navegador (ssr: false) para não entrar no build estático.
 */

interface PdfDisplayOptions {
  showLogo: boolean;
  detailedSubtotal: boolean;
  showBankData: boolean;
  showIndice?: boolean;
  showHistorico?: boolean;
  showCarta?: boolean;
  showClausulas?: boolean;
  showTermoAceite?: boolean;
}

interface CommercialProposalPDFViewProps {
  pedido: Pedido;
  companyProfile: CompanyProfile;
  onClose: () => void;
  onSendEmail?: (pedido: Pedido) => void;
  options?: PdfDisplayOptions;
}

const PropostaPdfInner = dynamic(() => import('./PropostaPdfInner'), {
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

export const CommercialProposalPDFView: React.FC<CommercialProposalPDFViewProps> = ({
  pedido,
  companyProfile,
  onClose,
  onSendEmail,
  options,
}) => (
  <PropostaPdfInner
    pedido={pedido}
    companyProfile={companyProfile}
    options={options}
    onClose={onClose}
    onSendEmail={onSendEmail}
  />
);
