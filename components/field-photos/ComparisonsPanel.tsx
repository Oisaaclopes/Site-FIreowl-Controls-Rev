'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useConfirm, useToast } from '@/components/ui/Feedback';
import { GalleryPhoto, normalizeText } from '@/lib/fieldPhotosGallery';
import { signedFieldPhotoUrl } from '@/lib/fieldPhotoStorage';
import {
  ComparisonResult, deleteComparison, FieldPhotoComparison, RESULT_LABEL, updateComparison,
} from '@/lib/fieldPhotoComparisons';

interface Props {
  comparisons: FieldPhotoComparison[];
  photoById: Map<string, GalleryPhoto>;
  thumbs: Record<string, string>;
  onReload: () => Promise<void> | void;
}

interface Resolved { c: FieldPhotoComparison; before: GalleryPhoto; after: GalleryPhoto }

const RESULT_TONE: Record<ComparisonResult, string> = {
  corrigido: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  parcial: 'bg-amber-50 text-amber-700 border-amber-200',
  pendente: 'bg-red-50 text-red-700 border-red-200',
};
const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const fmtTime = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');

export const ComparisonsPanel: React.FC<Props> = ({ comparisons, photoById, thumbs, onReload }) => {
  const toast = useToast();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<Resolved | null>(null);

  const resolved = useMemo<Resolved[]>(() => {
    const out: Resolved[] = [];
    for (const c of comparisons) {
      const before = photoById.get(c.beforePhotoId);
      const after = photoById.get(c.afterPhotoId);
      if (before && after) out.push({ c, before, after }); // sem acesso às duas → não exibe
    }
    return out;
  }, [comparisons, photoById]);

  const visible = useMemo(() => {
    const q = normalizeText(search);
    if (!q) return resolved;
    return resolved.filter((r) => normalizeText([r.before.clientName, r.before.localSetor, r.after.localSetor, r.c.titulo, r.c.descricao].filter(Boolean).join(' ')).includes(q));
  }, [resolved, search]);

  return (
    <div>
      <div className="relative mb-4">
        <span className="material-symbols-outlined pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-lg text-slate-400">search</span>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por cliente, local, título ou descrição" className="min-h-11 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm" />
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400">
          <span className="material-symbols-outlined mb-2 text-5xl text-slate-300">compare</span>
          <p className="font-semibold text-slate-600">Nenhuma comparação Antes × Depois.</p>
          <p className="mt-1 max-w-xs text-xs">Selecione 2 fotos do mesmo cliente na aba Todas e use “Antes × Depois”.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {visible.map((r) => <ComparisonCard key={r.c.id} r={r} thumbs={thumbs} onOpen={() => setDetail(r)} />)}
        </div>
      )}

      {detail && (
        <ComparisonDetail
          r={detail}
          thumbs={thumbs}
          toast={toast}
          confirm={confirm}
          onClose={() => setDetail(null)}
          onChanged={async () => { setDetail(null); await onReload(); }}
        />
      )}
    </div>
  );
};

const ComparisonCard: React.FC<{ r: Resolved; thumbs: Record<string, string>; onOpen: () => void }> = ({ r, thumbs, onOpen }) => {
  const { c, before, after } = r;
  const localDiff = (before.localSetor || '') !== (after.localSetor || '');
  return (
    <button onClick={onOpen} className="flex flex-col rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition-colors hover:border-slate-300">
      {/* Antes | Depois (empilha no mobile, lado a lado ≥sm) */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex-1">
          <p className="mb-1 text-[10px] font-bold uppercase text-sky-700">Antes · {fmtDate(before.capturadoEm)}</p>
          <div className="aspect-[4/3] overflow-hidden rounded-lg bg-slate-900">
            {thumbs[before.clientUuid] ? <img src={thumbs[before.clientUuid]} alt="Antes" className="h-full w-full object-contain" loading="lazy" /> : <div className="flex h-full items-center justify-center text-slate-500"><span className="material-symbols-outlined">image</span></div>}
          </div>
        </div>
        <div className="flex-1">
          <p className="mb-1 text-[10px] font-bold uppercase text-emerald-700">Depois · {fmtDate(after.capturadoEm)}</p>
          <div className="aspect-[4/3] overflow-hidden rounded-lg bg-slate-900">
            {thumbs[after.clientUuid] ? <img src={thumbs[after.clientUuid]} alt="Depois" className="h-full w-full object-contain" loading="lazy" /> : <div className="flex h-full items-center justify-center text-slate-500"><span className="material-symbols-outlined">image</span></div>}
          </div>
        </div>
      </div>
      <div className="mt-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-bold text-slate-900">{c.titulo || 'Comparação'}</p>
          {c.resultado && <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${RESULT_TONE[c.resultado]}`}>{RESULT_LABEL[c.resultado]}</span>}
        </div>
        <p className="truncate text-[11px] text-slate-500">{before.clientName || before.clientId}{localDiff ? ' · locais distintos' : before.localSetor ? ` · ${before.localSetor}` : ''}</p>
        {c.descricao && <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-600">{c.descricao}</p>}
      </div>
    </button>
  );
};

/* --------------------------------- Detalhe --------------------------------- */

const BigPhoto = ({ photo, label, tone, thumbs }: { photo: GalleryPhoto; label: string; tone: string; thumbs: Record<string, string> }) => {
  const [full, setFull] = useState<string | undefined>();
  useEffect(() => () => { if (full?.startsWith('blob:')) URL.revokeObjectURL(full); }, [full]);
  const open = async () => {
    if (photo.source === 'local') { const b = photo.localOriginal || photo.localEvidence; if (b) setFull(URL.createObjectURL(b)); return; }
    const path = photo.storagePathEvidencia || photo.storagePathOriginal;
    if (path) { try { setFull(await signedFieldPhotoUrl(path)); } catch { /* mantém thumb */ } }
  };
  return (
    <div className="flex-1">
      <p className={`mb-1 text-[11px] font-bold uppercase ${tone}`}>{label}</p>
      <button onClick={open} className="block aspect-[4/3] w-full overflow-hidden rounded-xl bg-slate-900">
        {(full || thumbs[photo.clientUuid])
          ? <img src={full || thumbs[photo.clientUuid]} alt={label} className="h-full w-full object-contain" />
          : <div className="flex h-full items-center justify-center text-slate-500"><span className="material-symbols-outlined">image</span></div>}
      </button>
      <p className="mt-1 text-[10px] text-slate-500">{photo.localSetor || '—'} · {fmtDate(photo.capturadoEm)} {fmtTime(photo.capturadoEm)}{photo.tecnicoNome ? ` · ${photo.tecnicoNome}` : ''}</p>
    </div>
  );
};

const ComparisonDetail: React.FC<{
  r: Resolved; thumbs: Record<string, string>;
  toast: { success: (m: string) => void; error: (m: string) => void; info: (m: string) => void };
  confirm: (o: { title: string; message?: string; confirmLabel?: string; danger?: boolean }) => Promise<boolean>;
  onClose: () => void; onChanged: () => Promise<void> | void;
}> = ({ r, thumbs, toast, confirm, onClose, onChanged }) => {
  const { c, before, after } = r;
  const [edit, setEdit] = useState(false);
  const [titulo, setTitulo] = useState(c.titulo || '');
  const [descricao, setDescricao] = useState(c.descricao || '');
  const [resultado, setResultado] = useState<ComparisonResult | ''>(c.resultado || '');
  const [busy, setBusy] = useState(false);

  const salvar = async () => {
    setBusy(true);
    try {
      await updateComparison(c.id, { titulo: titulo.trim() || undefined, descricao: descricao.trim() || undefined, resultado: resultado || undefined });
      toast.success('Comparação atualizada.');
      await onChanged();
    } catch { toast.error('Não foi possível salvar.'); } finally { setBusy(false); }
  };

  const inverter = async () => {
    setBusy(true);
    try {
      await updateComparison(c.id, { beforePhotoId: after.id, afterPhotoId: before.id });
      toast.success('Antes e Depois invertidos.');
      await onChanged();
    } catch { toast.error('Não foi possível inverter.'); } finally { setBusy(false); }
  };

  const remover = async () => {
    if (!(await confirm({ title: 'Remover comparação?', message: 'Remover esta comparação Antes × Depois? As fotos continuarão salvas normalmente.', confirmLabel: 'Remover', danger: true }))) return;
    setBusy(true);
    try { await deleteComparison(c.id); toast.success('Comparação removida.'); await onChanged(); }
    catch { toast.error('Não foi possível remover.'); } finally { setBusy(false); }
  };

  const localDiff = (before.localSetor || '') !== (after.localSetor || '');
  const field = 'mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm';

  return (
    <div className="fixed inset-0 z-[85] flex items-stretch justify-end bg-slate-950/60" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex h-full w-full max-w-lg flex-col overflow-y-auto bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
          <p className="truncate text-sm font-bold text-slate-900">{c.titulo || 'Comparação Antes × Depois'}</p>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><span className="material-symbols-outlined">close</span></button>
        </header>

        <div className="space-y-4 p-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <BigPhoto photo={before} label="Antes" tone="text-sky-700" thumbs={thumbs} />
            <BigPhoto photo={after} label="Depois" tone="text-emerald-700" thumbs={thumbs} />
          </div>

          <div className="rounded-xl border border-slate-200 p-3 text-sm">
            <Row k="Cliente" v={before.clientName || before.clientId} />
            {localDiff
              ? (<><Row k="Local (Antes)" v={before.localSetor || '—'} /><Row k="Local (Depois)" v={after.localSetor || '—'} /></>)
              : <Row k="Local / Setor" v={before.localSetor || '—'} />}
            {(before.tecnicoNome || after.tecnicoNome) && (
              before.tecnicoNome === after.tecnicoNome
                ? <Row k="Técnico" v={before.tecnicoNome!} />
                : (<><Row k="Técnico (Antes)" v={before.tecnicoNome || '—'} /><Row k="Técnico (Depois)" v={after.tecnicoNome || '—'} /></>)
            )}
            {c.osId && <Row k="Vínculo" v="Ordem de Serviço" />}
            {c.reportId && !c.osId && <Row k="Vínculo" v="Atendimento" />}
            {c.resultado && <Row k="Resultado" v={RESULT_LABEL[c.resultado]} />}
          </div>

          {edit ? (
            <div className="space-y-3 rounded-xl border border-[#1A1A72]/20 bg-[#1A1A72]/5 p-3">
              <label className="block text-xs font-bold uppercase text-slate-600">Título<input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={field} /></label>
              <label className="block text-xs font-bold uppercase text-slate-600">Descrição<textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} className={`${field} py-2`} /></label>
              <label className="block text-xs font-bold uppercase text-slate-600">Resultado
                <select value={resultado} onChange={(e) => setResultado(e.target.value as ComparisonResult | '')} className={`${field} normal-case`}>
                  <option value="">—</option>
                  {(Object.keys(RESULT_LABEL) as ComparisonResult[]).map((k) => <option key={k} value={k}>{RESULT_LABEL[k]}</option>)}
                </select>
              </label>
              <div className="flex gap-2">
                <button onClick={inverter} disabled={busy} className="min-h-10 flex-1 rounded-lg border border-slate-300 bg-white text-xs font-bold uppercase text-slate-700">Inverter A/D</button>
                <button onClick={() => setEdit(false)} disabled={busy} className="min-h-10 flex-1 rounded-lg border border-slate-300 bg-white text-xs font-bold uppercase text-slate-600">Cancelar</button>
                <button onClick={salvar} disabled={busy} className="min-h-10 flex-1 rounded-lg bg-[#1A1A72] text-xs font-bold uppercase text-white">Salvar</button>
              </div>
            </div>
          ) : (
            <>
              {c.descricao && <div><p className="text-[10px] font-bold uppercase text-slate-400">Descrição</p><p className="text-sm text-slate-700">{c.descricao}</p></div>}
              <div className="flex gap-2">
                <button onClick={() => setEdit(true)} className="min-h-11 flex-1 rounded-xl bg-[#1A1A72] text-xs font-bold uppercase text-white">Editar</button>
                <button onClick={remover} disabled={busy} className="min-h-11 flex-1 rounded-xl border border-red-300 bg-red-50 text-xs font-bold uppercase text-red-700">Remover</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between gap-3 border-b border-slate-100 py-1.5 last:border-0">
    <span className="text-[11px] font-bold uppercase text-slate-400">{k}</span>
    <span className="text-right text-sm text-slate-800">{v}</span>
  </div>
);
