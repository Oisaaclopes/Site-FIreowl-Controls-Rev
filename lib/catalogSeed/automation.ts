import { technical, TechnicalSeedProduct } from './types';
const p = (brand: string, line: string, sub: string, models: string[], name: string, type: TechnicalSeedProduct['productType'] = 'EQUIPMENT') => models.map((model) => technical('BMS', brand, line, sub, model, `${name} — ${model}`, { productType: type, stockManaged: false, catalogOnly: true }));
export const AUTOMATION_TECHNICAL_SEED: TechnicalSeedProduct[] = [
  ...p('Johnson Controls', 'Metasys', 'Controlador de aplicação', ['CGM04060-0', 'CGE04060-0', 'CGM09090-0', 'CGE09090-0', 'CVM03050-0', 'CVE03050-0P'], 'Controlador Metasys'),
  ...p('Johnson Controls', 'Metasys', 'Servidor / controlador de rede', ['SNC', 'SNE', 'NAE', 'NCE'], 'Controlador de rede'),
  ...p('Johnson Controls', 'Metasys', 'Software', ['ADS', 'ADX', 'SCT'], 'Software Metasys', 'SOFTWARE'),
  ...p('Schneider Electric', 'SpaceLogic', 'Controlador IP', ['MP-C-15A', 'MP-C-18A', 'MP-C-18B', 'MP-C-24A', 'MP-C-36A'], 'Controlador SpaceLogic'),
  ...p('Schneider Electric', 'SpaceLogic', 'Controlador de ambiente', ['RP-C-12A-M', 'RP-C-12B-M', 'RP-C-16A-M', 'RP-V-5C-M', 'RP-IO-12A-M', 'RP-IO-16E-M'], 'Controlador SpaceLogic'),
  ...p('Mercato', 'Climate', 'Controlador', ['Climate', 'ClimatePRO', 'PowerB'], 'Controlador Mercato'),
];
