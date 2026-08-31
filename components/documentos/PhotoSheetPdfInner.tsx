'use client';
import React, { useCallback, useState } from 'react';
import { pdf, PDFViewer, type DocumentProps } from '@react-pdf/renderer';
import { ArrowLeft, Download } from 'lucide-react';

interface Props {
  /** Documento React-PDF já montado (Folha individual ou Antes × Depois). */
  doc: React.ReactElement<DocumentProps>;
  filename: string;
  onClose: () => void;
}

// Viewer/download genérico reutilizado pelos dois modos da Folha de Fotos.
function PhotoSheetPdfInner({ doc, filename, onClose }: Props) {
  const [loading, setLoading] = useState(false);

  const download = useCallback(async () => {
    setLoading(true);
    try {
      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
    } finally {
      setLoading(false);
    }
  }, [doc, filename]);

  return (
    <div className="fixed inset-0 z-[80] bg-slate-900/85 p-3 sm:p-5 flex flex-col">
      <div className="max-w-5xl w-full mx-auto bg-slate-800 text-white rounded-xl p-3 mb-3 flex justify-between items-center">
        <button onClick={onClose} className="text-xs font-bold flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>
        <button onClick={download} disabled={loading} className="px-3 py-2 rounded-lg bg-[#E63946] text-xs font-bold flex items-center gap-1 disabled:opacity-70">
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

export default React.memo(PhotoSheetPdfInner);
