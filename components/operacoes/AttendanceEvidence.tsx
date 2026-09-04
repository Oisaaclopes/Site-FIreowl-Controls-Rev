'use client';

import React, { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FieldPhoto, FieldPhotoMoment, FieldPhotoSession, listFieldPhotosForAttendance } from '@/lib/fieldPhotos';
import { captureAttendanceEvidence, ensureAttendanceSession } from '@/lib/fieldPhotoCapture';
import { signedFieldPhotoUrl } from '@/lib/fieldPhotoStorage';
import { flushOutbox, isOnline } from '@/lib/offline/reportSync';
import { fetchTechnicalCatalog, TechnicalCatalogItem } from '@/lib/technicalCatalog';
import { saveAttendanceCentral } from '@/lib/serviceAttendances';
import { useDomainRefresh } from '@/lib/realtime/RealtimeProvider';
import { useToast } from '@/components/ui/Feedback';
import { EquipmentIdentifier, EquipmentIdentification, equipmentHasContent } from '@/components/catalog/EquipmentIdentifier';

/* ===================================================================
 * ETAPA 3B.3 — EVIDÊNCIAS INLINE do atendimento (§2–§35). Câmera + upload no
 * MESMO pipeline (field_photos/outbox), classificadas ANTES/DURANTE/DEPOIS e,
 * para SDAI, condição da central (CENTRAL_ANTES/CENTRAL_DEPOIS). Contexto
 * (cliente/OS/atendimento/técnico) é automático — NUNCA abre o Registro Rápido.
 * =================================================================== */

/** Estado relevante para a validação de finalização (calculada no pai). */
export interface EvidenceState {
  hasBefore: boolean;
  hasDuring: boolean;
  hasAfter: boolean;
  hasCentralBefore: boolean;
  hasCentralAfter: boolean;
  centralNotApplicable: boolean;
  centralNaReason: string;
}

interface Props {
  attendanceId: string;
  osId?: string;
  clientId?: string;
  clientName: string;
  technicianId?: string;
  technicianName?: string;
  /** SDAI estrutural → exige condição da central (§18/§24). */
  isSdai: boolean;
  /** Área da OS (scoping do catálogo de equipamento). */
  area?: string;
  initialCentral?: { conditionInitial?: string; conditionFinal?: string; notApplicable?: boolean; naReason?: string };
  onStateChange?: (s: EvidenceState) => void;
}

type Pending = { file: File; source: 'camera' | 'upload'; moment: FieldPhotoMoment; url: string };
type LocalPhoto = { photo: FieldPhoto; previewUrl: string; synced: boolean };

const MOMENT_LABEL: Record<FieldPhotoMoment, string> = {
  ANTES: 'Antes — como encontrei',
  DURANTE: 'Durante — execução',
  DEPOIS: 'Depois — como deixei',
  CENTRAL_ANTES: 'Central — antes',
  CENTRAL_DEPOIS: 'Central — depois',
};

export const AttendanceEvidence: React.FC<Props> = ({
  attendanceId, osId, clientId, clientName, technicianId, technicianName,
  isSdai, area, initialCentral, onStateChange,
}) => {
  const toast = useToast();
  const [serverPhotos, setServerPhotos] = useState<FieldPhoto[]>([]);
  const [localPhotos, setLocalPhotos] = useState<LocalPhoto[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [catalog, setCatalog] = useState<TechnicalCatalogItem[]>([]);
  const [session, setSession] = useState<FieldPhotoSession | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [note, setNote] = useState('');
  const [equipment, setEquipment] = useState<EquipmentIdentification | undefined>();
  const [busy, setBusy] = useState(false);

  // Condição da central (SDAI) — service_attendance; autosave discreto.
  const [condInitial, setCondInitial] = useState(initialCentral?.conditionInitial || '');
  const [condFinal, setCondFinal] = useState(initialCentral?.conditionFinal || '');
  const [naOn, setNaOn] = useState(!!initialCentral?.notApplicable);
  const [naReason, setNaReason] = useState(initialCentral?.naReason || '');
  const centralSavedRef = useRef({ i: condInitial, f: condFinal, na: naOn, r: naReason });

  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCfgRef = useRef<{ source: 'camera' | 'upload'; moment: FieldPhotoMoment } | null>(null);

  const refresh = useCallback(() => {
    if (!attendanceId) return;
    listFieldPhotosForAttendance(attendanceId).then(setServerPhotos).catch(() => setServerPhotos([]));
  }, [attendanceId]);
  useEffect(() => { refresh(); }, [refresh]);
  useDomainRefresh('fieldPhotos', refresh);

  useEffect(() => { fetchTechnicalCatalog().then(setCatalog).catch(() => setCatalog([])); }, []);

  // Fotos exibidas: servidor + locais ainda não confirmadas (sem duplicar id).
  const photos = useMemo(() => {
    const serverIds = new Set(serverPhotos.map((p) => p.id));
    const localsPend = localPhotos.filter((l) => !serverIds.has(l.photo.id));
    return { server: serverPhotos, locals: localsPend };
  }, [serverPhotos, localPhotos]);

  // Resolve URLs assinadas das fotos do servidor (evidência derivada, menor §46).
  useEffect(() => {
    let alive = true;
    (async () => {
      const missing = serverPhotos.filter((p) => !urls[p.id]);
      for (const p of missing) {
        try {
          const u = await signedFieldPhotoUrl(p.storagePathEvidencia || p.storagePathOriginal);
          if (alive) setUrls((prev) => ({ ...prev, [p.id]: u }));
        } catch { /* mantém sem preview */ }
      }
    })();
    return () => { alive = false; };
  }, [serverPhotos, urls]);

  const photosByMoment = useCallback((m: FieldPhotoMoment) => ({
    server: photos.server.filter((p) => p.evidenceMoment === m),
    locals: photos.locals.filter((l) => l.photo.evidenceMoment === m),
  }), [photos]);

  // Reporta o estado de evidências para a validação de finalização do pai.
  useEffect(() => {
    const has = (m: FieldPhotoMoment) => photos.server.some((p) => p.evidenceMoment === m) || photos.locals.some((l) => l.photo.evidenceMoment === m);
    onStateChange?.({
      hasBefore: has('ANTES'),
      hasDuring: has('DURANTE'),
      hasAfter: has('DEPOIS'),
      hasCentralBefore: has('CENTRAL_ANTES') || !!condInitial.trim(),
      hasCentralAfter: has('CENTRAL_DEPOIS') || !!condFinal.trim(),
      centralNotApplicable: naOn,
      centralNaReason: naReason,
    });
  }, [photos, condInitial, condFinal, naOn, naReason, onStateChange]);

  // Autosave da condição da central (debounce).
  useEffect(() => {
    const s = centralSavedRef.current;
    if (s.i === condInitial && s.f === condFinal && s.na === naOn && s.r === naReason) return;
    const h = window.setTimeout(async () => {
      try {
        await saveAttendanceCentral({ id: attendanceId, conditionInitial: condInitial, conditionFinal: condFinal, notApplicable: naOn, naReason });
        centralSavedRef.current = { i: condInitial, f: condFinal, na: naOn, r: naReason };
      } catch { /* mantém em tela */ }
    }, 1000);
    return () => window.clearTimeout(h);
  }, [attendanceId, condInitial, condFinal, naOn, naReason]);

  const openPicker = (source: 'camera' | 'upload', moment: FieldPhotoMoment) => {
    pendingCfgRef.current = { source, moment };
    const el = inputRef.current;
    if (!el) return;
    // Câmera no mobile: capture="environment"; upload: sem capture (galeria/arquivos).
    if (source === 'camera') el.setAttribute('capture', 'environment');
    else el.removeAttribute('capture');
    el.value = '';
    el.click();
  };

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const cfg = pendingCfgRef.current;
    if (!file || !cfg) return;
    if (!file.type.startsWith('image/')) { toast.error('Selecione uma imagem válida.'); return; }
    setNote(''); setEquipment(undefined);
    setPending({ file, source: cfg.source, moment: cfg.moment, url: URL.createObjectURL(file) });
  };

  const cancelPending = () => setPending((p) => { if (p) URL.revokeObjectURL(p.url); return null; });

  const savePending = async () => {
    if (!pending || busy || !clientId || !technicianId) {
      if (!technicianId) toast.error('Sessão do técnico indisponível.');
      return;
    }
    setBusy(true);
    try {
      let s = session;
      if (!s) { s = await ensureAttendanceSession({ clientId, technicianId, technicianName }); setSession(s); }
      const saved = await captureAttendanceEvidence({
        file: pending.file, source: pending.source, session: s,
        clientId, clientName, osId, serviceAttendanceId: attendanceId, moment: pending.moment,
        note, equipmentCatalogItemId: equipment?.catalogItemId, equipmentBrand: equipment?.brand, equipmentModel: equipment?.model,
      });
      setLocalPhotos((prev) => [...prev, { photo: saved.photo, previewUrl: saved.previewUrl, synced: false }]);
      URL.revokeObjectURL(pending.url);
      setPending(null); setNote(''); setEquipment(undefined);
      if (isOnline()) { flushOutbox().then(refresh).catch(() => {}); }
      toast.success('Evidência adicionada.');
    } catch {
      toast.error('Não foi possível salvar a evidência neste aparelho.');
    } finally {
      setBusy(false);
    }
  };

  const MomentGroup = ({ moment, compact }: { moment: FieldPhotoMoment; compact?: boolean }) => {
    const g = photosByMoment(moment);
    const count = g.server.length + g.locals.length;
    return (
      <div className={compact ? '' : 'rounded-lg border border-border bg-surface-2 p-2.5'}>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wide text-fg-secondary">{MOMENT_LABEL[moment]}</span>
          {count > 0 && <span className="text-[10px] font-bold text-fg-muted">{count} foto(s)</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {g.server.map((p) => (
            <span key={p.id} className="relative w-16 h-16 rounded-lg overflow-hidden border border-border bg-surface-3 shrink-0">
              {urls[p.id]
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={urls[p.id]} alt="Evidência" className="w-full h-full object-cover" />
                : <span className="w-full h-full flex items-center justify-center text-fg-muted"><span className="material-symbols-outlined text-lg">image</span></span>}
              {(p.equipmentBrand || p.equipmentModel) && (
                <span className="absolute bottom-0 inset-x-0 bg-navy/70 text-white text-[7px] px-1 truncate">{[p.equipmentBrand, p.equipmentModel].filter(Boolean).join(' ')}</span>
              )}
            </span>
          ))}
          {g.locals.map((l) => (
            <span key={l.photo.id} className="relative w-16 h-16 rounded-lg overflow-hidden border border-amber-300 bg-surface-3 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={l.previewUrl} alt="Evidência" className="w-full h-full object-cover" />
              <span className="absolute top-0 right-0 bg-amber-500 text-white text-[7px] px-1 rounded-bl">•</span>
            </span>
          ))}
          <button type="button" onClick={() => openPicker('camera', moment)} className="w-16 h-16 rounded-lg border border-dashed border-border text-fg-secondary hover:border-primary hover:text-primary flex flex-col items-center justify-center gap-0.5 shrink-0">
            <span className="material-symbols-outlined text-lg">photo_camera</span>
            <span className="text-[8px] font-bold uppercase">Tirar</span>
          </button>
          <button type="button" onClick={() => openPicker('upload', moment)} className="w-16 h-16 rounded-lg border border-dashed border-border text-fg-secondary hover:border-primary hover:text-primary flex flex-col items-center justify-center gap-0.5 shrink-0">
            <span className="material-symbols-outlined text-lg">upload</span>
            <span className="text-[8px] font-bold uppercase">Enviar</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-bold uppercase tracking-wide text-fg-secondary">Evidências</span>
      <input ref={inputRef} type="file" accept="image/*" onChange={onFile} className="hidden" />

      {/* SDAI — CENTRAL: ANTES (destacado) */}
      {isSdai && !naOn && (
        <div className="rounded-lg border border-primary/40 bg-primary-soft/30 p-2.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-primary mb-1">Central — condição inicial <span className="text-danger">*</span></p>
          <MomentGroup moment="CENTRAL_ANTES" compact />
          <textarea value={condInitial} onChange={(e) => setCondInitial(e.target.value)} rows={2} placeholder="Condição da central na chegada (ex.: 3 falhas de comunicação e 1 de bateria)." className="mt-2 w-full rounded-lg border border-border bg-surface text-fg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25" />
        </div>
      )}

      {/* ANTES / DURANTE / DEPOIS (equipamentos/serviço) */}
      <MomentGroup moment="ANTES" />
      <MomentGroup moment="DURANTE" />
      <MomentGroup moment="DEPOIS" />

      {/* SDAI — CENTRAL: DEPOIS (destacado) */}
      {isSdai && !naOn && (
        <div className="rounded-lg border border-primary/40 bg-primary-soft/30 p-2.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-primary mb-1">Central — condição final <span className="text-danger">*</span></p>
          <MomentGroup moment="CENTRAL_DEPOIS" compact />
          <textarea value={condFinal} onChange={(e) => setCondFinal(e.target.value)} rows={2} placeholder="Condição da central após o serviço (ex.: normalizada, sem falhas relacionadas)." className="mt-2 w-full rounded-lg border border-border bg-surface text-fg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25" />
        </div>
      )}

      {/* SDAI — escape "central não aplicável" (§26) */}
      {isSdai && (
        <div className="rounded-lg border border-border bg-surface-2 p-2.5">
          <label className="flex items-center gap-2 text-[12px] font-semibold text-fg-secondary">
            <input type="checkbox" checked={naOn} onChange={(e) => setNaOn(e.target.checked)} className="w-4 h-4 accent-primary" />
            Central não aplicável a este serviço
          </label>
          {naOn && (
            <input value={naReason} onChange={(e) => setNaReason(e.target.value)} placeholder="Motivo (ex.: serviço exclusivo em infraestrutura)." className="mt-2 w-full rounded-lg border border-border bg-surface text-fg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25" />
          )}
        </div>
      )}

      {/* Painel de confirmação da captura (preview + equipamento + nota) */}
      {pending && (
        <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) cancelPending(); }}>
          <div className="bg-surface w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <p className="text-xs font-bold uppercase tracking-wide text-fg-secondary">{MOMENT_LABEL[pending.moment]}</p>
              <button onClick={cancelPending} className="text-fg-muted hover:text-fg-secondary text-2xl leading-none">×</button>
            </div>
            <div className="overflow-y-auto p-4 flex flex-col gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pending.url} alt="Prévia" className="max-h-[40vh] w-full rounded-xl bg-slate-900 object-contain" />
              <EquipmentIdentifier value={equipment} onChange={setEquipment} catalog={catalog} area={area} />
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Observação (opcional)" className="w-full rounded-lg border border-border bg-surface text-fg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25" />
              {equipmentHasContent(equipment) && <p className="text-[10px] text-fg-muted">Identificação técnica — não movimenta estoque.</p>}
            </div>
            <div className="p-3 border-t border-border flex gap-2">
              <button onClick={cancelPending} className="px-4 py-2.5 rounded-lg bg-surface-3 text-xs font-bold uppercase text-fg-secondary">Cancelar</button>
              <button onClick={savePending} disabled={busy} className="flex-1 min-h-[44px] rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-bold uppercase tracking-wide disabled:opacity-60">{busy ? 'Salvando…' : 'Salvar evidência'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
