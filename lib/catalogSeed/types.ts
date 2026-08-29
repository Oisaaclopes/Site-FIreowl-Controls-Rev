import { InventoryItem } from '@/lib/types';

export type TechnicalSeedProduct = Pick<InventoryItem, 'category' | 'brand' | 'productLine' | 'subcategory' | 'model' | 'name' | 'unit' | 'productType' | 'catalogStatus' | 'technologies' | 'stockManaged' | 'catalogOnly' | 'technicalSpecs' | 'shortDescription' | 'commercialDescription' | 'technicalDescription' | 'recommendedUse' | 'systemType' | 'marketSegment' | 'manufacturerUrl'>;

export const technical = (category: string, brand: string, productLine: string, subcategory: string, model: string, name: string, options: Partial<TechnicalSeedProduct> = {}): TechnicalSeedProduct => ({
  category, brand, productLine, subcategory, model, name, unit: 'UN', productType: 'EQUIPMENT', catalogStatus: 'ATIVO', stockManaged: false, catalogOnly: true, ...options,
});

export const normalizedCatalogKey = (value: string | undefined) => (value || '').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
