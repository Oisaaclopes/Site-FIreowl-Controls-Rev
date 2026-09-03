'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Client, OrdemServico, Pendencia, ReportInstance, UserRole } from '@/lib/types';
import { useConfirm, useToast } from '@/components/ui/Feedback';
import { FieldPhotoMarker } from '@/lib/fieldPhotos';
import {
  applyFieldPhotoFilters,
  attachClientNames,
  FieldPhotoFilters,
  FieldPhotoLinks,
  friendlyPhotoId,
  groupFieldPhotosByClient,
  GalleryPhoto,
  isUnclassified,
  listLocalFieldPhotos,
  listRemoteFieldPhotos,
  mergeFieldPhotos,
  updateFieldPhotoLinks,
} from '@/lib/fieldPhotosGallery';
import { signedFieldPhotoUrl, signedFieldPhotoUrls } from '@/lib/fieldPhotoStorage';
import { PhotoSheetConfigModal } from '@/components/field-photos/PhotoSheetConfigModal';
import { ComparisonsPanel } from '@/components/field-photos/ComparisonsPanel';
import { ComparisonCreateModal } from '@/components/field-photos/ComparisonCreateModal';
import { FieldPhotoComparison, listComparisons, PAIR_INVALID_MESSAGE, ResolvedComparison, validateComparisonPair } from '@/lib/fieldPhotoComparisons';
import { flushOutbox, isOnline } from '@/lib/offline/reportSync';
import { fetchReports } from '@/lib/reports';
import { fetchOrdensServico } from '@/lib/ordensServico';
import { fetchPendencias } from '@/lib/pendencias';
import { fetchAssignableTechnicians } from '@/lib/users';
import { QuickFieldPhotoModal } from './QuickFieldPhotoModal';
import { gpsLabel } from '@/lib/fieldPhotoGeo';
import { shareEvidence } from '@/lib/fieldPhotoShare';
import { useDomainRefresh } from '@/lib/realtime/RealtimeProvider';

type ManagedTech = { id: string; name: string };

const MARKER_META: Record<FieldPhotoMarker, { label: string; tone: string }> = {
  antes: { label: 'Antes', tone: 'bg-sky-50 text-sky-700 border-sky-200' },
  depois: { label: 'Depois', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  falha: { label: 'Falha', tone: 'bg-red-50 text-red-700 border-red-200' },
  corrigido: { label: 'Corrigido', tone: 'bg-violet-50 text-violet-700 border-violet-200' },
  pendente: { label: 'Pendente', tone: 'bg-amber-50 text-amber-700 border-amber-200' },
};
const SYNC_META: Record<GalleryPhoto['syncStatus'], { label: string; tone: string }> = {
  sincronizado: { label: 'Sincronizado', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  pendente: { label: 'Pendente', tone: 'bg-amber-50 text-amber-700 border-amber-200' },
  erro: { label: 'Erro', tone: 'bg-red-50 text-red-700 border-red-200' },
};
const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const fmtTime = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');

interface Props {
  clients: Client[];
  userRole: UserRole;
  technicianId?: string;
  technicianName: string;
}

export const FotosDeCampoView: React.FC<Props> = ({ clients, userRole, technicianId, technicianName }) => {
  const toast = useToast();
  const confirm = useConfirm();
  const isManager = userRole === 'ADMINISTRATIVO' || userRole === 'GESTOR';

  const [tab, setTab] = useState<'todas' | 'pendentes' | 'comparacoes'>('todas');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [comparisons, setComparisons] = useState<FieldPhotoComparison[]>([]);
  const [comparePair, setComparePair] = useState<{ a: GalleryPhoto; b: GalleryPhoto } | null>(null);
  const [sheetComparisons, setSheetComparisons] = useState<ResolvedComparison[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState<FieldPhotoFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [groupByDay, setGroupByDay] = useState(false);
  const [techs, setTechs] = useState<ManagedTech[]>([]);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<GalleryPhoto | null>(null);
  const [linkTarget, setLinkTarget] = useState<{ photos: GalleryPhoto[] } | null>(null);
  const [sheetPhotos, setSheetPhotos] = useState<GalleryPhoto[] | null>(null);
  const [afterReference,setAfterReference]=useState<GalleryPhoto|null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [remote, local, comps] = await Promise.all([
        listRemoteFieldPhotos().catch((e) => { toast.error('Não foi possível carregar as fotos remotas.'); void e; return [] as GalleryPhoto[]; }),
        listLocalFieldPhotos().catch(() => [] as GalleryPhoto[]),
        listComparisons().catch(() => [] as FieldPhotoComparison[]),
      ]);
      setPhotos(attachClientNames(mergeFieldPhotos(remote, local), clients));
      setComparisons(comps);
    } finally {
      setLoading(false);
    }
  }, [clients, toast]);

  useEffect(() => { void load(); }, [load]);
  useDomainRefresh('fieldPhotos', load);
  useEffect(() => { if (isManager) fetchAssignableTechnicians().then((list) => setTechs(list.map((u) => ({ id: u.id, name: u.name })))).catch(() => {}); }, [isManager]);

  // Miniaturas: blobs locais viram object URL (revogados no cleanup deste efeito);
  // evidências remotas são assinadas em lote. Uma única requisição de signed URLs.
  useEffect(() => {
    let alive = true;
    const created: string[] = [];
    const next: Record<string, string> = {};
    for (const p of photos) {
      if (p.source === 'local') {
        const blob = p.localEvidence || p.localOriginal;
        if (blob) { const u = URL.createObjectURL(blob); created.push(u); next[p.clientUuid] = u; }
      }
    }
    setThumbs(next);
    const remotePaths = photos.filter((p) => p.source === 'remote').map((p) => p.storagePathEvidencia || p.storagePathOriginal).filter(Boolean) as string[];
    if (remotePaths.length) {
      signedFieldPhotoUrls(remotePaths).then((signed) => {
        if (!alive) return;
        setThumbs((prev) => {
          const merged = { ...prev };
          for (const p of photos) {
            if (p.source !== 'remote') continue;
            const path = p.storagePathEvidencia || p.storagePathOriginal;
            if (path && signed[path]) merged[p.clientUuid] = signed[path];
          }
          return merged;
        });
      }).catch(() => { /* miniaturas remotas podem falhar sem quebrar a lista */ });
    }
    return () => { alive = false; created.forEach((u) => URL.revokeObjectURL(u)); };
  }, [photos]);

  const visible = useMemo(() => {
    const f: FieldPhotoFilters = { ...filters, clientId: selectedClientId || undefined, marcador: tab === 'pendentes' ? 'pendente' : filters.marcador };
    return applyFieldPhotoFilters(photos, f);
  }, [photos, filters, tab, selectedClientId]);

  const clientGroups = useMemo(() => groupFieldPhotosByClient(photos, clients, comparisons), [photos, clients, comparisons]);
  const selectedGroup = clientGroups.find(g=>g.clientId===selectedClientId);
  const clientComparisons = comparisons.filter(c=>!selectedClientId || c.clientId===selectedClientId);
  const activeFilterCount = ['clientId', 'tecnicoId', 'marcador', 'syncStatus', 'from', 'to'].filter((k) => (filters as any)[k]).length;

  const toggleSelect = (uuid: string) => setSelection((prev) => { const n = new Set(prev); n.has(uuid) ? n.delete(uuid) : n.add(uuid); return n; });
  const clearSelection = () => setSelection(new Set());

  const retry = async (p?: GalleryPhoto) => {
    if (!isOnline()) { toast.error('Sem conexão para sincronizar agora.'); return; }
    toast.info('Sincronizando…');
    const res = await flushOutbox();
    await load();
    if (res.failed > 0) toast.error('Alguns registros ainda não sincronizaram.');
    else toast.success('Sincronização concluída.');
    void p;
  };

  const groups = useMemo(() => {
    if (!groupByDay) return [{ key: '', items: visible }];
    const map = new Map<string, GalleryPhoto[]>();
    for (const p of visible) { const k = (p.capturadoEm || '').slice(0, 10); (map.get(k) || map.set(k, []).get(k)!).push(p); }
    return Array.from(map.entries()).map(([key, items]) => ({ key, items }));
  }, [visible, groupByDay]);

  const selectedPhotos = useMemo(() => visible.filter((p) => selection.has(p.clientUuid)), [visible, selection]);
  const photoById = useMemo(() => new Map(photos.map((p) => [p.id, p] as const)), [photos]);
  const reloadComparisons = useCallback(async () => { try { setComparisons(await listComparisons()); } catch { /* mantém a lista atual */ } }, []);

  const startCompare = () => {
    const v = validateComparisonPair(selectedPhotos);
    if (!v.ok) { toast.error(PAIR_INVALID_MESSAGE[v.reason!]); return; }
    setComparePair({ a: selectedPhotos[0], b: selectedPhotos[1] });
  };

  return (
    <div className="mx-auto max-w-7xl px-3 py-4 sm:px-5 sm:py-6">
      {/* Cabeçalho + tabs */}
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined rounded-xl bg-navy p-2 text-white">photo_library</span>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-fg sm:text-xl">{selectedGroup ? selectedGroup.clientName : 'Fotos de Campo'}</h1>
            <p className="text-xs text-fg-secondary">{selectedGroup ? `${selectedGroup.photoCount} evidência(s) deste cliente` : 'Selecione um cliente para abrir a galeria.'}</p>
          </div>
          {selectedClientId&&<button onClick={()=>{setSelectedClientId(null);setTab('todas');setSelection(new Set())}} className="ml-auto min-h-10 rounded-lg border border-border-strong bg-surface px-3 text-xs font-bold uppercase text-fg-secondary">← Clientes</button>}
        </div>
        {selectedClientId&&(
        <div className="flex items-center gap-1 rounded-xl bg-surface-3 p-1 text-xs font-bold">
          <button onClick={() => setTab('todas')} className={`min-h-9 flex-1 rounded-lg px-3 uppercase tracking-wide transition-colors ${tab === 'todas' ? 'bg-surface text-primary shadow-sm' : 'text-fg-secondary'}`}>Todas</button>
          <button onClick={() => setTab('pendentes')} className={`min-h-9 flex-1 rounded-lg px-3 uppercase tracking-wide transition-colors ${tab === 'pendentes' ? 'bg-surface text-primary shadow-sm' : 'text-fg-secondary'}`}>
            Pendentes{selectedGroup?.pendingCount ? ` · ${selectedGroup.pendingCount}` : ''}
          </button>
          <button onClick={() => setTab('comparacoes')} className={`min-h-9 flex-1 rounded-lg px-3 uppercase tracking-wide transition-colors ${tab === 'comparacoes' ? 'bg-surface text-primary shadow-sm' : 'text-fg-secondary'}`}>
            Antes × Depois{clientComparisons.length > 0 ? ` · ${clientComparisons.length}` : ''}
          </button>
        </div>
        )}
      </div>

      {/* Busca + ações (fotos) — ocultas na aba de comparações */}
      {selectedClientId && tab !== 'comparacoes' && (
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <span className="material-symbols-outlined pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-lg text-fg-muted">search</span>
          <input
            value={filters.search || ''}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            placeholder="Buscar por cliente, local ou nota"
            className="min-h-11 w-full rounded-xl border border-border-strong bg-surface pl-9 pr-3 text-sm"
          />
        </div>
        <button onClick={() => setShowFilters(true)} className="relative min-h-11 rounded-xl border border-border-strong bg-surface px-3 text-xs font-bold uppercase text-fg-secondary">
          <span className="material-symbols-outlined align-middle text-base">tune</span>
          <span className="ml-1 hidden sm:inline">Filtros</span>
          {activeFilterCount > 0 && <span className="ml-1 rounded-full bg-navy px-1.5 text-[10px] text-white">{activeFilterCount}</span>}
        </button>
        <button onClick={() => setGroupByDay((v) => !v)} title="Agrupar por dia" className={`min-h-11 rounded-xl border px-3 text-xs font-bold uppercase ${groupByDay ? 'border-primary bg-navy/5 text-primary' : 'border-border-strong bg-surface text-fg-secondary'}`}>
          <span className="material-symbols-outlined align-middle text-base">calendar_view_day</span>
        </button>
        <button onClick={() => retry()} title="Sincronizar pendências" className="min-h-11 rounded-xl border border-border-strong bg-surface px-3 text-xs font-bold uppercase text-fg-secondary">
          <span className="material-symbols-outlined align-middle text-base">sync</span>
        </button>
      </div>
      )}

      {/* Barra de seleção em lote */}
      {selectedClientId && tab !== 'comparacoes' && selection.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/20 bg-navy/5 p-2.5">
          <span className="text-xs font-bold text-primary">{selection.size} selecionada(s)</span>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setSheetPhotos(selectedPhotos)} className="min-h-9 rounded-lg bg-danger px-3 text-xs font-bold uppercase text-white">
              <span className="material-symbols-outlined align-middle text-sm">picture_as_pdf</span> Folha de Fotos
            </button>
            <button onClick={startCompare} className="min-h-9 rounded-lg border border-primary bg-surface px-3 text-xs font-bold uppercase text-primary">
              <span className="material-symbols-outlined align-middle text-sm">compare</span> Antes × Depois
            </button>
            <button onClick={() => setLinkTarget({ photos: selectedPhotos })} className="min-h-9 rounded-lg bg-navy px-3 text-xs font-bold uppercase text-white">Vincular</button>
            <button onClick={clearSelection} className="min-h-9 rounded-lg border border-border-strong bg-surface px-3 text-xs font-bold uppercase text-fg-secondary">Limpar</button>
          </div>
        </div>
      )}

      {/* Conteúdo */}
      {!selectedClientId ? (
        loading ? <div className="py-20 text-center text-sm text-fg-muted">Carregando clientes…</div> : clientGroups.length===0 ? <div className="py-20 text-center text-sm text-fg-muted">Nenhum cliente possui fotos de campo.</div> :
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{clientGroups.map(group=>{const cover=group.photos[0];return <button key={group.clientId} onClick={()=>setSelectedClientId(group.clientId)} className="flex min-h-24 items-center gap-3 rounded-xl border border-border bg-surface p-3 text-left shadow-sm hover:border-primary/40">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-surface-3">{thumbs[cover.clientUuid]?<img src={thumbs[cover.clientUuid]} alt="Última evidência" className="h-full w-full object-cover"/>:<span className="material-symbols-outlined flex h-full items-center justify-center text-fg-muted">photo_library</span>}</div>
          <div className="min-w-0"><p className="truncate text-sm font-bold text-fg">{group.clientName}</p><p className="mt-1 text-[11px] text-fg-secondary">{group.photoCount} foto(s) · última {fmtDate(group.lastEvidenceAt)}</p><div className="mt-2 flex flex-wrap gap-1">{group.pendingCount>0&&<span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">{group.pendingCount} pendente(s)</span>}{group.comparisonCount>0&&<span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{group.comparisonCount} Antes×Depois</span>}</div></div>
        </button>})}</div>
      ) : tab === 'comparacoes' ? (
        <ComparisonsPanel comparisons={clientComparisons} photoById={photoById} thumbs={thumbs} onReload={reloadComparisons} onGenerateSheet={(items) => setSheetComparisons(items)} />
      ) : loading ? (
        <div className="py-20 text-center text-sm text-fg-muted">Carregando fotos…</div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-fg-muted">
          <span className="material-symbols-outlined mb-2 text-5xl text-fg-muted">{tab === 'pendentes' ? 'task_alt' : 'no_photography'}</span>
          <p className="font-semibold text-fg-secondary">{tab === 'pendentes' ? 'Nenhuma foto pendente para este cliente.' : 'Nenhuma foto de campo registrada.'}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <div key={g.key || 'all'}>
              {groupByDay && g.key && <p className="mb-2 text-xs font-bold uppercase tracking-wide text-fg-secondary">{fmtDate(g.key)}</p>}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {g.items.map((p) => (
                  <PhotoCard
                    key={p.clientUuid}
                    photo={p}
                    thumb={thumbs[p.clientUuid]}
                    selected={selection.has(p.clientUuid)}
                    onToggleSelect={() => toggleSelect(p.clientUuid)}
                    onOpen={() => setDetail(p)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showFilters && (
        <FiltersSheet
          filters={filters}
          onChange={setFilters}
          onClose={() => setShowFilters(false)}
          clients={clients}
          techs={techs}
          showTechFilter={isManager}
        />
      )}

      {detail && (
        <PhotoDetail
          photo={detail}
          clients={clients}
          onClose={() => setDetail(null)}
          onLink={() => setLinkTarget({ photos: [detail] })}
          onRetry={() => retry(detail)}
          hasComparison={comparisons.some(c=>c.beforePhotoId===detail.id)}
          onRegisterAfter={()=>{setAfterReference(detail);setDetail(null)}}
        />
      )}
      <QuickFieldPhotoModal isOpen={!!afterReference} clients={clients} technicianId={technicianId} technicianName={technicianName} afterReference={afterReference||undefined} onClose={()=>setAfterReference(null)} onComparisonCreated={()=>toast.success('Correção registrada. A relação será sincronizada automaticamente.')} />

      {linkTarget && (
        <LinkDialog
          photos={linkTarget.photos}
          userRole={userRole}
          onClose={() => setLinkTarget(null)}
          confirm={confirm}
          toast={toast}
          onDone={async () => { setLinkTarget(null); clearSelection(); setDetail(null); await load(); }}
        />
      )}

      {sheetPhotos && (
        <PhotoSheetConfigModal photos={sheetPhotos} onClose={() => setSheetPhotos(null)} />
      )}

      {sheetComparisons && (
        <PhotoSheetConfigModal comparisons={sheetComparisons} onClose={() => setSheetComparisons(null)} />
      )}

      {comparePair && (
        <ComparisonCreateModal
          a={comparePair.a}
          b={comparePair.b}
          thumbs={thumbs}
          existing={comparisons}
          onClose={() => setComparePair(null)}
          onDone={async () => { setComparePair(null); clearSelection(); await reloadComparisons(); }}
        />
      )}
    </div>
  );
};

/* --------------------------------- Card --------------------------------- */

const LinkBadges: React.FC<{ p: FieldPhotoLinks }> = ({ p }) => {
  const items = [p.reportId && 'Atend.', p.osId && 'OS', p.pendenciaId && 'Pend.'].filter(Boolean) as string[];
  if (items.length === 0) return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">Não classificada</span>;
  return <>{items.map((i) => <span key={i} className="rounded-full bg-navy/10 px-2 py-0.5 text-[10px] font-bold text-primary">{i}</span>)}</>;
};

const PhotoCard: React.FC<{ photo: GalleryPhoto; thumb?: string; selected: boolean; onToggleSelect: () => void; onOpen: () => void }> = ({ photo, thumb, selected, onToggleSelect, onOpen }) => {
  const marker = photo.marcador ? MARKER_META[photo.marcador] : null;
  const sync = SYNC_META[photo.syncStatus];
  return (
    <div className={`group relative flex flex-col overflow-hidden rounded-xl border bg-surface transition-all ${selected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-border-strong'}`}>
      <div className="relative aspect-square bg-slate-900">
        {thumb ? <img src={thumb} alt="Evidência de campo" className="h-full w-full object-cover" loading="lazy" /> : <div className="flex h-full items-center justify-center text-fg-secondary"><span className="material-symbols-outlined text-3xl">image</span></div>}
        <button onClick={onToggleSelect} className={`absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg shadow ${selected ? 'bg-navy text-white' : 'bg-black/40 text-white/80 hover:bg-black/60'}`} aria-label="Selecionar">
          <span className="material-symbols-outlined text-base">{selected ? 'check' : 'check_box_outline_blank'}</span>
        </button>
        <span className={`absolute right-2 top-2 rounded-full border px-2 py-0.5 text-[10px] font-bold ${sync.tone}`}>{sync.label}</span>
        <button onClick={onOpen} className="absolute inset-0" aria-label="Abrir detalhe" />
        <div className="pointer-events-none absolute bottom-2 left-2 right-2 flex items-center justify-between text-[10px] font-bold text-white">
          <span className="rounded bg-black/55 px-1.5 py-0.5">{friendlyPhotoId(photo.clientUuid)}</span>
          {marker && <span className={`rounded-full border px-2 py-0.5 ${marker.tone}`}>{marker.label}</span>}
        </div>
      </div>
      <button onClick={onOpen} className="flex flex-1 flex-col gap-0.5 p-2 text-left">
        <p className="truncate text-[11px] font-semibold text-fg-secondary">{photo.localSetor || 'Sem local'}</p>
        <p className="text-[10px] text-fg-muted">{fmtDate(photo.capturadoEm)} · {fmtTime(photo.capturadoEm)}</p>
      </button>
    </div>
  );
};

/* ------------------------------ Filtros (sheet) ------------------------------ */

const FiltersSheet: React.FC<{ filters: FieldPhotoFilters; onChange: (f: FieldPhotoFilters) => void; onClose: () => void; clients: Client[]; techs: ManagedTech[]; showTechFilter: boolean }> = ({ filters, onChange, onClose, clients, techs, showTechFilter }) => {
  const set = (patch: Partial<FieldPhotoFilters>) => onChange({ ...filters, ...patch });
  const markers: FieldPhotoMarker[] = ['antes', 'depois', 'falha', 'corrigido', 'pendente'];
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/50 sm:items-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-t-2xl bg-surface p-5 shadow-2xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-fg">Filtros</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-fg-muted hover:bg-surface-3"><span className="material-symbols-outlined">close</span></button>
        </div>
        <div className="space-y-3">
          <label className="block text-xs font-bold uppercase text-fg-secondary">Cliente
            <select value={filters.clientId || ''} onChange={(e) => set({ clientId: e.target.value || undefined })} className="mt-1 min-h-11 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm font-normal normal-case text-fg">
              <option value="">Todos</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          {showTechFilter && (
            <label className="block text-xs font-bold uppercase text-fg-secondary">Técnico
              <select value={filters.tecnicoId || ''} onChange={(e) => set({ tecnicoId: e.target.value || undefined })} className="mt-1 min-h-11 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm font-normal normal-case text-fg">
                <option value="">Todos</option>
                {techs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-bold uppercase text-fg-secondary">De
              <input type="date" value={filters.from || ''} onChange={(e) => set({ from: e.target.value || undefined })} className="mt-1 min-h-11 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm font-normal text-fg" />
            </label>
            <label className="block text-xs font-bold uppercase text-fg-secondary">Até
              <input type="date" value={filters.to || ''} onChange={(e) => set({ to: e.target.value || undefined })} className="mt-1 min-h-11 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm font-normal text-fg" />
            </label>
          </div>
          <label className="block text-xs font-bold uppercase text-fg-secondary">Marcador
            <select value={filters.marcador || ''} onChange={(e) => set({ marcador: (e.target.value || undefined) as FieldPhotoMarker | undefined })} className="mt-1 min-h-11 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm font-normal normal-case text-fg">
              <option value="">Todos</option>
              {markers.map((m) => <option key={m} value={m}>{MARKER_META[m].label}</option>)}
            </select>
          </label>
          <label className="block text-xs font-bold uppercase text-fg-secondary">Sincronização
            <select value={filters.syncStatus || ''} onChange={(e) => set({ syncStatus: (e.target.value || undefined) as GalleryPhoto['syncStatus'] | undefined })} className="mt-1 min-h-11 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm font-normal normal-case text-fg">
              <option value="">Todas</option>
              <option value="sincronizado">Sincronizado</option>
              <option value="pendente">Pendente</option>
              <option value="erro">Erro</option>
            </select>
          </label>
        </div>
        <div className="mt-5 flex gap-2">
          <button onClick={() => onChange({ search: filters.search })} className="min-h-11 flex-1 rounded-xl border border-border-strong bg-surface text-xs font-bold uppercase text-fg-secondary">Limpar</button>
          <button onClick={onClose} className="min-h-11 flex-1 rounded-xl bg-navy text-xs font-bold uppercase text-white">Aplicar</button>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------- Detalhe ------------------------------- */

const PhotoDetail: React.FC<{ photo: GalleryPhoto; clients: Client[]; onClose: () => void; onLink: () => void; onRetry: () => void; hasComparison:boolean; onRegisterAfter:()=>void }> = ({ photo, onClose, onLink, onRetry, hasComparison, onRegisterAfter }) => {
  const [view, setView] = useState<'evidence' | 'original' | 'markup'>('evidence');
  const [url, setUrl] = useState<string | undefined>();
  const objs = useRef<string[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      objs.current.forEach((u) => URL.revokeObjectURL(u)); objs.current = [];
      setUrl(undefined);
      if (photo.source === 'local') {
        const blob = view === 'original' ? photo.localOriginal : view === 'markup' ? photo.localMarkup : (photo.localEvidence || photo.localOriginal);
        if (blob) { const u = URL.createObjectURL(blob); objs.current.push(u); if (alive) setUrl(u); }
      } else {
        const path = view === 'original' ? photo.storagePathOriginal : view === 'markup' ? photo.storagePathMarkup : (photo.storagePathEvidencia || photo.storagePathOriginal);
        if (path) { try { const u = await signedFieldPhotoUrl(path); if (alive) setUrl(u); } catch { /* mantém indisponível */ } }
      }
    })();
    return () => { alive = false; objs.current.forEach((u) => URL.revokeObjectURL(u)); objs.current = []; };
  }, [photo, view]);

  const hasMarkup = !!(photo.storagePathMarkup || photo.localMarkup);
  const canLink = photo.source === 'remote';
  const share=async()=>{if(view!=='evidence')setView('evidence');try{const blob=photo.localEvidence||(url?await(await fetch(url)).blob():undefined);if(!blob)throw new Error();await shareEvidence(blob,`Evidencia-Fireowl-${photo.clientUuid.slice(0,8)}.jpg`);}catch{/* fallback indisponível é informado pela ausência da ação */}};
  const meta: [string, string | undefined][] = [
    ['Cliente', photo.clientName || photo.clientId],
    ['Local / Setor', photo.localSetor],
    ['Capturada em', `${fmtDate(photo.capturadoEm)} · ${fmtTime(photo.capturadoEm)}`],
    ['Técnico', photo.tecnicoNome],
    ['Marcador', photo.marcador ? MARKER_META[photo.marcador].label : undefined],
    ['Endereço GPS', gpsLabel(photo.geo)],
    ['Atendimento', photo.reportId?'Vinculado':undefined],['OS',photo.osId?'Vinculada':undefined],['Pendência',photo.pendenciaId?'Vinculada':undefined],['Antes × Depois',hasComparison?'Correção registrada':undefined],['Sincronização',SYNC_META[photo.syncStatus].label],
  ];

  return (
    <div className="fixed inset-0 z-[85] flex items-stretch justify-end bg-slate-950/60" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex h-full w-full max-w-lg flex-col overflow-y-auto bg-surface shadow-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-white/95 px-4 py-3 backdrop-blur">
          <p className="text-sm font-bold text-fg">{friendlyPhotoId(photo.clientUuid)}</p>
          <button onClick={onClose} className="rounded-lg p-1.5 text-fg-muted hover:bg-surface-3"><span className="material-symbols-outlined">close</span></button>
        </header>
        <div className="p-4">
          <div className="mb-2 flex gap-1 rounded-lg bg-surface-3 p-1 text-[11px] font-bold">
            <button onClick={() => setView('evidence')} className={`flex-1 rounded px-2 py-1.5 uppercase ${view === 'evidence' ? 'bg-surface text-primary shadow-sm' : 'text-fg-secondary'}`}>Evidência</button>
            <button onClick={() => setView('original')} className={`flex-1 rounded px-2 py-1.5 uppercase ${view === 'original' ? 'bg-surface text-primary shadow-sm' : 'text-fg-secondary'}`}>Original</button>
            {hasMarkup && <button onClick={() => setView('markup')} className={`flex-1 rounded px-2 py-1.5 uppercase ${view === 'markup' ? 'bg-surface text-primary shadow-sm' : 'text-fg-secondary'}`}>Markup</button>}
          </div>
          <div className="flex min-h-56 items-center justify-center overflow-hidden rounded-xl bg-slate-900">
            {url ? <img src={url} alt="Foto de campo" className="max-h-[52vh] w-full object-contain" /> : <span className="p-10 text-xs text-fg-muted">Imagem indisponível offline.</span>}
          </div>

          <dl className="mt-4 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
            {meta.filter(([, v]) => v).map(([k, v]) => (
              <div key={k} className="min-w-0"><dt className="text-[10px] font-bold uppercase text-fg-muted">{k}</dt><dd className="truncate text-sm text-fg">{v}</dd></div>
            ))}
          </dl>
          {photo.notaRapida && <div className="mt-3"><p className="text-[10px] font-bold uppercase text-fg-muted">Nota</p><p className="text-sm text-fg-secondary">{photo.notaRapida}</p></div>}
          {view==='evidence'&&<button onClick={share} className="mt-3 min-h-11 w-full rounded-xl border border-primary bg-surface text-xs font-bold uppercase text-primary">Compartilhar evidência</button>}
          {hasComparison?<p className="mt-3 rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-700">✓ Correção registrada</p>:photo.source==='remote'&&<button onClick={onRegisterAfter} className="mt-3 min-h-12 w-full rounded-xl bg-danger text-xs font-bold uppercase text-white">Registrar Depois</button>}

          <div className="mt-4 rounded-xl border border-border p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase text-fg-muted">Vínculos</p>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${SYNC_META[photo.syncStatus].tone}`}>{SYNC_META[photo.syncStatus].label}</span>
            </div>
            <div className="flex flex-wrap gap-1.5"><LinkBadges p={photo} /></div>
            {photo.source === 'remote'
              ? <button onClick={onLink} className="mt-3 min-h-10 w-full rounded-lg bg-navy text-xs font-bold uppercase text-white">Vincular</button>
              : <p className="mt-3 text-[11px] text-amber-700">Sincronize a foto antes de vincular.</p>}
            {photo.source === 'local' && photo.syncStatus === 'erro' && (
              <>
                {photo.lastError && <p className="mt-2 break-words text-[11px] text-red-600">{photo.lastError}</p>}
                <button onClick={onRetry} className="mt-2 min-h-10 w-full rounded-lg border border-red-300 bg-red-50 text-xs font-bold uppercase text-red-700">Tentar sincronizar</button>
              </>
            )}
          </div>
          {!canLink && photo.source === 'local' && photo.syncStatus === 'pendente' && (
            <button onClick={onRetry} className="mt-3 min-h-10 w-full rounded-lg border border-border-strong bg-surface text-xs font-bold uppercase text-fg-secondary">Sincronizar agora</button>
          )}
        </div>
      </div>
    </div>
  );
};

/* ------------------------------ Diálogo de vínculo ------------------------------ */

type LinkKind = 'report' | 'os' | 'pendencia';
const LinkDialog: React.FC<{
  photos: GalleryPhoto[];
  userRole: UserRole;
  onClose: () => void;
  onDone: () => Promise<void>;
  confirm: (o: { title: string; message?: string; confirmLabel?: string; danger?: boolean }) => Promise<boolean>;
  toast: { success: (m: string) => void; error: (m: string) => void; info: (m: string) => void };
}> = ({ photos, userRole, onClose, onDone, confirm, toast }) => {
  const [kind, setKind] = useState<LinkKind>('os');
  const [reports, setReports] = useState<ReportInstance[]>([]);
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const remotePhotos = photos.filter((p) => p.source === 'remote');
  const clientId = photos.length === 1 ? photos[0].clientId : undefined;
  const single = photos.length === 1 ? photos[0] : undefined;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      fetchReports(clientId ? { clienteId: clientId } : undefined).catch(() => [] as ReportInstance[]),
      fetchOrdensServico(clientId ? { clienteId: clientId } : undefined).catch(() => [] as OrdemServico[]),
      fetchPendencias(userRole, clientId ? { clienteId: clientId } : undefined).catch(() => [] as Pendencia[]),
    ]).then(([r, o, p]) => { if (alive) { setReports(r); setOrdens(o); setPendencias(p); setLoading(false); } });
    return () => { alive = false; };
  }, [clientId, userRole]);

  const apply = async (patch: FieldPhotoLinks, label: string) => {
    if (remotePhotos.length === 0) { toast.error('Sincronize a(s) foto(s) antes de vincular.'); return; }
    setBusy(true);
    try {
      await Promise.all(remotePhotos.map((p) => updateFieldPhotoLinks(p.id, patch)));
      toast.success(label);
      await onDone();
    } catch { toast.error('Não foi possível atualizar o vínculo.'); }
    finally { setBusy(false); }
  };

  const removeLink = async (field: keyof FieldPhotoLinks, name: string) => {
    if (!(await confirm({ title: 'Remover vínculo?', message: `A foto deixará de apontar para ${name}.`, confirmLabel: 'Remover', danger: true }))) return;
    await apply({ [field]: undefined } as FieldPhotoLinks, 'Vínculo removido.');
  };

  const current = single ? { report: single.reportId, os: single.osId, pendencia: single.pendenciaId } : undefined;
  const skipped = photos.length - remotePhotos.length;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/60 sm:items-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-surface shadow-2xl sm:rounded-2xl">
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="text-sm font-bold text-fg">Vincular {photos.length > 1 ? `${remotePhotos.length} fotos` : 'foto'}</p>
            <p className="text-[11px] text-fg-secondary">Não duplica arquivos — apenas o relacionamento.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-fg-muted hover:bg-surface-3"><span className="material-symbols-outlined">close</span></button>
        </header>

        {skipped > 0 && <p className="bg-amber-50 px-4 py-2 text-[11px] text-amber-700">{skipped} foto(s) local(is) serão ignoradas — sincronize antes de vincular.</p>}

        <div className="flex gap-1 border-b border-border px-4 py-2 text-[11px] font-bold">
          {([['os', 'OS'], ['report', 'Atendimento'], ['pendencia', 'Pendência']] as [LinkKind, string][]).map(([k, label]) => (
            <button key={k} onClick={() => setKind(k)} className={`flex-1 rounded-lg px-2 py-1.5 uppercase ${kind === k ? 'bg-navy text-white' : 'bg-surface-3 text-fg-secondary'}`}>{label}</button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? <p className="py-10 text-center text-sm text-fg-muted">Carregando…</p> : (
            <>
              {kind === 'os' && (
                <LinkList
                  current={current?.os}
                  emptyLabel="Nenhuma OS acessível para este cliente."
                  onRemove={current?.os ? () => removeLink('osId', 'esta OS') : undefined}
                  items={ordens.map((o) => ({ id: o.id, title: o.numero || `OS ${o.id.slice(0, 6)}`, subtitle: [o.titulo, o.status].filter(Boolean).join(' · ') }))}
                  onPick={(id) => apply({ osId: id }, 'Foto vinculada à OS.')}
                  busy={busy}
                />
              )}
              {kind === 'report' && (
                <LinkList
                  current={current?.report}
                  emptyLabel="Nenhum atendimento acessível para este cliente."
                  onRemove={current?.report ? () => removeLink('reportId', 'este atendimento') : undefined}
                  items={reports.map((r) => ({ id: r.id, title: r.numero || r.titulo || `Atendimento ${r.id.slice(0, 6)}`, subtitle: [r.tipo, r.local, r.status].filter(Boolean).join(' · ') }))}
                  onPick={(id) => apply({ reportId: id }, 'Foto vinculada ao atendimento.')}
                  busy={busy}
                />
              )}
              {kind === 'pendencia' && (
                <LinkList
                  current={current?.pendencia}
                  emptyLabel="Nenhuma pendência acessível para este cliente."
                  onRemove={current?.pendencia ? () => removeLink('pendenciaId', 'esta pendência') : undefined}
                  items={pendencias.map((p) => ({ id: p.id, title: p.descricao?.slice(0, 60) || p.grupo || `Pendência ${p.id.slice(0, 6)}`, subtitle: [p.local, p.status].filter(Boolean).join(' · ') }))}
                  onPick={(id) => apply({ pendenciaId: id }, 'Foto vinculada à pendência.')}
                  busy={busy}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const LinkList: React.FC<{ items: { id: string; title: string; subtitle?: string }[]; current?: string; onPick: (id: string) => void; onRemove?: () => void; emptyLabel: string; busy: boolean }> = ({ items, current, onPick, onRemove, emptyLabel, busy }) => {
  if (items.length === 0) return <p className="py-8 text-center text-sm text-fg-muted">{emptyLabel}</p>;
  return (
    <div className="space-y-1.5">
      {onRemove && <button disabled={busy} onClick={onRemove} className="mb-2 min-h-10 w-full rounded-lg border border-red-200 bg-red-50 text-xs font-bold uppercase text-red-700">Remover vínculo atual</button>}
      {items.map((it) => {
        const isCurrent = current === it.id;
        return (
          <button key={it.id} disabled={busy || isCurrent} onClick={() => onPick(it.id)} className={`flex w-full items-center justify-between gap-2 rounded-xl border p-2.5 text-left ${isCurrent ? 'border-primary bg-navy/5' : 'border-border hover:border-border-strong'}`}>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-fg">{it.title}</p>
              {it.subtitle && <p className="truncate text-[11px] text-fg-secondary">{it.subtitle}</p>}
            </div>
            {isCurrent ? <span className="shrink-0 rounded-full bg-navy px-2 py-0.5 text-[10px] font-bold text-white">Atual</span> : <span className="material-symbols-outlined shrink-0 text-fg-muted">link</span>}
          </button>
        );
      })}
    </div>
  );
};
