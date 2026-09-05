'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { Client, Device, UserRole, ClientTechnicalCredential, TechnicalBackup, DeviceVerification, AssetConditionValue } from '@/lib/types';
import {
  TechArea, AREAS, AREA_LABEL, CONDITIONS, CONDITION_LABEL, SOURCE_LABEL,
  groupsForArea, assetDisplayIdentifier, legacyGroupLabel,
} from '@/lib/technicalBase';
import { upsertDevice } from '@/lib/devices';
import { addVerification, fetchVerificationsForDevice } from '@/lib/deviceVerifications';
import {
  summarizeCentrals, summarizeGroups, duplicateGroups, centralAddressAnomalies,
  importReview, sortDevicesForArea, filterDevices, fabricantesInArea,
  OriginFilter, VerifFilter, GroupSummary,
} from '@/lib/technicalBaseSummary';
import { fetchCredentials, createCredential, revealCredentialSecret, deleteCredential } from '@/lib/clientCredentials';
import {
  fetchBackups, uploadBackup, signedBackupUrl, markBackupCurrent, deleteBackup, BACKUP_DISCLAIMER,
} from '@/lib/technicalBackups';
import { Badge } from '@/components/DataListRow';
import { EmptyState } from '@/components/EmptyState';
import { showToast, requestConfirm } from '@/components/ui/Feedback';
import { isSupabaseConfigured } from '@/lib/inventory';
import { TechnicalSurveyFlow } from '@/components/clients/TechnicalSurveyFlow';
import { TechnicalBaseImport } from '@/components/clients/TechnicalBaseImport';
import { AssetDetailDrawer } from '@/components/clients/AssetDetailDrawer';
import { fetchTechnicalCatalog, TechnicalCatalogItem } from '@/lib/technicalCatalog';
import { TechnicalAssetFields } from '@/components/clients/TechnicalAssetFields';
import { AssetFormValues, emptyAssetValues, firstInvalidField, buildDevicePatch, deviceToAssetValues } from '@/lib/technicalAssetForm';
import { FILE_TYPES, fileTypeLabel, fileTypeIcon, fmtFileSize, deviceOptionLabel } from '@/lib/technicalFiles';

/* ==========================================================================
 * ETAPA 3D — BASE TÉCNICA PERMANENTE (Cliente 360).
 * Consome o motor multidisciplinar (lib/technicalBase) para renderizar, de forma
 * ADAPTADA por disciplina, o parque instalado (devices), suas credenciais
 * protegidas (segredo isolado) e os backups técnicos (bucket privado). Read-first
 * + cadastro manual pelo formulário adaptativo. Fonte única (devices/RLS).
 * ========================================================================== */

const isGestao = (r: UserRole) => r === 'ADMINISTRATIVO' || r === 'GESTOR';

const CONDITION_COLOR: Record<AssetConditionValue, 'emerald' | 'amber' | 'red' | 'slate' | 'blue'> = {
  NORMAL: 'emerald', COM_AVARIA: 'amber', INOPERANTE: 'red',
  NAO_TESTADO: 'slate', NAO_LOCALIZADO: 'red', INADEQUADO: 'amber',
};

interface Props {
  client: Client;
  userRole: UserRole;
  devices: Device[] | null;
  onDevicesChanged: () => void;
}

export const ClientTechnicalBase: React.FC<Props> = ({ client, userRole, devices, onDevicesChanged }) => {
  const [area, setArea] = useState<TechArea>('SDAI');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showSurvey, setShowSurvey] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [verifDevice, setVerifDevice] = useState<Device | null>(null);
  const [detailDevice, setDetailDevice] = useState<Device | null>(null);
  const [editDevice, setEditDevice] = useState<Device | null>(null);
  const [catalog, setCatalog] = useState<TechnicalCatalogItem[]>([]);
  // §33 — filtro de ciclo de vida (padrão: só ativos instalados).
  const [lifecycle, setLifecycle] = useState<'ativos' | 'substituidos' | 'removidos' | 'todos'>('ativos');
  // Filtros e seleção (§8/§12/§27).
  const [groupFilter, setGroupFilter] = useState('');
  const [origem, setOrigem] = useState<OriginFilter>('todos');
  const [verif, setVerif] = useState<VerifFilter>('todos');
  const [condFilter, setCondFilter] = useState('');
  const [fabFilter, setFabFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showDup, setShowDup] = useState(false);
  const canManage = isGestao(userRole);

  // Ao trocar de área/aba, zera seleção e filtros específicos (evita ids órfãos).
  useEffect(() => { setSelected(new Set()); setGroupFilter(''); setShowDup(false); }, [area]);

  // Catálogo técnico (só identificação: área/família/fabricante/modelo — sem preço).
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let alive = true;
    fetchTechnicalCatalog().then((c) => { if (alive) setCatalog(c); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const matchesLifecycle = (d: Device): boolean => {
    if (lifecycle === 'todos') return true;
    if (lifecycle === 'ativos') return d.status === 'ativo';
    if (lifecycle === 'substituidos') return d.status === 'substituido';
    return d.status === 'removido';
  };

  // Ativos da área (fonte dos resumos/duplicados — §26/§29).
  const areaAll = useMemo(() => (devices || []).filter((d) => d.sistema === area), [devices, area]);
  const centrals = useMemo(() => summarizeCentrals(area, areaAll), [area, areaAll]);
  const groupSummary = useMemo(() => summarizeGroups(area, areaAll), [area, areaAll]);
  const centralGroupNames = useMemo(() => new Set(centrals.map((c) => c.group)), [centrals]);
  const peripheralSummary = useMemo(() => groupSummary.filter((g) => !centralGroupNames.has(g.group)), [groupSummary, centralGroupNames]);
  const dupGroups = useMemo(() => duplicateGroups(area, areaAll), [area, areaAll]);
  const anomalies = useMemo(() => centralAddressAnomalies(area, areaAll), [area, areaAll]);
  const review = useMemo(() => importReview(area, areaAll), [area, areaAll]);
  const fabricantes = useMemo(() => fabricantesInArea(areaAll), [areaAll]);
  const dupCandidateCount = useMemo(() => dupGroups.reduce((a, g) => a + g.devices.length, 0) + anomalies.length, [dupGroups, anomalies]);

  const countsByArea = useMemo(() => {
    const m: Record<string, number> = {};
    for (const d of devices || []) if (d.status === 'ativo' && !d.removedAt) m[d.sistema] = (m[d.sistema] || 0) + 1;
    return m;
  }, [devices]);

  const tableDevices = useMemo(() => {
    let list = (devices || []).filter((d) => d.sistema === area && matchesLifecycle(d));
    list = filterDevices(area, list, {
      group: groupFilter || undefined, fabricante: fabFilter || undefined,
      origem, condicao: condFilter || undefined, verificacao: verif,
    });
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((d) => {
      const ident = assetDisplayIdentifier(area, { central: d.central, laco: d.laco, endereco: d.endereco, technicalAttributes: d.technicalAttributes }).toLowerCase();
      const attrValues = Object.values(d.technicalAttributes || {}).map((v) => String(v ?? ''));
      return [ident, d.central, d.laco, d.endereco, d.grupo, d.tipoAtivo, d.tipoDispositivo, d.fabricante, d.modelo, d.localizacao, d.serial, ...attrValues]
        .some((v) => (v || '').toLowerCase().includes(q));
    });
    return sortDevicesForArea(area, list);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devices, area, search, lifecycle, groupFilter, fabFilter, origem, condFilter, verif]);

  // Duplicados (quando o painel está aberto): achata mantendo grupos.
  const dupDevices = useMemo(() => {
    const ids = new Set<string>();
    for (const g of dupGroups) for (const d of g.devices) ids.add(d.id);
    for (const d of anomalies) ids.add(d.id);
    return sortDevicesForArea(area, areaAll.filter((d) => ids.has(d.id)));
  }, [dupGroups, anomalies, areaAll, area]);

  const visible = showDup ? dupDevices : tableDevices;
  const anyFilter = !!(groupFilter || fabFilter || condFilter || search) || origem !== 'todos' || verif !== 'todos';

  const toggleRow = (id: string) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected((prev) => {
    const allSel = visible.length > 0 && visible.every((d) => prev.has(d.id));
    return allSel ? new Set() : new Set(visible.map((d) => d.id));
  });
  const clearSel = () => setSelected(new Set());
  const selectedDevices = useMemo(() => (devices || []).filter((d) => selected.has(d.id)), [devices, selected]);

  // Remoção segura (§11/§34): preserva histórico via status/removed_at (soft).
  const removeDevices = async (list: Device[]) => {
    if (!isSupabaseConfigured()) { showToast('Supabase não configurado.'); return; }
    const nowIso = new Date().toISOString();
    for (const d of list) {
      await upsertDevice({ ...d, status: 'removido', removedAt: d.removedAt || nowIso });
    }
    showToast(list.length === 1 ? 'Ativo removido da base ativa (histórico preservado).' : `${list.length} ativos removidos (histórico preservado).`);
    clearSel(); onDevicesChanged();
  };
  const confirmRemove = async (list: Device[]) => {
    if (list.length === 0) return;
    const one = list.length === 1 ? list[0] : null;
    const msg = one
      ? `Remover "${assetDisplayIdentifier(area, one) || one.modelo || 'ativo'}" da Base Técnica ativa? O histórico técnico é preservado.`
      : `Remover ${list.length} ativos da Base Técnica ativa? O histórico técnico de cada um é preservado.`;
    if (!await requestConfirm(msg)) return;
    try { await removeDevices(list); } catch (e: any) { showToast(`Falha ao remover: ${e?.message || e}`); }
  };
  // Edição em lote de um único campo (§12): condição/grupo/fabricante.
  const bulkPatch = async (patch: Partial<Device>) => {
    if (!isSupabaseConfigured()) { showToast('Supabase não configurado.'); return; }
    try {
      for (const d of selectedDevices) await upsertDevice({ ...d, ...patch });
      showToast(`${selectedDevices.length} ativo(s) atualizados.`);
      clearSel(); onDevicesChanged();
    } catch (e: any) { showToast(`Falha: ${e?.message || e}`); }
  };

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[1600px] flex-col gap-5">
      {/* Cartões de resumo por disciplina */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {AREAS.map((a) => {
          const active = a === area;
          return (
            <button
              key={a}
              onClick={() => { setArea(a); setSearch(''); }}
              className={`flex flex-col items-start rounded-xl border p-3 text-left transition-colors ${active ? 'border-primary bg-navy/5' : 'border-border bg-surface hover:border-border-strong'}`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">{AREA_LABEL[a]}</span>
              <span className={`mt-1 font-data-mono text-2xl font-bold ${active ? 'text-primary' : 'text-fg'}`}>{countsByArea[a] || 0}</span>
              <span className="text-[10px] text-fg-secondary">ativos na base</span>
            </button>
          );
        })}
      </div>

      {/* Resumo visual do sistema (centrais + periféricos) — derivado dos ativos (§2/§3) */}
      <SummaryPanel
        area={area} centrals={centrals} peripherals={peripheralSummary}
        activeGroup={groupFilter} onPickGroup={(g) => { setShowDup(false); setGroupFilter((cur) => (cur === g ? '' : g)); }}
      />

      {/* Revisão pós-importação (§18) */}
      {review.importados > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2 text-[11px]">
          <span className="font-bold uppercase tracking-wider text-fg-muted">Revisar importação</span>
          <span className="text-fg-secondary">{review.importados} importados</span>
          {review.duplicados > 0 && <button onClick={() => { setShowDup(true); setGroupFilter(''); }} className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">{review.duplicados} possíveis duplicados</button>}
          {review.semModelo > 0 && <span className="rounded-full bg-surface-3 px-2 py-0.5 text-fg-secondary">{review.semModelo} sem modelo</span>}
          {review.semFabricante > 0 && <span className="rounded-full bg-surface-3 px-2 py-0.5 text-fg-secondary">{review.semFabricante} sem fabricante</span>}
          {review.naoVerificados > 0 && <button onClick={() => { setShowDup(false); setOrigem('IMPORTACAO'); setVerif('nao_verificados'); }} className="rounded-full bg-surface-3 px-2 py-0.5 font-semibold text-primary">{review.naoVerificados} não verificados</button>}
        </div>
      )}

      {/* Barra de ação da disciplina selecionada */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-fg-secondary">
          {AREA_LABEL[area]} — {visible.length} {visible.length === 1 ? 'ativo' : 'ativos'}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <select value={lifecycle} onChange={(e) => setLifecycle(e.target.value as typeof lifecycle)} className="shrink-0 rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-fg focus:border-primary focus:outline-none" title="Ciclo de vida">
            <option value="ativos">Ativos</option>
            <option value="substituidos">Substituídos</option>
            <option value="removidos">Removidos</option>
            <option value="todos">Todos</option>
          </select>
          <select value={origem} onChange={(e) => setOrigem(e.target.value as OriginFilter)} className="shrink-0 rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-fg focus:border-primary focus:outline-none" title="Origem">
            <option value="todos">Origem: todas</option>
            <option value="MANUAL">Manual</option>
            <option value="IMPORTACAO">Importação</option>
            <option value="ATENDIMENTO">Atendimento</option>
            <option value="LEVANTAMENTO">Levantamento</option>
          </select>
          <select value={verif} onChange={(e) => setVerif(e.target.value as VerifFilter)} className="shrink-0 rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-fg focus:border-primary focus:outline-none" title="Verificação">
            <option value="todos">Verificação: todas</option>
            <option value="verificados">Verificados</option>
            <option value="nao_verificados">Não verificados</option>
          </select>
          <select value={condFilter} onChange={(e) => setCondFilter(e.target.value)} className="shrink-0 rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-fg focus:border-primary focus:outline-none" title="Condição">
            <option value="">Condição: todas</option>
            {CONDITIONS.map((c) => <option key={c} value={c}>{CONDITION_LABEL[c]}</option>)}
          </select>
          {fabricantes.length > 1 && (
            <select value={fabFilter} onChange={(e) => setFabFilter(e.target.value)} className="shrink-0 rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-fg focus:border-primary focus:outline-none" title="Fabricante">
              <option value="">Fabricante: todos</option>
              {fabricantes.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          )}
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar…" className="w-40 max-w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-fg placeholder:text-fg-muted focus:border-primary focus:outline-none" />
          <button onClick={() => { setShowDup((v) => !v); setGroupFilter(''); }} className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${showDup ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-border-strong text-fg-secondary hover:border-primary'}`} title="Possíveis duplicados">
            Duplicados{dupCandidateCount ? ` · ${dupCandidateCount}` : ''}
          </button>
          <button onClick={() => setShowSurvey(true)} className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-navy">Novo levantamento</button>
          <button onClick={() => setShowImport(true)} className="shrink-0 rounded-lg border border-border-strong px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-primary hover:bg-navy hover:text-white">Importar base</button>
          <button onClick={() => setShowAdd(true)} className="shrink-0 rounded-lg border border-primary px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-navy hover:text-white">+ Ativo manual</button>
        </div>
      </div>

      {/* Filtro ativo (grupo/duplicados) */}
      {(groupFilter || showDup || anyFilter) && (
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          {showDup && <span className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-800">Possíveis duplicados</span>}
          {groupFilter && <span className="rounded-full bg-navy/10 px-2.5 py-1 font-semibold text-primary">Grupo: {groupFilter}</span>}
          <button onClick={() => { setGroupFilter(''); setShowDup(false); setOrigem('todos'); setVerif('todos'); setCondFilter(''); setFabFilter(''); setSearch(''); }} className="font-semibold text-fg-muted underline hover:text-fg-secondary">Limpar filtros</button>
        </div>
      )}

      {/* Ações em lote (§12) */}
      {selected.size > 0 && (
        <BulkBar
          area={area} count={selected.size} canManage={canManage}
          onClear={clearSel}
          onRemove={() => confirmRemove(selectedDevices)}
          onCondition={(c) => bulkPatch({ condicao: c })}
          onGroup={(g) => bulkPatch({ grupo: g })}
          onFabricante={(f) => bulkPatch({ fabricante: f })}
        />
      )}

      {/* Tabela adaptativa por disciplina */}
      <AssetTable
        area={area} devices={visible} selected={selected} canManage={canManage}
        onToggleRow={toggleRow} onToggleAll={toggleAll}
        onVerify={setVerifDevice} onOpen={setDetailDevice} onEdit={setEditDevice}
        onRemove={(d) => confirmRemove([d])}
        onHistory={setDetailDevice} onPendencia={setDetailDevice}
      />

      {/* Credenciais protegidas + Backups técnicos */}
      <CredentialsPanel client={client} userRole={userRole} devices={devices} />
      <BackupsPanel client={client} userRole={userRole} devices={devices} currentArea={area} />

      {showAdd && (
        <AddAssetModal
          area={area}
          clienteId={client.id}
          catalog={catalog}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); onDevicesChanged(); }}
        />
      )}
      {verifDevice && (
        <VerificationModal
          area={area}
          device={verifDevice}
          clienteId={client.id}
          onClose={() => setVerifDevice(null)}
          onSaved={() => { setVerifDevice(null); onDevicesChanged(); }}
        />
      )}
      {editDevice && (
        <EditAssetModal
          area={area}
          device={editDevice}
          catalog={catalog}
          onClose={() => setEditDevice(null)}
          onSaved={() => { setEditDevice(null); onDevicesChanged(); }}
        />
      )}
      {showSurvey && (
        <TechnicalSurveyFlow
          area={area}
          clienteId={client.id}
          clientName={client.name}
          existingDevices={devices || []}
          userRole={userRole}
          catalog={catalog}
          onClose={() => setShowSurvey(false)}
          onChanged={onDevicesChanged}
        />
      )}
      {detailDevice && (
        <AssetDetailDrawer
          area={area}
          device={detailDevice}
          client={client}
          userRole={userRole}
          allDevices={devices || []}
          onOpenDevice={(d) => setDetailDevice(d)}
          onClose={() => setDetailDevice(null)}
          onChanged={onDevicesChanged}
          onVerify={(d) => { setDetailDevice(null); setVerifDevice(d); }}
        />
      )}
      {showImport && (
        <TechnicalBaseImport
          clienteId={client.id}
          area={area}
          existingDevices={devices || []}
          onClose={() => setShowImport(false)}
          onImported={onDevicesChanged}
        />
      )}
    </div>
  );
};

/* ------------------------- Ícone por grupo (§4, material symbols) ------------------------- */
function groupIcon(group: string): string {
  const g = group.toLowerCase();
  if (g.includes('central')) return 'developer_board';
  if (g.includes('repetidora') || g.includes('anunciador')) return 'device_hub';
  if (g.includes('detector')) return 'sensors';
  if (g.includes('acionador') || g.includes('botoeira')) return 'touch_app';
  if (g.includes('sirene') || g.includes('sinalizador')) return 'notifications_active';
  if (g.includes('módulo') || g.includes('modulo')) return 'memory';
  if (g.includes('fonte') || g.includes('alimenta') || g.includes('bateria')) return 'bolt';
  if (g.includes('câmera') || g.includes('camera')) return 'videocam';
  if (g.includes('nvr') || g.includes('dvr') || g.includes('xvr') || g.includes('gravador')) return 'dvr';
  if (g.includes('switch') || g.includes('rede') || g.includes('poe')) return 'lan';
  if (g.includes('leitora') || g.includes('controladora') || g.includes('catraca')) return 'badge';
  if (g.includes('sensor')) return 'radar';
  if (g.includes('infra') || g.includes('cabea')) return 'cable';
  return 'category';
}

/* ------------------------- Resumo visual (§2–§8) ------------------------- */
const SummaryPanel: React.FC<{
  area: TechArea; centrals: ReturnType<typeof summarizeCentrals>; peripherals: GroupSummary[];
  activeGroup: string; onPickGroup: (g: string) => void;
}> = ({ area, centrals, peripherals, activeGroup, onPickGroup }) => {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  if (centrals.length === 0 && peripherals.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {centrals.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {centrals.map((c) => (
            <button key={`${c.group}-${c.fabricante}-${c.modelo}`} onClick={() => onPickGroup(c.group)}
              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${activeGroup === c.group ? 'border-primary bg-navy/5' : 'border-border bg-surface hover:border-border-strong'}`}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-navy/10"><span className="material-symbols-outlined text-primary">{groupIcon(c.group)}</span></span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">{c.group}</p>
                <p className="truncate text-sm font-bold text-fg">{[c.fabricante !== '—' ? c.fabricante : '', c.modelo !== '—' ? c.modelo : ''].filter(Boolean).join(' ') || 'Sem fabricante/modelo'}</p>
                <p className="text-[11px] text-fg-secondary">{c.count} un</p>
              </div>
            </button>
          ))}
        </div>
      )}
      {peripherals.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {peripherals.map((g) => {
            const open = openGroup === g.group;
            const multi = g.brands.length > 1 || (g.brands[0] && g.brands[0].models.length > 1);
            return (
              <div key={g.group} className={`rounded-xl border ${activeGroup === g.group ? 'border-primary bg-navy/5' : 'border-border bg-surface'}`}>
                <button onClick={() => onPickGroup(g.group)} className="flex w-full items-center gap-2 p-2.5 text-left hover:bg-surface-2 rounded-t-xl">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-3"><span className="material-symbols-outlined text-[18px] text-fg-secondary">{groupIcon(g.group)}</span></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold text-fg-secondary">{g.group}</p>
                    <p className="font-data-mono text-lg font-bold text-fg">{g.count}</p>
                  </div>
                </button>
                {multi && (
                  <button onClick={() => setOpenGroup(open ? null : g.group)} className="w-full border-t border-border px-2.5 py-1 text-left text-[10px] font-semibold text-primary hover:bg-surface-2">
                    {open ? 'Ocultar' : 'Detalhar'} ({g.brands.length} fab.)
                  </button>
                )}
                {open && (
                  <div className="border-t border-border px-2.5 py-1.5 text-[10px] text-fg-secondary">
                    {g.brands.map((b) => (
                      <div key={b.brand} className="py-0.5">
                        <p className="font-semibold text-fg">{b.brand} — {b.count}</p>
                        {b.models.map((m) => <p key={m.model} className="pl-2 text-fg-muted">{m.model} — {m.count}</p>)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ------------------------- Ações em lote (§12) ------------------------- */
const BulkBar: React.FC<{
  area: TechArea; count: number; canManage: boolean; onClear: () => void;
  onRemove: () => void; onCondition: (c: AssetConditionValue) => void; onGroup: (g: string) => void; onFabricante: (f: string) => void;
}> = ({ area, count, canManage, onClear, onRemove, onCondition, onGroup, onFabricante }) => {
  const [fab, setFab] = useState('');
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/40 bg-navy/5 px-3 py-2 text-xs">
      <span className="font-bold text-primary">{count} selecionado{count > 1 ? 's' : ''}</span>
      <select defaultValue="" onChange={(e) => { if (e.target.value) { onCondition(e.target.value as AssetConditionValue); e.target.value = ''; } }} className="rounded-lg border border-border bg-surface px-2 py-1 text-fg">
        <option value="">Alterar condição…</option>
        {CONDITIONS.map((c) => <option key={c} value={c}>{CONDITION_LABEL[c]}</option>)}
      </select>
      <select defaultValue="" onChange={(e) => { if (e.target.value) { onGroup(e.target.value); e.target.value = ''; } }} className="rounded-lg border border-border bg-surface px-2 py-1 text-fg">
        <option value="">Alterar grupo…</option>
        {groupsForArea(area).map((g) => <option key={g} value={g}>{g}</option>)}
      </select>
      <div className="flex items-center gap-1">
        <input value={fab} onChange={(e) => setFab(e.target.value)} placeholder="Fabricante…" className="w-28 rounded-lg border border-border bg-surface px-2 py-1 text-fg" />
        <button onClick={() => { if (fab.trim()) { onFabricante(fab.trim()); setFab(''); } }} disabled={!fab.trim()} className="rounded-lg border border-border-strong px-2 py-1 font-semibold text-primary disabled:opacity-40">Aplicar</button>
      </div>
      {canManage && <button onClick={onRemove} className="rounded-lg border border-danger px-2.5 py-1 font-bold text-danger hover:bg-danger/10">Remover</button>}
      <button onClick={onClear} className="ml-auto font-semibold text-fg-muted underline hover:text-fg-secondary">Limpar seleção</button>
    </div>
  );
};

/* ------------------------- Tabela adaptativa (seleção + ações) ------------------------- */
const AssetTable: React.FC<{
  area: TechArea; devices: Device[]; selected: Set<string>; canManage: boolean;
  onToggleRow: (id: string) => void; onToggleAll: () => void;
  onVerify: (d: Device) => void; onOpen: (d: Device) => void; onEdit: (d: Device) => void;
  onRemove: (d: Device) => void; onHistory: (d: Device) => void; onPendencia: (d: Device) => void;
}> = ({ area, devices, selected, canManage, onToggleRow, onToggleAll, onVerify, onOpen, onEdit, onRemove, onHistory, onPendencia }) => {
  const [menu, setMenu] = useState<string | null>(null);
  if (devices.length === 0) {
    return <EmptyState variant="generico" title={`Sem ativos de ${AREA_LABEL[area]}`} description="Nenhum ativo para os filtros atuais. Ajuste os filtros, cadastre manualmente ou registre um levantamento." />;
  }
  const allSel = devices.every((d) => selected.has(d.id));
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[820px] text-left text-xs">
        <thead className="sticky top-0 z-10 bg-surface-2 text-[10px] uppercase tracking-wider text-fg-muted">
          <tr>
            <th className="w-8 px-3 py-2"><input type="checkbox" checked={allSel} onChange={onToggleAll} aria-label="Selecionar todos visíveis" /></th>
            <th className="px-3 py-2">Identificador ({AREA_LABEL[area]})</th>
            <th className="px-3 py-2">Grupo / Tipo</th>
            <th className="px-3 py-2">Fabricante / Modelo</th>
            <th className="px-3 py-2">Local</th>
            <th className="px-3 py-2">Condição</th>
            <th className="px-3 py-2">Origem</th>
            <th className="px-3 py-2 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {devices.map((d) => {
            const ident = assetDisplayIdentifier(area, { central: d.central, laco: d.laco, endereco: d.endereco, technicalAttributes: d.technicalAttributes });
            const sel = selected.has(d.id);
            return (
              <tr key={d.id} className={`bg-surface hover:bg-surface-2 ${sel ? 'bg-navy/5' : ''}`}>
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={sel} onChange={() => onToggleRow(d.id)} aria-label="Selecionar ativo" /></td>
                <td className="cursor-pointer px-3 py-2 font-data-mono font-semibold text-primary" onClick={() => onOpen(d)}>{ident || <span className="italic text-fg-muted">sem identificador</span>}</td>
                <td className="cursor-pointer px-3 py-2 text-fg-secondary" onClick={() => onOpen(d)}>{[legacyGroupLabel(area, d.grupo), d.tipoAtivo || d.tipoDispositivo].filter(Boolean).join(' · ') || '—'}</td>
                <td className="cursor-pointer px-3 py-2 text-fg-secondary" onClick={() => onOpen(d)}>{[d.fabricante, d.modelo].filter(Boolean).join(' ') || '—'}</td>
                <td className="px-3 py-2 text-fg-secondary">{d.localizacao || d.pavimento || '—'}</td>
                <td className="px-3 py-2">{d.condicao ? <Badge color={CONDITION_COLOR[d.condicao]}>{CONDITION_LABEL[d.condicao]}</Badge> : <span className="text-fg-muted">—</span>}</td>
                <td className="px-3 py-2 text-[10px] uppercase tracking-wide text-fg-muted">{d.source ? SOURCE_LABEL[d.source] : '—'}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => onVerify(d)} className="rounded-lg border border-border-strong px-2.5 py-1 text-[11px] font-semibold text-primary transition-colors hover:border-primary hover:bg-navy hover:text-white" title="Verificação técnica">Verificar</button>
                    <button onClick={() => onEdit(d)} className="rounded-lg border border-border-strong px-2.5 py-1 text-[11px] font-semibold text-fg-secondary transition-colors hover:border-primary hover:text-primary" title="Editar cadastro do ativo">Editar</button>
                    <div className="relative">
                      <button onClick={() => setMenu(menu === d.id ? null : d.id)} className="rounded-lg border border-border-strong px-1.5 py-1 text-fg-muted hover:text-fg-secondary" title="Mais">
                        <span className="material-symbols-outlined text-[16px] leading-none">more_vert</span>
                      </button>
                      {menu === d.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setMenu(null)} />
                          <div className="absolute right-0 top-8 z-20 w-40 rounded-lg border border-border bg-surface py-1 text-[11px] shadow-lg">
                            <button onClick={() => { setMenu(null); onHistory(d); }} className="block w-full px-3 py-2 text-left text-fg-secondary hover:bg-surface-2">Ver histórico</button>
                            <button onClick={() => { setMenu(null); onPendencia(d); }} className="block w-full px-3 py-2 text-left text-fg-secondary hover:bg-surface-2">Criar pendência</button>
                            {canManage && <button onClick={() => { setMenu(null); onRemove(d); }} className="block w-full px-3 py-2 text-left text-danger hover:bg-danger/10">Remover</button>}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

/* ------------------------- Editar ativo (reutiliza TechnicalAssetFields, §10) ------------------------- */
const EditAssetModal: React.FC<{ area: TechArea; device: Device; catalog: TechnicalCatalogItem[]; onClose: () => void; onSaved: () => void }> = ({ area, device, catalog, onClose, onSaved }) => {
  const [grupo, setGrupo] = useState(legacyGroupLabel(area, device.grupo) || '');
  const [vals, setVals] = useState<AssetFormValues>(() => deviceToAssetValues(device));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!grupo) { showToast('Selecione o grupo do ativo.'); return; }
    const invalid = firstInvalidField(area, grupo, vals);
    if (invalid) { showToast(`Valor inválido em "${invalid.label}".`); return; }
    if (!isSupabaseConfigured()) { showToast('Supabase não configurado.'); return; }
    setSaving(true);
    try {
      const patch = buildDevicePatch(area, grupo, vals);
      // Mantém id/cliente/status/origem/histórico (não recria o ativo) — §34.
      await upsertDevice({ ...device, ...patch } as Device);
      showToast('Ativo atualizado.');
      onSaved();
    } catch (e: any) {
      showToast(`Falha ao salvar: ${e?.message || e}`);
    } finally { setSaving(false); }
  };

  return (
    <Modal title={`Editar ativo — ${AREA_LABEL[area]}`} onClose={onClose}>
      <div className="mb-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-fg-secondary">Grupo</span>
          <select value={grupo} onChange={(e) => setGrupo(e.target.value)} className={inputCls}>
            <option value="">Selecione…</option>
            {[...new Set([...groupsForArea(area), grupo].filter(Boolean))].map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>
      </div>
      {grupo && <TechnicalAssetFields area={area} group={grupo} catalog={catalog} value={vals} onChange={setVals} />}
      <p className="mt-3 text-[11px] text-fg-muted">Editar corrige o cadastro do ativo. O histórico de verificações é preservado.</p>
      <ModalActions>
        <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-fg-secondary hover:bg-surface-2">Cancelar</button>
        <button onClick={save} disabled={saving || !grupo} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-navy disabled:opacity-50">{saving ? 'Salvando…' : 'Salvar alterações'}</button>
      </ModalActions>
    </Modal>
  );
};

/* ------------------------- Cadastro manual ------------------------- */
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="flex flex-col gap-1">
    <span className="text-[11px] font-semibold text-fg-secondary">{label}</span>
    {children}
  </label>
);
const inputCls = 'rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-primary focus:outline-none';

const AddAssetModal: React.FC<{ area: TechArea; clienteId: string; catalog: TechnicalCatalogItem[]; onClose: () => void; onSaved: () => void }> = ({ area, clienteId, catalog, onClose, onSaved }) => {
  // Mesmo motor/config do Levantamento (§36/§54): escolhe grupo → campos contextuais.
  const [grupo, setGrupo] = useState('');
  const [vals, setVals] = useState<AssetFormValues>(emptyAssetValues());
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!grupo) { showToast('Selecione o grupo do ativo.'); return; }
    const invalid = firstInvalidField(area, grupo, vals);
    if (invalid) { showToast(`Valor inválido em "${invalid.label}".`); return; }
    if (!isSupabaseConfigured()) { showToast('Supabase não configurado.'); return; }
    setSaving(true);
    try {
      const patch = buildDevicePatch(area, grupo, vals);
      await upsertDevice({ ...patch, clienteId, status: 'ativo', source: 'MANUAL' } as Device);
      showToast('Ativo adicionado à base técnica.');
      onSaved();
    } catch (e: any) {
      showToast(`Falha ao salvar: ${e?.message || e}`);
    } finally { setSaving(false); }
  };

  return (
    <Modal title={`Novo ativo — ${AREA_LABEL[area]}`} onClose={onClose}>
      <div className="mb-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-fg-secondary">Grupo</span>
          <select value={grupo} onChange={(e) => setGrupo(e.target.value)} className={inputCls}>
            <option value="">Selecione o que está registrando…</option>
            {groupsForArea(area).map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>
      </div>
      {grupo && <TechnicalAssetFields area={area} group={grupo} catalog={catalog} value={vals} onChange={setVals} />}
      <ModalActions>
        <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-fg-secondary hover:bg-surface-2">Cancelar</button>
        <button onClick={save} disabled={saving || !grupo} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-navy disabled:opacity-50">{saving ? 'Salvando…' : 'Adicionar ativo'}</button>
      </ModalActions>
    </Modal>
  );
};

/* ------------------------- Verificação (histórico) ------------------------- */
const VerificationModal: React.FC<{ area: TechArea; device: Device; clienteId: string; onClose: () => void; onSaved: () => void }> = ({ area, device, clienteId, onClose, onSaved }) => {
  const [history, setHistory] = useState<DeviceVerification[] | null>(null);
  const [condicao, setCondicao] = useState<AssetConditionValue>('NORMAL');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) { setHistory([]); return; }
    fetchVerificationsForDevice(device.id).then(setHistory).catch(() => setHistory([]));
  }, [device.id]);

  const ident = assetDisplayIdentifier(area, { central: device.central, laco: device.laco, endereco: device.endereco, technicalAttributes: device.technicalAttributes });

  const save = async () => {
    if (!isSupabaseConfigured()) { showToast('Supabase não configurado.'); return; }
    setSaving(true);
    try {
      await addVerification({ deviceId: device.id, clienteId, condicao, notes: notes || undefined, reconciliation: 'VERIFICADO' });
      showToast('Verificação registrada.');
      onSaved();
    } catch (e: any) {
      showToast(`Falha: ${e?.message || e}`);
    } finally { setSaving(false); }
  };

  return (
    <Modal title={`Verificar — ${ident || device.modelo || 'ativo'}`} onClose={onClose}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Condição constatada">
          <select value={condicao} onChange={(e) => setCondicao(e.target.value as AssetConditionValue)} className={inputCls}>
            {CONDITIONS.map((c) => <option key={c} value={c}>{CONDITION_LABEL[c]}</option>)}
          </select>
        </Field>
        <Field label="Observação"><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} /></Field>
      </div>
      <div className="mt-4">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-fg-muted">Histórico de verificações</p>
        {history === null ? <p className="text-xs italic text-fg-muted">Carregando…</p>
          : history.length === 0 ? <p className="text-xs italic text-fg-muted">Sem verificações anteriores.</p>
          : (
            <div className="flex flex-col gap-1.5">
              {history.map((v) => (
                <div key={v.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs">
                  <Badge color={CONDITION_COLOR[v.condicao]}>{CONDITION_LABEL[v.condicao]}</Badge>
                  <span className="min-w-0 flex-1 truncate text-fg-secondary">{v.notes || '—'}</span>
                  <span className="shrink-0 font-data-mono text-[10px] text-fg-muted">{v.verifiedAt ? new Date(v.verifiedAt).toLocaleString('pt-BR') : ''}</span>
                </div>
              ))}
            </div>
          )}
      </div>
      <ModalActions>
        <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-fg-secondary hover:bg-surface-2">Fechar</button>
        <button onClick={save} disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-navy disabled:opacity-50">{saving ? 'Registrando…' : 'Registrar verificação'}</button>
      </ModalActions>
    </Modal>
  );
};

/* ------------------------- Credenciais protegidas ------------------------- */
const CredentialsPanel: React.FC<{ client: Client; userRole: UserRole; devices: Device[] | null }> = ({ client, userRole, devices }) => {
  const [creds, setCreds] = useState<ClientTechnicalCredential[] | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const canReveal = isGestao(userRole);

  const load = () => {
    if (!isSupabaseConfigured()) { setCreds([]); return; }
    fetchCredentials(client.id).then(setCreds).catch(() => setCreds([]));
  };
  useEffect(load, [client.id]);

  const reveal = async (id: string) => {
    try {
      const s = await revealCredentialSecret(id);
      setRevealed((p) => ({ ...p, [id]: s ?? '(sem segredo cadastrado)' }));
    } catch (e: any) {
      showToast(`Não foi possível revelar: ${e?.message || e}`);
    }
  };
  const hide = (id: string) => setRevealed((p) => { const n = { ...p }; delete n[id]; return n; });

  const remove = async (c: ClientTechnicalCredential) => {
    if (!await requestConfirm(`Excluir a credencial "${c.label}"?`)) return;
    try { await deleteCredential(c.id); load(); } catch (e: any) { showToast(`Falha: ${e?.message || e}`); }
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-fg-secondary">
          <span className="material-symbols-outlined text-base text-fg-muted">key</span>Credenciais técnicas protegidas
        </h3>
        <button onClick={() => setShowAdd(true)} className="text-[10px] font-semibold uppercase tracking-wider text-primary hover:text-danger">+ Credencial</button>
      </div>
      <p className="mb-3 text-[11px] text-fg-muted">O segredo fica isolado e nunca aparece em listagens, PDFs ou relatórios. {canReveal ? 'Você pode revelá-lo pontualmente.' : 'Apenas gestão pode revelar o segredo.'}</p>
      {creds === null ? <p className="text-xs italic text-fg-muted">Carregando…</p>
        : creds.length === 0 ? <p className="text-xs italic text-fg-muted">Nenhuma credencial cadastrada.</p>
        : (
          <div className="flex flex-col gap-2">
            {creds.map((c) => (
              <div key={c.id} className="rounded-lg border border-border bg-surface-2 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-fg">{c.label}{c.area ? <span className="ml-2 text-[10px] uppercase text-fg-muted">{c.area}</span> : null}</p>
                    <p className="truncate text-[11px] text-fg-secondary">{c.username ? `Usuário: ${c.username}` : 'Sem usuário'}{c.notes ? ` · ${c.notes}` : ''}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {canReveal && (revealed[c.id] === undefined
                      ? <button onClick={() => reveal(c.id)} className="rounded-lg border border-border-strong px-2.5 py-1 text-[11px] font-semibold text-primary hover:border-primary hover:bg-navy hover:text-white">Revelar</button>
                      : <button onClick={() => hide(c.id)} className="rounded-lg border border-border-strong px-2.5 py-1 text-[11px] font-semibold text-fg-secondary hover:bg-surface">Ocultar</button>)}
                    {isGestao(userRole) && <button onClick={() => remove(c)} className="rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold text-danger hover:bg-danger/10">Excluir</button>}
                  </div>
                </div>
                {revealed[c.id] !== undefined && (
                  <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 font-data-mono text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                    {revealed[c.id]}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      {showAdd && <AddCredentialModal client={client} devices={devices} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
    </div>
  );
};

const AddCredentialModal: React.FC<{ client: Client; devices: Device[] | null; onClose: () => void; onSaved: () => void }> = ({ client, devices, onClose, onSaved }) => {
  const [label, setLabel] = useState('');
  const [area, setArea] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [username, setUsername] = useState('');
  const [secret, setSecret] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!label.trim()) { showToast('Informe um rótulo.'); return; }
    if (!isSupabaseConfigured()) { showToast('Supabase não configurado.'); return; }
    setSaving(true);
    try {
      await createCredential({
        clienteId: client.id, label: label.trim(), area: area || undefined,
        deviceId: deviceId || undefined, username: username || undefined, notes: notes || undefined,
      }, secret || undefined);
      showToast('Credencial cadastrada.');
      onSaved();
    } catch (e: any) { showToast(`Falha: ${e?.message || e}`); } finally { setSaving(false); }
  };

  return (
    <Modal title="Nova credencial técnica" onClose={onClose}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Rótulo *"><input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex.: Central SDAI 01" className={inputCls} /></Field>
        <Field label="Disciplina">
          <select value={area} onChange={(e) => setArea(e.target.value)} className={inputCls}>
            <option value="">—</option>
            {AREAS.map((a) => <option key={a} value={a}>{AREA_LABEL[a]}</option>)}
          </select>
        </Field>
        <Field label="Equipamento vinculado">
          <select value={deviceId} onChange={(e) => setDeviceId(e.target.value)} className={inputCls}>
            <option value="">—</option>
            {(devices || []).map((d) => <option key={d.id} value={d.id}>{[d.grupo, d.fabricante, d.modelo].filter(Boolean).join(' ') || d.id}</option>)}
          </select>
        </Field>
        <Field label="Usuário / login"><input value={username} onChange={(e) => setUsername(e.target.value)} className={inputCls} /></Field>
        <Field label="Segredo (senha/chave)"><input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} className={inputCls} autoComplete="new-password" /></Field>
        <Field label="Observação"><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} /></Field>
      </div>
      <p className="mt-3 text-[11px] text-fg-muted">O segredo é gravado em armazenamento isolado e nunca retorna em listagens. Deixe em branco para cadastrar apenas os metadados.</p>
      <ModalActions>
        <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-fg-secondary hover:bg-surface-2">Cancelar</button>
        <button onClick={save} disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-navy disabled:opacity-50">{saving ? 'Salvando…' : 'Cadastrar'}</button>
      </ModalActions>
    </Modal>
  );
};

/* ------------------------- Backups técnicos ------------------------- */
const BackupsPanel: React.FC<{ client: Client; userRole: UserRole; devices: Device[] | null; currentArea?: TechArea }> = ({ client, userRole, devices, currentArea }) => {
  const [backups, setBackups] = useState<TechnicalBackup[] | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);

  const load = () => {
    if (!isSupabaseConfigured()) { setBackups([]); return; }
    fetchBackups(client.id).then(setBackups).catch(() => setBackups([]));
  };
  useEffect(load, [client.id]);

  const download = async (b: TechnicalBackup) => {
    setBusy(b.id);
    try {
      const url = await signedBackupUrl(b.storagePath);
      window.open(url, '_blank', 'noopener');
    } catch (e: any) { showToast(`Falha ao gerar download: ${e?.message || e}`); } finally { setBusy(null); }
  };
  const mark = async (b: TechnicalBackup) => {
    try { await markBackupCurrent(client.id, b.id); load(); } catch (e: any) { showToast(`Falha: ${e?.message || e}`); }
  };
  const remove = async (b: TechnicalBackup) => {
    if (!await requestConfirm(`Excluir o arquivo "${b.originalFilename}"? Esta ação não pode ser desfeita.`)) return;
    try { await deleteBackup(b); load(); } catch (e: any) { showToast(`Falha: ${e?.message || e}`); }
  };

  const deviceById = (id?: string) => (devices || []).find((d) => d.id === id);

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-fg-secondary">
          <span className="material-symbols-outlined text-base text-fg-muted">folder</span>Arquivos técnicos
        </h3>
        <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1 rounded-lg border border-primary px-2.5 py-1 text-[11px] font-bold text-primary transition-colors hover:bg-navy hover:text-white">
          <span className="material-symbols-outlined text-[16px] leading-none">upload_file</span>Adicionar arquivo
        </button>
      </div>
      <p className="mb-3 text-[11px] text-fg-muted">Backups, programações e configurações dos equipamentos.</p>
      {backups === null ? <p className="text-xs italic text-fg-muted">Carregando…</p>
        : backups.length === 0 ? <p className="text-xs italic text-fg-muted">Nenhum arquivo técnico armazenado.</p>
        : (
          <div className="flex flex-col gap-2">
            {backups.map((b) => {
              const dev = deviceById(b.deviceId);
              const context = dev ? deviceOptionLabel(dev) : [b.area, b.manufacturer, b.model].filter(Boolean).join(' · ');
              return (
                <div key={b.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-3"><span className="material-symbols-outlined text-[20px] text-fg-secondary">{fileTypeIcon(b.backupType)}</span></span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-fg-muted">{fileTypeLabel(b.backupType)}{b.isCurrent && <Badge color="emerald">Atual</Badge>}</p>
                    <p className="truncate text-sm font-semibold text-fg">{b.originalFilename}</p>
                    <p className="truncate text-[11px] text-fg-secondary">
                      {context || 'Sem equipamento vinculado'}
                      {b.fileSize ? ` · ${fmtFileSize(b.fileSize)}` : ''}{b.createdAt ? ` · ${new Date(b.createdAt).toLocaleDateString('pt-BR')}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button onClick={() => download(b)} disabled={busy === b.id} className="rounded-lg border border-border-strong px-2.5 py-1 text-[11px] font-semibold text-primary hover:border-primary hover:bg-navy hover:text-white disabled:opacity-50">{busy === b.id ? '…' : 'Baixar'}</button>
                    <div className="relative">
                      <button onClick={() => setMenu(menu === b.id ? null : b.id)} className="rounded-lg border border-border-strong px-1.5 py-1 text-fg-muted hover:text-fg-secondary" title="Mais"><span className="material-symbols-outlined text-[16px] leading-none">more_vert</span></button>
                      {menu === b.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setMenu(null)} />
                          <div className="absolute right-0 top-8 z-20 w-40 rounded-lg border border-border bg-surface py-1 text-[11px] shadow-lg">
                            <button onClick={() => { setMenu(null); download(b); }} className="block w-full px-3 py-2 text-left text-fg-secondary hover:bg-surface-2">Baixar arquivo</button>
                            {!b.isCurrent && <button onClick={() => { setMenu(null); mark(b); }} className="block w-full px-3 py-2 text-left text-fg-secondary hover:bg-surface-2">Marcar como atual</button>}
                            {isGestao(userRole) && <button onClick={() => { setMenu(null); remove(b); }} className="block w-full px-3 py-2 text-left text-danger hover:bg-danger/10">Excluir</button>}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      {showAdd && <AddBackupModal client={client} devices={devices} currentArea={currentArea} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
    </div>
  );
};

const AddBackupModal: React.FC<{ client: Client; devices: Device[] | null; currentArea?: TechArea; onClose: () => void; onSaved: () => void }> = ({ client, devices, currentArea, onClose, onSaved }) => {
  const [file, setFile] = useState<File | null>(null);
  const [area, setArea] = useState<string>(currentArea || '');
  const [deviceId, setDeviceId] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [backupType, setBackupType] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  // §7 — só os equipamentos da disciplina selecionada (quando houver).
  const deviceOptions = useMemo(() => (devices || []).filter((d) => !area || d.sistema === area), [devices, area]);

  // §9 — vincular equipamento preenche fabricante/modelo a partir do device.
  const pickDevice = (id: string) => {
    setDeviceId(id);
    const d = (devices || []).find((x) => x.id === id);
    if (d) {
      if (d.fabricante) setManufacturer(d.fabricante);
      if (d.modelo) setModel(d.modelo);
      if (d.sistema && !area) setArea(d.sistema);
    }
  };
  // Trocar disciplina limpa vínculo incompatível.
  const changeArea = (a: string) => { setArea(a); if (deviceId && (devices || []).find((d) => d.id === deviceId)?.sistema !== a) setDeviceId(''); };

  const save = async () => {
    if (!file) { showToast('Selecione um arquivo.'); return; }
    if (!isSupabaseConfigured()) { showToast('Supabase não configurado.'); return; }
    setSaving(true);
    try {
      await uploadBackup({
        clienteId: client.id, file, originalFilename: file.name,
        area: area || undefined, deviceId: deviceId || undefined,
        manufacturer: manufacturer || undefined, model: model || undefined,
        backupType: backupType || undefined, notes: notes || undefined,
      });
      showToast('Arquivo técnico armazenado com segurança.');
      onSaved();
    } catch (e: any) { showToast(`Falha ao salvar: ${e?.message || e}`); } finally { setSaving(false); }
  };

  return (
    <Modal title="Adicionar arquivo técnico" onClose={onClose}>
      {/* Dropzone/card de seleção (§4) — input nativo oculto */}
      <input ref={fileRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      {!file ? (
        <button type="button" onClick={() => fileRef.current?.click()}
          className="mb-3 flex w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border-strong bg-surface-2 px-4 py-6 text-center transition-colors hover:border-primary">
          <span className="material-symbols-outlined text-3xl text-primary">upload_file</span>
          <span className="text-sm font-bold text-fg">Selecionar arquivo técnico</span>
          <span className="text-[11px] text-fg-muted">Backup, programação, configuração ou outro arquivo técnico</span>
        </button>
      ) : (
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-border bg-surface-2 px-3 py-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-3"><span className="material-symbols-outlined text-[20px] text-fg-secondary">{fileTypeIcon(backupType)}</span></span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-fg">{file.name}</p>
            <p className="text-[11px] text-fg-muted">{fmtFileSize(file.size)}</p>
          </div>
          <button type="button" onClick={() => fileRef.current?.click()} className="shrink-0 rounded-lg border border-border-strong px-2.5 py-1 text-[11px] font-semibold text-primary hover:border-primary">Alterar</button>
          <button type="button" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }} className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold text-danger hover:bg-danger/10">Remover</button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Tipo de arquivo">
          <select value={backupType} onChange={(e) => setBackupType(e.target.value)} className={inputCls}>
            <option value="">—</option>
            {FILE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="Disciplina">
          <select value={area} onChange={(e) => changeArea(e.target.value)} className={inputCls}>
            <option value="">—</option>
            {AREAS.map((a) => <option key={a} value={a}>{AREA_LABEL[a]}</option>)}
          </select>
        </Field>
        <Field label="Equipamento vinculado (opcional)">
          <select value={deviceId} onChange={(e) => pickDevice(e.target.value)} className={`${inputCls} sm:col-span-2`}>
            <option value="">— Sem equipamento específico</option>
            {deviceOptions.map((d) => <option key={d.id} value={d.id}>{deviceOptionLabel(d)}</option>)}
          </select>
        </Field>
        <Field label="Fabricante"><input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} placeholder={deviceId ? 'Preenchido pelo equipamento' : ''} className={inputCls} /></Field>
        <Field label="Modelo"><input value={model} onChange={(e) => setModel(e.target.value)} placeholder={deviceId ? 'Preenchido pelo equipamento' : ''} className={inputCls} /></Field>
        <Field label="Observação"><input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: backup após alteração do Laço 1" className={inputCls} /></Field>
      </div>

      <p className="mt-3 flex items-start gap-1.5 text-[11px] text-fg-muted">
        <span className="material-symbols-outlined text-[15px] leading-none">info</span>
        <span>{BACKUP_DISCLAIMER}</span>
      </p>
      <ModalActions>
        <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-fg-secondary hover:bg-surface-2">Cancelar</button>
        <button onClick={save} disabled={saving || !file} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-navy disabled:opacity-50">{saving ? 'Salvando…' : 'Adicionar arquivo'}</button>
      </ModalActions>
    </Modal>
  );
};

/* ------------------------- Modal primitivo ------------------------- */
const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
    <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-bold text-fg">{title}</h3>
        <button onClick={onClose} className="material-symbols-outlined text-fg-muted hover:text-fg">close</button>
      </div>
      {children}
    </div>
  </div>
);

const ModalActions: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="mt-5 flex justify-end gap-2">{children}</div>
);
