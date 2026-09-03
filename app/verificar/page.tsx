'use client';

import React, { useEffect, useState } from 'react';
import { findPublicDocumentVerification, PublicDocumentVerification } from '@/lib/documentVerification';

const LABEL: Record<string, string> = { relatorio: 'Relatório técnico', proposta: 'Proposta comercial', orcamento: 'Orçamento', ordem_servico: 'Ordem de serviço', contrato: 'Contrato' };

export default function VerificarDocumentoPage() {
  const [result, setResult] = useState<PublicDocumentVerification | null | undefined>(undefined);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('codigo') || '';
    if (!code) { setResult(null); return; }
    findPublicDocumentVerification(code).then(setResult).catch(() => setErro(true));
  }, []);

  return (
    <main className="min-h-screen bg-surface-3 flex items-center justify-center p-5 text-fg">
      <section className="w-full max-w-lg rounded-2xl bg-surface p-6 sm:p-8 shadow-xl border border-border">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-danger">Fireowl Controls</p>
        <h1 className="mt-2 text-2xl font-bold">Autenticidade de documento</h1>
        {result === undefined && !erro && <p className="mt-5 text-sm text-fg-secondary">Consultando autenticidade…</p>}
        {erro && <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">Não foi possível consultar o documento agora. Tente novamente em alguns minutos.</p>}
        {result === null && !erro && <p className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Código não encontrado ou documento ainda não foi publicado.</p>}
        {result && (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
            <p className="font-bold text-emerald-800">✓ Documento autêntico</p>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-fg-secondary">
              <dt className="text-fg-secondary">Tipo</dt><dd className="font-semibold">{LABEL[result.type] || result.type}</dd>
              <dt className="text-fg-secondary">Número</dt><dd className="font-semibold">{result.number}</dd>
              <dt className="text-fg-secondary">Cliente</dt><dd>{result.clientName}</dd>
              {result.issuedAt && <><dt className="text-fg-secondary">Emissão</dt><dd>{result.issuedAt}</dd></>}
              {result.version && <><dt className="text-fg-secondary">Versão</dt><dd>{result.version}</dd></>}
            </dl>
          </div>
        )}
      </section>
    </main>
  );
}
