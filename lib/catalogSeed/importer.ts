import { InventoryItem } from '@/lib/types';
import { TECHNICAL_CATALOG_SEED } from './index';
import { normalizedCatalogKey, TechnicalSeedProduct } from './types';

export type TechnicalCatalogPlan = {
  analyzed: number;
  existing: number;
  toInsert: InventoryItem[];
  safeUpdates: InventoryItem[];
  possibleDuplicates: { seed: TechnicalSeedProduct; matches: InventoryItem[] }[];
  byBrand: Record<string, { analyzed: number; existing: number; insert: number }>;
};

const matches = (item: InventoryItem, seed: TechnicalSeedProduct) =>
  normalizedCatalogKey(item.category) === normalizedCatalogKey(seed.category)
  && normalizedCatalogKey(item.brand) === normalizedCatalogKey(seed.brand)
  && normalizedCatalogKey(item.model || item.code) === normalizedCatalogKey(seed.model);

const draftFromSeed = (seed: TechnicalSeedProduct): InventoryItem => ({
  id: `catalog_${normalizedCatalogKey(`${seed.category}-${seed.brand}-${seed.model}`)}`,
  code: seed.model || '', name: seed.name, category: seed.category, subcategory: seed.subcategory,
  quantity: 0, minQuantity: 0, unitPrice: 0, supplier: '', location: '', unit: seed.unit || 'UN',
  stockManaged: false, brand: seed.brand, model: seed.model, productLine: seed.productLine,
  technologies: seed.technologies, catalogStatus: seed.catalogStatus, productType: seed.productType,
  catalogOnly: true, technicalSpecs: seed.technicalSpecs, shortDescription: seed.shortDescription,
  commercialDescription: seed.commercialDescription, technicalDescription: seed.technicalDescription,
  recommendedUse: seed.recommendedUse, systemType: seed.systemType, marketSegment: seed.marketSegment,
  manufacturerUrl: seed.manufacturerUrl,
});

/** Cria uma prévia auditável. Nunca toca saldo, preços, custos ou fornecedor existentes. */
export function planTechnicalCatalogImport(existingItems: InventoryItem[], seeds = TECHNICAL_CATALOG_SEED): TechnicalCatalogPlan {
  const plan: TechnicalCatalogPlan = { analyzed: seeds.length, existing: 0, toInsert: [], safeUpdates: [], possibleDuplicates: [], byBrand: {} };
  for (const seed of seeds) {
    const bucket = plan.byBrand[seed.brand || 'Sem marca'] ||= { analyzed: 0, existing: 0, insert: 0 };
    bucket.analyzed++;
    const found = existingItems.filter((item) => matches(item, seed));
    if (found.length > 1) { plan.possibleDuplicates.push({ seed, matches: found }); continue; }
    if (found.length === 1) {
      plan.existing++; bucket.existing++;
      const current = found[0];
      const patch: InventoryItem = { ...current };
      if (!patch.productLine) patch.productLine = seed.productLine;
      if (!patch.subcategory) patch.subcategory = seed.subcategory;
      if (!patch.shortDescription) patch.shortDescription = seed.shortDescription;
      if (!patch.commercialDescription) patch.commercialDescription = seed.commercialDescription;
      if (!patch.technicalDescription) patch.technicalDescription = seed.technicalDescription;
      if (!patch.recommendedUse) patch.recommendedUse = seed.recommendedUse;
      if (!patch.technicalSpecs && seed.technicalSpecs) patch.technicalSpecs = seed.technicalSpecs;
      if (JSON.stringify(patch) !== JSON.stringify(current)) plan.safeUpdates.push(patch);
      continue;
    }
    plan.toInsert.push(draftFromSeed(seed)); bucket.insert++;
  }
  return plan;
}

export async function applyTechnicalCatalogPlan(plan: TechnicalCatalogPlan, api: { insert: (item: InventoryItem) => Promise<void>; update: (item: InventoryItem) => Promise<void> }) {
  for (const item of plan.safeUpdates) await api.update(item);
  for (const item of plan.toInsert) await api.insert(item);
}
