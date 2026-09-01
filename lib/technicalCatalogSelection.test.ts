import { describe, expect, it } from 'vitest';
import type { InventoryItem } from './types';
import { centralModelsForBrand, centralType, manufacturersForArea, isInvalidTechnoholdSpelling } from './technicalCatalogSelection';
const item=(id:string,category:string,brand:string,model:string,subcategory:string):InventoryItem=>({id,code:id,name:`CENTRAL ${model}`,category,brand,model,subcategory,quantity:0,minQuantity:0,unitPrice:0,supplier:'',location:'',catalogStatus:'ATIVO'});
const data=[item('1','SDAI','Tecnohold','CIE-E065','Central de Alarme Endereçável'),item('bad','SDAI','TECHNOHOLD','ERRADO','Central de Alarme Endereçável'),item('2','SDAI','Intelbras','CIC 06L','Central de Alarme Convencional'),item('3','CFTV','Intelbras','MHDX','Gravador'),item('4','ALARME','JFL','Active','Central de alarme')];
describe('catálogo técnico por área',()=>{
  it('SDAI mostra somente fabricantes SDAI e omite a grafia errada',()=>expect(manufacturersForArea(data,'SDAI')).toEqual(['Intelbras','Tecnohold']));
  it('Tecnohold correto encontra suas centrais',()=>{expect(isInvalidTechnoholdSpelling('TECHNOHOLD')).toBe(true);expect(centralModelsForBrand(data,'SDAI','Tecnohold').map(i=>i.model)).toEqual(['CIE-E065']);});
  it('fabricante filtra modelos',()=>expect(centralModelsForBrand(data,'SDAI','Intelbras').map(i=>i.model)).toEqual(['CIC 06L']));
  it('modelo deriva tipo',()=>{expect(centralType(data[0])).toBe('Endereçável');expect(centralType(data[2])).toBe('Convencional');});
});
