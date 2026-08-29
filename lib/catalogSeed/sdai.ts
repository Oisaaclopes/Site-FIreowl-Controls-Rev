import { technical, TechnicalSeedProduct } from './types';

const group = (brand: string, line: string, subcategory: string, models: string[], description: string, legacy = false): TechnicalSeedProduct[] => models.map((model) => technical('SDAI', brand, line, subcategory, model, `${description} — ${model}`, { catalogStatus: legacy ? 'LEGADO' : 'ATIVO' }));

export const SDAI_TECHNICAL_SEED: TechnicalSeedProduct[] = [
  ...group('Notifier', 'ONYX', 'Central', ['NFS2-3030', 'NFS-3030', 'NFS2-640', 'NFS-640', 'NFS-320', 'AFP-3030'], 'Central de alarme de incêndio endereçável'),
  ...group('Notifier', 'ONYX', 'Detector de fumaça', ['FSP-951', 'FSP-951T', 'FSP-951R', 'FSP-851'], 'Detector endereçável', false),
  ...group('Notifier', 'ONYX', 'Detector térmico', ['FST-851', 'FST-851R', 'FST-851H', 'FAPT-851'], 'Detector endereçável', true),
  ...group('Notifier', 'ONYX', 'Módulo monitor', ['FMM-1', 'FMM-101', 'FDM-1', 'FZM-1', 'MMX-1'], 'Módulo monitor', false),
  ...group('Notifier', 'ONYX', 'Módulo controle', ['FCM-1', 'FRM-1', 'FCM-1-REL', 'CMX-1'], 'Módulo de controle / relé'),
  ...group('Notifier', 'ONYX', 'Módulo isolador', ['ISO-X', 'ISO-6', 'ISO-6A'], 'Módulo isolador'),
  ...group('Notifier', 'ONYX', 'Base', ['B300-6', 'B300-6-BP', 'B200S', 'B200SR', 'B501', 'B710LP'], 'Base para detector'),
  ...group('Notifier', 'ONYX', 'Anunciador', ['NCA-2', 'NCD', 'NCD-2', 'LCD-160', 'LCD-80', 'LCD2-80', 'ACM-24AT', 'AEM-24AT'], 'Anunciador / display'),
  ...group('Edwards', 'EST3 / Signature', 'Central', ['EST3', 'EST3X'], 'Central inteligente de incêndio'),
  ...group('Edwards', 'Signature Series', 'Detector', ['SIGA-OSD', 'SIGA-HRD', 'SIGA-HFS', 'SIGA-PD', 'SIGA-PS', 'SIGA-IPHS'], 'Detector Signature'),
  ...group('Edwards', 'Signature Series', 'Módulo', ['SIGA-CT1', 'SIGA-CT2', 'SIGA-IM2', 'SIGA-MM1', 'SIGA-CR', 'SIGA-CC1', 'SIGA-CC2', 'SIGA-IM'], 'Módulo Signature'),
  ...group('Bosch', 'FPA / AVENAR / LSN', 'Central', ['FPA-5000', 'FPA-1200', 'AVENAR Panel 8000', 'AVENAR Panel 2000'], 'Central de incêndio'),
  ...group('Bosch', 'LSN', 'Detector', ['FAP-425-O', 'FAP-425-OT', 'FAP-425-DOT', 'FAP-425-DO', 'FAH-425-T-R', 'FAP-520'], 'Detector LSN', false),
  ...group('Bosch', 'LSN', 'Detector por aspiração', ['FAS-420-TM', 'FAS-420-TM-R', 'FAS-420-TP1', 'FAS-420-TP2'], 'Detector por aspiração'),
  ...group('Ascael', 'HORUS', 'Central', ['CAX-i', 'CAX3001'], 'Central endereçável'),
  ...group('Ascael', 'HORUS', 'Detector', ['DFX-i', 'DTX-i', 'DFX3000', 'DTX3000'], 'Detector endereçável'),
  ...group('Ascael', 'HORUS', 'Acionador manual', ['BIX-i', 'BEX-i', 'BIX3000', 'BEX3000'], 'Acionador manual'),
];
