'use client';

import React, { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EvidenceItemCategory, ServiceAttendanceEvidenceItem } from '@/lib/types';
import { FieldPhoto, FieldPhotoMoment, FieldPhotoSession, listFieldPhotosForAttendance, deleteFieldPhoto, updateFieldPhotoMeta } from '@/lib/fieldPhotos';
import { captureAttendanceEvidence, ensureAttendanceSession } from '@/lib/fieldPhotoCapture';
import { signedFieldPhotoUrl } from '@/lib/fieldPhotoStorage';
import { flushOutbox, isOnline } from '@/lib/offline/reportSync';
import { fetchTechnicalCatalog, TechnicalCatalogItem } from '@/lib/technicalCatalog';
import { saveAttendanceCentral } from '@/lib/serviceAttendances';
import {
  buildEvidenceCategoryOptions, createEvidenceItem, deleteEvidenceItem, equipmentToItemFields,
  EVIDENCE_CATEGORY_LABEL, EvidenceCategoryOption, fetchEvidenceItems, updateEvidenceItem,
} from '@/lib/evidenceItems';
import { useDomainRefresh } from '@/lib/realtime/RealtimeProvider';
import { useIsMobile } from '@/lib/useIsMobile';
import { useConfirm, useToast } from '@/components/ui/Feedback';
import { PickerField } from '@/components/ui/PickerField';
import { CameraCapture } from '@/components/ui/CameraCapture';
import { EquipmentIdentifier, EquipmentIdentification } from '@/components/catalog/EquipmentIdentifier';

/* ===================================================================
 * CORREÇÃO pós-3B.4 — Evidências por ITEM com captura UNIFICADA.
 *   [Adicionar foto] abre o seletor nativo (câmera OU galeria); sem dois botões
 *   e sem forçar `capture` (§6–§19). Mesmo pipeline (field_photos/outbox).
 *   Categorias do item vêm da taxonomia real por ÁREA (§25–§36). Central geral
 *   do SDAI (chegada/saída) preservada à parte (0087).
 * =================================================================== */

export interface EvidenceState {
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
  isSdai: boolean;
  area?: string;
  initialCentral?: { conditionInitial?: string; conditionFinal?: string; notApplicable?: boolean; naReason?: string };
  onStateChange?: (s: EvidenceState) => void;
}

type LocalPhoto = { photo: FieldPhoto; previewUrl: string };

export const AttendanceEvidence: React.FC<Props> = ({
  attendanceId, osId, clientId, clientName, technicianId, technicianName,
  isSdai, area, initialCentral, onStateChange,
}) => {
  const toast = useToast();
  const confirm = useConfirm();
  const isMobile = useIsMobile();

  const [cameraOpen, setCameraOpen] = useState(false);
  const [items, setItems] = useState<ServiceAttendanceEvidenceItem[]>([]);
  const [serverPhotos, setServerPhotos] = useState<FieldPhoto[]>([]);
  const [localPhotos, setLocalPhotos] = useState<LocalPhoto[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [catalog, setCatalog] = useState<TechnicalCatalogItem[]>([]);
  const [session, setSession] = useState<FieldPhotoSession | null>(null);

  const [newItem, setNewItem] = useState<{ file: File; url: string } | null>(null);
  const [capture, setCapture] = useState<{ file: File; url: string; moment: FieldPhotoMoment; itemId?: string; central?: boolean } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [viewer, setViewer] = useState<FieldPhoto | null>(null);

  const [condInitial, setCondInitial] = useState(initialCentral?.conditionInitial || '');
  const [condFinal, setCondFinal] = useState(initialCentral?.conditionFinal || '');
  const [naOn, setNaOn] = useState(!!initialCentral?.notApplicable);
  const [naReason, setNaReason] = useState(initialCentral?.naReason || '');
  const centralSavedRef = useRef({ i: condInitial, f: condFinal, na: naOn, r: naReason });

  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCfgRef = useRef<{ kind: 'newItem' | 'capture'; moment?: FieldPhotoMoment; itemId?: string; central?: boolean } | null>(null);

  const refresh = useCallback(() => {
    if (!attendanceId) return;
    fetchEvidenceItems(attendanceId).then(setItems).catch(() => setItems([]));
    listFieldPhotosForAttendance(attendanceId).then(setServerPhotos).catch(() => setServerPhotos([]));
  }, [attendanceId]);
  useEffect(() => { refresh(); }, [refresh]);
  useDomainRefresh('fieldPhotos', refresh);
  useEffect(() => { fetchTechnicalCatalog().then(setCatalog).catch(() => setCatalog([])); }, []);

  const categoryOptions = useMemo(() => buildEvidenceCategoryOptions(catalog, isSdai ? (area || 'sdai') : area), [catalog, area, isSdai]);

  const allPhotos = useMemo(() => {
    const serverIds = new Set(serverPhotos.map((p) => p.id));
    return [...serverPhotos, ...localPhotos.filter((l) => !serverIds.has(l.photo.id)).map((l) => l.photo)];
  }, [serverPhotos, localPhotos]);
  const previewFor = useCallback((photo: FieldPhoto): string | undefined => {
    return localPhotos.find((l) => l.photo.id === photo.id)?.previewUrl || urls[photo.id];
  }, [localPhotos, urls]);

  useEffect(() => {
    let alive = true;
    (async () => {
      for (const p of serverPhotos) {
        if (urls[p.id]) continue;
        try { const u = await signedFieldPhotoUrl(p.storagePathEvidencia || p.storagePathOriginal); if (alive) setUrls((prev) => ({ ...prev, [p.id]: u })); } catch { /* sem preview */ }
      }
    })();
    return () => { alive = false; };
  }, [serverPhotos, urls]);

  const centralPhotos = useCallback((m: 'CENTRAL_ANTES' | 'CENTRAL_DEPOIS') => allPhotos.filter((p) => !p.evidenceItemId && p.evidenceMoment === m), [allPhotos]);

  useEffect(() => {
    onStateChange?.({
      hasCentralBefore: centralPhotos('CENTRAL_ANTES').length > 0 || !!condInitial.trim(),
      hasCentralAfter: centralPhotos('CENTRAL_DEPOIS').length > 0 || !!condFinal.trim(),
      centralNotApplicable: naOn,
      centralNaReason: naReason,
    });
  }, [centralPhotos, condInitial, condFinal, naOn, naReason, onStateChange]);

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

  const ensureSession = useCallback(async (): Promise<FieldPhotoSession | null> => {
    if (!clientId || !technicianId) { toast.error('Sessão do técnico indisponível.'); return null; }
    if (session) return session;
    const s = await ensureAttendanceSession({ clientId, technicianId, technicianName });
    setSession(s);
    return s;
  }, [clientId, session, technicianId, technicianName, toast]);

  // Captura: no MOBILE abre a CameraCapture (câmera traseira como ação principal,
  // galeria acessível dentro dela); no DESKTOP usa o seletor de arquivo (§11).
  // Os dois caminhos entregam um File ao mesmo `receiveFile`.
  const trigger = (cfg: NonNullable<typeof pendingCfgRef.current>) => {
    pendingCfgRef.current = cfg;
    if (isMobile) { setCameraOpen(true); return; }
    const el = inputRef.current;
    if (!el) return;
    el.value = '';
    el.click();
  };
  const receiveFile = (file: File) => {
    const cfg = pendingCfgRef.current;
    if (!file || !cfg) return;
    if (!file.type.startsWith('image/')) { toast.error('Selecione uma imagem válida.'); return; }
    const url = URL.createObjectURL(file);
    if (cfg.kind === 'newItem') setNewItem({ file, url });
    else setCapture({ file, url, moment: cfg.moment || 'DURANTE', itemId: cfg.itemId, central: cfg.central });
  };
  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) receiveFile(file);
  };

  const addLocal = (photo: FieldPhoto, previewUrl: string) => setLocalPhotos((prev) => [...prev, { photo, previewUrl }]);
  const afterWrite = () => { if (isOnline()) flushOutbox().then(refresh).catch(() => {}); };

  const item = detailId ? items.find((i) => i.id === detailId) : undefined;

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-bold uppercase tracking-wide text-fg-secondary">Evidências</span>
      <input ref={inputRef} type="file" accept="image/*" onChange={onFile} className="hidden" />

      {cameraOpen && (
        <CameraCapture
          onCapture={(file) => { setCameraOpen(false); receiveFile(file); }}
          onClose={() => { setCameraOpen(false); pendingCfgRef.current = null; }}
        />
      )}

      {isSdai && !naOn && (
        <CentralBlock
          title="Central" subtitle="Condição inicial" required
          photos={centralPhotos('CENTRAL_ANTES')} previewFor={previewFor}
          onAdd={() => trigger({ kind: 'capture', moment: 'CENTRAL_ANTES', central: true })}
          onOpen={setViewer}
          text={condInitial} onText={setCondInitial}
          placeholder="Condição da central na chegada (ex.: 3 falhas de comunicação e 1 de bateria)."
        />
      )}

      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wide text-fg-secondary">Itens do atendimento</span>
        <span className="text-[10px] text-fg-muted">{items.length}</span>
      </div>

      {items.length === 0 && (
        <p className="text-[11px] text-fg-muted -mt-1">Registre cada equipamento, infraestrutura ou cabeamento trabalhado como um item, com suas fotos de antes, durante e depois.</p>
      )}

      <div className="flex flex-col gap-2">
        {items.map((it) => (
          <ItemCard
            key={it.id} item={it} photos={allPhotos} previewFor={previewFor}
            onOpen={() => setDetailId(it.id)}
            onRegistrarDurante={() => trigger({ kind: 'capture', moment: 'DURANTE', itemId: it.id })}
            onRegistrarDepois={() => trigger({ kind: 'capture', moment: 'DEPOIS', itemId: it.id })}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => trigger({ kind: 'newItem' })}
        className="min-h-[48px] rounded-lg border border-dashed border-primary/50 bg-primary-soft/30 text-primary text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-2 hover:bg-primary-soft/50"
      >
        <span className="material-symbols-outlined text-xl">add_a_photo</span>
        Novo item
      </button>

      {isSdai && !naOn && (
        <CentralBlock
          title="Central" subtitle="Condição final" required
          photos={centralPhotos('CENTRAL_DEPOIS')} previewFor={previewFor}
          onAdd={() => trigger({ kind: 'capture', moment: 'CENTRAL_DEPOIS', central: true })}
          onOpen={setViewer}
          text={condFinal} onText={setCondFinal}
          placeholder="Condição da central após o serviço (ex.: normalizada, sem falhas relacionadas)."
        />
      )}

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

      {newItem && (
        <NewItemSheet
          capture={newItem} catalog={catalog} area={area} categoryOptions={categoryOptions}
          onCancel={() => { URL.revokeObjectURL(newItem.url); setNewItem(null); }}
          onSave={async (form, equipment) => {
            const s = await ensureSession();
            if (!s || !clientId) return;
            const created = await createEvidenceItem({
              serviceAttendanceId: attendanceId, workOrderId: osId,
              title: form.title, category: form.category, equipmentType: form.equipmentType,
              location: form.location || undefined, deviceAddress: form.deviceAddress || undefined,
              notes: form.notes || undefined, ...equipmentToItemFields(equipment),
            });
            const saved = await captureAttendanceEvidence({
              file: newItem.file, session: s, clientId, clientName, osId,
              serviceAttendanceId: attendanceId, moment: 'ANTES', evidenceItemId: created.id, note: form.notes,
              equipmentCatalogItemId: equipment?.catalogItemId, equipmentBrand: equipment?.brand, equipmentModel: equipment?.model,
            });
            addLocal(saved.photo, saved.previewUrl);
            setItems((prev) => [...prev, created]);
            URL.revokeObjectURL(newItem.url); setNewItem(null);
            afterWrite();
            toast.success('Item registrado.');
          }}
        />
      )}

      {capture && (
        <CapturePanel
          capture={capture} catalog={catalog} area={area} allowEquipment={!capture.central}
          onCancel={() => { URL.revokeObjectURL(capture.url); setCapture(null); }}
          onSave={async (note, equipment) => {
            const s = await ensureSession();
            if (!s || !clientId) return;
            const saved = await captureAttendanceEvidence({
              file: capture.file, session: s, clientId, clientName, osId,
              serviceAttendanceId: attendanceId, moment: capture.moment, evidenceItemId: capture.itemId, note,
              equipmentCatalogItemId: equipment?.catalogItemId, equipmentBrand: equipment?.brand, equipmentModel: equipment?.model,
            });
            addLocal(saved.photo, saved.previewUrl);
            URL.revokeObjectURL(capture.url); setCapture(null);
            afterWrite();
            toast.success('Evidência adicionada.');
          }}
        />
      )}

      {item && (
        <ItemDetail
          item={item} photos={allPhotos} previewFor={previewFor} catalog={catalog} area={area} categoryOptions={categoryOptions}
          onClose={() => setDetailId(null)}
          onOpenPhoto={setViewer}
          onAdd={(moment) => trigger({ kind: 'capture', moment, itemId: item.id })}
          onSaveEdit={async (patch) => { const updated = await updateEvidenceItem(item.id, patch); setItems((prev) => prev.map((x) => x.id === item.id ? updated : x)); }}
          onDelete={async () => {
            const n = allPhotos.filter((p) => p.evidenceItemId === item.id).length;
            const ok = await confirm({ title: `Excluir "${item.title}"?`, message: n > 0 ? `Este item possui ${n} evidência(s) fotográfica(s). As fotos são mantidas em Fotos de Campo, mas deixam de pertencer a este item.` : 'Confirmar exclusão do item?', confirmLabel: 'Excluir item', danger: true });
            if (!ok) return;
            await deleteEvidenceItem(item.id);
            setItems((prev) => prev.filter((x) => x.id !== item.id));
            setDetailId(null);
            refresh();
          }}
        />
      )}

      {viewer && (
        <PhotoViewer
          photo={viewer} url={previewFor(viewer)} catalog={catalog} area={area}
          onClose={() => setViewer(null)}
          onSaveMeta={async (patch) => { await updateFieldPhotoMeta(viewer.id, patch); setServerPhotos((prev) => prev.map((p) => p.id === viewer.id ? { ...p, ...patch } : p)); setLocalPhotos((prev) => prev.map((l) => l.photo.id === viewer.id ? { ...l, photo: { ...l.photo, ...patch } } : l)); }}
          onDelete={async () => {
            const ok = await confirm({ title: 'Excluir foto?', message: 'A foto será removida definitivamente desta evidência.', confirmLabel: 'Excluir foto', danger: true });
            if (!ok) return;
            await deleteFieldPhoto(viewer);
            setServerPhotos((prev) => prev.filter((p) => p.id !== viewer.id));
            setLocalPhotos((prev) => prev.filter((l) => l.photo.id !== viewer.id));
            setViewer(null);
            toast.success('Foto excluída.');
          }}
        />
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
const ItemCard: React.FC<{
  item: ServiceAttendanceEvidenceItem; photos: FieldPhoto[]; previewFor: (p: FieldPhoto) => string | undefined;
  onOpen: () => void; onRegistrarDurante: () => void; onRegistrarDepois: () => void;
}> = ({ item, photos, previewFor, onOpen, onRegistrarDurante, onRegistrarDepois }) => {
  const mine = photos.filter((p) => p.evidenceItemId === item.id);
  const nAntes = mine.filter((p) => p.evidenceMoment === 'ANTES').length;
  const nDurante = mine.filter((p) => p.evidenceMoment === 'DURANTE').length;
  const nDepois = mine.filter((p) => p.evidenceMoment === 'DEPOIS').length;
  const thumb = mine.find((p) => p.evidenceMoment === 'ANTES') || mine[0];
  const thumbUrl = thumb ? previewFor(thumb) : undefined;
  const typeLabel = item.equipmentType || EVIDENCE_CATEGORY_LABEL[item.category];
  const subtitle = [item.model, item.deviceAddress ? `Endereço ${item.deviceAddress}` : '', item.location].filter(Boolean);

  const Count = ({ label, n }: { label: string; n: number }) => (
    <span className="flex items-center gap-1 text-[10px] font-bold">
      <span className={`material-symbols-outlined text-sm ${n > 0 ? 'text-emerald-600' : 'text-fg-muted'}`}>{n > 0 ? 'check_circle' : 'radio_button_unchecked'}</span>
      <span className="text-fg-secondary">{label}{n > 1 ? ` ${n}` : ''}</span>
    </span>
  );

  return (
    <div className="rounded-lg border border-border bg-surface p-2.5">
      <button type="button" onClick={onOpen} className="w-full flex items-start gap-3 text-left">
        <span className="w-14 h-14 rounded-lg overflow-hidden border border-border bg-surface-3 shrink-0 flex items-center justify-center">
          {thumbUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={thumbUrl} alt={item.title} className="w-full h-full object-cover" />
            : <span className="material-symbols-outlined text-fg-muted">image</span>}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-fg text-sm truncate">{item.title}</span>
          <span className="block text-[11px] text-fg-secondary truncate">{typeLabel}</span>
          {subtitle.length > 0 && <span className="block text-[11px] text-fg-muted truncate">{subtitle.join(' · ')}</span>}
        </span>
      </button>
      <div className="mt-2 flex items-center gap-3"><Count label="Antes" n={nAntes} /><Count label="Durante" n={nDurante} /><Count label="Depois" n={nDepois} /></div>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={onRegistrarDurante} className="flex-1 min-h-[40px] rounded-lg border border-border text-fg-secondary text-[11px] font-bold uppercase hover:border-border-strong flex items-center justify-center gap-1"><span className="material-symbols-outlined text-sm">add_a_photo</span>Durante</button>
        <button type="button" onClick={onRegistrarDepois} className={`flex-1 min-h-[40px] rounded-lg text-[11px] font-bold uppercase flex items-center justify-center gap-1 ${nDepois === 0 ? 'bg-primary text-white hover:bg-primary-hover' : 'border border-border text-fg-secondary hover:border-border-strong'}`}><span className="material-symbols-outlined text-sm">add_a_photo</span>Depois</button>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
const CentralBlock: React.FC<{
  title: string; subtitle: string; required?: boolean;
  photos: FieldPhoto[]; previewFor: (p: FieldPhoto) => string | undefined;
  onAdd: () => void; onOpen: (p: FieldPhoto) => void;
  text: string; onText: (v: string) => void; placeholder: string;
}> = ({ title, subtitle, required, photos, previewFor, onAdd, onOpen, text, onText, placeholder }) => (
  <div className="rounded-lg border border-primary/40 bg-primary-soft/30 p-2.5">
    <p className="text-[11px] font-bold uppercase tracking-wide text-primary">{title}</p>
    <p className="text-[10px] font-semibold text-fg-secondary mb-1.5">{subtitle}{required && <span className="text-danger"> *</span>}</p>
    <div className="flex flex-wrap gap-2">
      {photos.map((p) => (
        <button type="button" key={p.id} onClick={() => onOpen(p)} className="w-14 h-14 rounded-lg overflow-hidden border border-border bg-surface-3 shrink-0">
          {previewFor(p)
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={previewFor(p)} alt="Central" className="w-full h-full object-cover" />
            : <span className="w-full h-full flex items-center justify-center"><span className="material-symbols-outlined text-fg-muted">image</span></span>}
        </button>
      ))}
      <button type="button" onClick={onAdd} className="w-14 h-14 rounded-lg border border-dashed border-border text-fg-secondary hover:border-primary hover:text-primary flex flex-col items-center justify-center shrink-0"><span className="material-symbols-outlined text-lg">add_a_photo</span><span className="text-[8px] font-bold uppercase">Foto</span></button>
    </div>
    <textarea value={text} onChange={(e) => onText(e.target.value)} rows={2} placeholder={placeholder} className="mt-2 w-full rounded-lg border border-border bg-surface text-fg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25" />
  </div>
);

/* -------------------------------------------------------------------------- */
interface NewItemForm { title: string; category: EvidenceItemCategory; equipmentType?: string; location: string; deviceAddress: string; notes: string; }
const NewItemSheet: React.FC<{
  capture: { file: File; url: string };
  catalog: TechnicalCatalogItem[]; area?: string; categoryOptions: EvidenceCategoryOption[];
  onCancel: () => void;
  onSave: (form: NewItemForm, equipment?: EquipmentIdentification) => Promise<void>;
}> = ({ capture, catalog, area, categoryOptions, onCancel, onSave }) => {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [titleTouched, setTitleTouched] = useState(false);
  const [opt, setOpt] = useState<EvidenceCategoryOption | undefined>();
  const [location, setLocation] = useState('');
  const [deviceAddress, setDeviceAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [equipment, setEquipment] = useState<EquipmentIdentification | undefined>();
  const [busy, setBusy] = useState(false);

  const showEquipment = !!opt && (opt.coarse === 'EQUIPAMENTO' || opt.coarse === 'CENTRAL');

  const pickCategory = (value: string) => {
    const found = categoryOptions.find((o) => o.value === value);
    setOpt(found);
    if (found && !titleTouched && !title.trim()) setTitle(found.label); // §28 sugere, não força
    setEquipment(undefined);
  };

  const save = async () => {
    if (!title.trim()) { toast.error('Informe um título para o item.'); return; }
    setBusy(true);
    try { await onSave({ title: title.trim(), category: opt?.coarse || 'OUTRO', equipmentType: opt?.subcategory, location, deviceAddress, notes }, equipment); }
    catch { toast.error('Não foi possível registrar o item.'); setBusy(false); }
  };

  return (
    <Sheet title="Novo item" onClose={onCancel}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={capture.url} alt="Prévia" className="max-h-[34vh] w-full rounded-xl bg-slate-900 object-contain" />
      <label className="block">
        <span className="text-[10px] font-bold uppercase text-fg-muted">Categoria</span>
        <PickerField
          sheetTitle="Selecionar categoria" placeholder="Selecionar categoria" searchPlaceholder="Buscar categoria..."
          emptyLabel="Nenhuma categoria disponível." value={opt?.value || ''} onChange={pickCategory}
          options={categoryOptions.map((o) => ({ id: o.value, name: o.label }))}
          triggerClassName="mt-1 w-full flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-fg-secondary"
        />
      </label>
      <label className="block">
        <span className="text-[10px] font-bold uppercase text-fg-muted">Título</span>
        <input value={title} onChange={(e) => { setTitle(e.target.value); setTitleTouched(true); }} placeholder="Ex.: Sirene com avaria" className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25" />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block"><span className="text-[10px] font-bold uppercase text-fg-muted">Endereço do dispositivo</span><input value={deviceAddress} onChange={(e) => setDeviceAddress(e.target.value)} placeholder="Ex.: 42" className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25" /></label>
        <label className="block"><span className="text-[10px] font-bold uppercase text-fg-muted">Local / setor</span><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ex.: Corredor" className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25" /></label>
      </div>
      {showEquipment && <EquipmentIdentifier value={equipment} onChange={setEquipment} catalog={catalog} area={area} subcategory={opt?.subcategory} />}
      <label className="block"><span className="text-[10px] font-bold uppercase text-fg-muted">Observação</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Opcional" className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25" /></label>
      <SheetActions onCancel={onCancel} onConfirm={save} busy={busy} confirmLabel="Salvar item" />
    </Sheet>
  );
};

/* -------------------------------------------------------------------------- */
const MOMENT_TITLE: Record<FieldPhotoMoment, string> = {
  ANTES: 'Antes', DURANTE: 'Durante', DEPOIS: 'Depois', CENTRAL_ANTES: 'Central na chegada', CENTRAL_DEPOIS: 'Central na saída',
};
const CapturePanel: React.FC<{
  capture: { file: File; url: string; moment: FieldPhotoMoment };
  catalog: TechnicalCatalogItem[]; area?: string; allowEquipment: boolean;
  onCancel: () => void; onSave: (note: string, equipment?: EquipmentIdentification) => Promise<void>;
}> = ({ capture, catalog, area, allowEquipment, onCancel, onSave }) => {
  const [note, setNote] = useState('');
  const [equipment, setEquipment] = useState<EquipmentIdentification | undefined>();
  const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); try { await onSave(note, equipment); } catch { setBusy(false); } };
  return (
    <Sheet title={MOMENT_TITLE[capture.moment]} onClose={onCancel}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={capture.url} alt="Prévia" className="max-h-[40vh] w-full rounded-xl bg-slate-900 object-contain" />
      {allowEquipment && <EquipmentIdentifier value={equipment} onChange={setEquipment} catalog={catalog} area={area} />}
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Observação (opcional)" className="w-full rounded-lg border border-border bg-surface text-fg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25" />
      <SheetActions onCancel={onCancel} onConfirm={save} busy={busy} confirmLabel="Salvar evidência" />
    </Sheet>
  );
};

/* -------------------------------------------------------------------------- */
const ItemDetail: React.FC<{
  item: ServiceAttendanceEvidenceItem; photos: FieldPhoto[]; previewFor: (p: FieldPhoto) => string | undefined;
  catalog: TechnicalCatalogItem[]; area?: string; categoryOptions: EvidenceCategoryOption[];
  onClose: () => void; onOpenPhoto: (p: FieldPhoto) => void;
  onAdd: (moment: FieldPhotoMoment) => void;
  onSaveEdit: (patch: Partial<ServiceAttendanceEvidenceItem>) => Promise<void>;
  onDelete: () => void;
}> = ({ item, photos, previewFor, catalog, area, categoryOptions, onClose, onOpenPhoto, onAdd, onSaveEdit, onDelete }) => {
  const [editing, setEditing] = useState(false);
  const mine = photos.filter((p) => p.evidenceItemId === item.id);
  const group = (m: FieldPhotoMoment) => mine.filter((p) => p.evidenceMoment === m);
  const subtitle = [item.manufacturer, item.model].filter(Boolean).join(' ');

  const Row = ({ moment, label }: { moment: FieldPhotoMoment; label: string }) => (
    <div>
      <p className="text-[10px] font-bold uppercase text-fg-secondary mb-1">{label}</p>
      <div className="flex flex-wrap gap-2">
        {group(moment).map((p) => (
          <button type="button" key={p.id} onClick={() => onOpenPhoto(p)} className="w-16 h-16 rounded-lg overflow-hidden border border-border bg-surface-3 shrink-0">
            {previewFor(p)
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={previewFor(p)} alt={label} className="w-full h-full object-cover" />
              : <span className="w-full h-full flex items-center justify-center"><span className="material-symbols-outlined text-fg-muted">image</span></span>}
          </button>
        ))}
        <button type="button" onClick={() => onAdd(moment)} className="w-16 h-16 rounded-lg border border-dashed border-border text-fg-secondary hover:border-primary hover:text-primary flex flex-col items-center justify-center shrink-0"><span className="material-symbols-outlined text-lg">add_a_photo</span><span className="text-[8px] font-bold uppercase">Foto</span></button>
      </div>
    </div>
  );

  if (editing) {
    return <ItemEditSheet item={item} catalog={catalog} area={area} categoryOptions={categoryOptions} onCancel={() => setEditing(false)} onSave={async (patch) => { await onSaveEdit(patch); setEditing(false); }} />;
  }

  return (
    <Sheet title={item.title} onClose={onClose}>
      <div className="rounded-lg bg-surface-2 p-2.5">
        <p className="text-[11px] font-bold text-fg">{item.equipmentType || EVIDENCE_CATEGORY_LABEL[item.category]}</p>
        {subtitle && <p className="text-[11px] text-fg-secondary">{subtitle}</p>}
        {(item.deviceAddress || item.location) && <p className="text-[11px] text-fg-muted">{[item.deviceAddress ? `Endereço ${item.deviceAddress}` : '', item.location].filter(Boolean).join(' · ')}</p>}
        {item.notes && <p className="mt-1 text-[11px] text-fg-secondary whitespace-pre-wrap">{item.notes}</p>}
      </div>
      <Row moment="ANTES" label="Antes" />
      <Row moment="DURANTE" label="Durante" />
      <Row moment="DEPOIS" label="Depois" />
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={() => setEditing(true)} className="flex-1 min-h-[44px] rounded-lg border border-border text-fg-secondary text-xs font-bold uppercase hover:border-border-strong">Editar item</button>
        <button type="button" onClick={onDelete} className="min-h-[44px] px-4 rounded-lg bg-red-50 text-red-700 text-xs font-bold uppercase hover:bg-red-100">Excluir</button>
      </div>
    </Sheet>
  );
};

const ItemEditSheet: React.FC<{
  item: ServiceAttendanceEvidenceItem; catalog: TechnicalCatalogItem[]; area?: string; categoryOptions: EvidenceCategoryOption[];
  onCancel: () => void; onSave: (patch: Partial<ServiceAttendanceEvidenceItem>) => Promise<void>;
}> = ({ item, catalog, area, categoryOptions, onCancel, onSave }) => {
  const initialOpt = categoryOptions.find((o) => (item.equipmentType && o.subcategory === item.equipmentType)) || categoryOptions.find((o) => !o.subcategory && o.coarse === item.category);
  const [title, setTitle] = useState(item.title);
  const [opt, setOpt] = useState<EvidenceCategoryOption | undefined>(initialOpt);
  const [location, setLocation] = useState(item.location || '');
  const [deviceAddress, setDeviceAddress] = useState(item.deviceAddress || '');
  const [notes, setNotes] = useState(item.notes || '');
  const [equipment, setEquipment] = useState<EquipmentIdentification | undefined>(
    item.manufacturer || item.model ? { catalogItemId: item.catalogItemId, brand: item.manufacturer, model: item.model, manual: !item.catalogItemId } : undefined
  );
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const showEquipment = !!opt && (opt.coarse === 'EQUIPAMENTO' || opt.coarse === 'CENTRAL');
  const save = async () => {
    if (!title.trim()) { toast.error('Informe um título.'); return; }
    setBusy(true);
    try { await onSave({ title: title.trim(), category: opt?.coarse || item.category, equipmentType: opt?.subcategory, location, deviceAddress, notes, ...equipmentToItemFields(equipment) }); }
    catch { toast.error('Não foi possível salvar.'); setBusy(false); }
  };
  return (
    <Sheet title="Editar item" onClose={onCancel}>
      <label className="block"><span className="text-[10px] font-bold uppercase text-fg-muted">Categoria</span>
        <PickerField sheetTitle="Selecionar categoria" placeholder="Selecionar categoria" searchPlaceholder="Buscar categoria..." emptyLabel="Nenhuma categoria disponível."
          value={opt?.value || ''} onChange={(v) => setOpt(categoryOptions.find((o) => o.value === v))}
          options={categoryOptions.map((o) => ({ id: o.value, name: o.label }))}
          triggerClassName="mt-1 w-full flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-fg-secondary" />
      </label>
      <label className="block"><span className="text-[10px] font-bold uppercase text-fg-muted">Título</span><input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25" /></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block"><span className="text-[10px] font-bold uppercase text-fg-muted">Endereço</span><input value={deviceAddress} onChange={(e) => setDeviceAddress(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25" /></label>
        <label className="block"><span className="text-[10px] font-bold uppercase text-fg-muted">Local</span><input value={location} onChange={(e) => setLocation(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25" /></label>
      </div>
      {showEquipment && <EquipmentIdentifier value={equipment} onChange={setEquipment} catalog={catalog} area={area} subcategory={opt?.subcategory} />}
      <label className="block"><span className="text-[10px] font-bold uppercase text-fg-muted">Observação</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25" /></label>
      <SheetActions onCancel={onCancel} onConfirm={save} busy={busy} confirmLabel="Salvar" />
    </Sheet>
  );
};

/* -------------------------------------------------------------------------- */
const PhotoViewer: React.FC<{
  photo: FieldPhoto; url?: string; catalog: TechnicalCatalogItem[]; area?: string;
  onClose: () => void;
  onSaveMeta: (patch: { notaRapida?: string; equipmentCatalogItemId?: string; equipmentBrand?: string; equipmentModel?: string }) => Promise<void>;
  onDelete: () => void;
}> = ({ photo, url, catalog, area, onClose, onSaveMeta, onDelete }) => {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(photo.notaRapida || '');
  const [equipment, setEquipment] = useState<EquipmentIdentification | undefined>(
    photo.equipmentBrand || photo.equipmentModel ? { catalogItemId: photo.equipmentCatalogItemId, brand: photo.equipmentBrand, model: photo.equipmentModel, manual: !photo.equipmentCatalogItemId } : undefined
  );
  const [busy, setBusy] = useState(false);
  const captured = photo.capturadoEm ? new Date(photo.capturadoEm) : null;

  const save = async () => {
    setBusy(true);
    try { await onSaveMeta({ notaRapida: note, equipmentCatalogItemId: equipment?.catalogItemId, equipmentBrand: equipment?.brand, equipmentModel: equipment?.model }); setEditing(false); }
    catch { /* mantém */ } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[96] flex flex-col bg-slate-900/90 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <button onClick={onClose} className="text-white/80 hover:text-white text-2xl leading-none">×</button>
        <div className="flex gap-3">
          <button onClick={() => setEditing((v) => !v)} className="text-white/80 hover:text-white flex items-center gap-1 text-xs font-bold uppercase"><span className="material-symbols-outlined text-lg">edit</span>Editar</button>
          <button onClick={onDelete} className="text-red-300 hover:text-red-200 flex items-center gap-1 text-xs font-bold uppercase"><span className="material-symbols-outlined text-lg">delete</span>Excluir</button>
        </div>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center p-2">
        {url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={url} alt="Evidência" className="max-h-full max-w-full object-contain" />
          : <span className="text-white/60">Prévia indisponível</span>}
      </div>
      <div className="bg-surface p-4 max-h-[55vh] overflow-y-auto flex flex-col gap-2">
        <p className="text-[11px] text-fg-secondary">{photo.evidenceMoment ? `${MOMENT_TITLE[photo.evidenceMoment]} · ` : ''}{captured ? captured.toLocaleString('pt-BR') : ''}</p>
        {!editing ? (
          <>
            {(photo.equipmentBrand || photo.equipmentModel) && <p className="text-sm font-semibold text-fg">{[photo.equipmentBrand, photo.equipmentModel].filter(Boolean).join(' ')}</p>}
            {photo.notaRapida && <p className="text-sm text-fg-secondary whitespace-pre-wrap">{photo.notaRapida}</p>}
            {!photo.notaRapida && !photo.equipmentBrand && !photo.equipmentModel && <p className="text-[11px] text-fg-muted">Sem observação.</p>}
          </>
        ) : (
          <>
            <EquipmentIdentifier value={equipment} onChange={setEquipment} catalog={catalog} area={area} />
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Observação" className="w-full rounded-lg border border-border bg-surface text-fg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25" />
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="px-4 py-2.5 rounded-lg bg-surface-3 text-xs font-bold uppercase text-fg-secondary">Cancelar</button>
              <button onClick={save} disabled={busy} className="flex-1 min-h-[44px] rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-bold uppercase disabled:opacity-60">{busy ? 'Salvando…' : 'Salvar'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
const Sheet: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-[92] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="bg-surface w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <p className="text-sm font-bold text-fg truncate">{title}</p>
        <button onClick={onClose} className="text-fg-muted hover:text-fg-secondary text-2xl leading-none shrink-0">×</button>
      </div>
      <div className="overflow-y-auto p-4 flex flex-col gap-3">{children}</div>
    </div>
  </div>
);

const SheetActions: React.FC<{ onCancel: () => void; onConfirm: () => void; busy?: boolean; confirmLabel: string }> = ({ onCancel, onConfirm, busy, confirmLabel }) => (
  <div className="flex gap-2 pt-1">
    <button type="button" onClick={onCancel} className="px-4 py-2.5 rounded-lg bg-surface-3 text-xs font-bold uppercase text-fg-secondary">Cancelar</button>
    <button type="button" onClick={onConfirm} disabled={busy} className="flex-1 min-h-[44px] rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-bold uppercase tracking-wide disabled:opacity-60">{busy ? 'Salvando…' : confirmLabel}</button>
  </div>
);
