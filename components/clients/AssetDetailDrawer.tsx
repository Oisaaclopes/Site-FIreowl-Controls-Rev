'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { Client, Device, UserRole, DeviceVerification, AssetConditionValue, Pendencia } from '@/lib/types';
import {
  TechArea, AREA_LABEL, CONDITION_LABEL, SOURCE_LABEL, identifierFields, fieldValue, assetDisplayIdentifier, legacyGroupLabel,
} from '@/lib/technicalBase';
import { fetchVerificationsForDevice } from '@/lib/deviceVerifications';
import { listFieldPhotosByDevice, FieldPhoto } from '@/lib/fieldPhotos';
import { signedFieldPhotoUrls } from '@/lib/fieldPhotoStorage';
import { insertPendencia } from '@/lib/pendencias';
import { Badge } from '@/components/DataListRow';
import { showToast } from '@/components/ui/Feedback';
import { isSupabaseConfigured } from '@/lib/inventory';

/* ==========================================================================
 * ETAPA 3D.3 (Partes E/H) — Detalhe do ativo da Base Técnica.
 * Identificadores adaptados por disciplina (§36), condição atual, origem, última
 * verificação, HISTÓRICO cronológico (§37, nunca sobrescrito) e GALERIA de fotos
 * sob demanda (§38, signed URLs). Permite abrir a verificação e CRIAR PENDÊNCIA
 * (§58–§60) preservando o contexto (device_id → rastreabilidade da evidência).
 * ========================================================================== */

const CONDITION_COLOR: Record<AssetConditionValue, 'emerald' | 'amber' | 'red' | 'slate' | 'blue'> = {
  NORMAL: 'emerald', COM_AVARIA: 'amber', INOPERANTE: 'red', NAO_TESTADO: 'slate', NAO_LOCALIZADO: 'red', INADEQUADO: 'amber',
};
const PROBLEM_CONDITIONS: AssetConditionValue[] = ['COM_AVARIA', 'INOPERANTE', 'INADEQUADO', 'NAO_LOCALIZADO'];

interface Props {
  area: TechArea;
  device: Device;
  client: Client;
  userRole: UserRole;
  allDevices?: Device[];
  onOpenDevice?: (d: Device) => void;
  onClose: () => void;
  onChanged: () => void;
  onVerify: (d: Device) => void;
}

const STATUS_LABEL: Record<string, string> = { ativo: 'Ativo', inativo: 'Inativo', substituido: 'Substituído', removido: 'Removido' };

export const AssetDetailDrawer: React.FC<Props> = ({ area, device, client, allDevices = [], onOpenDevice, onClose, onChanged, onVerify }) => {
  // §27/§28 — navegação entre ativo anterior ↔ substituto.
  const replacement = device.replacedByDeviceId ? allDevices.find((d) => d.id === device.replacedByDeviceId) : undefined;
  const previous = allDevices.find((d) => d.replacedByDeviceId === device.id);
  const shortId = (d: Device) => assetDisplayIdentifier(d.sistema as TechArea, { central: d.central, laco: d.laco, endereco: d.endereco, technicalAttributes: d.technicalAttributes }) || d.modelo || 'ativo';
  const [history, setHistory] = useState<DeviceVerification[] | null>(null);
  const [thumbs, setThumbs] = useState<{ id: string; url: string; note?: string; at?: string }[] | null>(null);
  const [showPend, setShowPend] = useState(false);

  const ident = assetDisplayIdentifier(area, { central: device.central, laco: device.laco, endereco: device.endereco, technicalAttributes: device.technicalAttributes });

  useEffect(() => {
    if (!isSupabaseConfigured()) { setHistory([]); setThumbs([]); return; }
    let alive = true;
    fetchVerificationsForDevice(device.id).then((h) => alive && setHistory(h)).catch(() => alive && setHistory([]));
    // Galeria sob demanda (§38/§66): só as fotos DESTE ativo, com signed URL.
    listFieldPhotosByDevice(device.id).then(async (photos: FieldPhoto[]) => {
      if (!alive) return;
      const paths = photos.map((p) => p.storagePathEvidencia || p.storagePathOriginal).filter(Boolean) as string[];
      const signed = await signedFieldPhotoUrls(paths).catch(() => ({} as Record<string, string>));
      const list = photos.map((p) => {
        const path = p.storagePathEvidencia || p.storagePathOriginal;
        return { id: p.id, url: (path && signed[path]) || '', note: p.notaRapida, at: p.capturadoEm };
      }).filter((x) => x.url);
      if (alive) setThumbs(list);
    }).catch(() => alive && setThumbs([]));
    return () => { alive = false; };
  }, [device.id]);

  const idFields = useMemo(() => identifierFields(area).map((f) => ({ label: f.label, value: fieldValue({ central: device.central, laco: device.laco, endereco: device.endereco, technicalAttributes: device.technicalAttributes }, f) })).filter((x) => x.value), [area, device]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div className="flex h-full w-full max-w-md flex-col overflow-hidden border-l border-border bg-surface" onClick={(e) => e.stopPropagation()}>
        <header className="flex shrink-0 items-start justify-between gap-2 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">{AREA_LABEL[area]} · {legacyGroupLabel(area, device.grupo) || 'Ativo'}</p>
            <h3 className="truncate text-base font-bold text-fg">{device.tipoAtivo || device.tipoDispositivo || device.modelo || 'Ativo técnico'}</h3>
            <p className="truncate font-data-mono text-xs text-primary">{ident || 'sem identificador'}</p>
          </div>
          <button onClick={onClose} className="material-symbols-outlined text-fg-muted hover:text-fg">close</button>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {/* Identificadores por disciplina (§36) */}
          <Section title="Identificação">
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
              {idFields.map((f) => <Row key={f.label} k={f.label} v={f.value} />)}
              {device.fabricante && <Row k="Fabricante" v={device.fabricante} />}
              {device.modelo && <Row k="Modelo" v={device.modelo} />}
              {device.serial && <Row k="Nº série" v={device.serial} />}
              {device.localizacao && <Row k="Local" v={device.localizacao} full />}
            </dl>
          </Section>

          <Section title="Situação">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge color={device.status === 'ativo' ? 'emerald' : device.status === 'substituido' ? 'amber' : device.status === 'removido' ? 'red' : 'slate'}>{STATUS_LABEL[device.status] || device.status}</Badge>
              {device.condicao ? <Badge color={CONDITION_COLOR[device.condicao]}>{CONDITION_LABEL[device.condicao]}</Badge> : <span className="text-fg-muted">Condição não informada</span>}
              {device.source && <span className="rounded bg-surface-2 px-2 py-0.5 text-[10px] uppercase tracking-wide text-fg-muted">Origem: {SOURCE_LABEL[device.source]}</span>}
              {device.lastVerifiedAt && <span className="text-[11px] text-fg-secondary">Últ. verificação: {new Date(device.lastVerifiedAt).toLocaleDateString('pt-BR')}</span>}
              {device.source === 'IMPORTACAO' && !device.lastVerifiedAt && <Badge color="amber">Não verificado em campo</Badge>}
            </div>
            {/* §27 — vínculos de substituição (navegação) */}
            {(replacement || previous || device.removedAt) && (
              <div className="mt-2 space-y-1.5 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs">
                {device.removedAt && <p className="text-fg-secondary">{device.status === 'substituido' ? 'Substituído' : 'Removido'} em {new Date(device.removedAt).toLocaleDateString('pt-BR')}</p>}
                {replacement && onOpenDevice && (
                  <button onClick={() => onOpenDevice(replacement)} className="flex w-full items-center justify-between gap-2 rounded border border-border px-2 py-1 text-left hover:bg-surface">
                    <span className="min-w-0 truncate text-fg-secondary">Substituído por: <b className="text-fg">{shortId(replacement)}</b></span>
                    <span className="shrink-0 font-semibold text-primary">Ver novo →</span>
                  </button>
                )}
                {previous && onOpenDevice && (
                  <button onClick={() => onOpenDevice(previous)} className="flex w-full items-center justify-between gap-2 rounded border border-border px-2 py-1 text-left hover:bg-surface">
                    <span className="min-w-0 truncate text-fg-secondary">Substituiu: <b className="text-fg">{shortId(previous)}</b></span>
                    <span className="shrink-0 font-semibold text-primary">Ver anterior →</span>
                  </button>
                )}
              </div>
            )}
          </Section>

          {/* Galeria (§38) */}
          <Section title={`Fotos ${thumbs ? `(${thumbs.length})` : ''}`}>
            {thumbs === null ? <p className="text-xs italic text-fg-muted">Carregando…</p>
              : thumbs.length === 0 ? <p className="text-xs italic text-fg-muted">Sem fotos vinculadas a este ativo.</p>
              : (
                <div className="grid grid-cols-3 gap-2">
                  {thumbs.map((t) => (
                    <a key={t.id} href={t.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={t.url} alt={t.note || 'Evidência'} className="h-24 w-full object-cover" loading="lazy" />
                    </a>
                  ))}
                </div>
              )}
          </Section>

          {/* Histórico (§37) */}
          <Section title={`Histórico de verificações ${history ? `(${history.length})` : ''}`}>
            {history === null ? <p className="text-xs italic text-fg-muted">Carregando…</p>
              : history.length === 0 ? <p className="text-xs italic text-fg-muted">Sem verificações registradas.</p>
              : (
                <div className="flex flex-col gap-2">
                  {history.map((v) => (
                    <div key={v.id} className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <Badge color={CONDITION_COLOR[v.condicao]}>{CONDITION_LABEL[v.condicao]}</Badge>
                        <span className="font-data-mono text-[10px] text-fg-muted">{v.verifiedAt ? new Date(v.verifiedAt).toLocaleString('pt-BR') : ''}</span>
                      </div>
                      <p className="mt-1 flex flex-wrap gap-x-2 text-[10px] uppercase tracking-wide text-fg-muted">
                        {v.source && <span>{v.source === 'ATENDIMENTO' ? 'Atendimento' : v.source === 'LEVANTAMENTO' ? 'Levantamento' : v.source}</span>}
                        {v.reconciliation && <span>· {v.reconciliation}</span>}
                        {v.workOrderId && <span>· OS vinculada</span>}
                      </p>
                      {v.notes && <p className="mt-0.5 text-fg-secondary">{v.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
          </Section>

          {showPend && (
            <CreatePendenciaForm area={area} device={device} client={client} ident={ident} onClose={() => setShowPend(false)} onCreated={() => { setShowPend(false); showToast('Pendência criada.'); onChanged(); }} />
          )}
        </div>

        <footer className="flex shrink-0 gap-2 border-t border-border p-3">
          <button onClick={() => onVerify(device)} className="flex-1 rounded-lg bg-primary px-3 py-2.5 text-sm font-bold text-white hover:bg-navy">Verificar</button>
          <button onClick={() => setShowPend(true)} className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-bold ${device.condicao && PROBLEM_CONDITIONS.includes(device.condicao) ? 'border-danger text-danger hover:bg-danger/10' : 'border-border-strong text-primary hover:border-primary hover:bg-navy hover:text-white'}`}>Criar pendência</button>
        </footer>
      </div>
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="mb-4">
    <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-fg-muted">{title}</p>
    {children}
  </div>
);
const Row: React.FC<{ k: string; v: string; full?: boolean }> = ({ k, v, full }) => (
  <div className={full ? 'col-span-2' : ''}><dt className="text-[10px] uppercase text-fg-muted">{k}</dt><dd className="font-semibold text-fg">{v}</dd></div>
);

/* ------------------------- Criar pendência (§58–§60) ------------------------- */
const CreatePendenciaForm: React.FC<{ area: TechArea; device: Device; client: Client; ident: string; onClose: () => void; onCreated: () => void }> = ({ area, device, client, ident, onClose, onCreated }) => {
  const [descricao, setDescricao] = useState('');
  const [acao, setAcao] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!descricao.trim()) { showToast('Descreva a pendência.'); return; }
    if (!isSupabaseConfigured()) { showToast('Supabase não configurado.'); return; }
    setSaving(true);
    try {
      // Contexto preservado (§59): cliente + ativo (device_id) → a evidência do
      // ativo (field_photos.device_id) permanece rastreável como ANTES (§60).
      const pend: Pendencia = {
        id: '',
        clienteId: client.id,
        deviceId: device.id,
        grupo: `${AREA_LABEL[area]}${device.grupo ? ' · ' + device.grupo : ''}`,
        descricao: `${device.tipoAtivo || device.grupo || 'Ativo'} (${ident || 'sem id'}): ${descricao.trim()}`,
        acaoRecomendada: acao.trim() || undefined,
        local: device.localizacao || undefined,
        quantidade: 1,
        status: 'aberta',
      } as Pendencia;
      await insertPendencia(pend);
      onCreated();
    } catch (e: any) { showToast(`Falha: ${e?.message || e}`); } finally { setSaving(false); }
  };

  return (
    <div className="rounded-xl border border-danger/40 bg-danger/5 p-3">
      <p className="mb-2 text-xs font-bold text-danger">Nova pendência para este ativo</p>
      <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} placeholder="O que foi constatado?" className="mb-2 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-primary focus:outline-none" />
      <input value={acao} onChange={(e) => setAcao(e.target.value)} placeholder="Ação recomendada (opcional)" className="mb-2 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-primary focus:outline-none" />
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-fg-secondary hover:bg-surface-2">Cancelar</button>
        <button onClick={save} disabled={saving} className="rounded-lg bg-danger px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50">{saving ? 'Criando…' : 'Criar pendência'}</button>
      </div>
    </div>
  );
};
