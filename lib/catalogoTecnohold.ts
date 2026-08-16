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

export const TECNOHOLD_SDAI: CatalogoProduto[] = [
  // Detectores
  { code: 'DFE485THP1B02', name: 'DETECTOR ÓPTICO DE FUMAÇA ENDEREÇÁVEL IP-20 - DFE485TH (SAFIRA/AVALON)', subcategory: 'Detector de Fumaça Endereçável (Óptico)', costPrice: 99.96 },
  { code: 'DTE485THP1B02', name: 'DETECTOR TERMOVELOCIMÉTRICO ENDEREÇÁVEL IP-20 - DTE485TH (SAFIRA/AVALON)', subcategory: 'Detector de Temperatura (Termovelocimétrico / Fixo)', costPrice: 99.96 },
  { code: 'DTLIN01', name: 'DETECTOR DE FUMAÇA LINEAR CONVENCIONAL 24V LASER IP-30 - DTLIN01', subcategory: 'Detector Linear de Fumaça (Feixe / Barreira)', costPrice: 1900.0 },

  // Módulos
  { code: 'MCS485THP2B03', name: 'MÓDULO DE LEITURA ENDEREÇÁVEL CONTATO SECO NA/NF IP-55 - MCS485TH', subcategory: 'Módulo Monitor / Entrada', costPrice: 143.82 },
  { code: 'MCB485TH1LP2B03', name: 'MÓDULO DE LEITURA ENDEREÇÁVEL LAÇO CONV. CLASSE B IP-55 - MCB485TH', subcategory: 'Módulo Endereçador de Zona Convencional', costPrice: 176.78 },
  { code: 'MIRE485THP2B03', name: 'MÓDULO ISOLADOR DE CURTO E REPETIDOR ENDEREÇÁVEL IP-55 - MIRE485TH', subcategory: 'Módulo Isolador de Curto-Circuito', costPrice: 218.29 },
  { code: 'MRE485THP1B03', name: 'MÓDULO DE COMANDO DE RELÉS ENDEREÇÁVEL IP-20 - MRE485TH', subcategory: 'Módulo de Relé / Saída', costPrice: 182.93 },

  // Centrais endereçáveis (ABS)
  { code: 'PAIE485TH65E.00', name: 'CENTRAL DE ALARME DE INCÊNDIO ENDEREÇÁVEL 65 END. ABS - CIE-E065 AVALON EVOLUTION (S/ BATERIA)', subcategory: 'Central de Alarme Endereçável', costPrice: 756.01 },
  { code: 'PAIE485TH125E.00', name: 'CENTRAL DE ALARME DE INCÊNDIO ENDEREÇÁVEL 125 END. ABS - CIE-E125 AVALON EVOLUTION (S/ BATERIA)', subcategory: 'Central de Alarme Endereçável', costPrice: 870.87 },
  { code: 'PAIE485TH250E.00', name: 'CENTRAL DE ALARME DE INCÊNDIO ENDEREÇÁVEL 250 END. ABS - CIE-E250 AVALON EVOLUTION (S/ BATERIA)', subcategory: 'Central de Alarme Endereçável', costPrice: 1844.7 },
  // Centrais endereçáveis (Metálica)
  { code: 'PAIE485TH65E.10', name: 'CENTRAL DE ALARME DE INCÊNDIO ENDEREÇÁVEL 65 END. METÁLICA - CIE-E065 AVALON EVOLUTION (S/ BATERIA)', subcategory: 'Central de Alarme Endereçável', costPrice: 931.23 },
  { code: 'PAIE485TH125E.10', name: 'CENTRAL DE ALARME DE INCÊNDIO ENDEREÇÁVEL 125 END. METÁLICA - CIE-E125 AVALON EVOLUTION (S/ BATERIA)', subcategory: 'Central de Alarme Endereçável', costPrice: 1070.11 },
  { code: 'PAIE485TH250E.10', name: 'CENTRAL DE ALARME DE INCÊNDIO ENDEREÇÁVEL 250 END. METÁLICA - CIE-E250 AVALON EVOLUTION (S/ BATERIA)', subcategory: 'Central de Alarme Endereçável', costPrice: 2080.65 },

  // Sinalizadores audiovisuais
  { code: 'SAVE485THLEDP1B05', name: 'SINALIZADOR AUDIOVISUAL ENDEREÇÁVEL LED IP-20 - SAVE485TH (SAFIRA/AVALON)', subcategory: 'Sirene Audiovisual Endereçável (Strobe)', costPrice: 127.27 },
  { code: 'SAVE485THLEDP2B05', name: 'SINALIZADOR AUDIOVISUAL ENDEREÇÁVEL LED IP-55 - SAVE485TH (SAFIRA/AVALON)', subcategory: 'Sirene Audiovisual Endereçável (Strobe)', costPrice: 250.25 },
  { code: 'SAVE485THLEDP4B05', name: 'SINALIZADOR AUDIOVISUAL ENDEREÇÁVEL LED IP-67 - SAVE485TH (SAFIRA/AVALON)', subcategory: 'Sirene Audiovisual Endereçável (Strobe)', costPrice: 400.4 },

  // Acionadores manuais
  { code: 'AME485THP1B05', name: 'ACIONADOR MANUAL ENDEREÇÁVEL APERTE AQUI IP-20 - AME07 (SAFIRA/AVALON)', subcategory: 'Acionador Manual Endereçável (Rearmável)', costPrice: 74.35 },
  { code: 'AME485THT12P2B05', name: 'ACIONADOR MANUAL ENDEREÇÁVEL AMET12 SEM RESINA IP-55 - (SAFIRA/AVALON)', subcategory: 'Acionador Manual Endereçável (Rearmável)', costPrice: 214.44 },
  { code: 'AME485THT12P4B05', name: 'ACIONADOR MANUAL ENDEREÇÁVEL AMET12 COM RESINA IP-67 - (SAFIRA/AVALON)', subcategory: 'Acionador Manual à Prova de Tempo (IP66)', costPrice: 235.59 },

  // Fonte / iluminação / baterias
  { code: 'QFAE485THP1B08', name: 'QUADRO FONTE AUXILIAR ENDEREÇÁVEL 24V 5A IP-20 METÁLICO (SEM BATERIA) - QFAE485TH', subcategory: 'Fonte de Alimentação Auxiliar (SDAI)', costPrice: 1260.54 },
  { code: 'LME-2200.00', name: 'LUMINÁRIA DE EMERGÊNCIA 140 LEDS 2200LM BIVOLT IP-20 - LME-2200', subcategory: 'Luminária de Emergência', costPrice: 89.9 },
  { code: 'BAT0003', name: 'BATERIA SELADA 12V 1,3AH CHUMBO-ÁCIDA (96,5x45x59mm)', subcategory: 'Bateria Selada (VRLA / Chumbo-Ácido)', costPrice: 57.63 },
  { code: 'BAT0016', name: 'BATERIA SELADA 12V 5AH CHUMBO-ÁCIDA (90x70x107mm)', subcategory: 'Bateria Selada (VRLA / Chumbo-Ácido)', costPrice: 97.0 },
];
