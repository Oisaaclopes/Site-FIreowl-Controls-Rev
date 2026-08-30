'use client';
import React, { useMemo, useState, useCallback } from 'react';
import { PDFViewer, pdf } from '@react-pdf/renderer';
import { ArrowLeft, Download } from 'lucide-react';
import { TimecardDocument, TimecardBlock } from './TimecardDocument';

interface Props {
  blocks: TimecardBlock[];
  periodLabel: string;
  fileLabel: string;
  logoUrl?: string;
  onClose: () => void;
}

function TimecardPdfInner({ blocks, periodLabel, fileLabel, logoUrl, onClose }: Props) {
  const [loading, setLoading] = useState(false);

  // Snapshot IMUTÁVEL do documento: só é reconstruído quando os dados do
  // espelho mudam (blocks/período/logo) — nunca por causa do relógio da aba
  // Ponto ou do estado `loading`. Viewer e download usam o MESMO elemento.
  const doc = useMemo(
    () => <TimecardDocument blocks={blocks} periodLabel={periodLabel} logoUrl={logoUrl} />,
    [blocks, periodLabel, logoUrl]
  );

  const download = useCallback(async () => {
    setLoading(true);
    try {
      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `espelho_ponto_${fileLabel.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
    } finally {
      setLoading(false);
    }
  }, [doc, fileLabel]);

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/85 p-3 sm:p-5 flex flex-col">
      <div className="max-w-5xl w-full mx-auto bg-slate-800 text-white rounded-xl p-3 mb-3 flex justify-between items-center">
        <button onClick={onClose} className="text-xs font-bold flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>
        <button
          onClick={download}
          disabled={loading}
          className="px-3 py-2 rounded-lg bg-[#E63946] text-xs font-bold flex items-center gap-1"
        >
          <Download className="w-4 h-4" />
          {loading ? 'Gerando…' : 'Baixar PDF'}
        </button>
      </div>
      <div className="max-w-5xl w-full mx-auto flex-1 bg-white rounded-xl overflow-hidden">
        <PDFViewer width="100%" height="100%" style={{ border: 'none' }}>
          {doc}
        </PDFViewer>
      </div>
    </div>
  );
}

// React.memo: com props estáveis (blocks/periodLabel/fileLabel/logoUrl vindos do
// snapshot em estado e onClose via useCallback), as re-renderizações de 1s do
// relógio da aba Ponto NÃO chegam ao viewer — sem flicker.
export default React.memo(TimecardPdfInner);
