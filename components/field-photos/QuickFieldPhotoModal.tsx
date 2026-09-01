'use client';

import React, { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Client } from '@/lib/types';
import { FieldPhoto, FieldPhotoMarker, FieldPhotoSession, newFieldPhoto, newFieldPhotoSession } from '@/lib/fieldPhotos';
import { createFireowlEvidence } from '@/lib/fieldPhotoEvidence';
import { enqueueFieldPhoto, enqueueFieldPhotoComparison, enqueueFieldPhotoSession } from '@/lib/offline/fieldPhotoSync';
import { flushOutbox, isOnline, offlineAvailable } from '@/lib/offline/reportSync';
import { buildFieldPhotoPath, signedFieldPhotoUrl } from '@/lib/fieldPhotoStorage';
import { useConfirm, useToast } from '@/components/ui/Feedback';
import { ClientSelector } from '@/components/clients/ClientSelector';
import type { GalleryPhoto } from '@/lib/fieldPhotosGallery';
import type { ComparisonResult } from '@/lib/fieldPhotoComparisons';
import { capturePosition, reverseGeocode } from '@/lib/fieldPhotoGeo';

type SavedPhoto = { photo: FieldPhoto; original: Blob; evidence?: Blob; previewUrl: string; evidenceUrl?: string; synced: boolean };
const MARKERS: { value: FieldPhotoMarker; label: string; tone: string }[] = [
  { value: 'antes', label: 'Antes', tone: 'bg-sky-50 text-sky-700 border-sky-200' },
  { value: 'depois', label: 'Depois', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'falha', label: 'Falha', tone: 'bg-red-50 text-red-700 border-red-200' },
  { value: 'corrigido', label: 'Corrigido', tone: 'bg-violet-50 text-violet-700 border-violet-200' },
  { value: 'pendente', label: 'Pendente', tone: 'bg-amber-50 text-amber-700 border-amber-200' },
];

interface Props {
  isOpen: boolean;
  clients: Client[];
  technicianId?: string;
  technicianName: string;
  onClose: () => void;
  afterReference?: GalleryPhoto;
  onComparisonCreated?: () => void;
}

export const QuickFieldPhotoModal: React.FC<Props> = ({ isOpen, clients, technicianId, technicianName, onClose, afterReference, onComparisonCreated }) => {
  const toast = useToast();
  const confirm = useConfirm();
  const inputRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<SavedPhoto[]>([]);
  const [clientId, setClientId] = useState('');
  const [sector, setSector] = useState('');
  const [session, setSession] = useState<FieldPhotoSession | null>(null);
  const [photos, setPhotos] = useState<SavedPhoto[]>([]);
  const [current, setCurrent] = useState<{ file: File; capturedAt: string; url: string } | null>(null);
  const [marker, setMarker] = useState<FieldPhotoMarker>('falha');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState(false);
  const [showPhotos, setShowPhotos] = useState(false);
  const [opened, setOpened] = useState<SavedPhoto | null>(null);
  const [geo,setGeo]=useState<Awaited<ReturnType<typeof capturePosition>>>();
  const [comparisonResult,setComparisonResult]=useState<ComparisonResult>('corrigido');
  const client = useMemo(() => clients.find((item) => item.id === clientId), [clients, clientId]);
  const pending = photos.filter((photo) => !photo.synced).length;

  useEffect(() => { photosRef.current = photos; }, [photos]);

  const releaseCurrent = React.useCallback(() => setCurrent((value) => { if (value) URL.revokeObjectURL(value.url); return null; }), []);
  const reset = React.useCallback(() => {
    releaseCurrent();
    setPhotos((items) => { items.forEach((photo) => { URL.revokeObjectURL(photo.previewUrl); if (photo.evidenceUrl) URL.revokeObjectURL(photo.evidenceUrl); }); return []; });
    setClientId(''); setSector(''); setSession(null); setMarker('falha'); setNote(''); setSummary(false); setShowPhotos(false); setOpened(null);
  }, [releaseCurrent]);
  useEffect(() => () => { releaseCurrent(); }, [releaseCurrent]);
  useEffect(() => { if (!isOpen) reset(); }, [isOpen, reset]);
  useEffect(()=>{if(isOpen&&afterReference){setClientId(afterReference.clientId);setSector(afterReference.localSetor||'');setMarker('depois');}},[isOpen,afterReference]);

  const sync = async () => {
    if (!isOnline()) return;
    try {
      const result = await flushOutbox();
      // A fila remove jobs confirmados; como a sessão atual é local, refletimos o êxito sem recarregar a tela.
      if (result.failed > 0) return;
      setPhotos((items) => items.map((item) => ({ ...item, synced: true })));
      await Promise.all(photosRef.current.map(async (item) => {
        try {
          const evidenceUrl = await signedFieldPhotoUrl(item.photo.storagePathEvidencia || item.photo.storagePathOriginal);
          if (item.evidenceUrl?.startsWith('blob:')) URL.revokeObjectURL(item.evidenceUrl);
          setPhotos((latest) => latest.map((entry) => entry.photo.clientUuid === item.photo.clientUuid ? { ...entry, evidenceUrl } : entry));
        } catch { /* a visualização local permanece disponível */ }
      }));
    } catch { /* o job permanece no IDB e o retry aplica backoff */ }
  };

  const start = async () => {
    if (!client || !technicianId) { toast.error(!technicianId ? 'Sessão do técnico indisponível. Faça login novamente.' : 'Selecione um cliente.'); return; }
    if (!offlineAvailable()) { toast.error('Este navegador não disponibiliza armazenamento local para o Registro Rápido.'); return; }
    const created = newFieldPhotoSession({ clientId: client.id, tecnicoId: technicianId, tecnicoNome: technicianName, localSetor: sector.trim() || undefined });
    try {
      await enqueueFieldPhotoSession(created);
      setSession(created);
      setTimeout(() => { void sync(); }, 0);
    } catch { toast.error('Não foi possível salvar a sessão neste aparelho.'); }
  };

  const capture = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !file.type.startsWith('image/')) { if (file) toast.error('Selecione uma imagem válida.'); return; }
    releaseCurrent();
    const capturedAt=new Date().toISOString();setCurrent({ file, capturedAt, url: URL.createObjectURL(file) });
    const position=await capturePosition();setGeo(position ? await reverseGeocode(position) : undefined);
  };

  const savePhoto = async (finishAfter = false) => {
    if (!session || !client || !current || busy) return;
    setBusy(true);
    const captured = current;
    const basePhoto = newFieldPhoto({ sessionId: session.id, clientId: client.id, storagePathOriginal: '', notaRapida: note.trim() || undefined, marcador: afterReference?'depois':marker, geo }, captured.capturedAt);
    const pathBase = { technicianId: session.tecnicoId, sessionClientUuid: session.clientUuid, photoClientUuid: basePhoto.clientUuid };
    const photo = {
      ...basePhoto,
      storagePathOriginal: buildFieldPhotoPath({ ...pathBase, asset: 'original' }),
      storagePathEvidencia: buildFieldPhotoPath({ ...pathBase, asset: 'evidence' }),
    };
    let evidence: Blob | undefined;
    let evidenceUrl: string | undefined;
    try {
      evidence = await createFireowlEvidence(captured.file, photo, session, client.name);
      evidenceUrl = URL.createObjectURL(evidence);
    } catch { toast.info('Foto salva. A evidência será gerada novamente na sincronização.'); }
    try {
      await enqueueFieldPhoto({ photo, session, original: captured.file, evidence, clientName: client.name });
      if(afterReference&&technicianId){await enqueueFieldPhotoComparison({ownerUserId:technicianId,comparison:{beforePhotoId:afterReference.id,afterPhotoId:photo.id,clientId:client.id,reportId:afterReference.reportId,osId:afterReference.osId,pendenciaId:afterReference.pendenciaId,resultado:comparisonResult}});onComparisonCreated?.();}
      setPhotos((items) => [...items, { photo, original: captured.file, evidence, previewUrl: captured.url, evidenceUrl, synced: false }]);
      setCurrent(null); // a URL passa a pertencer ao card salvo e será liberada no reset.
      setNote(''); setMarker('falha');
      void sync();
      if (finishAfter) await finalize(false);
    } catch {
      if (evidenceUrl) URL.revokeObjectURL(evidenceUrl);
      toast.error('Não foi possível salvar a foto neste aparelho. Tente novamente.');
    } finally { setBusy(false); }
  };

  const finalize = async (confirmUnsaved = true) => {
    if (!session) return;
    if (current && confirmUnsaved && !(await confirm({ title: 'Foto ainda não salva', message: 'Finalizar descarta a foto atual. Deseja continuar?', confirmLabel: 'Descartar e finalizar', danger: true }))) return;
    if (current) releaseCurrent();
    const finished = { ...session, finalizadoEm: new Date().toISOString(), syncStatus: 'pendente' as const };
    try {
      await enqueueFieldPhotoSession(finished);
      setSession(finished); setSummary(true); void sync();
    } catch { toast.error('Não foi possível finalizar localmente. Suas fotos continuam salvas.'); }
  };

  const close = async () => {
    if (current && !(await confirm({ title: 'Descartar foto atual?', message: 'A foto ainda não foi salva no aparelho.', confirmLabel: 'Descartar', danger: true }))) return;
    reset(); onClose();
  };

  if (!isOpen) return null;
  const label = (value?: FieldPhotoMarker) => MARKERS.find((item) => item.value === value)?.label || 'Sem marcador';
  return <div className="fixed inset-0 z-[80] bg-slate-950/55 backdrop-blur-sm sm:flex sm:items-center sm:justify-center sm:p-5">
    <div role="dialog" aria-modal="true" aria-label="Registro rápido" className="h-[100dvh] w-full overflow-y-auto bg-slate-50 sm:h-auto sm:max-h-[92vh] sm:max-w-2xl sm:rounded-2xl sm:shadow-2xl">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:rounded-t-2xl">
        <div><p className="text-sm font-bold text-slate-900">Registro Rápido</p><p className="text-[11px] text-slate-500">Fotos de campo independentes</p></div>
        <button onClick={close} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Fechar"><span className="material-symbols-outlined">close</span></button>
      </header>
      <main className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {!session ? <div className="mx-auto max-w-md space-y-4 py-5">
          <ClientSelector clients={clients} value={clientId} onChange={setClientId} label="Cliente *" />
          {afterReference&&<div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-800"><strong>Registrar Depois</strong><p className="mt-1">A nova foto será relacionada à evidência anterior sem duplicar arquivos.</p></div>}
          <div><label className="text-xs font-bold uppercase tracking-wide text-slate-600">Local / setor</label><input value={sector} onChange={(e) => setSector(e.target.value)} placeholder="Ex.: Bloco B · Casa de máquinas" className="mt-1.5 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm" /></div>
          <button onClick={start} disabled={!clientId || !technicianId} className="min-h-14 w-full rounded-xl bg-[#1A1A72] px-4 text-sm font-bold uppercase tracking-wide text-white disabled:opacity-50">Iniciar registro</button>
        </div> : summary ? <div className="mx-auto max-w-md space-y-5 py-7 text-center"><span className="material-symbols-outlined rounded-full bg-emerald-100 p-4 text-4xl text-emerald-600">task_alt</span><div><h2 className="text-xl font-bold text-slate-900">Registro concluído</h2><p className="mt-1 text-sm text-slate-500">{client?.name}{session.localSetor ? ` · ${session.localSetor}` : ''}</p></div><div className="grid grid-cols-2 gap-3 text-left"><div className="rounded-xl bg-white p-3"><p className="text-[10px] font-bold uppercase text-slate-400">Fotos</p><p className="text-xl font-bold">{photos.length}</p></div><div className="rounded-xl bg-white p-3"><p className="text-[10px] font-bold uppercase text-slate-400">Pendentes</p><p className="text-xl font-bold">{pending}</p></div></div><button onClick={() => setShowPhotos(true)} className="min-h-12 w-full rounded-xl border border-[#1A1A72] text-sm font-bold uppercase text-[#1A1A72]">Ver fotos</button><button onClick={close} className="min-h-12 w-full rounded-xl bg-[#1A1A72] text-sm font-bold uppercase text-white">Voltar ao painel</button></div> : <>
          <div className="mb-4 rounded-xl bg-white p-3 shadow-sm"><p className="truncate text-sm font-bold text-slate-900">{client?.name}</p><p className="mt-0.5 text-[11px] text-slate-500">{session.localSetor || 'Sem local definido'} · Fotos: {photos.length}</p><p className={`mt-2 text-[10px] font-bold uppercase ${isOnline() && pending === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>{isOnline() && pending === 0 ? 'Sincronizado' : `${pending || photos.length} pendente(s) de sincronização`}</p></div>
          {!current ? <button onClick={() => inputRef.current?.click()} className="flex min-h-56 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#1A1A72]/30 bg-[#1A1A72]/5 text-[#1A1A72]"><span className="material-symbols-outlined text-5xl">photo_camera</span><span className="mt-3 text-sm font-bold uppercase">Tirar foto</span><span className="mt-1 text-xs text-slate-500">Câmera traseira no celular</span></button> : <div className="space-y-4"><img src={current.url} alt="Prévia da foto capturada" className="max-h-[46vh] w-full rounded-2xl bg-slate-900 object-contain" />{afterReference?<div><p className="mb-2 text-xs font-bold uppercase text-slate-600">Resultado</p><div className="grid grid-cols-1 gap-2">{([['corrigido','Corrigido'],['parcial','Parcialmente corrigido'],['pendente','Continua pendente']] as [ComparisonResult,string][]).map(([v,l])=><button key={v} onClick={()=>setComparisonResult(v)} className={`min-h-11 rounded-xl border text-xs font-bold ${comparisonResult===v?'border-[#1A1A72] bg-[#1A1A72]/5 text-[#1A1A72]':'border-slate-200'}`}>{l}</button>)}</div></div>:<div><p className="mb-2 text-xs font-bold uppercase text-slate-600">Marcador</p><div className="flex flex-wrap gap-2">{MARKERS.map((item) => <button key={item.value} onClick={() => setMarker(item.value)} className={`min-h-10 rounded-full border px-3 text-xs font-bold ${marker === item.value ? item.tone + ' ring-2 ring-offset-1 ring-[#1A1A72]/30' : 'border-slate-200 bg-white text-slate-600'}`}>{item.label}</button>)}</div></div>}<textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota rápida (opcional)" className="min-h-24 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm" /></div>}
          <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={capture} />
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">{current && <button onClick={releaseCurrent} disabled={busy} className="min-h-12 rounded-xl border border-slate-300 bg-white text-xs font-bold uppercase text-slate-700">Descartar</button>}{current && <button onClick={() => savePhoto(false)} disabled={busy} className="min-h-12 rounded-xl bg-[#1A1A72] px-3 text-xs font-bold uppercase text-white disabled:opacity-60">{busy ? 'Preparando foto…' : 'Salvar e tirar outra'}</button>}<button onClick={() => finalize()} disabled={busy} className="min-h-12 rounded-xl bg-slate-800 px-3 text-xs font-bold uppercase text-white disabled:opacity-60">Finalizar</button></div>
          {photos.length > 0 && <button onClick={() => setShowPhotos(true)} className="mt-3 w-full text-xs font-bold uppercase text-[#1A1A72]">Ver fotos desta sessão ({photos.length})</button>}
        </>}
      </main>
      {showPhotos && <div className="fixed inset-0 z-[90] overflow-y-auto bg-slate-50 p-4"><header className="mx-auto flex max-w-2xl items-center justify-between pb-4"><div><p className="font-bold">Fotos da sessão</p><p className="text-xs text-slate-500">{photos.length} registradas</p></div><button onClick={() => setShowPhotos(false)} className="rounded-lg p-2"><span className="material-symbols-outlined">close</span></button></header><div className="mx-auto grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-3">{photos.map((item) => <button key={item.photo.clientUuid} onClick={() => setOpened(item)} className="overflow-hidden rounded-xl bg-white text-left shadow-sm"><img src={item.evidenceUrl || item.previewUrl} alt="Foto de campo" className="aspect-square w-full object-cover"/><div className="p-2"><p className="text-[10px] font-bold uppercase text-slate-700">{label(item.photo.marcador)}</p><p className="mt-0.5 truncate text-[11px] text-slate-500">{item.photo.notaRapida || new Date(item.photo.capturadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p><p className={`mt-1 text-[9px] font-bold uppercase ${item.synced ? 'text-emerald-600' : 'text-amber-600'}`}>{item.synced ? 'Sincronizada' : 'Pendente'}</p></div></button>)}</div></div>}
      {opened && <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/80 p-4"><div className="max-h-full w-full max-w-3xl overflow-auto rounded-2xl bg-white p-3"><div className="mb-2 flex justify-between"><p className="text-sm font-bold">Evidência</p><button onClick={() => setOpened(null)}><span className="material-symbols-outlined">close</span></button></div><img src={opened.evidenceUrl || opened.previewUrl} alt="Evidência da foto" className="max-h-[72vh] w-full rounded-xl object-contain" />{!opened.evidenceUrl && <p className="mt-2 text-xs text-amber-700">Evidência pendente — exibindo original.</p>}<button onClick={() => setOpened((item) => item && ({ ...item, evidenceUrl: undefined }))} className="mt-3 text-xs font-bold uppercase text-[#1A1A72]">Ver original</button></div></div>}
    </div>
  </div>;
};
