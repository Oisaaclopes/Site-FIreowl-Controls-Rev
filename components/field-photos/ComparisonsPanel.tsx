'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useConfirm, useToast } from '@/components/ui/Feedback';
import { GalleryPhoto, normalizeText } from '@/lib/fieldPhotosGallery';
import { signedFieldPhotoUrl } from '@/lib/fieldPhotoStorage';
import {
  ComparisonResult, deleteComparison, FieldPhotoComparison, RESULT_LABEL,
  ResolvedComparison, resolveComparisons, updateComparison,
} from '@/lib/fieldPhotoComparisons';
import { comparisonSheetClient } from '@/lib/comparisonSheet';

interface Props {
  comparisons: FieldPhotoComparison[];
  photoById: Map<string, GalleryPhoto>;
  thumbs: Record<string, string>;
  onReload: () => Promise<void> | void;
  onGenerateSheet: (items: ResolvedComparison[]) => void;
}

const RESULT_TONE: Record<ComparisonResult, string> = {
  corrigido: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  parcial: 'bg-amber-50 text-amber-700 border-amber-200',
  pendente: 'bg-red-50 text-red-700 border-red-200',
};
const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const fmtTime = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');

export const ComparisonsPanel: React.FC<Props> = ({ comparisons, photoById, thumbs, onReload, onGenerateSheet }) => {
  const toast = useToast();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<ResolvedComparison | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const resolved = useMemo(() => resolveComparisons(comparisons, photoById), [comparisons, photoById]);

  const visible = useMemo(() => {
    const q = normalizeText(search);
    if (!q) return resolved;
    return resolved.filter((r) => normalizeText([r.before.clientName, r.before.localSetor, r.after.localSetor, r.comparison.titulo, r.comparison.descricao].filter(Boolean).join(' ')).includes(q));
  }, [resolved, search]);

  const toggle = (id: string) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectedItems = useMemo(() => visible.filter((r) => selected.has(r.comparison.id)), [visible, selected]);

  const gerar = () => {
    if (selectedItems.length === 0) return;
    if (!comparisonSheetClient(selectedItems).ok) { toast.error('A Folha de Fotos deve conter comparações do mesmo cliente.'); return; }
    onGenerateSheet(selectedItems);
  };

  return (
    <div>
      <div className="relative mb-4">
        <span className="material-symbols-outlined pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-lg text-fg-muted">search</span>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por cliente, local, título ou descrição" className="min-h-11 w-full rounded-xl border border-border-strong bg-surface pl-9 pr-3 text-sm" />
      </div>

      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/20 bg-navy/5 p-2.5">
          <span className="text-xs font-bold text-primary">{selected.size} comparação(ões) selecionada(s)</span>
          <div className="flex gap-2">
            <button onClick={gerar} className="min-h-9 rounded-lg bg-danger px-3 text-xs font-bold uppercase text-white">
              <span className="material-symbols-outlined align-middle text-sm">picture_as_pdf</span> Gerar Folha de Fotos
            </button>
            <button onClick={() => setSelected(new Set())} className="min-h-9 rounded-lg border border-border-strong bg-surface px-3 text-xs font-bold uppercase text-fg-secondary">Limpar</button>
          </div>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-fg-muted">
          <span className="material-symbols-outlined mb-2 text-5xl text-fg-muted">compare</span>
          <p className="font-semibold text-fg-secondary">Nenhuma comparação Antes × Depois.</p>
          <p className="mt-1 max-w-xs text-xs">Selecione 2 fotos do mesmo cliente na aba Todas e use “Antes × Depois”.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {visible.map((r) => (
            <ComparisonCard key={r.comparison.id} r={r} thumbs={thumbs} selected={selected.has(r.comparison.id)} onToggle={() => toggle(r.comparison.id)} onOpen={() => setDetail(r)} />
          ))}
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

const CardThumb = ({ photo, thumbs }: { photo: GalleryPhoto; thumbs: Record<string, string> }) => (
  <div className="aspect-[4/3] overflow-hidden rounded-lg bg-slate-900">
    {thumbs[photo.clientUuid]
      ? <img src={thumbs[photo.clientUuid]} alt="Evidência" className="h-full w-full object-contain" loading="lazy" />
      : <div className="flex h-full items-center justify-center text-fg-secondary"><span className="material-symbols-outlined">image</span></div>}
  </div>
);

const ComparisonCard: React.FC<{ r: ResolvedComparison; thumbs: Record<string, string>; selected: boolean; onToggle: () => void; onOpen: () => void }> = ({ r, thumbs, selected, onToggle, onOpen }) => {
  const { comparison: c, before, after } = r;
  const localDiff = (before.localSetor || '') !== (after.localSetor || '');
  return (
    <div className={`relative flex flex-col rounded-xl border bg-surface p-3 shadow-sm transition-colors ${selected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-border-strong'}`}>
      <button onClick={onToggle} className={`absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-lg shadow ${selected ? 'bg-navy text-white' : 'bg-white/90 text-fg-secondary hover:bg-surface'}`} aria-label="Selecionar">
        <span className="material-symbols-outlined text-base">{selected ? 'check' : 'check_box_outline_blank'}</span>
      </button>
      <button onClick={onOpen} className="text-left">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex-1">
            <p className="mb-1 text-[10px] font-bold uppercase text-sky-700">Antes · {fmtDate(before.capturadoEm)}</p>
            <CardThumb photo={before} thumbs={thumbs} />
          </div>
          <div className="flex-1">
            <p className="mb-1 text-[10px] font-bold uppercase text-emerald-700">Depois · {fmtDate(after.capturadoEm)}</p>
            <CardThumb photo={after} thumbs={thumbs} />
          </div>
        </div>
        <div className="mt-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-bold text-fg">{c.titulo || 'Comparação'}</p>
            {c.resultado && <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${RESULT_TONE[c.resultado]}`}>{RESULT_LABEL[c.resultado]}</span>}
          </div>
          <p className="truncate text-[11px] text-fg-secondary">{before.clientName || before.clientId}{localDiff ? ' · locais distintos' : before.localSetor ? ` · ${before.localSetor}` : ''}</p>
          {c.descricao && <p className="mt-0.5 line-clamp-2 text-[11px] text-fg-secondary">{c.descricao}</p>}
        </div>
      </button>
    </div>
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
          : <div className="flex h-full items-center justify-center text-fg-secondary"><span className="material-symbols-outlined">image</span></div>}
      </button>
      <p className="mt-1 text-[10px] text-fg-secondary">{photo.localSetor || '—'} · {fmtDate(photo.capturadoEm)} {fmtTime(photo.capturadoEm)}{photo.tecnicoNome ? ` · ${photo.tecnicoNome}` : ''}</p>
    </div>
  );
};

const ComparisonDetail: React.FC<{
  r: ResolvedComparison; thumbs: Record<string, string>;
  toast: { success: (m: string) => void; error: (m: string) => void; info: (m: string) => void };
  confirm: (o: { title: string; message?: string; confirmLabel?: string; danger?: boolean }) => Promise<boolean>;
  onClose: () => void; onChanged: () => Promise<void> | void;
}> = ({ r, thumbs, toast, confirm, onClose, onChanged }) => {
  const { comparison: c, before, after } = r;
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
  const field = 'mt-1 min-h-11 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm';

  return (
    <div className="fixed inset-0 z-[85] flex items-stretch justify-end bg-slate-950/60" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex h-full w-full max-w-lg flex-col overflow-y-auto bg-surface shadow-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-white/95 px-4 py-3 backdrop-blur">
          <p className="truncate text-sm font-bold text-fg">{c.titulo || 'Comparação Antes × Depois'}</p>
          <button onClick={onClose} className="rounded-lg p-1.5 text-fg-muted hover:bg-surface-3"><span className="material-symbols-outlined">close</span></button>
        </header>

        <div className="space-y-4 p-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <BigPhoto photo={before} label="Antes" tone="text-sky-700" thumbs={thumbs} />
            <BigPhoto photo={after} label="Depois" tone="text-emerald-700" thumbs={thumbs} />
          </div>

          <div className="rounded-xl border border-border p-3 text-sm">
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
            <div className="space-y-3 rounded-xl border border-primary/20 bg-navy/5 p-3">
              <label className="block text-xs font-bold uppercase text-fg-secondary">Título<input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={field} /></label>
              <label className="block text-xs font-bold uppercase text-fg-secondary">Descrição<textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} className={`${field} py-2`} /></label>
              <label className="block text-xs font-bold uppercase text-fg-secondary">Resultado
                <select value={resultado} onChange={(e) => setResultado(e.target.value as ComparisonResult | '')} className={`${field} normal-case`}>
                  <option value="">—</option>
                  {(Object.keys(RESULT_LABEL) as ComparisonResult[]).map((k) => <option key={k} value={k}>{RESULT_LABEL[k]}</option>)}
                </select>
              </label>
              <div className="flex gap-2">
                <button onClick={inverter} disabled={busy} className="min-h-10 flex-1 rounded-lg border border-border-strong bg-surface text-xs font-bold uppercase text-fg-secondary">Inverter A/D</button>
                <button onClick={() => setEdit(false)} disabled={busy} className="min-h-10 flex-1 rounded-lg border border-border-strong bg-surface text-xs font-bold uppercase text-fg-secondary">Cancelar</button>
                <button onClick={salvar} disabled={busy} className="min-h-10 flex-1 rounded-lg bg-navy text-xs font-bold uppercase text-white">Salvar</button>
              </div>
            </div>
          ) : (
            <>
              {c.descricao && <div><p className="text-[10px] font-bold uppercase text-fg-muted">Descrição</p><p className="text-sm text-fg-secondary">{c.descricao}</p></div>}
              <div className="flex gap-2">
                <button onClick={() => setEdit(true)} className="min-h-11 flex-1 rounded-xl bg-navy text-xs font-bold uppercase text-white">Editar</button>
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
  <div className="flex justify-between gap-3 border-b border-border py-1.5 last:border-0">
    <span className="text-[11px] font-bold uppercase text-fg-muted">{k}</span>
    <span className="text-right text-sm text-fg">{v}</span>
  </div>
);
