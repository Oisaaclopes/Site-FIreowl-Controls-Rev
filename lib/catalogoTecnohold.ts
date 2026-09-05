import { Supplier } from './types';
import { CatalogoProduto } from './catalogoIntelbrasVision';

/* =====================================================================
 * Catálogo de produtos SDAI Tecnohold (linha Safira / Avalon).
 * Fonte: proposta 059024 (Alyon Sistemas de Proteção / Tecnohold),
 * 30/10/2025. O "valor" da proposta é o PREÇO DE CUSTO unitário; a margem
 * padrão (40%) calcula o preço de venda e o markup na importação.
 * ===================================================================== */

export const TECNOHOLD_MARCA = 'Tecnohold';
export const TECNOHOLD_FORNECEDOR = 'Tecnohold';
export const TECNOHOLD_MARGEM = 40; // %

/** Fornecedor Tecnohold (dados da proposta) — criado no módulo Fornecedores. */
export const TECNOHOLD_SUPPLIER: Supplier = {
  id: 'forn-tecnohold',
  code: 'FORN-TECNO',
  name: 'Tecnohold',
  cnpj: '17.652.252/0001-06',
  category: 'SDAI',
  contactName: 'Maiara Kelly da Silva Gomes',
  phone: '(11) 2632-3310',
  email: 'faturamento@tecnohold.com.br',
  city: 'São Paulo - SP',
  rating: 5,
  leadTimeDays: 5,
  activeStatus: 'HOMOLOGADO',
  brands: ['Tecnohold'],
};

// Revisão de dados mestres (SKUs reais do fabricante em `code`; `model` = nome
// comercial oficial). Os antigos "CIE-E065/125/250" eram nomes SINTÉTICOS: a
// linha oficial dessas centrais endereçáveis é Avalon Evolution (65/125/250
// endereços, gabinete ABS/Metálica). `technology` alimenta o autopreenchimento.
export const TECNOHOLD_SDAI: CatalogoProduto[] = [
  // Detectores
  { code: 'DFE485THP1B02', name: 'Detector Óptico de Fumaça Endereçável IP-20 (Safira/Avalon) — DFE485TH', model: 'DFE485TH', subcategory: 'Detector de Fumaça Endereçável (Óptico)', costPrice: 99.96, productLine: 'Safira/Avalon', technology: 'Endereçável', ip: 'IP20' },
  { code: 'DTE485THP1B02', name: 'Detector Termovelocimétrico Endereçável IP-20 (Safira/Avalon) — DTE485TH', model: 'DTE485TH', subcategory: 'Detector de Temperatura (Termovelocimétrico / Fixo)', costPrice: 99.96, productLine: 'Safira/Avalon', technology: 'Endereçável', ip: 'IP20' },
  { code: 'DTLIN01', name: 'Detector Linear de Fumaça Convencional 24V Laser IP-30 — DTLIN01', model: 'DTLIN01', subcategory: 'Detector Linear de Fumaça (Feixe / Barreira)', costPrice: 1900.0, technology: 'Convencional', ip: 'IP30' },

  // Módulos
  { code: 'MCS485THP2B03', name: 'Módulo de Leitura Endereçável Contato Seco NA/NF IP-55 — MCS485TH', model: 'MCS485TH', subcategory: 'Módulo Monitor / Entrada', costPrice: 143.82, technology: 'Endereçável', ip: 'IP55' },
  { code: 'MCB485TH1LP2B03', name: 'Módulo de Leitura Endereçável Laço Conv. Classe B IP-55 — MCB485TH', model: 'MCB485TH', subcategory: 'Módulo Endereçador de Zona Convencional', costPrice: 176.78, technology: 'Endereçável', ip: 'IP55' },
  { code: 'MIRE485THP2B03', name: 'Módulo Isolador de Curto e Repetidor Endereçável IP-55 — MIRE485TH', model: 'MIRE485TH', subcategory: 'Módulo Isolador de Curto-Circuito', costPrice: 218.29, technology: 'Endereçável', ip: 'IP55' },
  { code: 'MRE485THP1B03', name: 'Módulo de Comando de Relés Endereçável IP-20 — MRE485TH', model: 'MRE485TH', subcategory: 'Módulo de Relé / Saída', costPrice: 182.93, technology: 'Endereçável', ip: 'IP20' },

  // Centrais endereçáveis — linha Avalon Evolution (ABS)
  { code: 'PAIE485TH65E.00', name: 'Central SDAI Endereçável 65 endereços — Avalon Evolution (ABS, s/ bateria)', model: 'Avalon Evolution 65 (ABS)', subcategory: 'Central de Alarme Endereçável', costPrice: 756.01, productLine: 'Avalon Evolution', technology: 'Endereçável' },
  { code: 'PAIE485TH125E.00', name: 'Central SDAI Endereçável 125 endereços — Avalon Evolution (ABS, s/ bateria)', model: 'Avalon Evolution 125 (ABS)', subcategory: 'Central de Alarme Endereçável', costPrice: 870.87, productLine: 'Avalon Evolution', technology: 'Endereçável' },
  { code: 'PAIE485TH250E.00', name: 'Central SDAI Endereçável 250 endereços — Avalon Evolution (ABS, s/ bateria)', model: 'Avalon Evolution 250 (ABS)', subcategory: 'Central de Alarme Endereçável', costPrice: 1844.7, productLine: 'Avalon Evolution', technology: 'Endereçável' },
  // Centrais endereçáveis — linha Avalon Evolution (Metálica)
  { code: 'PAIE485TH65E.10', name: 'Central SDAI Endereçável 65 endereços — Avalon Evolution (Metálica, s/ bateria)', model: 'Avalon Evolution 65 (Metálica)', subcategory: 'Central de Alarme Endereçável', costPrice: 931.23, productLine: 'Avalon Evolution', technology: 'Endereçável' },
  { code: 'PAIE485TH125E.10', name: 'Central SDAI Endereçável 125 endereços — Avalon Evolution (Metálica, s/ bateria)', model: 'Avalon Evolution 125 (Metálica)', subcategory: 'Central de Alarme Endereçável', costPrice: 1070.11, productLine: 'Avalon Evolution', technology: 'Endereçável' },
  { code: 'PAIE485TH250E.10', name: 'Central SDAI Endereçável 250 endereços — Avalon Evolution (Metálica, s/ bateria)', model: 'Avalon Evolution 250 (Metálica)', subcategory: 'Central de Alarme Endereçável', costPrice: 2080.65, productLine: 'Avalon Evolution', technology: 'Endereçável' },

  // Sinalizadores audiovisuais
  { code: 'SAVE485THLEDP1B05', name: 'Sinalizador Audiovisual Endereçável LED IP-20 (Safira/Avalon) — SAVE485TH', model: 'SAVE485TH IP-20', subcategory: 'Sirene Audiovisual Endereçável (Strobe)', costPrice: 127.27, productLine: 'Safira/Avalon', technology: 'Endereçável', ip: 'IP20' },
  { code: 'SAVE485THLEDP2B05', name: 'Sinalizador Audiovisual Endereçável LED IP-55 (Safira/Avalon) — SAVE485TH', model: 'SAVE485TH IP-55', subcategory: 'Sirene Audiovisual Endereçável (Strobe)', costPrice: 250.25, productLine: 'Safira/Avalon', technology: 'Endereçável', ip: 'IP55' },
  { code: 'SAVE485THLEDP4B05', name: 'Sinalizador Audiovisual Endereçável LED IP-67 (Safira/Avalon) — SAVE485TH', model: 'SAVE485TH IP-67', subcategory: 'Sirene Audiovisual Endereçável (Strobe)', costPrice: 400.4, productLine: 'Safira/Avalon', technology: 'Endereçável', ip: 'IP67' },

  // Acionadores manuais
  { code: 'AME485THP1B05', name: 'Acionador Manual Endereçável "Aperte Aqui" IP-20 (Safira/Avalon) — AME07', model: 'AME07 IP-20', subcategory: 'Acionador Manual Endereçável (Rearmável)', costPrice: 74.35, productLine: 'Safira/Avalon', technology: 'Endereçável', ip: 'IP20' },
  { code: 'AME485THT12P2B05', name: 'Acionador Manual Endereçável AMET12 sem resina IP-55 (Safira/Avalon)', model: 'AMET12 IP-55', subcategory: 'Acionador Manual Endereçável (Rearmável)', costPrice: 214.44, productLine: 'Safira/Avalon', technology: 'Endereçável', ip: 'IP55' },
  { code: 'AME485THT12P4B05', name: 'Acionador Manual Endereçável AMET12 com resina IP-67 (Safira/Avalon)', model: 'AMET12 IP-67', subcategory: 'Acionador Manual à Prova de Tempo (IP66)', costPrice: 235.59, productLine: 'Safira/Avalon', technology: 'Endereçável', ip: 'IP67' },

  // Fonte / iluminação / baterias
  { code: 'QFAE485THP1B08', name: 'Quadro Fonte Auxiliar Endereçável 24V 5A IP-20 Metálico (s/ bateria) — QFAE485TH', model: 'QFAE485TH', subcategory: 'Fonte de Alimentação Auxiliar (SDAI)', costPrice: 1260.54, technology: 'Endereçável', ip: 'IP20' },
  { code: 'LME-2200.00', name: 'Luminária de Emergência 140 LEDs 2200lm Bivolt IP-20 — LME-2200', model: 'LME-2200', subcategory: 'Luminária de Emergência', costPrice: 89.9, ip: 'IP20' },
  { code: 'BAT0003', name: 'Bateria Selada 12V 1,3Ah Chumbo-Ácida (96,5x45x59mm)', model: 'BAT 12V 1,3Ah', subcategory: 'Bateria Selada (VRLA / Chumbo-Ácido)', costPrice: 57.63 },
  { code: 'BAT0016', name: 'Bateria Selada 12V 5Ah Chumbo-Ácida (90x70x107mm)', model: 'BAT 12V 5Ah', subcategory: 'Bateria Selada (VRLA / Chumbo-Ácido)', costPrice: 97.0 },
];
