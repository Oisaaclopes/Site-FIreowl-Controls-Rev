import type { InventoryItem } from './types';
import { normalizedCatalogKey } from './catalogSeed/types';

const active=(i:InventoryItem)=>!i.catalogStatus||normalizedCatalogKey(i.catalogStatus)==='ativo';
export const sameCatalogValue=(a?:string,b?:string)=>normalizedCatalogKey(a)===normalizedCatalogKey(b);
export const isInvalidTechnoholdSpelling=(value?:string)=>normalizedCatalogKey(value)==='technohold';
export const isCentralItem=(i:InventoryItem)=>/central|painel de incendio/i.test(`${i.subcategory||''} ${i.name||''}`) && !/repetidor|sinotico/i.test(`${i.subcategory||''} ${i.name||''}`);
export function catalogItemsForArea(items:InventoryItem[],area:string){return items.filter(i=>active(i)&&sameCatalogValue(i.category,area));}
export function manufacturersForArea(items:InventoryItem[],area:string):string[]{const map=new Map<string,string>();for(const i of catalogItemsForArea(items,area)){const b=(i.brand||'').trim();if(b&&!isInvalidTechnoholdSpelling(b)&&!map.has(normalizedCatalogKey(b)))map.set(normalizedCatalogKey(b),b);}return [...map.values()].sort((a,b)=>a.localeCompare(b,'pt-BR',{sensitivity:'base'}));}
export function centralModelsForBrand(items:InventoryItem[],area:string,brand:string):InventoryItem[]{return catalogItemsForArea(items,area).filter(i=>sameCatalogValue(i.brand,brand)&&isCentralItem(i)).sort((a,b)=>(a.model||a.name).localeCompare(b.model||b.name,'pt-BR',{sensitivity:'base'}));}
export function centralType(item?:Pick<InventoryItem,'subcategory'|'name'|'technicalSpecs'>):'Convencional'|'Endereçável'|'Não identificado'{const s=normalizedCatalogKey(`${item?.subcategory||''} ${item?.name||''} ${JSON.stringify(item?.technicalSpecs||{})}`);if(s.includes('enderecavel'))return'Endereçável';if(s.includes('convencional')||/\bconv\b/.test(s))return'Convencional';return'Não identificado';}
