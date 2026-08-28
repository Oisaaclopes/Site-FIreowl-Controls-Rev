'use client';

import React, { useEffect, useState } from 'react';
import { PDFViewer, pdf } from '@react-pdf/renderer';
import { ArrowLeft, Download, Printer } from 'lucide-react';
import { ReportTechnicalDocument } from './ReportTechnicalDocument';
import { montarReportPdfData, nomeArquivoRelatorio, ReportPdfData, ReportNivel } from '@/lib/reportPdfData';
import { ReportInstance, Client, CompanyProfile, UserRole } from '@/lib/types';
import { publishDocumentVerification } from '@/lib/documentVerification';

interface Props {
  report: ReportInstance;
  cliente?: Client;
  companyProfile?: CompanyProfile;
  userRole: UserRole;
  onClose: () => void;
  /** Fallback: método antigo (HTML + window.print). */
  onFallback?: () => void;
}

const NIVEIS: { id: ReportNivel; nome: string }[] = [
  { id: 'simples', nome: 'Simples' },
  { id: 'tecnico', nome: 'Técnico' },
  { id: 'corporativo', nome: 'Corporativo' },
];

export default function ReportTechnicalPdfInner({ report, cliente, companyProfile, userRole, onClose, onFallback }: Props) {
  const [data, setData] = useState<ReportPdfData | null>(null);
  const [erro, setErro] = useState(false);
  const [nivel, setNivel] = useState<ReportNivel>('tecnico');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let alive = true;
    setData(null);
    setErro(false);
    montarReportPdfData(report, cliente, companyProfile, userRole, 'tecnico')
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { console.error('Relatório técnico (PDF):', e); if (alive) setErro(true); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report?.id]);

  const docFor = (d: ReportPdfData) => <ReportTechnicalDocument data={{ ...d, nivel }} />;

  const handleDownload = async () => {
    if (!data || downloading) return;
    setDownloading(true);
    try {
      // Publica só os metadados mínimos consultados pelo QR. Falhas não
      // impedem a emissão do PDF (útil durante a aplicação da migração).
      try {
        await publishDocumentVerification({
          type: 'relatorio', sourceId: report.id, number: data.numero,
          clientName: data.clienteNome, issuedAt: data.dataFim || data.dataInicio,
          status: report.status,
        });
      } catch (verificationError) {
        console.warn('Não foi possível publicar a validação do relatório:', verificationError);
      }
      const blob = await pdf(docFor(data)).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nomeArquivoRelatorio(data.numero, data.clienteNome);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      console.error('Falha ao gerar o PDF do relatório:', e);
      alert('Não foi possível gerar o PDF. Tente a versão de impressão.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/85 flex flex-col p-3 sm:p-5">
      <div className="w-full max-w-5xl mx-auto bg-slate-800 text-white rounded-xl p-3 mb-3 shadow-xl flex flex-wrap justify-between items-center gap-3 shrink-0">
        <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-semibold uppercase">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <div className="flex items-center gap-1 bg-slate-900/60 rounded-lg p-0.5">
          {NIVEIS.map((n) => (
            <button key={n.id} onClick={() => setNivel(n.id)} className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide ${nivel === n.id ? 'bg-[#F2A900] text-[#0B1E38]' : 'text-slate-400 hover:text-white'}`}>{n.nome}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {onFallback && (
            <button onClick={onFallback} title="Versão de impressão (método antigo)" className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 uppercase tracking-wider">
              <Printer className="w-4 h-4" /> Impressão
            </button>
          )}
          <button onClick={handleDownload} disabled={!data || downloading} className="px-4 py-2 bg-[#E63946] hover:bg-[#a51515] disabled:opacity-60 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm uppercase tracking-wider">
            <Download className="w-4 h-4" /> {downloading ? 'Gerando…' : 'Baixar PDF'}
          </button>
        </div>
      </div>

      <div className="w-full max-w-5xl mx-auto flex-1 min-h-0 bg-white rounded-xl overflow-hidden border border-slate-700 flex items-center justify-center">
        {erro ? (
          <div className="text-center text-slate-600 p-6">
            <span className="material-symbols-outlined text-4xl text-slate-300">error</span>
            <p className="mt-2 text-sm font-semibold">Não foi possível montar o relatório.</p>
            {onFallback && (
              <button onClick={onFallback} className="mt-3 px-4 py-2 bg-[#0B1E38] text-white text-xs font-bold rounded-lg uppercase tracking-wider inline-flex items-center gap-1.5">
                <Printer className="w-4 h-4" /> Gerar versão de impressão
              </button>
            )}
          </div>
        ) : !data ? (
          <div className="text-center text-slate-500">
            <span className="material-symbols-outlined text-4xl animate-spin inline-block text-slate-300">progress_activity</span>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wider">Montando o relatório…</p>
          </div>
        ) : (
          <PDFViewer width="100%" height="100%" style={{ border: 'none' }} showToolbar>
            {docFor(data)}
          </PDFViewer>
        )}
      </div>
    </div>
  );
}
