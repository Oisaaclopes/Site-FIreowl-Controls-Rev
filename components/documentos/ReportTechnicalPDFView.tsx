'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { ReportInstance, Client, CompanyProfile, UserRole } from '@/lib/types';

interface Props {
  report: ReportInstance;
  cliente?: Client;
  companyProfile?: CompanyProfile;
  userRole: UserRole;
  onClose: () => void;
  onFallback?: () => void;
}

const ReportTechnicalPdfInner = dynamic(() => import('./ReportTechnicalPdfInner'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-50 bg-slate-900/85 flex items-center justify-center">
      <div className="text-center text-white">
        <span className="material-symbols-outlined text-4xl animate-spin inline-block">progress_activity</span>
        <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-slate-300">Preparando o relatório…</p>
      </div>
    </div>
  ),
});

export const ReportTechnicalPDFView: React.FC<Props> = (props) => <ReportTechnicalPdfInner {...props} />;
