'use client';
import React, { useEffect, useState } from 'react';
import type { Client, Device, OrdemServico, ReportInstance, ServiceAttendance, UserRole } from '@/lib/types';
import type { TemplateSchema } from '@/lib/reportSchema';
import { ReportForm } from '@/components/reports/ReportForm';
import { buildBaseReportCatalog, augmentCatalogForSdaiMaintenance } from '@/lib/reportCatalog';
import type { CatalogSources } from '@/components/reports/FormEngine';
import { fetchMaintenancePeriodPlan } from '@/lib/maintenancePlan';
import { fetchReportsByAttendanceIds } from '@/lib/reports';
import { pickAttendanceReport } from '@/lib/maintenanceReports';
import { attendancePlanDevices, resolveAttendanceTemplateCodigo } from '@/lib/sdaiAttendanceWiring';
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
}

/**
 * MANUTENÇÃO PREVENTIVA SDAI dentro do Atendimento (entrada canônica). Só ATIVA
 * quando `enabled` (atendimento SDAI vinculado a contrato). Resolve
 * contexto/plano/template/catálogo, mostra o estado (não iniciada / concluída) e
 * abre o ReportForm existente (com plano injetado + gancho de manutenção). Tudo
 * gated por PREVENTIVA_SDAI_CONTRATO — não afeta outros fluxos.
 */
export const SdaiMaintenancePanel: React.FC<{
  enabled: boolean;
  attendance: ServiceAttendance;
  os?: OrdemServico;
  clients: Client[];
  userRole?: UserRole;
  technicianName?: string;
  onSaved?: () => void;
}> = ({ enabled, attendance, os, clients, userRole = 'TECNICO', technicianName, onSaved }) => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'na' | 'error'>('idle');
  const [ctx, setCtx] = useState<ResolvedCtx | null>(null);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || status !== 'idle') return;
    const contratoId = os?.contratoId || undefined;
    const clienteId = os?.clienteId || undefined;
    if (!contratoId || !clienteId) { setStatus('na'); return; }
    let alive = true;
    setStatus('loading');
    (async () => {
      try {
        const { periodStart, periodEnd } = monthWindow();
        const routines = await fetchContractRoutines(contratoId);
        const routine = routines.find((r) => r.ativo !== false && (r.area === 'SDAI'));
        const codigo = resolveAttendanceTemplateCodigo(routine) || PREVENTIVA_SDAI_CONTRATO_CODIGO;

        const dbTpl = await fetchTemplateByCodigo(codigo).catch(() => null);
        const template = (dbTpl?.schema as TemplateSchema | undefined)
          || ALL_TEMPLATES.find((t) => t.codigo === codigo);
        if (!template) { if (alive) setStatus('na'); return; }

        const [plan, devicesCliente, inventory, contracts, pendAbertas, existing] = await Promise.all([
          fetchMaintenancePeriodPlan({ contractId: contratoId, clienteId, periodStart, periodEnd, rotation: true }),
          fetchDevices(clienteId),
          fetchInventory().catch(() => []),
          fetchContracts().catch(() => []),
          fetchPendencias(userRole, { clienteId, status: 'aberta' }).catch(() => []),
          fetchReportsByAttendanceIds([attendance.id]).catch(() => []),
        ]);

        const base = buildBaseReportCatalog({ inventory: inventory as never, services: [], brands: [], contracts: contracts as never });
        const catalog = augmentCatalogForSdaiMaintenance(base, {
          devices: devicesCliente,
          pendenciasAbertas: pendAbertas.map((p) => ({ id: p.id, descricao: p.descricao, grupo: p.grupo })),
        });

        const found = pickAttendanceReport(existing, codigo);
        const finalizedReport = found && found.status === 'finalizado' ? found : undefined;

        if (!alive) return;
        setCtx({
          template: { ...template, versao: dbTpl?.versao ?? template.versao },
          templateId: dbTpl?.id,
          plan,
          planDevices: attendancePlanDevices(plan, devicesCliente),
          catalog,
          cliente: clients.find((c) => c.id === clienteId),
          finalizedReport,
        });
        setStatus('ready');
      } catch (e) {
        if (!alive) return;
        setErr(e instanceof Error ? e.message : 'Falha ao preparar a manutenção.');
        setStatus('error');
      }
    })();
    return () => { alive = false; };
  }, [enabled, status, os, attendance.id, clients, userRole]);

  if (!enabled || status === 'na') return null;

  const box: React.CSSProperties = { border: '1px solid var(--border, #e5e7eb)', borderRadius: 12, padding: 12, margin: '12px 0', background: 'var(--bg-surface, #fff)' };

  if (status === 'loading' || status === 'idle') {
    return <div style={box}>Preparando manutenção preventiva SDAI…</div>;
  }
  if (status === 'error') {
    return <div style={box}>Não foi possível preparar a manutenção: {err}</div>;
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
            <div style={{ fontSize: 13, opacity: 0.8 }}>{planned} dispositivo(s) planejado(s) neste período.</div>
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
        onBack={() => setOpen(false)}
        onSaved={() => { setOpen(false); setStatus('idle'); onSaved?.(); }}
      />
    </div>
  );
};
