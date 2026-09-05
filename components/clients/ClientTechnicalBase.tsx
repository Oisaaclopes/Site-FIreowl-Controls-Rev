'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { Client, Device, UserRole, ClientTechnicalCredential, TechnicalBackup, DeviceVerification, AssetConditionValue } from '@/lib/types';
import {
  TechArea, AREAS, AREA_LABEL, CONDITIONS, CONDITION_LABEL, SOURCE_LABEL,
  groupsForArea, assetDisplayIdentifier, legacyGroupLabel,
} from '@/lib/technicalBase';
import { upsertDevice } from '@/lib/devices';
import { addVerification, fetchVerificationsForDevice } from '@/lib/deviceVerifications';
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
import { AssetFormValues, emptyAssetValues, firstInvalidField, buildDevicePatch } from '@/lib/technicalAssetForm';

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
  const [catalog, setCatalog] = useState<TechnicalCatalogItem[]>([]);
  // §33 — filtro de ciclo de vida (padrão: só ativos instalados).
  const [lifecycle, setLifecycle] = useState<'ativos' | 'substituidos' | 'removidos' | 'todos'>('ativos');

  // Catálogo técnico (só identificação: área/família/fabricante/modelo — sem preço).
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let alive = true;
    fetchTechnicalCatalog().then((c) => { if (alive) setCatalog(c); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  // §34 — cards contam apenas ativos ATUALMENTE instalados (não os substituídos/removidos).
  const countsByArea = useMemo(() => {
    const m: Record<string, number> = {};
    for (const d of devices || []) if (d.status === 'ativo') m[d.sistema] = (m[d.sistema] || 0) + 1;
    return m;
  }, [devices]);

  const matchesLifecycle = (d: Device): boolean => {
    if (lifecycle === 'todos') return true;
    if (lifecycle === 'ativos') return d.status === 'ativo';
    if (lifecycle === 'substituidos') return d.status === 'substituido';
    return d.status === 'removido';
  };

  const areaDevices = useMemo(() => {
    const list = (devices || []).filter((d) => d.sistema === area && matchesLifecycle(d));
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((d) => {
      const ident = assetDisplayIdentifier(area, { central: d.central, laco: d.laco, endereco: d.endereco, technicalAttributes: d.technicalAttributes }).toLowerCase();
      // §14: busca por identificadores da disciplina — inclui colunas canônicas e
      // TODOS os atributos técnicos (ip, canal, mac, zona, device instance, ponto,
      // controladora, descrição programada…), além dos campos comuns.
      const attrValues = Object.values(d.technicalAttributes || {}).map((v) => String(v ?? ''));
      return [ident, d.central, d.laco, d.endereco, d.grupo, d.tipoAtivo, d.tipoDispositivo, d.fabricante, d.modelo, d.localizacao, d.serial, ...attrValues]
        .some((v) => (v || '').toLowerCase().includes(q));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devices, area, search, lifecycle]);

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

      {/* Barra de ação da disciplina selecionada */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-fg-secondary">
          {AREA_LABEL[area]} — {areaDevices.length} {areaDevices.length === 1 ? 'ativo' : 'ativos'}
        </h2>
        <div className="flex items-center gap-2">
          {/* §33 — filtro de ciclo de vida */}
          <select
            value={lifecycle}
            onChange={(e) => setLifecycle(e.target.value as typeof lifecycle)}
            className="shrink-0 rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-fg focus:border-primary focus:outline-none"
            title="Ciclo de vida"
          >
            <option value="ativos">Ativos</option>
            <option value="substituidos">Substituídos</option>
            <option value="removidos">Removidos</option>
            <option value="todos">Todos</option>
          </select>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por identificador, grupo, modelo…"
            className="w-56 max-w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-fg placeholder:text-fg-muted focus:border-primary focus:outline-none"
          />
          <button
            onClick={() => setShowSurvey(true)}
            className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-navy"
          >
            Novo levantamento
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="shrink-0 rounded-lg border border-border-strong px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-primary hover:bg-navy hover:text-white"
          >
            Importar base
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="shrink-0 rounded-lg border border-primary px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-navy hover:text-white"
          >
            + Ativo manual
          </button>
        </div>
      </div>

      {/* Tabela adaptativa por disciplina */}
      <AdaptiveAssetTable area={area} devices={areaDevices} onVerify={setVerifDevice} onOpen={setDetailDevice} />

      {/* Credenciais protegidas + Backups técnicos */}
      <CredentialsPanel client={client} userRole={userRole} devices={devices} />
      <BackupsPanel client={client} userRole={userRole} devices={devices} />

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

/* ------------------------- Tabela adaptativa ------------------------- */
const AdaptiveAssetTable: React.FC<{ area: TechArea; devices: Device[]; onVerify: (d: Device) => void; onOpen: (d: Device) => void }> = ({ area, devices, onVerify, onOpen }) => {
  if (devices.length === 0) {
    return <EmptyState variant="generico" title={`Sem ativos de ${AREA_LABEL[area]}`} description="Nenhum ativo desta disciplina na base técnica deste cliente. Cadastre manualmente ou registre um levantamento." />;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[720px] text-left text-xs">
        <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-fg-muted">
          <tr>
            <th className="px-3 py-2">Identificador ({AREA_LABEL[area]})</th>
            <th className="px-3 py-2">Grupo / Tipo</th>
            <th className="px-3 py-2">Fabricante / Modelo</th>
            <th className="px-3 py-2">Local</th>
            <th className="px-3 py-2">Condição</th>
            <th className="px-3 py-2">Origem</th>
            <th className="px-3 py-2 text-right">Ação</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {devices.map((d) => {
            const ident = assetDisplayIdentifier(area, { central: d.central, laco: d.laco, endereco: d.endereco, technicalAttributes: d.technicalAttributes });
            return (
              <tr key={d.id} className="cursor-pointer bg-surface hover:bg-surface-2" onClick={() => onOpen(d)}>
                <td className="px-3 py-2 font-data-mono font-semibold text-primary">{ident || <span className="italic text-fg-muted">sem identificador</span>}</td>
                <td className="px-3 py-2 text-fg-secondary">{[legacyGroupLabel(area, d.grupo), d.tipoAtivo || d.tipoDispositivo].filter(Boolean).join(' · ') || '—'}</td>
                <td className="px-3 py-2 text-fg-secondary">{[d.fabricante, d.modelo].filter(Boolean).join(' ') || '—'}</td>
                <td className="px-3 py-2 text-fg-secondary">{d.localizacao || d.pavimento || '—'}</td>
                <td className="px-3 py-2">{d.condicao ? <Badge color={CONDITION_COLOR[d.condicao]}>{CONDITION_LABEL[d.condicao]}</Badge> : <span className="text-fg-muted">—</span>}</td>
                <td className="px-3 py-2 text-[10px] uppercase tracking-wide text-fg-muted">{d.source ? SOURCE_LABEL[d.source] : '—'}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={(e) => { e.stopPropagation(); onVerify(d); }} className="rounded-lg border border-border-strong px-2.5 py-1 text-[11px] font-semibold text-primary transition-colors hover:border-primary hover:bg-navy hover:text-white">
                    Verificar
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
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
const BackupsPanel: React.FC<{ client: Client; userRole: UserRole; devices: Device[] | null }> = ({ client, userRole, devices }) => {
  const [backups, setBackups] = useState<TechnicalBackup[] | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

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
    if (!await requestConfirm(`Excluir o backup "${b.originalFilename}"?`)) return;
    try { await deleteBackup(b); load(); } catch (e: any) { showToast(`Falha: ${e?.message || e}`); }
  };

  const fmtSize = (n?: number) => (n == null ? '' : n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`);

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-fg-secondary">
          <span className="material-symbols-outlined text-base text-fg-muted">backup</span>Backups técnicos de equipamentos
        </h3>
        <button onClick={() => setShowAdd(true)} className="text-[10px] font-semibold uppercase tracking-wider text-primary hover:text-danger">+ Enviar backup</button>
      </div>
      <p className="mb-3 rounded-lg border border-border bg-surface-2 px-3 py-2 text-[11px] italic text-fg-muted">{BACKUP_DISCLAIMER}</p>
      {backups === null ? <p className="text-xs italic text-fg-muted">Carregando…</p>
        : backups.length === 0 ? <p className="text-xs italic text-fg-muted">Nenhum backup armazenado.</p>
        : (
          <div className="flex flex-col gap-2">
            {backups.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate text-sm font-semibold text-fg">
                    {b.originalFilename}
                    {b.isCurrent && <Badge color="emerald">Atual</Badge>}
                  </p>
                  <p className="truncate text-[11px] text-fg-secondary">
                    {[b.area, b.manufacturer, b.model, b.backupType].filter(Boolean).join(' · ') || 'Equipamento não especificado'}
                    {b.fileSize ? ` · ${fmtSize(b.fileSize)}` : ''}{b.createdAt ? ` · ${new Date(b.createdAt).toLocaleDateString('pt-BR')}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button onClick={() => download(b)} disabled={busy === b.id} className="rounded-lg border border-border-strong px-2.5 py-1 text-[11px] font-semibold text-primary hover:border-primary hover:bg-navy hover:text-white disabled:opacity-50">{busy === b.id ? '…' : 'Baixar'}</button>
                  {!b.isCurrent && <button onClick={() => mark(b)} className="rounded-lg border border-border-strong px-2.5 py-1 text-[11px] font-semibold text-fg-secondary hover:bg-surface">Marcar atual</button>}
                  {isGestao(userRole) && <button onClick={() => remove(b)} className="rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold text-danger hover:bg-danger/10">Excluir</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      {showAdd && <AddBackupModal client={client} devices={devices} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
    </div>
  );
};

const AddBackupModal: React.FC<{ client: Client; devices: Device[] | null; onClose: () => void; onSaved: () => void }> = ({ client, devices, onClose, onSaved }) => {
  const [file, setFile] = useState<File | null>(null);
  const [area, setArea] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [backupType, setBackupType] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

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
      showToast('Backup armazenado com segurança.');
      onSaved();
    } catch (e: any) { showToast(`Falha no upload: ${e?.message || e}`); } finally { setSaving(false); }
  };

  return (
    <Modal title="Enviar backup técnico" onClose={onClose}>
      <p className="mb-3 rounded-lg border border-border bg-surface-2 px-3 py-2 text-[11px] italic text-fg-muted">{BACKUP_DISCLAIMER} O arquivo é preservado exatamente como enviado; o sistema não interpreta, executa nem converte o conteúdo.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Arquivo *"><input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className={inputCls} /></Field>
        <Field label="Tipo de backup">
          <select value={backupType} onChange={(e) => setBackupType(e.target.value)} className={inputCls}>
            <option value="">—</option>
            {['BACKUP_COMPLETO', 'PROGRAMACAO', 'BASE_DISPOSITIVOS', 'CONFIGURACAO', 'EXPORTACAO', 'OUTRO'].map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
        </Field>
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
        <Field label="Fabricante"><input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} className={inputCls} /></Field>
        <Field label="Modelo"><input value={model} onChange={(e) => setModel(e.target.value)} className={inputCls} /></Field>
        <Field label="Observação"><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} /></Field>
      </div>
      <ModalActions>
        <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-fg-secondary hover:bg-surface-2">Cancelar</button>
        <button onClick={save} disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-navy disabled:opacity-50">{saving ? 'Enviando…' : 'Enviar backup'}</button>
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
