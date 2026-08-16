/* =====================================================================
 * Catálogo de produtos SDAI Intelbras (fornecedor Vision).
 * Reference data em código: alimenta a importação em massa no Estoque e,
 * por consequência, a "lista pré-pronta" de dispositivos da preventiva SDAI.
 * O valor informado é o PREÇO DE CUSTO; a margem padrão (40%) calcula o
 * preço de venda e o markup na hora de importar.
 * ===================================================================== */

export interface CatalogoProduto {
  code: string;
  name: string;
  /** Subcategoria do Estoque (agrupa a lista pré-pronta da preventiva). */
  subcategory: string;
  /** Preço de custo (R$). */
  costPrice: number;
  /** Indisponível no fornecedor no momento (importado com estoque zerado). */
  indisponivel?: boolean;
}

export const MARCA_PADRAO = 'Intelbras';
export const FORNECEDOR_PADRAO = 'Vision';
export const MARGEM_PADRAO = 40; // % de margem de lucro

export const INTELBRAS_VISION_SDAI: CatalogoProduto[] = [
  // --- Centrais de Alarme de Incêndio ---
  { code: '4611060', name: 'CENTRAL ALARME DE INCÊNDIO CIE 1060', subcategory: 'Central de Alarme Endereçável', costPrice: 672.26 },
  { code: '4610100', name: 'CENTRAL ALARME DE INCÊNDIO CIE 1125', subcategory: 'Central de Alarme Endereçável', costPrice: 1337.76 },
  { code: '4610101', name: 'CENTRAL ALARME DE INCÊNDIO CIE 1250', subcategory: 'Central de Alarme Endereçável', costPrice: 2877.04 },
  { code: '4610102', name: 'CENTRAL ALARME DE INCÊNDIO CIE 2500', subcategory: 'Central de Alarme Endereçável', costPrice: 4385.59 },
  { code: '4610006', name: 'CENTRAL ALARME DE INCÊNDIO CONV. - CIC 06L', subcategory: 'Central de Alarme Convencional', costPrice: 415.03 },
  { code: '4610012', name: 'CENTRAL ALARME DE INCÊNDIO CONV. - CIC 12L', subcategory: 'Central de Alarme Convencional', costPrice: 494.9 },

  // --- Detectores de Fumaça, Temperatura e Gás ---
  { code: '4610050', name: 'DETECTOR DE FUMAÇA ENDEREÇAVEL DFE 523', subcategory: 'Detector de Fumaça Endereçável (Óptico)', costPrice: 101.31 },
  { code: '4613533', name: 'DETECTOR DE TEMPERATURA ENDEREÇAVEL DTE 521', subcategory: 'Detector de Temperatura (Termovelocimétrico / Fixo)', costPrice: 103.81 },
  { code: '4610049', name: 'DETECTOR DE TEMPERATURA ENDEREÇAVEL DTE 523', subcategory: 'Detector de Temperatura (Termovelocimétrico / Fixo)', costPrice: 114.55 },
  { code: '4610024', name: 'DETECTOR DE GÁS CONVENCIONAL DGC 423', subcategory: 'Detector de Gás (CO / GLP / Amônia)', costPrice: 189.9 },
  { code: '4613100', name: 'DETECTOR DE FUMAÇA LINEAR ATÉ 100MTS - DFL 3100', subcategory: 'Detector Linear de Fumaça (Feixe / Barreira)', costPrice: 1841.71 },
  { code: '4610026', name: 'CONJUNTO ESPELHO REFLETORES 4 UN. DFL 3100', subcategory: 'Detector Linear de Fumaça (Feixe / Barreira)', costPrice: 242.49 },

  // --- Acionadores Manuais e Sinalizadores ---
  { code: '4610521', name: 'ACIONADOR MANUAL ENDEREÇAVEL AME 521', subcategory: 'Acionador Manual Endereçável (Rearmável)', costPrice: 73.63 },
  { code: '4610522', name: 'ACIONADOR MANUAL ENDEREÇAVEL AME 522 COM SIRENE', subcategory: 'Acionador Manual Endereçável (Rearmável)', costPrice: 89.09 },
  { code: '4610566', name: 'ACIONADOR MANUAL ENDEREÇAVEL IP 66 AME 566', subcategory: 'Acionador Manual à Prova de Tempo (IP66)', costPrice: 224.88 },
  { code: '4610523', name: 'SINALIZADOR AUDIO VISUAL ENDEREÇAVEL SAV 521 E', subcategory: 'Sirene Audiovisual Endereçável (Strobe)', costPrice: 114.8 },

  // --- Módulos e Acessórios ---
  { code: '4610103', name: 'FONTE AUXILIAR INCÊNDIO FNA520', subcategory: 'Fonte de Alimentação Auxiliar (SDAI)', costPrice: 861.91 },
  { code: '4610041', name: 'ISOLADOR DE LAÇO IDL 521 V2', subcategory: 'Módulo Isolador de Curto-Circuito', costPrice: 91.09 },
  { code: '4610038', name: 'MODULO DE SAÍDA E ENTRADA MIO 521 V2', subcategory: 'Módulo de Relé / Saída', costPrice: 165.19 },
  { code: '4610037', name: 'MODULO DE ZONA MDZ 521 V2', subcategory: 'Módulo Endereçador de Zona Convencional', costPrice: 165.19 },
  { code: '4616656', name: 'MODULO GATEWAY GW521', subcategory: 'Placa de Rede / Comunicação (Integração)', costPrice: 744.04 },
  { code: '4610059', name: 'PROGRAMADOR DE ENDEREÇOS PDE 1000', subcategory: 'Programador de Endereços', costPrice: 249.9 },
  { code: '4610104', name: 'REPETIDORA CENTRAL ENDEREÇAVEL CIE - RP 520', subcategory: 'Painel Repetidor / Sinótico (Display Remoto)', costPrice: 714.04 },
  { code: '4610042', name: 'MODULO DE ENTRADA MDI 521 V2', subcategory: 'Módulo Monitor / Entrada', costPrice: 128.94, indisponivel: true },
  { code: '4612804', name: 'PLACA FONTE CENTRAL CIE', subcategory: 'Fonte de Alimentação Auxiliar (SDAI)', costPrice: 211.19, indisponivel: true },
];
