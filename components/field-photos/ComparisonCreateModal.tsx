'use client';

import React, { useState } from 'react';
import { useToast } from '@/components/ui/Feedback';
import { GalleryPhoto, friendlyPhotoId } from '@/lib/fieldPhotosGallery';
import {
  buildComparison, ComparisonResult, createComparison, FieldPhotoComparison,
  hasDuplicate, PAIR_INVALID_MESSAGE, RESULT_LABEL, validateComparisonPair,
} from '@/lib/fieldPhotoComparisons';

interface Props {
  a: GalleryPhoto;
  b: GalleryPhoto;
  thumbs: Record<string, string>;
  existing: FieldPhotoComparison[];
  onClose: () => void;
  onDone: () => Promise<void> | void;
}

const fmt = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export const ComparisonCreateModal: React.FC<Props> = ({ a, b, thumbs, existing, onClose, onDone }) => {
  const toast = useToast();
  const [beforeIsA, setBeforeIsA] = useState(true);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [resultado, setResultado] = useState<ComparisonResult | ''>('');
  const [busy, setBusy] = useState(false);

  const valid = validateComparisonPair([a, b]);

  const criar = async () => {
    if (busy) return;
    if (!valid.ok) { toast.error(PAIR_INVALID_MESSAGE[valid.reason!]); return; }
    const before = beforeIsA ? a : b;
    const after = beforeIsA ? b : a;
    if (hasDuplicate(existing, before.id, after.id)) { toast.error('Essas duas fotos já formam uma comparação.'); return; }
    setBusy(true);
    try {
      await createComparison(buildComparison(a, b, beforeIsA, { titulo, descricao, resultado: resultado || undefined }));
      toast.success('Comparação criada.');
      await onDone();
    } catch {
      toast.error('Não foi possível criar a comparação.');
    } finally {
      setBusy(false);
    }
  };

  const PhotoTile = ({ photo, role }: { photo: GalleryPhoto; role: 'antes' | 'depois' }) => (
    <div className={`overflow-hidden rounded-xl border ${role === 'antes' ? 'border-sky-300' : 'border-emerald-300'}`}>
      <div className="flex items-center justify-between px-2 py-1">
        <span className={`text-[10px] font-bold uppercase ${role === 'antes' ? 'text-sky-700' : 'text-emerald-700'}`}>{role === 'antes' ? 'Antes' : 'Depois'}</span>
        <span className="text-[10px] text-slate-400">{friendlyPhotoId(photo.clientUuid)}</span>
      </div>
      <div className="aspect-[4/3] bg-slate-900">
        {thumbs[photo.clientUuid]
          ? <img src={thumbs[photo.clientUuid]} alt="Evidência" className="h-full w-full object-contain" />
          : <div className="flex h-full items-center justify-center text-slate-500"><span className="material-symbols-outlined">image</span></div>}
      </div>
      <p className="truncate px-2 py-1 text-[10px] text-slate-500">{photo.localSetor || '—'} · {fmt(photo.capturadoEm)}</p>
    </div>
  );

  const before = beforeIsA ? a : b;
  const after = beforeIsA ? b : a;
  const field = 'mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm';

  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center bg-slate-950/60 sm:items-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <p className="text-sm font-bold text-slate-900">Criar comparação Antes × Depois</p>
            <p className="text-[11px] text-slate-500">Relaciona duas evidências — não duplica arquivos.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><span className="material-symbols-outlined">close</span></button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {!valid.ok && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{PAIR_INVALID_MESSAGE[valid.reason!]}</p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <PhotoTile photo={before} role="antes" />
            <PhotoTile photo={after} role="depois" />
          </div>

          <div>
            <p className="mb-1.5 text-xs font-bold uppercase text-slate-600">Qual é o “Antes”?</p>
            <div className="flex gap-2">
              <button onClick={() => setBeforeIsA(true)} className={`min-h-10 flex-1 rounded-lg border px-3 text-xs font-bold uppercase ${beforeIsA ? 'border-[#1A1A72] bg-[#1A1A72]/5 text-[#1A1A72]' : 'border-slate-300 bg-white text-slate-600'}`}>Foto A é o Antes</button>
              <button onClick={() => setBeforeIsA(false)} className={`min-h-10 flex-1 rounded-lg border px-3 text-xs font-bold uppercase ${!beforeIsA ? 'border-[#1A1A72] bg-[#1A1A72]/5 text-[#1A1A72]' : 'border-slate-300 bg-white text-slate-600'}`}>Foto B é o Antes</button>
            </div>
          </div>

          <label className="block text-xs font-bold uppercase text-slate-600">Título <span className="font-normal normal-case text-slate-400">(opcional)</span>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Substituição do detector" className={field} />
          </label>
          <label className="block text-xs font-bold uppercase text-slate-600">Descrição / serviço executado <span className="font-normal normal-case text-slate-400">(opcional)</span>
            <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} className={`${field} py-2`} />
          </label>
          <label className="block text-xs font-bold uppercase text-slate-600">Resultado <span className="font-normal normal-case text-slate-400">(opcional)</span>
            <select value={resultado} onChange={(e) => setResultado(e.target.value as ComparisonResult | '')} className={`${field} normal-case`}>
              <option value="">—</option>
              {(Object.keys(RESULT_LABEL) as ComparisonResult[]).map((r) => <option key={r} value={r}>{RESULT_LABEL[r]}</option>)}
            </select>
          </label>
        </div>

        <div className="flex gap-2 border-t border-slate-200 p-4">
          <button onClick={onClose} className="min-h-12 flex-1 rounded-xl border border-slate-300 bg-white text-xs font-bold uppercase text-slate-600">Cancelar</button>
          <button onClick={criar} disabled={busy || !valid.ok} className="min-h-12 flex-[2] rounded-xl bg-[#1A1A72] text-xs font-bold uppercase text-white disabled:opacity-60">
            {busy ? 'Criando…' : 'Criar comparação'}
          </button>
        </div>
      </div>
    </div>
  );
};
