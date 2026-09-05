'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { PDFViewer, pdf } from '@react-pdf/renderer';
import { ArrowLeft, Download } from 'lucide-react';
import { Client, Device } from '@/lib/types';
import { TechArea, AREA_LABEL, SurveyMode } from '@/lib/technicalBase';
import { fetchCompanyProfile } from '@/lib/companyProfile';
import { fetchDevices } from '@/lib/devices';
import { listFieldPhotosByDevice } from '@/lib/fieldPhotos';
import { resolveFieldPhotoDataUrls } from '@/lib/fieldPhotoStorage';
import { surveyResumo, surveyConclusao, relevantAssets, evidenceCaption } from '@/lib/surveyPdfData';
import { LevantamentoDocument, LevantamentoDocData } from './LevantamentoDocument';
import { showToast } from '@/components/ui/Feedback';

export interface SurveyResumoNumbers {
  expected?: number; verified?: number; naoLocalizado?: number; novo?: number; alterado?: number; pendente?: number; coveragePct?: number | null;
}

interface Props {
  client: Client;
  area: TechArea;
  mode: SurveyMode;
  scopeText?: string;
  deviceIds: string[];
  resumo: SurveyResumoNumbers;
  technicianName?: string;
  technicianCargo?: string;
  onClose: () => void;
}

const MAX_EVIDENCES = 24; // §51 — não lotar o PDF com centenas de fotos

export default function LevantamentoPdfInner({ client, area, mode, scopeText, deviceIds, resumo, technicianName, technicianCargo, onClose }: Props) {
  const [data, setData] = useState<LevantamentoDocData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let alive = true;
    setData(null); setError(null);
    (async () => {
      const [company, allDevices] = await Promise.all([
        fetchCompanyProfile().catch(() => null),
        fetchDevices(client.id).catch(() => [] as Device[]),
      ]);
      // Ativos do levantamento (fresco = condição já salva). Fallback: área toda.
      const idSet = new Set(deviceIds);
      let devices = allDevices.filter((d) => d.sistema === area && (idSet.size === 0 || idSet.has(d.id)));
      if (devices.length === 0) devices = allDevices.filter((d) => d.sistema === area);

      // Evidências relevantes (§52): 1 foto por ativo problemático, limitado (§51).
      const relevantes = relevantAssets(devices).slice(0, MAX_EVIDENCES);
      const evidences: { caption: string; dataUrl: string }[] = [];
      for (const d of relevantes) {
        try {
          const photos = await listFieldPhotosByDevice(d.id);
          const path = photos[0]?.storagePathEvidencia || photos[0]?.storagePathOriginal;
          if (!path) continue;
          const map = await resolveFieldPhotoDataUrls([path]);
          const url = map[path];
          if (url) evidences.push({ caption: evidenceCaption(area, d), dataUrl: url });
        } catch { /* ignora a foto deste ativo */ }
      }

      const resumoLines = surveyResumo({ mode, devices, scopeText, ...resumo });
      const conclusao = surveyConclusao({ mode, total: devices.length, verified: resumo.verified, pendente: resumo.pendente, scopeText });
      if (!alive) return;
      setData({
        company,
        clientName: client.name,
        area, mode, scopeText,
        dateStr: new Date().toLocaleDateString('pt-BR'),
        technicianName, technicianCargo,
        devices, resumo: resumoLines, conclusao, evidences,
      });
    })().catch((e) => { if (alive) setError((e as Error)?.message || 'Falha ao montar o PDF.'); });
    return () => { alive = false; };
  }, [client, area, mode, scopeText, deviceIds, resumo, technicianName, technicianCargo]);

  const doc = useMemo(() => (data ? <LevantamentoDocument data={data} /> : null), [data]);

  const handleDownload = async () => {
    if (!doc || downloading) return;
    setDownloading(true);
    try {
      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `LEVANTAMENTO-${AREA_LABEL[area].replace(/[^A-Za-z0-9]+/g, '_')}-${(client.name || 'cliente').replace(/[^A-Za-z0-9]+/g, '_')}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      console.error('Falha ao gerar o PDF:', e);
      showToast('Não foi possível gerar o PDF. Tente novamente.');
    } finally { setDownloading(false); }
  };

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-slate-900/85 p-3 sm:p-5">
      <div className="mx-auto mb-3 flex w-full max-w-5xl shrink-0 flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-800 p-3 text-white shadow-xl">
        <button onClick={onClose} className="flex items-center gap-1.5 rounded-lg p-2 text-xs font-semibold uppercase text-slate-300 transition-colors hover:bg-slate-700 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <span className="text-xs font-bold uppercase tracking-wider text-slate-200">Levantamento — {AREA_LABEL[area]}</span>
        <button onClick={handleDownload} disabled={downloading || !data} className="flex items-center gap-1.5 rounded-lg bg-[#E63946] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition-colors hover:bg-[#a51515] disabled:opacity-60">
          <Download className="h-4 w-4" /> {downloading ? 'Gerando…' : 'Baixar PDF'}
        </button>
      </div>
      <div className="mx-auto flex w-full max-w-5xl flex-1 items-center justify-center overflow-hidden rounded-xl border border-slate-700 bg-white">
        {error ? <p className="px-6 text-center text-sm text-slate-600">{error}</p>
          : !doc ? (
            <div className="text-center text-slate-500">
              <span className="material-symbols-outlined inline-block animate-spin text-4xl">progress_activity</span>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wider">Montando o documento…</p>
            </div>
          ) : (
            <PDFViewer width="100%" height="100%" style={{ border: 'none' }} showToolbar>{doc}</PDFViewer>
          )}
      </div>
    </div>
  );
}
