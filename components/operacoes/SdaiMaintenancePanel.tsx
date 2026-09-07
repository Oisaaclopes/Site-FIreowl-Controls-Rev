'use client';
import React, { useEffect, useState } from 'react';
import type { Client, Device, OrdemServico, ReportInstance, ServiceAttendance, UserRole } from '@/lib/types';
import type { TemplateSchema } from '@/lib/reportSchema';
import { ReportForm, type MaintenanceReportContext } from '@/components/reports/ReportForm';
import { buildBaseReportCatalog, augmentCatalogForSdaiMaintenance } from '@/lib/reportCatalog';
import type { CatalogSources } from '@/components/reports/FormEngine';
import { fetchMaintenancePeriodPlan } from '@/lib/maintenancePlan';
import { fetchReportsByAttendanceIds } from '@/lib/reports';
import { pickAttendanceReport } from '@/lib/maintenanceReports';
import { attendancePlanDevices, resolveSdaiPreventiveRoutine, periodicidadeLabel, competenciaFromPeriodStart } from '@/lib/sdaiAttendanceWiring';
import { friendlyContractRef } from '@/lib/contracts';
import type { SdaiMaintenanceMode } from '@/lib/sdaiAttendanceWiring';
import { PREVENTIVA_SDAI_CONTRATO_CODIGO } from '@/lib/sdaiMaintenance';
import { fetchContractRoutines } from '@/lib/contractRoutines';
import { fetchDevices } from '@/lib/devices';
import { fetchInventory } from '@/lib/inventory';
import { fetchContracts } from '@/lib/contracts';
import { fetchPendencias } from '@/lib/pendencias';
import { fetchTemplateByCodigo } from '@/lib/reportTemplates';
import { ALL_TEMPLATES } from '@/lib/reportTemplatesData';
import type { MaintenancePeriodPlan } from '@/lib/types';

function monthWindow(d = new Date()): { periodStart: string; periodEnd: string } {
  const y = d.getFullYear(); const m = d.getMonth();
  return {
    periodStart: `${y}-${String(m + 1).padStart(2, '0')}-01`,
    periodEnd: new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10),
  };
}

interface ResolvedCtx {
  template: TemplateSchema;
  templateId?: string;
  plan: MaintenancePeriodPlan;
  planDevices: Device[];
  catalog: CatalogSources;
  cliente?: Client;
  finalizedReport?: ReportInstance;
  identity: MaintenanceReportContext;
}

const LOAD_TIMEOUT_MS = 20_000;

function withLoadTimeout<T>(promise: Promise<T>, stage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error(`Tempo limite ao carregar ${stage}.`)),
      LOAD_TIMEOUT_MS,
    );
    promise.then(
      (value) => { window.clearTimeout(timer); resolve(value); },
      (error) => { window.clearTimeout(timer); reject(error); },
    );
  });
}

/**
 * MANUTENÇÃO PREVENTIVA SDAI dentro do Atendimento (entrada canônica). Só ATIVA
 * quando `enabled` (atendimento SDAI vinculado a contrato). Resolve
 * contexto/plano/template/catálogo, mostra o estado (não iniciada / concluída) e
 * abre o ReportForm existente (com plano injetado + gancho de manutenção). Tudo
 * gated por PREVENTIVA_SDAI_CONTRATO — não afeta outros fluxos.
 */
export type { SdaiMaintenanceMode } from '@/lib/sdaiAttendanceWiring';

export const SdaiMaintenancePanel: React.FC<{
  enabled: boolean;
  attendance: ServiceAttendance;
  os?: OrdemServico;
  clients: Client[];
  userRole?: UserRole;
  technicianName?: string;
  onSaved?: () => void;
  onExit?: () => void;
  /** Reporta o estado ao AttendanceScreen para não competir com o fluxo genérico (§7). */
  onModeChange?: (mode: SdaiMaintenanceMode) => void;
}> = ({ enabled, attendance, os, clients, userRole = 'TECNICO', technicianName, onSaved, onExit, onModeChange }) => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'na' | 'error'>('idle');
  const [ctx, setCtx] = useState<ResolvedCtx | null>(null);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // reloadKey força re-resolução (retry §8 / após salvar) SEM depender de `status`
  // nas deps do efeito — depender de status causava o loop que travava em loading:
  // setStatus('loading') disparava o cleanup (alive=false) da própria execução.
  const [reloadKey, setReloadKey] = useState(0);

  // Reporta o modo ao pai (§7): 'off' quando desabilitado.
  useEffect(() => {
    onModeChange?.(!enabled ? 'off' : status === 'idle' ? 'loading' : status);
  }, [enabled, status, onModeChange]);

  useEffect(() => {
    if (!enabled) { setStatus('idle'); return; }
    const contratoId = os?.contratoId || undefined;
    const clienteId = os?.clienteId || undefined;
    if (!contratoId || !clienteId) { setStatus('na'); return; }
    let alive = true;
    setCtx(null);
    setStatus('loading');
    setErr(null);
    (async () => {
      try {
        const { periodStart, periodEnd } = monthWindow();
        // Gate endurecido (§2): a OS não pode ser corretiva/instalação e precisa
        // existir rotina preventiva SDAI contratual (PREVENTIVA_SDAI_CONTRATO).
        // Sem isso → NÃO mostra CTA (não classifica corretiva como preventiva).
        if (os?.tipo && os.tipo !== 'preventiva') { if (alive) setStatus('na'); return; }
        const routines = await withLoadTimeout(fetchContractRoutines(contratoId), 'rotinas do contrato');
        const routine = resolveSdaiPreventiveRoutine(routines);
        if (!routine) { if (alive) setStatus('na'); return; }
        const codigo = PREVENTIVA_SDAI_CONTRATO_CODIGO;

        const dbTpl = await withLoadTimeout(fetchTemplateByCodigo(codigo), 'template SDAI');
        const template = (dbTpl?.schema as TemplateSchema | undefined)
          || ALL_TEMPLATES.find((t) => t.codigo === codigo);
        if (!template) throw new Error('Template da preventiva SDAI não encontrado.');

        const [plan, devicesCliente, inventory, contracts, pendAbertas, existing] = await Promise.all([
          withLoadTimeout(fetchMaintenancePeriodPlan({ contractId: contratoId, clienteId, periodStart, periodEnd, rotation: true }), 'plano de manutenção'),
          withLoadTimeout(fetchDevices(clienteId), 'dispositivos'),
          withLoadTimeout(fetchInventory(), 'inventário'),
          withLoadTimeout(fetchContracts(), 'contratos'),
          withLoadTimeout(fetchPendencias(userRole, { clienteId, status: 'aberta' }), 'pendências'),
          withLoadTimeout(fetchReportsByAttendanceIds([attendance.id]), 'relatórios do atendimento'),
        ]);

        const base = buildBaseReportCatalog({ inventory: inventory as never, services: [], brands: [], contracts: contracts as never });
        const catalog = augmentCatalogForSdaiMaintenance(base, {
          devices: devicesCliente,
          pendenciasAbertas: pendAbertas.map((p) => ({ id: p.id, descricao: p.descricao, grupo: p.grupo })),
        });

        const found = pickAttendanceReport(existing, codigo);
        const finalizedReport = found && found.status === 'finalizado' ? found : undefined;

        // Contexto documental RESOLVIDO pela cadeia real (contrato → rotina →
        // execução → OS → atendimento). NUNCA expõe contract.id: usa a referência
        // PÚBLICA (friendlyContractRef → contract.numero). O técnico não escolhe.
        const contrato = contracts.find((c) => c.id === contratoId);
        // Pendências do contexto SDAI: abertas do cliente, restritas à área SDAI
        // (ou sem grupo). Não duplica — apenas apresenta as que já existem.
        const pendenciasCtx = pendAbertas
          .filter((p) => {
            const g = (p.grupo || '').trim().toUpperCase();
            return g === '' || g.includes('SDAI');
          })
          .map((p) => ({
            id: p.id,
            grupo: p.grupo,
            descricao: p.descricao,
            local: p.local,
            criadaEm: p.criadaEm,
            status: p.status,
          }));
        const identity: MaintenanceReportContext = {
          contratoRef: contrato ? friendlyContractRef(contrato) : (contratoId ? friendlyContractRef({ id: contratoId }) : '—'),
          contratoEscopo: contrato?.contractType,
          periodicidade: periodicidadeLabel(routine),
          competencia: competenciaFromPeriodStart(periodStart),
          osNumero: os?.numero,
          tecnico: technicianName,
          pendencias: pendenciasCtx,
        };

        if (!alive) return;
        setCtx({
          template: { ...template, versao: dbTpl?.versao ?? template.versao },
          templateId: dbTpl?.id,
          plan,
          planDevices: attendancePlanDevices(plan, devicesCliente),
          catalog,
          cliente: clients.find((c) => c.id === clienteId),
          finalizedReport,
          identity,
        });
        setStatus('ready');
      } catch (e) {
        if (!alive) return;
        console.error('Falha ao preparar manutenção preventiva SDAI:', e);
        setErr(e instanceof Error ? e.message : 'Falha ao preparar a manutenção.');
        setStatus('error');
      }
    })();
    return () => { alive = false; };
    // Deps PRIMITIVAS (nunca `status` nem o objeto `os`): re-resolve por origem
    // real da OS + retry/salvar (reloadKey). `clients` fora das deps de propósito
    // (usado só p/ nome do cliente; evita re-run por identidade de array).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, os?.contratoId, os?.clienteId, os?.tipo, os?.id, attendance.id, userRole, reloadKey]);

  const retry = () => { setErr(null); setStatus('loading'); setReloadKey((k) => k + 1); };

  if (!enabled || status === 'na') return null;

  const box: React.CSSProperties = { border: '1px solid var(--border, #e5e7eb)', borderRadius: 12, padding: 12, margin: '12px 0', background: 'var(--bg-surface, #fff)' };

  if (status === 'loading' || status === 'idle') {
    return <div style={box}>Preparando manutenção preventiva SDAI…</div>;
  }
  if (status === 'error') {
    return (
      <div style={box}>
        <strong>Não foi possível preparar a manutenção preventiva SDAI.</strong>
        {err ? <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>{err}</div> : null}
        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={retry}
            style={{ padding: '9px 14px', borderRadius: 10, background: 'var(--bg-primary, #0B1E38)', color: '#fff', border: 0, fontWeight: 600 }}>
            Tentar novamente
          </button>
          {onExit ? (
            <button type="button" onClick={onExit}
              style={{ padding: '9px 14px', borderRadius: 10, background: 'transparent', color: 'inherit', border: '1px solid var(--border, #e5e7eb)', fontWeight: 600 }}>
              Sair
            </button>
          ) : null}
        </div>
      </div>
    );
  }
  if (!ctx) return null;

  // Estado concluído (§13/§14): report finalizado deste atendimento existe.
  if (ctx.finalizedReport && !open) {
    return (
      <div style={box}>
        <strong>Manutenção preventiva SDAI concluída.</strong>
        <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
          O relatório técnico deste atendimento está disponível na aba Relatórios.
        </div>
      </div>
    );
  }

  const planned = ctx.plan.programadosDeviceIds.length;

  if (!open) {
    return (
      <div style={box}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <strong>Manutenção preventiva SDAI</strong>
            <div style={{ fontSize: 13, opacity: 0.8 }}>
              {planned > 0
                ? `${planned} dispositivo(s) planejado(s) neste período.`
                : '0 dispositivos planejados para este período. O checklist da central ainda pode ser realizado.'}
            </div>
          </div>
          <button type="button" onClick={() => setOpen(true)}
            style={{ padding: '10px 16px', borderRadius: 10, background: 'var(--bg-primary, #0B1E38)', color: '#fff', border: 0, fontWeight: 600 }}>
            Executar manutenção
          </button>
        </div>
      </div>
    );
  }

  // Formulário aberto (overlay simples; reutiliza o ReportForm existente).
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg-surface, #fff)', zIndex: 50, overflow: 'auto' }}>
      <ReportForm
        template={ctx.template}
        templateId={ctx.templateId}
        cliente={ctx.cliente}
        catalog={ctx.catalog}
        userRole={userRole}
        currentUserName={technicianName}
        contexto={{ osId: os?.id, contratoId: os?.contratoId }}
        devices={ctx.planDevices}
        maintenance={{ serviceAttendanceId: attendance.id, plan: { programadosDeviceIds: ctx.plan.programadosDeviceIds } }}
        maintenanceContext={ctx.identity}
        onBack={() => setOpen(false)}
        onSaved={() => { setOpen(false); setReloadKey((k) => k + 1); onSaved?.(); }}
      />
    </div>
  );
};
