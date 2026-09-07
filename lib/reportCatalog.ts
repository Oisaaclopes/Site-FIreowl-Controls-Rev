/* ===================================================================
 * Montagem ÚNICA de CatalogSources para o ReportForm/FormEngine. Extraído do
 * RelatoriosView (que montava inline) para ser reutilizado tal e qual pelo
 * AttendanceScreen — SEM duplicar a lógica e sem mudar o comportamento do wizard.
 * PURO (sem I/O): recebe os dados já carregados e devolve o CatalogSources.
 * =================================================================== */
import type { CatalogSources } from '@/components/reports/FormEngine';
import type { Device } from './types';
import { GRUPOS_FALHA } from './catalogoFalhas';

const uniq = (arr: string[]) => Array.from(new Set(arr.filter(Boolean)));
const uniqCI = (arr: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of arr) {
    const k = (v || '').trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(v.trim());
  }
  return out;
};

/** Shapes estruturais (evitam acoplar aos tipos exatos; os arrays reais servem). */
export interface CatalogInventoryItem {
  id: string; name: string; category?: string; subcategory?: string;
  brand?: string; model?: string; unit?: string; quantity?: number;
  productLine?: string; shortDescription?: string; technicalDescription?: string;
  technologies?: string[]; recommendedUse?: string;
}
export interface CatalogServiceItem { id: string; title: string; category?: string }
export interface CatalogBrandItem { name: string }
export interface CatalogContractItem { id: string; unit?: string; contractType?: string }

export interface BaseCatalogInput {
  inventory: CatalogInventoryItem[];
  services: CatalogServiceItem[];
  brands: CatalogBrandItem[];
  contracts: CatalogContractItem[];
}

/**
 * Catálogo BASE (idêntico ao que o wizard montava): categorias, itens, marcas,
 * modelos, modelosPorMarca/Grupo, detalhesModelo e contratos. `devices`,
 * `pendenciasAprovadas` e `pendenciasAbertas` ficam vazios (preenchidos por área).
 */
export function buildBaseReportCatalog(input: BaseCatalogInput): CatalogSources {
  const { inventory, services, brands, contracts } = input;
  return {
    categorias: uniq([...GRUPOS_FALHA, ...inventory.map((i) => i.category || ''), ...services.map((s) => s.category || '')]),
    itens: uniq([...inventory.map((i) => i.name), ...services.map((s) => s.title)]),
    itensDetalhados: [
      ...inventory.map((i) => ({ id: i.id, label: i.name, tipo: 'material' as const, marca: i.brand, modelo: i.model, unidade: i.unit })),
      ...services.map((s) => ({ id: s.id, label: s.title, tipo: 'servico' as const, unidade: 'vb' })),
    ],
    marcas: uniqCI([...brands.map((b) => b.name), ...inventory.map((i) => i.brand || '')]),
    modelos: uniqCI(inventory.map((i) => (i.model || i.name || '').trim())),
    modelosPorMarca: inventory.reduce<Record<string, string[]>>((acc, i) => {
      const marca = (i.brand || '').trim();
      const modelo = (i.model || '').trim() || (i.name || '').trim();
      if (!marca || !modelo) return acc;
      if (!acc[marca]) acc[marca] = [];
      if (!acc[marca].includes(modelo)) acc[marca].push(modelo);
      return acc;
    }, {}),
    modelosPorGrupo: {
      centrais_sdai: uniqCI(inventory.filter((i) => i.category === 'SDAI' && /central|painel/i.test(`${i.subcategory || ''} ${i.name}`)).map((i) => i.model || i.name)),
      gravadores_cftv: uniqCI(inventory.filter((i) => i.category === 'CFTV' && /gravador|nvr|dvr|nvd|mhdx|invd/i.test(`${i.subcategory || ''} ${i.name} ${i.model || ''}`)).map((i) => i.model || i.name)),
      controladoras_acesso: uniqCI(inventory.filter((i) => /controle de acesso/i.test(i.category || '') && /controladora|painel/i.test(`${i.subcategory || ''} ${i.name}`)).map((i) => i.model || i.name)),
      controladores_bms: uniqCI(inventory.filter((i) => i.category === 'BMS' && /controlador|clp|servidor/i.test(`${i.subcategory || ''} ${i.name}`)).map((i) => i.model || i.name)),
      centrais_alarme: uniqCI(inventory.filter((i) => i.category === 'ALARME' && /central/i.test(`${i.subcategory || ''} ${i.name}`)).map((i) => i.model || i.name)),
    },
    detalhesModelo: inventory.reduce<Record<string, { marca?: string; linha?: string; resumo?: string; tecnologias?: string[]; indicacao?: string }>>((acc, item) => {
      const model = (item.model || item.name || '').trim();
      if (model && !acc[model]) acc[model] = { marca: item.brand, linha: item.productLine, resumo: item.shortDescription || item.technicalDescription, tecnologias: item.technologies, indicacao: item.recommendedUse };
      return acc;
    }, {}),
    devices: [],
    contratos: contracts.map((c) => ({ id: c.id, label: `${c.contractType || c.unit || ''} (${c.id})` })),
    pendenciasAprovadas: [],
    pendenciasAbertas: [],
  };
}

/** Rótulo de um device para os selects `origem: 'devices'` (central/falha). */
export function deviceLabel(d: Device): string {
  const tipo = d.tipoAtivo || d.tipoDispositivo || 'Dispositivo';
  const loc = [d.central, d.laco, d.endereco].filter(Boolean).join('/');
  return loc ? `${tipo} · ${loc}` : tipo;
}

/**
 * Augmentação para o Atendimento SDAI (contratual): injeta os devices do cliente
 * (para os selects de central/falha) e as pendências abertas. NÃO altera a base.
 */
export function augmentCatalogForSdaiMaintenance(
  base: CatalogSources,
  input: { devices: Device[]; pendenciasAbertas?: { id: string; descricao?: string; grupo?: string }[] }
): CatalogSources {
  return {
    ...base,
    devices: input.devices.map((d) => ({ id: d.id, label: deviceLabel(d) })),
    pendenciasAbertas: (input.pendenciasAbertas || []).map((p) => ({ id: p.id, label: `${p.grupo || 'Pendência'} — ${p.descricao || ''}`.slice(0, 60) })),
  };
}
