'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { Device, ServiceAttendanceEvidenceItem, AssetConditionValue } from '@/lib/types';
import {
  TechArea, AREA_LABEL, CONDITIONS, CONDITION_LABEL, identifierFields, assetDisplayIdentifier, validateIdentifier,
} from '@/lib/technicalBase';
import { fetchDevices } from '@/lib/devices';
import { fetchEvidenceItems } from '@/lib/evidenceItems';
import { fetchTechnicalCatalog, TechnicalCatalogItem } from '@/lib/technicalCatalog';
import { EquipmentIdentifier, EquipmentIdentification } from '@/components/catalog/EquipmentIdentifier';
import { planLifecycle, materializePlan, suggestDecision, AssetLifecycleDecision } from '@/lib/assetLifecycle';
import { persistLifecycle } from '@/lib/assetLifecycleApply';
import { newAssetId } from '@/lib/surveyCapture';
import { getOutboxOwner } from '@/lib/offline/outbox';
import { showToast } from '@/components/ui/Feedback';
import { isSupabaseConfigured } from '@/lib/inventory';

/* ==========================================================================
 * ETAPA 3D.4 — Etapa "Atualização da Base Técnica" no fechamento (§10, §40–§44).
 * Por ITEM de evidência, o técnico confirma o que aconteceu com o ativo:
 * [Mesmo] [Substituído] [Removido] [Não alterar]. Nada é inferido (§2). Um item
 * por vez (§40); pré-seleção pela 0093 (§10). Aplica de forma idempotente (§23),
 * online ou offline (§24).
 * ========================================================================== */

const inputCls = 'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-primary focus:outline-none';

interface WorkState {
  decision?: AssetLifecycleDecision;
  linkedDeviceId?: string;
  finalCondition: AssetConditionValue;
  newEquip?: EquipmentIdentification;
  newIdent: Record<string, string>;
  newSerial: string;
  applied?: boolean;
}

interface Props {
  clienteId: string;
  workOrderId?: string;
  serviceAttendanceId: string;
  defaultArea?: TechArea;
  onDone: () => void;
  onCancel: () => void;
}

export const BaseUpdateStep: React.FC<Props> = ({ clienteId, workOrderId, serviceAttendanceId, defaultArea, onCancel, onDone }) => {
  const [items, setItems] = useState<ServiceAttendanceEvidenceItem[] | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [catalog, setCatalog] = useState<TechnicalCatalogItem[]>([]);
  const [work, setWork] = useState<Record<string, WorkState>>({});
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isSupabaseConfigured()) { setItems([]); return; }
    let alive = true;
    Promise.all([
      fetchEvidenceItems(serviceAttendanceId).catch(() => [] as ServiceAttendanceEvidenceItem[]),
      fetchDevices(clienteId).catch(() => [] as Device[]),
      fetchTechnicalCatalog().catch(() => [] as TechnicalCatalogItem[]),
    ]).then(([its, devs, cat]) => {
      if (!alive) return;
      setItems(its);
      setDevices(devs);
      setCatalog(cat);
      // Pré-seleção (§10): só itens de EQUIPAMENTO entram no ciclo de vida.
      const w: Record<string, WorkState> = {};
      for (const it of its) {
        const decision = it.category === 'EQUIPAMENTO' ? suggestDecision(it) : 'NAO_ALTERAR';
        w[it.id] = { decision, linkedDeviceId: it.deviceId, finalCondition: 'NORMAL', newIdent: {}, newSerial: '', applied: !!it.baseUpdateAppliedAt };
      }
      setWork(w);
    });
    return () => { alive = false; };
  }, [serviceAttendanceId, clienteId]);

  const deviceById = useMemo(() => new Map(devices.map((d) => [d.id, d])), [devices]);
  const activeDevices = useMemo(() => devices.filter((d) => d.status === 'ativo'), [devices]);

  const relevantItems = (items || []).filter((it) => it.category === 'EQUIPAMENTO');

  const setW = (id: string, patch: Partial<WorkState>) => setWork((p) => ({ ...p, [id]: { ...p[id], ...patch } }));

  const areaOf = (it: ServiceAttendanceEvidenceItem, w: WorkState): TechArea | undefined => {
    const dev = w.linkedDeviceId ? deviceById.get(w.linkedDeviceId) : undefined;
    return (dev?.sistema as TechArea) || defaultArea;
  };

  const confirmAll = async () => {
    if (!isSupabaseConfigured()) { showToast('Supabase não configurado.'); return; }
    setSaving(true);
    const owner = getOutboxOwner();
    let offline = false;
    try {
      for (const it of relevantItems) {
        const w = work[it.id];
        if (!w || w.applied || !w.decision) continue;
        const oldDevice = w.linkedDeviceId ? deviceById.get(w.linkedDeviceId) : undefined;
        // Sem ativo vinculado só é possível "não alterar" (não inventa ativo).
        if (!oldDevice && w.decision !== 'NAO_ALTERAR') { showToast(`Vincule um ativo ao item "${it.title}" ou marque "Não alterar".`); setSaving(false); return; }
        const area = areaOf(it, w);

        const replacement = w.decision === 'SUBSTITUIDO' && area ? {
          newDeviceId: newAssetId(),
          clienteId,
          finalCondition: w.finalCondition,
          manufacturer: w.newEquip?.brand || it.equipmentFinalManufacturer,
          model: w.newEquip?.model || it.equipmentFinalModel,
          catalogItemId: w.newEquip?.catalogItemId,
          serial: w.newSerial || undefined,
          ...identifierValuesToDevice(area, w.newIdent),
        } : undefined;

        const plan = planLifecycle({
          decision: w.decision,
          item: { id: it.id, deviceId: w.linkedDeviceId },
          clienteId,
          oldDevice,
          finalCondition: w.finalCondition,
          serviceAttendanceId,
          workOrderId,
          timestampISO: new Date().toISOString(),
          verificationId: newAssetId(),
          replacement,
        });
        const res = await persistLifecycle(materializePlan(plan, oldDevice), owner);
        if (res.mode === 'offline') offline = true;
        setW(it.id, { applied: true });
      }
      showToast(offline ? 'Atualizações da Base salvas offline (sincronizam depois).' : 'Base Técnica atualizada.');
      onDone();
    } catch (e: any) {
      showToast(`Falha ao atualizar a Base: ${e?.message || e}`);
    } finally { setSaving(false); }
  };

  // Nada a decidir → segue direto ao fecho (não burocratiza, §41).
  useEffect(() => {
    if (items !== null && relevantItems.length === 0) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  if (items === null) {
    return <Overlay><div className="text-center text-fg-muted"><span className="material-symbols-outlined animate-spin text-3xl">progress_activity</span></div></Overlay>;
  }
  if (relevantItems.length === 0) return null;

  return (
    <Overlay>
      <div className="flex max-h-screen w-full max-w-lg flex-col overflow-hidden bg-surface sm:max-h-[92vh] sm:rounded-2xl sm:border sm:border-border" onClick={(e) => e.stopPropagation()}>
        <header className="shrink-0 border-b border-border px-4 py-3">
          <h3 className="text-base font-bold text-fg">Atualização da Base Técnica</h3>
          <p className="text-[11px] text-fg-muted">Confirme, por equipamento, o que mudou. Nada é alterado sem sua confirmação.</p>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {relevantItems.map((it) => {
            const w = work[it.id];
            if (!w) return null;
            const linked = w.linkedDeviceId ? deviceById.get(w.linkedDeviceId) : undefined;
            const area = areaOf(it, w);
            return (
              <div key={it.id} className={`rounded-xl border p-3 ${w.applied ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20' : 'border-border bg-surface-2'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-fg">{it.title}</p>
                    <p className="truncate text-[11px] text-fg-secondary">{[it.manufacturer, it.model, it.deviceAddress && `End. ${it.deviceAddress}`].filter(Boolean).join(' · ') || 'Equipamento'}</p>
                  </div>
                  {w.applied && <span className="material-symbols-outlined text-emerald-600">check_circle</span>}
                </div>

                {/* Vínculo ao ativo da Base (§8/§44) */}
                {!linked ? (
                  <div className="mt-2">
                    <p className="mb-1 text-[11px] font-semibold text-fg-secondary">Vincular a um ativo existente da Base:</p>
                    <input value={search[it.id] || ''} onChange={(e) => setSearch((p) => ({ ...p, [it.id]: e.target.value }))} placeholder="Buscar por identificador, modelo, local…" className={inputCls} />
                    <div className="mt-1 max-h-36 overflow-y-auto rounded-lg border border-border">
                      {matchDevices(activeDevices, search[it.id], defaultArea).slice(0, 8).map((d) => (
                        <button key={d.id} onClick={() => setW(it.id, { linkedDeviceId: d.id, decision: suggestDecision({ equipmentReplaced: it.equipmentReplaced, deviceId: d.id }) })}
                          className="flex w-full items-center justify-between gap-2 border-b border-border px-2 py-1.5 text-left text-xs last:border-0 hover:bg-surface">
                          <span className="min-w-0 flex-1 truncate">{assetDisplayIdentifier(d.sistema as TechArea, { central: d.central, laco: d.laco, endereco: d.endereco, technicalAttributes: d.technicalAttributes }) || d.modelo || 'ativo'}</span>
                          <span className="shrink-0 text-[10px] text-fg-muted">{AREA_LABEL[d.sistema as TechArea] || d.sistema}</span>
                        </button>
                      ))}
                    </div>
                    <label className="mt-2 flex items-center gap-2 text-[11px] text-fg-secondary">
                      <input type="radio" checked={w.decision === 'NAO_ALTERAR'} onChange={() => setW(it.id, { decision: 'NAO_ALTERAR' })} />
                      Não alterar a Base para este item
                    </label>
                  </div>
                ) : (
                  <>
                    <p className="mt-2 rounded bg-surface px-2 py-1 text-[11px] text-fg-secondary">
                      Ativo: <b>{assetDisplayIdentifier(linked.sistema as TechArea, { central: linked.central, laco: linked.laco, endereco: linked.endereco, technicalAttributes: linked.technicalAttributes }) || linked.modelo || 'ativo'}</b>
                      {' '}· {[linked.fabricante, linked.modelo].filter(Boolean).join(' ')}
                      {linked.condicao ? ` · ${CONDITION_LABEL[linked.condicao]}` : ''}
                      <button onClick={() => setW(it.id, { linkedDeviceId: undefined, decision: 'NAO_ALTERAR' })} className="ml-2 text-[10px] font-semibold text-primary">trocar</button>
                    </p>
                    <div className="mt-2 grid grid-cols-4 gap-1.5">
                      {(['MESMO', 'SUBSTITUIDO', 'REMOVIDO', 'NAO_ALTERAR'] as AssetLifecycleDecision[]).map((dec) => (
                        <button key={dec} onClick={() => setW(it.id, { decision: dec })} disabled={w.applied}
                          className={`rounded-lg border px-1 py-1.5 text-[10px] font-bold transition-colors ${w.decision === dec ? 'border-primary bg-navy/5 text-primary' : 'border-border text-fg-secondary'}`}>
                          {dec === 'MESMO' ? 'Mesmo' : dec === 'SUBSTITUIDO' ? 'Substituído' : dec === 'REMOVIDO' ? 'Removido' : 'Não alterar'}
                        </button>
                      ))}
                    </div>

                    {w.decision === 'MESMO' && (
                      <div className="mt-2">
                        <label className="text-[11px] font-semibold text-fg-secondary">Condição após o atendimento</label>
                        <select value={w.finalCondition} onChange={(e) => setW(it.id, { finalCondition: e.target.value as AssetConditionValue })} className={inputCls}>
                          {CONDITIONS.map((c) => <option key={c} value={c}>{CONDITION_LABEL[c]}</option>)}
                        </select>
                      </div>
                    )}

                    {w.decision === 'REMOVIDO' && (
                      <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">O ativo será marcado como removido (histórico preservado).</p>
                    )}

                    {w.decision === 'SUBSTITUIDO' && area && (
                      <div className="mt-2 space-y-2 rounded-lg border border-border bg-surface p-2">
                        <p className="text-[11px] font-bold text-fg">Novo equipamento instalado</p>
                        <EquipmentIdentifier value={w.newEquip} onChange={(v) => setW(it.id, { newEquip: v })} catalog={catalog} area={area} subcategory={linked.grupo || undefined} />
                        {identifierFields(area).map((f) => (
                          <div key={f.key}>
                            <label className="text-[10px] font-semibold uppercase text-fg-muted">{f.label}</label>
                            <input value={w.newIdent[f.key] ?? initialIdent(linked, f.key, area)} onChange={(e) => setW(it.id, { newIdent: { ...w.newIdent, [f.key]: e.target.value } })}
                              placeholder={f.placeholder}
                              className={`${inputCls} ${!validateIdentifier(f.kind, w.newIdent[f.key] ?? '') ? 'border-danger' : ''}`} />
                          </div>
                        ))}
                        <div className="grid grid-cols-2 gap-2">
                          <div><label className="text-[10px] font-semibold uppercase text-fg-muted">Nº série</label><input value={w.newSerial} onChange={(e) => setW(it.id, { newSerial: e.target.value })} className={inputCls} /></div>
                          <div><label className="text-[10px] font-semibold uppercase text-fg-muted">Condição</label>
                            <select value={w.finalCondition} onChange={(e) => setW(it.id, { finalCondition: e.target.value as AssetConditionValue })} className={inputCls}>
                              {CONDITIONS.map((c) => <option key={c} value={c}>{CONDITION_LABEL[c]}</option>)}
                            </select>
                          </div>
                        </div>
                        <p className="text-[10px] text-fg-muted">Identificadores não são herdados automaticamente — confirme (§15). Sem inferência de compatibilidade (§17).</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        <footer className="flex shrink-0 gap-2 border-t border-border p-3">
          <button onClick={onCancel} className="flex-1 rounded-lg border border-border px-3 py-3 text-sm font-semibold text-fg-secondary hover:bg-surface-2">Voltar</button>
          <button onClick={confirmAll} disabled={saving} className="flex-[2] rounded-lg bg-primary px-3 py-3 text-sm font-bold text-white hover:bg-navy disabled:opacity-50">{saving ? 'Aplicando…' : 'Confirmar e seguir para assinatura'}</button>
        </footer>
      </div>
    </Overlay>
  );
};

const Overlay: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="fixed inset-0 z-[70] flex items-stretch justify-center bg-black/50 sm:items-center sm:p-4">{children}</div>
);

/** Valor inicial do identificador do novo ativo: sugere o do antigo (editável §14). */
function initialIdent(oldDevice: Device, key: string, area: TechArea): string {
  const f = identifierFields(area).find((x) => x.key === key);
  if (!f) return '';
  if (f.store === 'attr') return String(oldDevice.technicalAttributes?.[key] ?? '');
  return String((oldDevice as any)[f.store] ?? '');
}

/** Converte os identificadores digitados no formato do Device (coluna vs atributo). */
function identifierValuesToDevice(area: TechArea, values: Record<string, string>): { central?: string; laco?: string; endereco?: string; technicalAttributes?: Record<string, unknown> } {
  const out: { central?: string; laco?: string; endereco?: string; technicalAttributes?: Record<string, unknown> } = { technicalAttributes: {} };
  for (const f of identifierFields(area)) {
    const v = (values[f.key] ?? '').trim();
    if (!v) continue;
    if (f.store === 'attr') out.technicalAttributes![f.key] = v;
    else (out as any)[f.store] = v;
  }
  return out;
}

function matchDevices(devices: Device[], q: string | undefined, area?: TechArea): Device[] {
  let list = devices;
  if (area) list = list.filter((d) => d.sistema === area);
  const s = (q || '').trim().toLowerCase();
  if (!s) return list;
  return list.filter((d) => {
    const ident = assetDisplayIdentifier(d.sistema as TechArea, { central: d.central, laco: d.laco, endereco: d.endereco, technicalAttributes: d.technicalAttributes }).toLowerCase();
    const attrs = Object.values(d.technicalAttributes || {}).map((v) => String(v ?? ''));
    return [ident, d.modelo, d.fabricante, d.localizacao, d.tipoAtivo, ...attrs].some((v) => (v || '').toLowerCase().includes(s));
  });
}
