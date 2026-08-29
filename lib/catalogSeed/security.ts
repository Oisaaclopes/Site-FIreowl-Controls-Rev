import { technical, TechnicalSeedProduct } from './types';
const products = (area: string, brand: string, line: string, sub: string, models: string[], name: string, technologies: string[] = []) => models.map((model) => technical(area, brand, line, sub, model, `${name} — ${model}`, { technologies }));
export const SECURITY_TECHNICAL_SEED: TechnicalSeedProduct[] = [
  ...products('CFTV', 'Intelbras', 'VIP', 'Câmera IP', ['VIP 1230 B', 'VIP 1230 D', 'VIP 3220 B', 'VIP 3220 D', 'VIP 3230 B SL G3', 'VIP 3240 IA', 'VIP 3216 SD IR IA'], 'Câmera IP', ['PoE', 'ONVIF']),
  ...products('CFTV', 'Intelbras', 'NVD / iNVD', 'Gravador NVR', ['NVD 1304', 'NVD 1408', 'NVD 1416', 'NVD 3116', 'NVD 3316', 'NVD 3332', 'NVD 5124', 'iNVD 3032'], 'Gravador NVR'),
  ...products('CFTV', 'Hikvision', 'AcuSense / ColorVu', 'Câmera IP', ['DS-2CD2043G2-I', 'DS-2CD2046G2-I', 'DS-2CD2143G2-I', 'DS-2CD2343G2-I', 'DS-2CD2347G2-LU', 'DS-2CD2387G2-LU'], 'Câmera IP', ['PoE', 'AcuSense', 'ColorVu', 'ONVIF']),
  ...products('CFTV', 'Hikvision', 'NVR', 'Gravador NVR', ['DS-7608NI-K1', 'DS-7608NI-K1/8P', 'DS-7616NI-K2', 'DS-7616NI-K2/16P', 'DS-7632NI-K2', 'DS-7732NI-K4'], 'Gravador NVR'),
  ...products('ALARME', 'Intelbras', 'AMT / XLine', 'Central de alarme', ['AMT 4010 SMART', 'AMT 8000'], 'Central de alarme'),
  ...products('ALARME', 'Intelbras', 'XLine', 'Sensor', ['IVP 8000 PET', 'IVP 8000 PET CAM', 'IVP 8000 EX', 'XAS 8000', 'TX 8000', 'XSS 8000', 'XAT 8000'], 'Periférico de alarme sem fio'),
];
