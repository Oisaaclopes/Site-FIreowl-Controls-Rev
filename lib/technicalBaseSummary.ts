import type { Device } from './types';
import { TechArea, legacyGroupLabel, assetIdentityKey, assetDisplayIdentifier, CONDITION_LABEL, SOURCE_LABEL, AssetCondition, AssetSource } from './technicalBase';

/* ===================================================================
 * RESUMO DA BASE TÉCNICA — helpers PUROS e testáveis (§31).
 * Derivam tudo dos `devices` reais (fonte única canônica, §29): resumo por
 * grupo, destaque de centrais, ordenação numérica SDAI, candidatos a duplicado
 * (reusa assetIdentityKey da taxonomia) e filtros. Só ATIVOS entram no resumo
 * (§26): status 'ativo' e sem removed_at. Sem I/O, sem side effects.
 * =================================================================== */

/** Ativo = instalado e não removido (não conta substituído/removido, §26/§34). */
export const isActiveDevice = (d: Device): boolean => d.status === 'ativo' && !d.removedAt;
export const activeDevices = (devices: Device[]): Device[] => (devices || []).filter(isActiveDevice);

/** Grupos que representam a "central" do sistema por área (destaque no topo). */
export const CENTRAL_GROUPS: Record<TechArea, string[]> = {
  SDAI: ['Central SDAI', 'Repetidora de SDAI'],
  ALARME: ['Central'],
  CFTV: ['DVR', 'NVR', 'XVR'],
  BMS: ['Controlador', 'CLP'],
  CONTROLE_ACESSO: ['Controladora'],
};

/** Rótulo de grupo canônico do device (normaliza legado; fallback seguro). */
export function displayGroup(area: TechArea, d: Device): string {
  const g = legacyGroupLabel(area, d.grupo);
  return (g || d.tipoAtivo || d.tipoDispositivo || 'Outros').trim() || 'Outros';
}

export interface AssetCardView {
  identifier: string;
  group: string;
  brandModel: string;
  local: string;
  condition: AssetCondition | null;
  conditionLabel: string;    // "" quando não informada (§13/§20 — não vira NORMAL)
  origin: AssetSource | null;
  originLabel: string;
  verified: boolean;
  verifiedLabel: string;     // "Verificado" | "Não verificado"
}

/**
 * Apresentação PRIORITÁRIA de um ativo para o card mobile (§3/§4). Mesma fonte
 * do desktop; nunca interpreta condição ausente como NORMAL.
 */
export function assetCardView(area: TechArea, d: Device): AssetCardView {
  const cond = (d.condicao || null) as AssetCondition | null;
  const src = (d.source || null) as AssetSource | null;
  return {
    identifier: assetDisplayIdentifier(area, { central: d.central, laco: d.laco, endereco: d.endereco, technicalAttributes: d.technicalAttributes }),
    group: displayGroup(area, d),
    brandModel: [d.fabricante, d.modelo].filter(Boolean).join(' · '),
    local: d.localizacao || d.pavimento || '',
    condition: cond,
    conditionLabel: cond ? CONDITION_LABEL[cond] : '',
    origin: src,
    originLabel: src ? SOURCE_LABEL[src] : '',
    verified: !!d.lastVerifiedAt,
    verifiedLabel: d.lastVerifiedAt ? 'Verificado' : 'Não verificado',
  };
}

const brandModel = (d: Device) => ({ brand: (d.fabricante || '').trim() || '—', model: (d.modelo || '').trim() || '—' });

export interface ModelCount { model: string; count: number }
export interface BrandBreakdown { brand: string; count: number; models: ModelCount[] }
export interface GroupSummary { group: string; count: number; brands: BrandBreakdown[] }

/** Resumo por GRUPO (só ativos), com detalhamento fabricante→modelo. "Outros" por último. */
export function summarizeGroups(area: TechArea, devices: Device[]): GroupSummary[] {
  const groups = new Map<string, Map<string, Map<string, number>>>(); // group → brand → model → count
  for (const d of activeDevices(devices)) {
    const g = displayGroup(area, d);
    const { brand, model } = brandModel(d);
    const gm = groups.get(g) || groups.set(g, new Map()).get(g)!;
    const bm = gm.get(brand) || gm.set(brand, new Map()).get(brand)!;
    bm.set(model, (bm.get(model) || 0) + 1);
  }
  const out: GroupSummary[] = [];
  for (const [group, bmap] of groups) {
    let count = 0;
    const brands: BrandBreakdown[] = [];
    for (const [brand, mmap] of bmap) {
      let bcount = 0;
      const models: ModelCount[] = [];
      for (const [model, c] of mmap) { bcount += c; models.push({ model, count: c }); }
      count += bcount;
      models.sort((a, b) => b.count - a.count || a.model.localeCompare(b.model, 'pt-BR'));
      brands.push({ brand, count: bcount, models });
    }
    brands.sort((a, b) => b.count - a.count || a.brand.localeCompare(b.brand, 'pt-BR'));
    out.push({ group, count, brands });
  }
  return out.sort((a, b) =>
    a.group === 'Outros' ? 1 : b.group === 'Outros' ? -1 : b.count - a.count || a.group.localeCompare(b.group, 'pt-BR'));
}

export interface CentralSummary { fabricante: string; modelo: string; group: string; count: number; deviceIds: string[] }

/** Centrais/painéis do sistema (destaque no topo), agrupadas por fabricante+modelo. */
export function summarizeCentrals(area: TechArea, devices: Device[]): CentralSummary[] {
  const centralGroups = new Set(CENTRAL_GROUPS[area] || []);
  const map = new Map<string, CentralSummary>();
  for (const d of activeDevices(devices)) {
    const g = displayGroup(area, d);
    if (!centralGroups.has(g)) continue;
    const { brand, model } = brandModel(d);
    const key = `${g}|${brand}|${model}`;
    const cur = map.get(key);
    if (cur) { cur.count += 1; cur.deviceIds.push(d.id); }
    else map.set(key, { fabricante: brand, modelo: model, group: g, count: 1, deviceIds: [d.id] });
  }
  return [...map.values()].sort((a, b) => a.group.localeCompare(b.group, 'pt-BR') || b.count - a.count);
}

const numOr = (v?: string): number => {
  const n = Number(String(v ?? '').trim());
  return Number.isFinite(n) && String(v ?? '').trim() !== '' ? n : Number.POSITIVE_INFINITY;
};

/** Ordenação contextual. SDAI: Central → Laço → Endereço NUMÉRICO (1,2,…,10,11). */
export function sortDevicesForArea(area: TechArea, devices: Device[]): Device[] {
  const list = [...devices];
  if (area === 'SDAI') {
    list.sort((a, b) =>
      numOr(a.central) - numOr(b.central) ||
      numOr(a.laco) - numOr(b.laco) ||
      numOr(a.endereco) - numOr(b.endereco) ||
      (a.modelo || '').localeCompare(b.modelo || '', 'pt-BR'));
    return list;
  }
  list.sort((a, b) => displayGroup(area, a).localeCompare(displayGroup(area, b), 'pt-BR') || (a.modelo || '').localeCompare(b.modelo || '', 'pt-BR'));
  return list;
}

export interface DuplicateGroup { key: string; devices: Device[] }

/**
 * Candidatos a DUPLICADO dentro do cliente+área: mesma identidade técnica
 * estrutural (SDAI = central+laço+endereço; CFTV = ip / gravador+canal; etc.),
 * reusando assetIdentityKey. Só ATIVOS. Nunca faz merge — só identifica (§13/§32).
 * Endereços iguais em CENTRAIS diferentes NÃO colidem (a central entra na chave).
 */
export function duplicateGroups(area: TechArea, devices: Device[]): DuplicateGroup[] {
  const byKey = new Map<string, Device[]>();
  for (const d of activeDevices(devices)) {
    const key = assetIdentityKey(area, { central: d.central, laco: d.laco, endereco: d.endereco, technicalAttributes: d.technicalAttributes });
    if (!key) continue;
    (byKey.get(key) || byKey.set(key, []).get(key)!).push(d);
  }
  return [...byKey.entries()].filter(([, list]) => list.length > 1).map(([key, list]) => ({ key, devices: list }));
}

/**
 * Anomalia (§22): device de grupo "central" que carrega laço/endereço como se
 * fosse periférico endereçável — candidato à revisão da importação. Não corrige.
 */
export function centralAddressAnomalies(area: TechArea, devices: Device[]): Device[] {
  const centralGroups = new Set(CENTRAL_GROUPS[area] || []);
  return activeDevices(devices).filter((d) => centralGroups.has(displayGroup(area, d)) && (!!(d.laco || '').trim() || !!(d.endereco || '').trim()));
}

// ---------------------------------------------------------------------
// HIERARQUIA SDAI (Central → Laço → Dispositivos) — só SDAI (§20/§33).
// Derivada dos devices ATIVOS. Ordenação NUMÉRICA. Expected NUNCA é inventado
// (§28): sem fonte estruturada real → null (cobertura null). Cadastrado ≠
// verificado (§29): verificados = tem last_verified_at.
// ---------------------------------------------------------------------
export interface SdaiLoopNode {
  key: string; laco: string | null; label: string; devices: Device[];
  cadastrados: number; verificados: number; duplicados: number;
}
export interface SdaiCentralNode {
  key: string; central: string | null; label: string;
  centralDevice?: Device;      // device real da Central SDAI (fonte do fab/modelo)
  centralRegistros: number;    // >1 → "N registros da Central X — revisar" (§26)
  fabricante?: string; modelo?: string;
  loops: SdaiLoopNode[];
  cadastrados: number; verificados: number; duplicados: number;
  expected: number | null;     // §28 — só com fonte real; senão null
}
export interface SdaiHierarchy { centrals: SdaiCentralNode[] }

/** Cobertura verificada só quando expected é real (§30). */
export function coveragePct(expected: number | null, verificados: number): number | null {
  if (expected == null || expected <= 0) return null;
  return Math.round((Math.min(verificados, expected) / expected) * 1000) / 10;
}

export function buildSdaiHierarchy(devices: Device[]): SdaiHierarchy {
  const area: TechArea = 'SDAI';
  const act = activeDevices(devices).filter((d) => d.sistema === 'SDAI');
  const dupIds = new Set<string>();
  for (const g of duplicateGroups(area, devices)) for (const d of g.devices) dupIds.add(d.id);
  const centralGroups = new Set(CENTRAL_GROUPS.SDAI);
  const n = (v?: string) => { const x = Number(String(v ?? '').trim()); return Number.isFinite(x) && String(v ?? '').trim() !== '' ? x : Number.POSITIVE_INFINITY; };
  const ver = (list: Device[]) => list.filter((d) => d.lastVerifiedAt).length;
  const dup = (list: Device[]) => list.filter((d) => dupIds.has(d.id)).length;

  const byCentral = new Map<string, Device[]>();
  for (const d of act) {
    const key = (d.central || '').trim() || '__none__';
    (byCentral.get(key) || byCentral.set(key, []).get(key)!).push(d);
  }

  const centrals: SdaiCentralNode[] = [...byCentral.entries()].map(([ckey, list]) => {
    const central = ckey === '__none__' ? null : ckey;
    const centralDevs = list.filter((d) => centralGroups.has(displayGroup(area, d)));
    const centralDevice = centralDevs[0];
    // Loops (só periféricos; a central é representada no cabeçalho).
    const byLoop = new Map<string, Device[]>();
    for (const d of list) {
      if (centralGroups.has(displayGroup(area, d))) continue;
      const lkey = (d.laco || '').trim() || '__none__';
      (byLoop.get(lkey) || byLoop.set(lkey, []).get(lkey)!).push(d);
    }
    const loops: SdaiLoopNode[] = [...byLoop.entries()].map(([lkey, ldevs]) => {
      const laco = lkey === '__none__' ? null : lkey;
      const sorted = [...ldevs].sort((a, b) => n(a.endereco) - n(b.endereco) || (a.modelo || '').localeCompare(b.modelo || '', 'pt-BR'));
      return { key: `${ckey}|${lkey}`, laco, label: laco ? `Laço ${laco}` : 'Sem laço definido', devices: sorted, cadastrados: ldevs.length, verificados: ver(ldevs), duplicados: dup(ldevs) };
    }).sort((a, b) => (a.laco === null ? 1 : b.laco === null ? -1 : n(a.laco) - n(b.laco)));
    return {
      key: ckey, central, label: central ? `Central ${central}` : 'Sem central definida',
      centralDevice, centralRegistros: centralDevs.length,
      fabricante: centralDevice?.fabricante, modelo: centralDevice?.modelo,
      loops, cadastrados: list.length, verificados: ver(list), duplicados: dup(list),
      expected: null, // §28 — nenhuma fonte estruturada real disponível aqui
    };
  }).sort((a, b) => (a.central === null ? 1 : b.central === null ? -1 : n(a.central) - n(b.central)));

  return { centrals };
}

export type OriginFilter = 'todos' | 'MANUAL' | 'IMPORTACAO' | 'ATENDIMENTO' | 'LEVANTAMENTO';
export type VerifFilter = 'todos' | 'verificados' | 'nao_verificados';

export interface AssetFilter {
  group?: string;
  fabricante?: string;
  origem?: OriginFilter;
  condicao?: string;         // AssetConditionValue ou vazio
  verificacao?: VerifFilter;
}

/** Aplica filtros (grupo/fabricante/origem/condição/verificação). Não filtra saldo/lifecycle aqui. */
export function filterDevices(area: TechArea, devices: Device[], f: AssetFilter): Device[] {
  return devices.filter((d) => {
    if (f.group && displayGroup(area, d) !== f.group) return false;
    if (f.fabricante && (d.fabricante || '').trim() !== f.fabricante) return false;
    if (f.origem && f.origem !== 'todos' && d.source !== f.origem) return false;
    if (f.condicao && (d.condicao || '') !== f.condicao) return false;
    if (f.verificacao === 'verificados' && !d.lastVerifiedAt) return false;
    if (f.verificacao === 'nao_verificados' && d.lastVerifiedAt) return false;
    return true;
  });
}

/** Fabricantes distintos (ativos) da área, ordenados. */
export function fabricantesInArea(devices: Device[]): string[] {
  const set = new Set<string>();
  for (const d of activeDevices(devices)) if ((d.fabricante || '').trim()) set.add(d.fabricante!.trim());
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/**
 * Inconsistências OBJETIVAS de importação (§17): grupo ausente ou central com
 * laço/endereço de periférico (§18/§22). Campo opcional ausente (fabricante/
 * modelo) NÃO é inconsistência aqui — tem contador próprio. Só ativos.
 */
export function importInconsistencyDevices(area: TechArea, devices: Device[]): Device[] {
  const anomalyIds = new Set(centralAddressAnomalies(area, devices).map((d) => d.id));
  return activeDevices(devices).filter((d) => anomalyIds.has(d.id) || !(d.grupo || '').trim());
}

export interface ImportReview {
  importados: number;
  duplicados: number;
  semFabricante: number;
  semModelo: number;
  semCondicao: number;
  naoVerificados: number;
  inconsistencias: number;
}

/** Resumo de revisão pós-importação (§18). Só ativos; condição vazia NÃO vira NORMAL (§20). */
export function importReview(area: TechArea, devices: Device[]): ImportReview {
  const imported = activeDevices(devices).filter((d) => d.source === 'IMPORTACAO');
  const dupIds = new Set<string>();
  for (const g of duplicateGroups(area, devices)) for (const d of g.devices) if (d.source === 'IMPORTACAO') dupIds.add(d.id);
  const inconsistentImportedIds = new Set(importInconsistencyDevices(area, devices).filter((d) => d.source === 'IMPORTACAO').map((d) => d.id));
  return {
    importados: imported.length,
    duplicados: dupIds.size,
    semFabricante: imported.filter((d) => !(d.fabricante || '').trim()).length,
    semModelo: imported.filter((d) => !(d.modelo || '').trim()).length,
    semCondicao: imported.filter((d) => !(d.condicao || '').trim()).length,
    naoVerificados: imported.filter((d) => !d.lastVerifiedAt).length,
    inconsistencias: inconsistentImportedIds.size,
  };
}
