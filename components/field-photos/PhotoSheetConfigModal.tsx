'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/ui/Feedback';
import { friendlyPhotoId, GalleryPhoto } from '@/lib/fieldPhotosGallery';
import { signedFieldPhotoUrl } from '@/lib/fieldPhotoStorage';
import { fetchOrdensServico } from '@/lib/ordensServico';
import { fetchReports } from '@/lib/reports';
import {
  buildLegend, MARKER_LABEL, orderPhotos, PhotoSheetConfig, PhotoSheetItem, PhotoSheetOrder,
  selectionClient, sharedReference, sharedTechnician, todayIso,
} from '@/lib/photoSheet';
import {
  comparisonLegend, comparisonSheetClient, ComparisonSheetItem, sharedComparisonReference,
} from '@/lib/comparisonSheet';
import type { ResolvedComparison } from '@/lib/fieldPhotoComparisons';
import type { DocumentProps } from '@react-pdf/renderer';
import { PhotoSheetPDFView } from '@/components/documentos/PhotoSheetPDFView';
import { PhotoSheetDocument } from '@/components/documentos/PhotoSheetDocument';
import { PhotoComparisonDocument } from '@/components/documentos/PhotoComparisonDocument';
import { photoSheetFilename } from '@/lib/photoSheet';

interface Props {
  photos?: GalleryPhoto[];
  comparisons?: ResolvedComparison[];
  onClose: () => void;
}

type Mode = 'individuais' | 'comparacoes';

const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result as string);
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

async function resolveImage(p: GalleryPhoto): Promise<string> {
  if (p.source === 'local') {
    const blob = p.localEvidence || p.localOriginal;
    if (!blob) throw new Error('sem imagem local');
    return blobToDataUrl(blob);
  }
  const path = p.storagePathEvidencia || p.storagePathOriginal;
  if (!path) throw new Error('sem caminho');
  const url = await signedFieldPhotoUrl(path);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('fetch');
  return blobToDataUrl(await resp.blob());
}

/** Fotos únicas de um conjunto de comparações (para o modo Evidências individuais). */
function flattenComparisons(comparisons: ResolvedComparison[]): GalleryPhoto[] {
  const seen = new Set<string>();
  const out: GalleryPhoto[] = [];
  for (const r of comparisons) for (const p of [r.before, r.after]) {
    if (!seen.has(p.id)) { seen.add(p.id); out.push(p); }
  }
  return out;
}

export const PhotoSheetConfigModal: React.FC<Props> = ({ photos, comparisons, onClose }) => {
  const toast = useToast();
  const hasComparisons = !!(comparisons && comparisons.length);

  const [mode, setMode] = useState<Mode>(hasComparisons ? 'comparacoes' : 'individuais');
  const basePhotos = useMemo(() => photos || (comparisons ? flattenComparisons(comparisons) : []), [photos, comparisons]);
  const client = useMemo(
    () => (hasComparisons ? comparisonSheetClient(comparisons!) : selectionClient(basePhotos)),
    [hasComparisons, comparisons, basePhotos],
  );

  const [titulo, setTitulo] = useState('Folha de Fotos');
  const [subtitulo, setSubtitulo] = useState('');
  const [localSetor, setLocalSetor] = useState('');
  const [referencia, setReferencia] = useState('');
  const [dataEmissao, setDataEmissao] = useState(todayIso());
  const [responsavel, setResponsavel] = useState('');
  const [observacao, setObservacao] = useState('');
  const [order, setOrder] = useState<PhotoSheetOrder>('selecao');
  const [ordered, setOrdered] = useState<GalleryPhoto[]>(basePhotos);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ doc: React.ReactElement<DocumentProps>; filename: string } | null>(null);

  const localCount = basePhotos.filter((p) => p.source === 'local').length;

  useEffect(() => {
    if (!client.ok) return;
    setResponsavel(sharedTechnician(basePhotos) || '');
    const uniqueLocal = Array.from(new Set(basePhotos.map((p) => p.localSetor).filter(Boolean)));
    if (uniqueLocal.length === 1) setLocalSetor(uniqueLocal[0] as string);
    const ref = hasComparisons ? sharedComparisonReference(comparisons!) : sharedReference(basePhotos);
    let alive = true;
    (async () => {
      try {
        if (ref.osId && client.clientId) {
          const os = (await fetchOrdensServico({ clienteId: client.clientId })).find((o) => o.id === ref.osId);
          if (alive && os?.numero) setReferencia(os.numero);
        } else if (ref.reportId && client.clientId) {
          const r = (await fetchReports({ clienteId: client.clientId })).find((x) => x.id === ref.reportId);
          if (alive && (r?.numero || r?.titulo)) setReferencia(r!.numero || r!.titulo!);
        }
      } catch { /* referência fica em branco */ }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { setOrdered(orderPhotos(basePhotos, order)); }, [order, basePhotos]);

  const move = (idx: number, dir: -1 | 1) => {
    setOrder('selecao');
    setOrdered((list) => {
      const next = [...list];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return next;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };

  const buildConfig = (): PhotoSheetConfig => ({
    titulo: titulo.trim() || 'Folha de Fotos',
    subtitulo: subtitulo.trim() || undefined,
    clienteNome: client.clientName || '—',
    localSetor: localSetor.trim() || undefined,
    referencia: referencia.trim() || undefined,
    dataEmissao,
    responsavel: responsavel.trim() || undefined,
    observacao: observacao.trim() || undefined,
  });

  const gerar = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (mode === 'comparacoes' && hasComparisons) {
        const items: ComparisonSheetItem[] = [];
        const failed: string[] = [];
        for (const r of comparisons!) {
          try {
            const [beforeDataUrl, afterDataUrl] = await Promise.all([resolveImage(r.before), resolveImage(r.after)]);
            const leg = comparisonLegend(r, items.length);
            items.push({ ...leg, beforeDataUrl, afterDataUrl });
          } catch {
            failed.push(r.comparison.titulo || `Comparação ${items.length + 1}`);
          }
        }
        if (items.length === 0) { toast.error('Nenhuma comparação pôde ser carregada. Verifique a conexão.'); return; }
        if (failed.length) toast.info(`${failed.length} comparação(ões) omitida(s) por falha de imagem: ${failed.slice(0, 2).join(', ')}${failed.length > 2 ? '…' : ''}`);
        const config = buildConfig();
        setPreview({ doc: <PhotoComparisonDocument config={config} items={items} />, filename: photoSheetFilename(client.clientName, dataEmissao) });
      } else {
        const items: PhotoSheetItem[] = [];
        const failed: string[] = [];
        for (const p of ordered) {
          try {
            const imageDataUrl = await resolveImage(p);
            const leg = buildLegend(p, items.length);
            items.push({ ...leg, clientUuid: p.clientUuid, imageDataUrl });
          } catch {
            failed.push(friendlyPhotoId(p.clientUuid));
          }
        }
        if (items.length === 0) { toast.error('Nenhuma evidência pôde ser carregada. Verifique a conexão.'); return; }
        if (failed.length) toast.info(`${failed.length} evidência(s) omitida(s): ${failed.slice(0, 3).join(', ')}${failed.length > 3 ? '…' : ''}`);
        const config = buildConfig();
        setPreview({ doc: <PhotoSheetDocument config={config} items={items} />, filename: photoSheetFilename(client.clientName, dataEmissao) });
      }
    } finally {
      setBusy(false);
    }
  };

  if (preview) return <PhotoSheetPDFView doc={preview.doc} filename={preview.filename} onClose={() => setPreview(null)} />;

  if (!client.ok) {
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4" onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-2xl">
          <span className="material-symbols-outlined mb-2 text-4xl text-amber-500">group</span>
          <h2 className="text-base font-bold text-slate-900">Clientes diferentes</h2>
          <p className="mt-1 text-sm text-slate-600">{hasComparisons ? 'A Folha de Fotos deve conter comparações do mesmo cliente.' : 'A Folha de Fotos deve conter fotos do mesmo cliente.'} Ajuste a seleção e tente novamente.</p>
          <button onClick={onClose} className="mt-4 min-h-11 w-full rounded-xl bg-[#1A1A72] text-xs font-bold uppercase text-white">Entendi</button>
        </div>
      </div>
    );
  }

  const field = 'mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm';
  const count = mode === 'comparacoes' && hasComparisons ? comparisons!.length : ordered.length;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/60 sm:items-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <p className="text-sm font-bold text-slate-900">Folha de Fotos</p>
            <p className="text-[11px] text-slate-500">{count} {mode === 'comparacoes' ? 'comparação(ões)' : 'evidência(s)'} · {client.clientName}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><span className="material-symbols-outlined">close</span></button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {hasComparisons && (
            <div>
              <p className="mb-1.5 text-xs font-bold uppercase text-slate-600">Modo de apresentação</p>
              <div className="flex gap-2">
                <button onClick={() => setMode('comparacoes')} className={`min-h-10 flex-1 rounded-lg border px-3 text-xs font-bold uppercase ${mode === 'comparacoes' ? 'border-[#1A1A72] bg-[#1A1A72]/5 text-[#1A1A72]' : 'border-slate-300 bg-white text-slate-600'}`}>Antes × Depois</button>
                <button onClick={() => setMode('individuais')} className={`min-h-10 flex-1 rounded-lg border px-3 text-xs font-bold uppercase ${mode === 'individuais' ? 'border-[#1A1A72] bg-[#1A1A72]/5 text-[#1A1A72]' : 'border-slate-300 bg-white text-slate-600'}`}>Evidências individuais</button>
              </div>
            </div>
          )}

          {localCount > 0 && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
              {localCount} foto(s) ainda não sincronizada(s) usarão a evidência salva no aparelho.
            </p>
          )}

          <label className="block text-xs font-bold uppercase text-slate-600">Título do documento
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={field} />
          </label>
          <label className="block text-xs font-bold uppercase text-slate-600">Subtítulo <span className="font-normal normal-case text-slate-400">(opcional)</span>
            <input value={subtitulo} onChange={(e) => setSubtitulo(e.target.value)} className={field} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-bold uppercase text-slate-600">Local / Setor
              <input value={localSetor} onChange={(e) => setLocalSetor(e.target.value)} className={field} />
            </label>
            <label className="block text-xs font-bold uppercase text-slate-600">Referência
              <input value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="OS / Relatório / Vistoria" className={field} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-bold uppercase text-slate-600">Data de emissão
              <input type="date" value={dataEmissao} onChange={(e) => setDataEmissao(e.target.value)} className={field} />
            </label>
            <label className="block text-xs font-bold uppercase text-slate-600">Responsável técnico
              <input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className={field} />
            </label>
          </div>
          <label className="block text-xs font-bold uppercase text-slate-600">Observação geral <span className="font-normal normal-case text-slate-400">(opcional)</span>
            <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} className={`${field} py-2`} />
          </label>

          {/* Reordenação só no modo de evidências individuais sem comparações */}
          {mode === 'individuais' && !hasComparisons && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-xs font-bold uppercase text-slate-600">Ordem das evidências</p>
                <select value={order} onChange={(e) => setOrder(e.target.value as PhotoSheetOrder)} className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs">
                  <option value="selecao">Seleção</option>
                  <option value="antiga">Mais antiga</option>
                  <option value="recente">Mais recente</option>
                </select>
              </div>
              <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 p-2">
                {ordered.map((p, i) => (
                  <div key={p.clientUuid} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-1.5">
                    <span className="w-6 shrink-0 text-center text-[11px] font-bold text-[#1A1A72]">{String(i + 1).padStart(2, '0')}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-slate-800">{p.localSetor || friendlyPhotoId(p.clientUuid)}</p>
                      <p className="truncate text-[10px] text-slate-500">{new Date(p.capturadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}{p.marcador ? ` · ${MARKER_LABEL[p.marcador]}` : ''}</p>
                    </div>
                    <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1 text-slate-500 disabled:opacity-30"><span className="material-symbols-outlined text-base">arrow_upward</span></button>
                    <button onClick={() => move(i, 1)} disabled={i === ordered.length - 1} className="rounded p-1 text-slate-500 disabled:opacity-30"><span className="material-symbols-outlined text-base">arrow_downward</span></button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t border-slate-200 p-4">
          <button onClick={onClose} className="min-h-12 flex-1 rounded-xl border border-slate-300 bg-white text-xs font-bold uppercase text-slate-600">Cancelar</button>
          <button onClick={gerar} disabled={busy} className="min-h-12 flex-[2] rounded-xl bg-[#1A1A72] text-xs font-bold uppercase text-white disabled:opacity-70">
            {busy ? 'Preparando…' : 'Visualizar PDF'}
          </button>
        </div>
      </div>
    </div>
  );
};
