'use client';
import { showToast } from '@/components/ui/Feedback';

import React, { useEffect, useMemo, useState } from 'react';
import { PDFViewer, pdf } from '@react-pdf/renderer';
import { ArrowLeft, Download } from 'lucide-react';
import { Client, CompanyProfile, OrdemServico, Pedido } from '@/lib/types';
import { buildOsDocumentData, OsDocumentData, osDocumentFileName } from '@/lib/osDocuments';
import { OrdemServicoExecutadaDocument } from './OrdemServicoExecutadaDocument';
import { RelatorioAtendimentoDocument } from './RelatorioAtendimentoDocument';

export type OsDocKind = 'os' | 'relatorio';

interface Props {
  os: OrdemServico;
  company: CompanyProfile | null;
  client?: Client;
  pedido?: Pedido;
  initialKind?: OsDocKind;
  onClose: () => void;
}

export default function OsDocumentsPdfInner({ os, company, client, pedido, initialKind = 'os', onClose }: Props) {
  const [data, setData] = useState<OsDocumentData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<OsDocKind>(initialKind);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let alive = true;
    setData(null); setError(null);
    buildOsDocumentData(os, { company, client, pedido })
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setError((e as Error)?.message || 'Falha ao montar o documento.'); });
    return () => { alive = false; };
  }, [os, company, client, pedido]);

  const doc = useMemo(() => {
    if (!data) return null;
    return kind === 'os' ? <OrdemServicoExecutadaDocument data={data} /> : <RelatorioAtendimentoDocument data={data} />;
  }, [data, kind]);

  const handleDownload = async () => {
    if (!doc || !data || downloading) return;
    setDownloading(true);
    try {
      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = osDocumentFileName(kind === 'os' ? 'OS' : 'RELATORIO-TECNICO-OS', os, data.clientOperational);
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      console.error('Falha ao gerar o PDF:', e);
      showToast('Não foi possível gerar o PDF. Tente novamente.');
    } finally {
      setDownloading(false);
    }
  };

  const Tab = ({ k, label }: { k: OsDocKind; label: string }) => (
    <button onClick={() => setKind(k)} className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide ${kind === k ? 'bg-white text-slate-900' : 'text-slate-300 hover:text-white'}`}>{label}</button>
  );

  return (
    <div className="fixed inset-0 z-[80] bg-slate-900/85 flex flex-col p-3 sm:p-5">
      <div className="w-full max-w-5xl mx-auto bg-slate-800 text-white rounded-xl p-3 mb-3 shadow-xl flex flex-wrap justify-between items-center gap-3 shrink-0">
        <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-semibold uppercase">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <div className="flex items-center gap-1 bg-slate-900/60 rounded-lg p-1">
          <Tab k="os" label="Ordem de Serviço" />
          <Tab k="relatorio" label="Relatório Técnico" />
        </div>
        <button onClick={handleDownload} disabled={downloading || !data} className="px-4 py-2 bg-[#E63946] hover:bg-[#a51515] disabled:opacity-60 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm uppercase tracking-wider">
          <Download className="w-4 h-4" /> {downloading ? 'Gerando…' : 'Baixar PDF'}
        </button>
      </div>

      <div className="w-full max-w-5xl mx-auto flex-1 min-h-0 bg-white rounded-xl overflow-hidden border border-slate-700 flex items-center justify-center">
        {error ? (
          <p className="text-sm text-slate-600 px-6 text-center">{error}</p>
        ) : !doc ? (
          <div className="text-center text-slate-500">
            <span className="material-symbols-outlined text-4xl animate-spin inline-block">progress_activity</span>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wider">Montando o documento…</p>
          </div>
        ) : (
          <PDFViewer width="100%" height="100%" style={{ border: 'none' }} showToolbar>
            {doc}
          </PDFViewer>
        )}
      </div>
    </div>
  );
}
