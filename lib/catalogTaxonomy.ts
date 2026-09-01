import type { InventoryItem } from './types';
import { normalizedCatalogKey } from './catalogSeed/types';

// =====================================================================
// Taxonomia técnica canônica Fireowl (camada TS).
// Espelha a migration 0070_canonical_catalog_taxonomy.sql. É a fonte de
// verdade dos NÓS, ALIASES e das REGRAS de classificação determinística.
// Nada aqui muda saldo/preço/custo — apenas lê metadados do produto.
// =====================================================================

export type CatalogClassificationStatus = 'CLASSIFICADO' | 'REVISAR' | 'NAO_CLASSIFICADO';
export type CatalogArea = 'SDAI' | 'CFTV' | 'ALARME' | 'BMS';
export type CatalogNodeType = 'FAMILY' | 'GROUP' | 'TYPE' | 'FUNCTION' | 'TECHNOLOGY' | 'FORM_FACTOR';

export interface CatalogTaxonomyNode {
  code: string;
  area: CatalogArea;
  parentCode: string | null;
  nodeType: CatalogNodeType;
  name: string;
  sortOrder: number;
}

export interface CatalogTaxonomyAlias {
  code: string; // nó canônico de destino
  alias: string;
}

export interface ClassificationResult {
  code: string | null;
  status: CatalogClassificationStatus;
}

// ---- Nós (mesmos códigos/estrutura da migration) --------------------
export const CATALOG_TAXONOMY_NODES: CatalogTaxonomyNode[] = [
  // SDAI — famílias
  n('SDAI', null, 'FAMILY', 'SDAI.CENTRAIS', 'Centrais de Alarme de Incêndio', 10),
  n('SDAI', null, 'FAMILY', 'SDAI.DETECTORES', 'Detectores', 20),
  n('SDAI', null, 'FAMILY', 'SDAI.MODULOS', 'Módulos', 30),
  n('SDAI', null, 'FAMILY', 'SDAI.BASES', 'Bases', 40),
  n('SDAI', null, 'FAMILY', 'SDAI.ACIONADORES', 'Acionadores Manuais', 50),
  n('SDAI', null, 'FAMILY', 'SDAI.ANUNCIADORES', 'Repetidoras / Anunciadores', 60),
  // SDAI — Centrais
  n('SDAI', 'SDAI.CENTRAIS', 'GROUP', 'SDAI.CENTRAIS.EQUIP', 'Equipamentos', 10),
  n('SDAI', 'SDAI.CENTRAIS.EQUIP', 'TECHNOLOGY', 'SDAI.CENTRAIS.EQUIP.END', 'Endereçável', 10),
  n('SDAI', 'SDAI.CENTRAIS.EQUIP', 'TECHNOLOGY', 'SDAI.CENTRAIS.EQUIP.CONV', 'Convencional', 20),
  // 0071 — Componentes / Peças de central (só subtipos com produto real)
  n('SDAI', 'SDAI.CENTRAIS', 'GROUP', 'SDAI.CENTRAIS.COMPONENTES', 'Componentes / Peças', 20),
  n('SDAI', 'SDAI.CENTRAIS.COMPONENTES', 'TYPE', 'SDAI.CENTRAIS.COMPONENTES.COMUNICACAO', 'Comunicação / Rede', 10),
  n('SDAI', 'SDAI.CENTRAIS.COMPONENTES', 'TYPE', 'SDAI.CENTRAIS.COMPONENTES.PROGRAMACAO', 'Programação / Endereçamento', 20),
  // SDAI — Detectores
  n('SDAI', 'SDAI.DETECTORES', 'TYPE', 'SDAI.DETECTORES.FUMACA', 'Fumaça', 10),
  n('SDAI', 'SDAI.DETECTORES.FUMACA', 'TECHNOLOGY', 'SDAI.DETECTORES.FUMACA.END', 'Endereçável', 10),
  n('SDAI', 'SDAI.DETECTORES.FUMACA', 'TECHNOLOGY', 'SDAI.DETECTORES.FUMACA.CONV', 'Convencional', 20),
  n('SDAI', 'SDAI.DETECTORES', 'TYPE', 'SDAI.DETECTORES.TEMP', 'Temperatura', 20),
  n('SDAI', 'SDAI.DETECTORES.TEMP', 'TECHNOLOGY', 'SDAI.DETECTORES.TEMP.END', 'Endereçável', 10),
  n('SDAI', 'SDAI.DETECTORES.TEMP', 'TECHNOLOGY', 'SDAI.DETECTORES.TEMP.CONV', 'Convencional', 20),
  n('SDAI', 'SDAI.DETECTORES', 'TYPE', 'SDAI.DETECTORES.ASP', 'Aspiração', 30),
  // 0071 — novos tipos de detector com produto real (Gás, Linear/Feixe)
  n('SDAI', 'SDAI.DETECTORES', 'TYPE', 'SDAI.DETECTORES.GAS', 'Gás', 40),
  n('SDAI', 'SDAI.DETECTORES', 'TYPE', 'SDAI.DETECTORES.LINEAR', 'Linear / Feixe', 50),
  // 0072 — multicritério (multissensor: óptico+térmico etc.); só endereçável real
  n('SDAI', 'SDAI.DETECTORES', 'TYPE', 'SDAI.DETECTORES.MULTICRITERIO', 'Multicritério', 25),
  n('SDAI', 'SDAI.DETECTORES.MULTICRITERIO', 'TECHNOLOGY', 'SDAI.DETECTORES.MULTICRITERIO.END', 'Endereçável', 10),
  // SDAI — Módulos
  n('SDAI', 'SDAI.MODULOS', 'FUNCTION', 'SDAI.MODULOS.ENTRADA', 'Entrada / Monitor', 10),
  n('SDAI', 'SDAI.MODULOS', 'FUNCTION', 'SDAI.MODULOS.SAIDA', 'Saída / Controle', 20),
  n('SDAI', 'SDAI.MODULOS', 'FUNCTION', 'SDAI.MODULOS.IO', 'Entrada e Saída (I/O)', 30),
  n('SDAI', 'SDAI.MODULOS', 'FUNCTION', 'SDAI.MODULOS.RELE', 'Relé', 40),
  n('SDAI', 'SDAI.MODULOS', 'FUNCTION', 'SDAI.MODULOS.ISOLADOR', 'Isolador', 50),
  // 0072 — módulo de zona (interface de laço/zona convencional no endereçável)
  n('SDAI', 'SDAI.MODULOS', 'FUNCTION', 'SDAI.MODULOS.ZONA', 'Módulo de Zona', 60),
  // SDAI — Acionadores
  n('SDAI', 'SDAI.ACIONADORES', 'TECHNOLOGY', 'SDAI.ACIONADORES.END', 'Endereçável', 10),
  n('SDAI', 'SDAI.ACIONADORES', 'TECHNOLOGY', 'SDAI.ACIONADORES.CONV', 'Convencional', 20),
  // 0071 — famílias novas justificadas por produto real (Intelbras/Tecnohold/Morey)
  n('SDAI', null, 'FAMILY', 'SDAI.SINALIZADORES', 'Sirenes / Sinalizadores', 55),
  n('SDAI', 'SDAI.SINALIZADORES', 'TECHNOLOGY', 'SDAI.SINALIZADORES.END', 'Endereçável', 10),
  n('SDAI', 'SDAI.SINALIZADORES', 'TECHNOLOGY', 'SDAI.SINALIZADORES.CONV', 'Convencional', 20),
  n('SDAI', null, 'FAMILY', 'SDAI.ALIMENTACAO', 'Fontes / Alimentação', 70),
  n('SDAI', 'SDAI.ALIMENTACAO', 'TYPE', 'SDAI.ALIMENTACAO.AUXILIAR', 'Fonte Auxiliar', 10),
  n('SDAI', null, 'FAMILY', 'SDAI.BATERIAS', 'Baterias', 80),
  n('SDAI', 'SDAI.BATERIAS', 'TYPE', 'SDAI.BATERIAS.SELADA', 'Selada / VRLA', 10),
  n('SDAI', null, 'FAMILY', 'SDAI.EMERGENCIA', 'Iluminação de Emergência', 90),
  n('SDAI', 'SDAI.EMERGENCIA', 'TYPE', 'SDAI.EMERGENCIA.LUMINARIAS', 'Luminárias', 10),
  // CFTV
  n('CFTV', null, 'FAMILY', 'CFTV.CAMERAS', 'Câmeras', 10),
  n('CFTV', 'CFTV.CAMERAS', 'TECHNOLOGY', 'CFTV.CAMERAS.IP', 'IP', 10),
  n('CFTV', 'CFTV.CAMERAS.IP', 'FORM_FACTOR', 'CFTV.CAMERAS.IP.BULLET', 'Bullet', 10),
  n('CFTV', 'CFTV.CAMERAS.IP', 'FORM_FACTOR', 'CFTV.CAMERAS.IP.DOME', 'Dome', 20),
  n('CFTV', 'CFTV.CAMERAS', 'TECHNOLOGY', 'CFTV.CAMERAS.HDCVI', 'HDCVI / Analógica', 20),
  n('CFTV', null, 'FAMILY', 'CFTV.GRAVADORES', 'Gravadores', 20),
  n('CFTV', 'CFTV.GRAVADORES', 'TECHNOLOGY', 'CFTV.GRAVADORES.NVR', 'NVR', 10),
  n('CFTV', 'CFTV.GRAVADORES', 'TECHNOLOGY', 'CFTV.GRAVADORES.DVR_HIBRIDO', 'DVR / Híbrido', 20),
];

function n(area: CatalogArea, parentCode: string | null, nodeType: CatalogNodeType, code: string, name: string, sortOrder: number): CatalogTaxonomyNode {
  return { area, parentCode, nodeType, code, name, sortOrder };
}

// ---- Aliases (mesmo conjunto da migration) --------------------------
export const CATALOG_TAXONOMY_ALIASES: CatalogTaxonomyAlias[] = [
  ...aliasList('SDAI.CENTRAIS', ['Central', 'Central de Alarme', 'Central de Incêndio', 'Central de Alarme de Incêndio', 'Painel de Incêndio', 'FACP']),
  ...aliasList('SDAI.MODULOS.ISOLADOR', ['Isolador', 'Isolator', 'Isolator Module', 'Isolador de Laço', 'Módulo Isolador']),
  ...aliasList('SDAI.MODULOS.IO', ['I/O', 'Input Output', 'Input/Output', 'Entrada/Saída', 'Entrada e Saída', 'Módulo de Entrada e Saída']),
  ...aliasList('SDAI.MODULOS.ENTRADA', ['Módulo Monitor', 'Monitor', 'Módulo de Entrada', 'Input Module']),
  ...aliasList('SDAI.MODULOS.SAIDA', ['Módulo de Controle', 'Control Module', 'Módulo de Saída', 'Output Module']),
  ...aliasList('SDAI.MODULOS.RELE', ['Módulo Relé', 'Relé', 'Relay Module', 'Saída Relé']),
  ...aliasList('SDAI.DETECTORES', ['Detector', 'Detetor']),
  ...aliasList('SDAI.DETECTORES.FUMACA', ['Fumaça', 'Smoke', 'Detector de Fumaça']),
  ...aliasList('SDAI.DETECTORES.TEMP', ['Térmico', 'Temperatura', 'Heat', 'Detector Térmico']),
  ...aliasList('SDAI.DETECTORES.ASP', ['Aspiração', 'Detector por Aspiração', 'VESDA']),
  ...aliasList('SDAI.BASES', ['Base', 'Base para Detector']),
  ...aliasList('SDAI.ACIONADORES', ['AM', 'Acionador', 'Acionador Manual', 'Botoeira', 'Manual Call Point', 'Pull Station']),
  ...aliasList('SDAI.ANUNCIADORES', ['Anunciador', 'Repetidora', 'Annunciator']),
  ...aliasList('CFTV.CAMERAS', ['Câmera', 'Camera']),
  ...aliasList('CFTV.CAMERAS.IP', ['Câmera IP', 'Network Camera']),
  ...aliasList('CFTV.CAMERAS.HDCVI', ['HDCVI', 'Analógica', 'Câmera HDCVI']),
  ...aliasList('CFTV.CAMERAS.IP.BULLET', ['Bullet']),
  ...aliasList('CFTV.CAMERAS.IP.DOME', ['Dome']),
  ...aliasList('CFTV.GRAVADORES', ['Gravador', 'Recorder']),
  ...aliasList('CFTV.GRAVADORES.NVR', ['NVR', 'Gravador NVR']),
  ...aliasList('CFTV.GRAVADORES.DVR_HIBRIDO', ['DVR', 'Híbrido', 'Gravador Híbrido']),
  // 0071 — novos ramos SDAI
  ...aliasList('SDAI.SINALIZADORES', ['Sirene', 'Sirene Audiovisual', 'Sinalizador', 'Sinalizador Audiovisual', 'Strobe', 'Sounder', 'Beacon']),
  ...aliasList('SDAI.ALIMENTACAO.AUXILIAR', ['Fonte Auxiliar', 'Fonte de Alimentação Auxiliar', 'Fonte Nobreak', 'QFA', 'QFAE']),
  ...aliasList('SDAI.BATERIAS', ['Bateria']),
  ...aliasList('SDAI.BATERIAS.SELADA', ['Bateria Selada', 'Bateria Chumbo Ácida', 'VRLA', 'Chumbo Ácido']),
  ...aliasList('SDAI.DETECTORES.GAS', ['Detector de Gás', 'Detector Gás', 'Sensor de Gás']),
  ...aliasList('SDAI.DETECTORES.LINEAR', ['Detector Linear', 'Detector de Feixe', 'Beam Detector', 'Barreira Linear']),
  ...aliasList('SDAI.CENTRAIS.COMPONENTES.COMUNICACAO', ['Placa de Rede', 'Placa de Comunicação', 'Gateway', 'Módulo de Comunicação']),
  ...aliasList('SDAI.CENTRAIS.COMPONENTES.PROGRAMACAO', ['Programador de Endereços', 'Programador de Endereço']),
  ...aliasList('SDAI.CENTRAIS.COMPONENTES', ['Componente de Central', 'Peça de Central']),
  ...aliasList('SDAI.EMERGENCIA.LUMINARIAS', ['Luminária de Emergência', 'Iluminação de Emergência', 'Bloco Autônomo']),
  // 0072 — Módulo de Zona e Multicritério
  ...aliasList('SDAI.MODULOS.ZONA', ['Módulo de Zona', 'Módulo Endereçador de Zona', 'Endereçador de Zona', 'Zone Module', 'Módulo para Laço Convencional']),
  ...aliasList('SDAI.DETECTORES.MULTICRITERIO', ['Multicritério', 'Multisensor', 'Multi-criteria']),
];

function aliasList(code: string, aliases: string[]): CatalogTaxonomyAlias[] {
  return aliases.map((alias) => ({ code, alias }));
}

// ---- Índices ---------------------------------------------------------
const NODE_BY_CODE = new Map(CATALOG_TAXONOMY_NODES.map((node) => [node.code, node]));
const ALIAS_INDEX = new Map(CATALOG_TAXONOMY_ALIASES.map((a) => [normalizedCatalogKey(a.alias), a.code]));

// ---- Helpers de árvore ----------------------------------------------
export function getTaxonomyNode(code: string): CatalogTaxonomyNode | undefined {
  return NODE_BY_CODE.get(code);
}

/** Filhos diretos de um nó (ou raízes de uma área quando parentCode = null). */
export function getTaxonomyChildren(code: string | null, area?: CatalogArea): CatalogTaxonomyNode[] {
  return CATALOG_TAXONOMY_NODES
    .filter((node) => node.parentCode === code && (!area || node.area === area))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Caminho raiz→nó (inclui o próprio nó). Vazio se o código não existir. */
export function getTaxonomyPath(code: string): CatalogTaxonomyNode[] {
  const path: CatalogTaxonomyNode[] = [];
  let current = NODE_BY_CODE.get(code);
  const seen = new Set<string>();
  while (current && !seen.has(current.code)) {
    seen.add(current.code);
    path.unshift(current);
    current = current.parentCode ? NODE_BY_CODE.get(current.parentCode) : undefined;
  }
  return path;
}

/** Família (nó FAMILY ancestral) de um código. */
export function getCanonicalFamily(code: string): CatalogTaxonomyNode | undefined {
  return getTaxonomyPath(code).find((node) => node.nodeType === 'FAMILY');
}

/** Nó canônico de um sinônimo/alias (normalizado); null se não houver. */
export function normalizeTaxonomyAlias(term: string | undefined): string | null {
  return ALIAS_INDEX.get(normalizedCatalogKey(term)) ?? null;
}

// ---- Validação de integridade da árvore -----------------------------
export function validateTaxonomyTree(): string[] {
  const problems: string[] = [];
  const codes = new Set(CATALOG_TAXONOMY_NODES.map((node) => node.code));
  for (const node of CATALOG_TAXONOMY_NODES) {
    if (node.parentCode && !codes.has(node.parentCode)) problems.push(`parent inexistente: ${node.code} -> ${node.parentCode}`);
    if (node.parentCode) {
      const parent = NODE_BY_CODE.get(node.parentCode);
      if (parent && parent.area !== node.area) problems.push(`área divergente do pai: ${node.code}`);
    }
    // Ciclo: caminho deve terminar numa raiz sem revisitar.
    const seen = new Set<string>();
    let cur: CatalogTaxonomyNode | undefined = node;
    while (cur && cur.parentCode) {
      if (seen.has(cur.code)) { problems.push(`ciclo detectado em: ${node.code}`); break; }
      seen.add(cur.code);
      cur = NODE_BY_CODE.get(cur.parentCode);
    }
  }
  return problems;
}

// =====================================================================
// Classificador determinístico (espelha o backfill SQL da 0070).
// NÃO usa IA/heurística obscura; só regras explícitas e auditáveis.
// =====================================================================
type ClassifiableItem = Pick<InventoryItem, 'category' | 'brand' | 'subcategory' | 'model' | 'code' | 'productLine' | 'description' | 'name' | 'technicalSpecs'>;

const CLASSIFICADO = (code: string): ClassificationResult => ({ code, status: 'CLASSIFICADO' });
const REVISAR = (code: string): ClassificationResult => ({ code, status: 'REVISAR' });
const NAO_CLASSIFICADO: ClassificationResult = { code: null, status: 'NAO_CLASSIFICADO' };

// ---------------------------------------------------------------------
// Revisão técnica por MODELO (Passada 2.3 / migration 0072). Decisões
// comprovadas em datasheet/documentação do fabricante, espelhadas no
// backfill da 0072. Chave = modelo normalizado (normalizedCatalogKey).
// FAP-520 permanece REVISAR (variante FAP-O 520 vs FAP-OC 520 ambígua).
// ---------------------------------------------------------------------
const REVIEWED_BY_MODEL: Record<string, ClassificationResult> = {
  // Bosch AVENAR 4000
  fap425o: CLASSIFICADO('SDAI.DETECTORES.FUMACA.END'),
  fap425do: CLASSIFICADO('SDAI.DETECTORES.FUMACA.END'),
  fap425ot: CLASSIFICADO('SDAI.DETECTORES.MULTICRITERIO.END'),
  fap425dot: CLASSIFICADO('SDAI.DETECTORES.MULTICRITERIO.END'),
  fah425tr: CLASSIFICADO('SDAI.DETECTORES.TEMP.END'),
  fap520: REVISAR('SDAI.DETECTORES'),
  // Edwards Signature — detectores
  sigaosd: CLASSIFICADO('SDAI.DETECTORES.FUMACA.END'),
  sigapd: CLASSIFICADO('SDAI.DETECTORES.FUMACA.END'),
  sigaps: CLASSIFICADO('SDAI.DETECTORES.FUMACA.END'),
  sigahrd: CLASSIFICADO('SDAI.DETECTORES.TEMP.END'),
  sigahfs: CLASSIFICADO('SDAI.DETECTORES.TEMP.END'),
  sigaiphs: CLASSIFICADO('SDAI.DETECTORES.MULTICRITERIO.END'),
  // Edwards Signature — módulos de entrada/monitor
  sigact1: CLASSIFICADO('SDAI.MODULOS.ENTRADA'),
  sigact2: CLASSIFICADO('SDAI.MODULOS.ENTRADA'),
  sigamm1: CLASSIFICADO('SDAI.MODULOS.ENTRADA'),
  // Edwards Signature — módulos de saída/controle (função operacional)
  sigacc1: CLASSIFICADO('SDAI.MODULOS.SAIDA'),
  sigacc2: CLASSIFICADO('SDAI.MODULOS.SAIDA'),
  // Edwards Signature — isoladores
  sigaim: CLASSIFICADO('SDAI.MODULOS.ISOLADOR'),
  sigaim2: CLASSIFICADO('SDAI.MODULOS.ISOLADOR'),
  // Módulo de zona (Intelbras / Tecnohold)
  mdz521v2: CLASSIFICADO('SDAI.MODULOS.ZONA'),
  mcb485th: CLASSIFICADO('SDAI.MODULOS.ZONA'),
  // Acionadores manuais endereçáveis (IP é atributo, não nó)
  ame566: CLASSIFICADO('SDAI.ACIONADORES.END'),
  amet12ip67: CLASSIFICADO('SDAI.ACIONADORES.END'),
};

export function classifyCatalogItem(item: ClassifiableItem): ClassificationResult {
  const area = normalizedCatalogKey(item.category);
  const sub = normalizedCatalogKey(item.subcategory);
  const brand = normalizedCatalogKey(item.brand);
  const model = item.model || item.code || '';

  // Revisão técnica por modelo tem precedência (decisão comprovada, 0072).
  const reviewed = REVIEWED_BY_MODEL[normalizedCatalogKey(model)];
  if (reviewed) return reviewed;
  const tok = normalizedCatalogKey(`${item.name || ''} ${item.description || ''} ${item.productLine || ''}`);
  const conv = tok.includes('convencional');
  const housing = typeof item.technicalSpecs?.housing === 'string' ? item.technicalSpecs.housing : '';

  if (area === 'sdai') {
    if (sub === 'central') {
      if (conv) return CLASSIFICADO('SDAI.CENTRAIS.EQUIP.CONV');
      if (/enderecavel|inteligente|lsn/.test(tok)) return CLASSIFICADO('SDAI.CENTRAIS.EQUIP.END');
      return REVISAR('SDAI.CENTRAIS.EQUIP');
    }
    if (sub === 'detectordefumaca') return CLASSIFICADO(conv ? 'SDAI.DETECTORES.FUMACA.CONV' : 'SDAI.DETECTORES.FUMACA.END');
    if (sub === 'detectortermico') return CLASSIFICADO(conv ? 'SDAI.DETECTORES.TEMP.CONV' : 'SDAI.DETECTORES.TEMP.END');
    if (sub === 'detectorporaspiracao') return CLASSIFICADO('SDAI.DETECTORES.ASP');
    if (sub === 'detector') {
      if (brand === 'ascael' && /^DF/i.test(model)) return CLASSIFICADO('SDAI.DETECTORES.FUMACA.END');
      if (brand === 'ascael' && /^DT/i.test(model)) return CLASSIFICADO('SDAI.DETECTORES.TEMP.END');
      return REVISAR('SDAI.DETECTORES');
    }
    if (sub === 'modulomonitor') return CLASSIFICADO('SDAI.MODULOS.ENTRADA');
    if (sub === 'modulocontrole') return CLASSIFICADO(/REL/i.test(model) ? 'SDAI.MODULOS.RELE' : 'SDAI.MODULOS.SAIDA');
    if (sub === 'moduloisolador') return CLASSIFICADO('SDAI.MODULOS.ISOLADOR');
    if (sub === 'modulo') return REVISAR('SDAI.MODULOS');
    if (sub === 'base') return CLASSIFICADO('SDAI.BASES');
    if (sub === 'acionadormanual') {
      if (conv) return CLASSIFICADO('SDAI.ACIONADORES.CONV');
      if (/enderecavel|horus/.test(tok)) return CLASSIFICADO('SDAI.ACIONADORES.END');
      return REVISAR('SDAI.ACIONADORES');
    }
    if (sub === 'anunciador') return CLASSIFICADO('SDAI.ANUNCIADORES');

    // ---- 0071: subcategorias reais de produção (Intelbras/Tecnohold/Morey) ----
    // Centrais (tecnologia explícita na subcategoria)
    if (sub === 'centraldealarmeenderecavel') return CLASSIFICADO('SDAI.CENTRAIS.EQUIP.END');
    if (sub === 'centraldealarmeconvencional') return CLASSIFICADO('SDAI.CENTRAIS.EQUIP.CONV');
    // Componentes de central
    if (sub === 'placaderedecomunicacaointegracao') return CLASSIFICADO('SDAI.CENTRAIS.COMPONENTES.COMUNICACAO');
    if (sub === 'programadordeenderecos') return CLASSIFICADO('SDAI.CENTRAIS.COMPONENTES.PROGRAMACAO');
    // Painel repetidor/sinótico = função de repetição remota → família Anunciadores (não Componentes)
    if (sub === 'painelrepetidorsinoticodisplayremoto') return CLASSIFICADO('SDAI.ANUNCIADORES');
    // Detectores (tipo explícito; tecnologia é secundária)
    if (sub === 'detectordefumacaenderecaveloptico') return CLASSIFICADO('SDAI.DETECTORES.FUMACA.END');
    if (sub === 'detectordetemperaturatermovelocimetricofixo') return CLASSIFICADO('SDAI.DETECTORES.TEMP');
    if (sub === 'detectordegascoglpamonia') return CLASSIFICADO('SDAI.DETECTORES.GAS');
    if (sub === 'detectorlineardefumacafeixebarreira') return CLASSIFICADO('SDAI.DETECTORES.LINEAR');
    // Módulos (função explícita)
    if (sub === 'moduloderelesaida') return CLASSIFICADO('SDAI.MODULOS.RELE');
    if (sub === 'modulomonitorentrada') return CLASSIFICADO('SDAI.MODULOS.ENTRADA');
    if (sub === 'moduloisoladordecurtocircuito') return CLASSIFICADO('SDAI.MODULOS.ISOLADOR');
    // Endereçador de zona: função de interface incerta (monitor vs interface) → REVISAR
    if (sub === 'moduloenderecadordezonaconvencional') return REVISAR('SDAI.MODULOS');
    // Acionadores
    if (sub === 'acionadormanualenderecavelrearmavel') return CLASSIFICADO('SDAI.ACIONADORES.END');
    // "À prova de tempo (IP66)" não declara tecnologia → REVISAR na família
    if (sub === 'acionadormanualaprovadetempoip66') return REVISAR('SDAI.ACIONADORES');
    // Sirenes / Sinalizadores
    if (sub === 'sireneaudiovisualenderecavelstrobe') return CLASSIFICADO('SDAI.SINALIZADORES.END');
    if (sub === 'sireneaudiovisualconvencional') return CLASSIFICADO('SDAI.SINALIZADORES.CONV');
    // Fonte auxiliar — "Placa Fonte ..." pode ser fonte interna de central → REVISAR
    if (sub === 'fontedealimentacaoauxiliarsdai') {
      return normalizedCatalogKey(model).includes('placafonte')
        ? REVISAR('SDAI.ALIMENTACAO')
        : CLASSIFICADO('SDAI.ALIMENTACAO.AUXILIAR');
    }
    // Baterias / Iluminação de emergência
    if (sub === 'bateriaseladavrlachumboacido') return CLASSIFICADO('SDAI.BATERIAS.SELADA');
    if (sub === 'luminariadeemergencia') return CLASSIFICADO('SDAI.EMERGENCIA.LUMINARIAS');

    return NAO_CLASSIFICADO;
  }

  if (area === 'cftv') {
    if (sub === 'cameraip' || sub === 'cameraipbullet') {
      if (brand === 'intelbras') {
        if (/(^|\s)B(\s|$)/.test(model) || housing === 'bullet') return CLASSIFICADO('CFTV.CAMERAS.IP.BULLET');
        if (/(^|\s)D(\s|$)/.test(model)) return CLASSIFICADO('CFTV.CAMERAS.IP.DOME');
      }
      return CLASSIFICADO('CFTV.CAMERAS.IP');
    }
    if (sub === 'camerahdcvi') return CLASSIFICADO('CFTV.CAMERAS.HDCVI');
    if (sub === 'gravadornvr') return CLASSIFICADO('CFTV.GRAVADORES.NVR');
    if (sub === 'dvrgravadorhibrido') return CLASSIFICADO('CFTV.GRAVADORES.DVR_HIBRIDO');
    return NAO_CLASSIFICADO;
  }

  // ALARME / BMS / outras áreas: sem classificação nesta passada.
  return NAO_CLASSIFICADO;
}

/**
 * Classificação de exibição de um produto: usa o vínculo persistido
 * (canonical_taxonomy_id resolvido para code) quando existir; senão,
 * deriva pelas regras determinísticas. Nunca inventa fora de SDAI/CFTV.
 */
export function getProductClassification(item: ClassifiableItem & { canonicalCode?: string | null; classificationStatus?: CatalogClassificationStatus }): ClassificationResult {
  if (item.canonicalCode && NODE_BY_CODE.has(item.canonicalCode)) {
    return { code: item.canonicalCode, status: item.classificationStatus ?? 'CLASSIFICADO' };
  }
  return classifyCatalogItem(item);
}
