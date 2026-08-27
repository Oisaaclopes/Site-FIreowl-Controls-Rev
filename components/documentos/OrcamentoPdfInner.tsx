'use client';

import React, { useState } from 'react';
import { PDFViewer, pdf } from '@react-pdf/renderer';
import { OrcamentoDocument, OrcamentoPdfOptions } from './OrcamentoDocument';
import { Pedido, CompanyProfile } from '@/lib/types';
import { nomeArquivoPdf } from '@/lib/utils';
import { ArrowLeft, Download } from 'lucide-react';

interface Props {
  pedido: Pedido;
  companyProfile: CompanyProfile;
  options?: OrcamentoPdfOptions;
  onClose: () => void;
}

export default function OrcamentoPdfInner({ pedido, companyProfile, options, onClose }: Props) {
  const [downloading, setDownloading] = useState(false);
  const doc = <OrcamentoDocument pedido={pedido} companyProfile={companyProfile} options={options} />;

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nomeArquivoPdf('Orcamento', pedido.numeroPedido, pedido.clienteNome);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      console.error('Falha ao gerar o PDF:', e);
      alert('Não foi possível gerar o PDF. Tente novamente.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/85 flex flex-col p-3 sm:p-5">
      <div className="w-full max-w-5xl mx-auto bg-slate-800 text-white rounded-xl p-3 mb-3 shadow-xl flex flex-wrap justify-between items-center gap-3 shrink-0">
        <button
          onClick={onClose}
          className="p-2 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-semibold uppercase"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar ao Sistema
        </button>
        <span className="text-xs font-data-mono text-amber-400 font-bold hidden sm:inline">ORÇAMENTO: {pedido.numeroPedido}</span>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="px-4 py-2 bg-[#E63946] hover:bg-[#a51515] disabled:opacity-60 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm uppercase tracking-wider"
        >
          <Download className="w-4 h-4" /> {downloading ? 'Gerando…' : 'Baixar PDF'}
        </button>
      </div>

      <div className="w-full max-w-5xl mx-auto flex-1 min-h-0 bg-white rounded-xl overflow-hidden border border-slate-700">
        <PDFViewer width="100%" height="100%" style={{ border: 'none' }} showToolbar>
          {doc}
        </PDFViewer>
      </div>
    </div>
  );
}
