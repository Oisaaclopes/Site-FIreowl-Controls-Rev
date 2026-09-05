/* ===================================================================
 * ETAPA 3D.2 — Reconciliação de levantamento COMPLETO (PURO, testável).
 * Usa os ativos existentes da Base como CHECKLIST. Durante o levantamento, cada
 * ativo recebe uma reconciliação (VERIFICADO/ALTERADO/NAO_LOCALIZADO) e podem
 * surgir ativos NOVO. A cobertura só "fecha" (100%) quando todo existente foi
 * resolvido (§4: não permitir declarar 100% se a reconciliação não fechar).
 * =================================================================== */
import { coverage } from './technicalBase';

export type ReconStatus = 'VERIFICADO' | 'NAO_LOCALIZADO' | 'NOVO' | 'DUPLICADO' | 'ALTERADO';

export interface ReconRecord {
  deviceId: string;        // ativo alvo (existente) ou novo device
  reconciliation: ReconStatus;
}

export interface ReconSummary {
  expected: number;        // itens no checklist (base existente na área/escopo)
  verified: number;        // VERIFICADO + ALTERADO
  alterado: number;        // subconjunto verificado com alteração
  naoLocalizado: number;   // existentes marcados NAO_LOCALIZADO
  novo: number;            // ativos encontrados fora do checklist
  pendente: number;        // existentes ainda sem reconciliação
  resolved: number;        // verified + naoLocalizado (existentes tratados)
  coveragePct: number | null;
  complete: boolean;       // todo existente resolvido (pendente === 0)
  canDeclare100: boolean;  // idem — trava para não declarar 100% sem fechar
}

/**
 * Calcula o resumo da reconciliação a partir do checklist de existentes e dos
 * registros feitos no levantamento. Considera o ÚLTIMO registro por ativo.
 */
export function reconcile(existingDeviceIds: string[], records: ReconRecord[]): ReconSummary {
  const existing = new Set(existingDeviceIds);
  const lastByDevice = new Map<string, ReconStatus>();
  for (const r of records) lastByDevice.set(r.deviceId, r.reconciliation);

  let verified = 0, alterado = 0, naoLocalizado = 0;
  for (const id of existing) {
    const st = lastByDevice.get(id);
    if (st === 'VERIFICADO') verified++;
    else if (st === 'ALTERADO') { verified++; alterado++; }
    else if (st === 'NAO_LOCALIZADO') naoLocalizado++;
  }
  // NOVO = registros de ativos que não estão no checklist de existentes.
  let novo = 0;
  for (const [deviceId, st] of lastByDevice) {
    if (st === 'NOVO' && !existing.has(deviceId)) novo++;
  }

  const expected = existing.size;
  const resolved = verified + naoLocalizado;
  const pendente = Math.max(0, expected - resolved);
  const cov = coverage(expected, resolved);
  const complete = expected > 0 ? pendente === 0 : false;

  return {
    expected, verified, alterado, naoLocalizado, novo, pendente, resolved,
    coveragePct: cov.pct,
    complete,
    canDeclare100: complete,
  };
}

/** Resumo do PONTUAL/PARCIAL: sem checklist fechado, cobertura só dentro do escopo. */
export interface OpenSurveySummary {
  known: number;           // ativos conhecidos após esta visita
  added: number;           // ativos adicionados nesta visita
  scopeExpected?: number;  // esperado declarado (PARCIAL); ausente = não determinado
  coveragePct: number | null;
  coverageDetermined: boolean;
}

export function summarizeOpenSurvey(input: { known: number; added: number; scopeExpected?: number }): OpenSurveySummary {
  const cov = coverage(input.scopeExpected, input.known);
  return {
    known: input.known,
    added: input.added,
    scopeExpected: input.scopeExpected,
    coveragePct: cov.pct,
    coverageDetermined: cov.pct != null,
  };
}
