import type { InventoryItem } from './types';
import { normalizedCatalogKey } from './catalogSeed/types';

// =====================================================================
// Taxonomia técnica canônica Fireowl (camada TS).
// Espelha as migrations 0070–0072 e 0115–0117 (nós AREA + domínio
// TRANSVERSAL INFRA). É a fonte de
// verdade dos NÓS, ALIASES e das REGRAS de classificação determinística.
// Nada aqui muda saldo/preço/custo — apenas lê metadados do produto.
// =====================================================================

export type CatalogClassificationStatus = 'CLASSIFICADO' | 'REVISAR' | 'NAO_CLASSIFICADO';
export type CatalogArea = 'SDAI' | 'CFTV' | 'ALARME' | 'BMS' | 'CONTROLE_ACESSO';
export type CatalogNodeType = 'FAMILY' | 'GROUP' | 'TYPE' | 'FUNCTION' | 'TECHNOLOGY' | 'FORM_FACTOR';
/** 0116 — AREA: nó de área comercial; TRANSVERSAL: domínio INFRA (area null). */
export type CatalogScope = 'AREA' | 'TRANSVERSAL';

export interface CatalogTaxonomyNode {
  code: string;
  scope: CatalogScope;
  area: CatalogArea | null;
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
  // 0115 — famílias específicas de CFTV (mesmo nível de Câmeras/Gravadores)
  n('CFTV', null, 'FAMILY', 'CFTV.ARMAZENAMENTO', 'Armazenamento', 30),
  n('CFTV', 'CFTV.ARMAZENAMENTO', 'TYPE', 'CFTV.ARMAZENAMENTO.HD', 'Disco Rígido (HD)', 10),
  n('CFTV', 'CFTV.ARMAZENAMENTO', 'TYPE', 'CFTV.ARMAZENAMENTO.SSD', 'SSD', 20),
  n('CFTV', 'CFTV.ARMAZENAMENTO', 'TYPE', 'CFTV.ARMAZENAMENTO.CARTAO', 'Cartão de Memória', 30),
  n('CFTV', null, 'FAMILY', 'CFTV.TRANSMISSAO', 'Transmissão de Vídeo', 40),
  n('CFTV', 'CFTV.TRANSMISSAO', 'TYPE', 'CFTV.TRANSMISSAO.BALUN', 'Balun', 10),
  n('CFTV', 'CFTV.TRANSMISSAO', 'TYPE', 'CFTV.TRANSMISSAO.EXTENSOR', 'Extensor / Conversor de Vídeo', 20),
  n('CFTV', null, 'FAMILY', 'CFTV.ACESSORIOS', 'Acessórios de Instalação', 50),
  n('CFTV', 'CFTV.ACESSORIOS', 'TYPE', 'CFTV.ACESSORIOS.SUPORTE', 'Suportes', 10),
  n('CFTV', 'CFTV.ACESSORIOS', 'TYPE', 'CFTV.ACESSORIOS.CAIXA', 'Caixas de Passagem / Herméticas', 20),
  n('CFTV', null, 'FAMILY', 'CFTV.VISUALIZACAO', 'Visualização e Operação', 60),
  n('CFTV', 'CFTV.VISUALIZACAO', 'TYPE', 'CFTV.VISUALIZACAO.MONITOR', 'Monitor', 10),
  n('CFTV', 'CFTV.VISUALIZACAO', 'TYPE', 'CFTV.VISUALIZACAO.CONTROLADORA', 'Mesa Controladora / Joystick', 20),
  // 0117 — domínio TRANSVERSAL Infraestrutura (area null; não é área comercial)
  t(null, 'FAMILY', 'INFRA.ENERGIA', 'Energia', 10),
  t('INFRA.ENERGIA', 'TYPE', 'INFRA.ENERGIA.FONTE', 'Fonte', 10),
  t('INFRA.ENERGIA', 'TYPE', 'INFRA.ENERGIA.NOBREAK', 'Nobreak', 20),
  t('INFRA.ENERGIA', 'TYPE', 'INFRA.ENERGIA.BATERIA', 'Bateria', 30),
  t('INFRA.ENERGIA', 'TYPE', 'INFRA.ENERGIA.DPS', 'Proteção Elétrica (DPS)', 40),
  t(null, 'FAMILY', 'INFRA.REDE', 'Rede', 20),
  t('INFRA.REDE', 'TYPE', 'INFRA.REDE.SWITCH', 'Switch', 10),
  t('INFRA.REDE', 'TYPE', 'INFRA.REDE.SWITCH_POE', 'Switch PoE', 20),
  t('INFRA.REDE', 'TYPE', 'INFRA.REDE.POE', 'Injetor / Extensor PoE', 30),
  t('INFRA.REDE', 'TYPE', 'INFRA.REDE.ROTEADOR', 'Roteador / Access Point', 40),
  t('INFRA.REDE', 'TYPE', 'INFRA.REDE.CONVERSOR', 'Conversor de Mídia', 50),
  t(null, 'FAMILY', 'INFRA.CABEAMENTO', 'Cabeamento', 30),
  t('INFRA.CABEAMENTO', 'TYPE', 'INFRA.CABEAMENTO.UTP', 'Cabo UTP', 10),
  t('INFRA.CABEAMENTO', 'TYPE', 'INFRA.CABEAMENTO.COAXIAL', 'Cabo Coaxial', 20),
  t('INFRA.CABEAMENTO', 'TYPE', 'INFRA.CABEAMENTO.FIBRA', 'Fibra Óptica', 30),
  t('INFRA.CABEAMENTO', 'TYPE', 'INFRA.CABEAMENTO.ENERGIA', 'Cabo de Energia / PP', 40),
  t('INFRA.CABEAMENTO', 'TYPE', 'INFRA.CABEAMENTO.VIDEO', 'Cabo HDMI / VGA', 50),
  t('INFRA.CABEAMENTO', 'TYPE', 'INFRA.CABEAMENTO.CONECTORES', 'Conectores', 60),
  t(null, 'FAMILY', 'INFRA.RACKS', 'Racks e Organização', 40),
  t('INFRA.RACKS', 'TYPE', 'INFRA.RACKS.RACK', 'Rack', 10),
  t('INFRA.RACKS', 'TYPE', 'INFRA.RACKS.PATCH_PANEL', 'Patch Panel', 20),
  t('INFRA.RACKS', 'TYPE', 'INFRA.RACKS.ORGANIZADOR', 'Organizador de Cabos', 30),
  t('INFRA.RACKS', 'TYPE', 'INFRA.RACKS.ACESSORIOS', 'Acessórios de Rack', 40),
];

function n(area: CatalogArea, parentCode: string | null, nodeType: CatalogNodeType, code: string, name: string, sortOrder: number): CatalogTaxonomyNode {
  return { scope: 'AREA', area, parentCode, nodeType, code, name, sortOrder };
}

function t(parentCode: string | null, nodeType: CatalogNodeType, code: string, name: string, sortOrder: number): CatalogTaxonomyNode {
  return { scope: 'TRANSVERSAL', area: null, parentCode, nodeType, code, name, sortOrder };
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
  // 0115 — CFTV específico ("Monitor" segue = módulo monitor SDAI)
  ...aliasList('CFTV.ARMAZENAMENTO.HD', ['HD', 'HDD', 'Disco Rígido', 'HD Surveillance', 'HD para CFTV']),
  ...aliasList('CFTV.ARMAZENAMENTO.SSD', ['SSD']),
  ...aliasList('CFTV.ARMAZENAMENTO.CARTAO', ['Cartão de Memória', 'Cartão microSD', 'MicroSD', 'Cartão SD']),
  ...aliasList('CFTV.TRANSMISSAO.BALUN', ['Balun', 'Video Balun', 'Balun HDCVI']),
  ...aliasList('CFTV.TRANSMISSAO.EXTENSOR', ['Extensor de Vídeo', 'Conversor de Vídeo', 'Conversor HDCVI', 'Extensor HDMI']),
  ...aliasList('CFTV.ACESSORIOS.SUPORTE', ['Suporte', 'Suporte para Câmera']),
  ...aliasList('CFTV.ACESSORIOS.CAIXA', ['Caixa de Passagem', 'Caixa Hermética']),
  ...aliasList('CFTV.VISUALIZACAO.MONITOR', ['Monitor de Vídeo', 'Monitor CFTV']),
  ...aliasList('CFTV.VISUALIZACAO.CONTROLADORA', ['Mesa Controladora', 'Joystick', 'Teclado Controlador']),
  // 0117 — Infraestrutura ("Bateria"/"Fonte Auxiliar"/"Fonte Nobreak" seguem SDAI)
  ...aliasList('INFRA.ENERGIA.FONTE', ['Fonte', 'Fonte 12V', 'Fonte Colmeia', 'Fonte Chaveada']),
  ...aliasList('INFRA.ENERGIA.NOBREAK', ['Nobreak', 'UPS']),
  ...aliasList('INFRA.ENERGIA.BATERIA', ['Bateria Estacionária', 'Bateria para Nobreak']),
  ...aliasList('INFRA.ENERGIA.DPS', ['DPS', 'Protetor de Surto', 'Dispositivo de Proteção contra Surtos']),
  ...aliasList('INFRA.REDE.SWITCH', ['Switch', 'Switch de Rede']),
  ...aliasList('INFRA.REDE.SWITCH_POE', ['Switch PoE']),
  ...aliasList('INFRA.REDE.POE', ['Injetor PoE', 'Extensor PoE', 'Splitter PoE']),
  ...aliasList('INFRA.REDE.ROTEADOR', ['Roteador', 'Router', 'Access Point']),
  ...aliasList('INFRA.REDE.CONVERSOR', ['Conversor de Mídia', 'Media Converter']),
  ...aliasList('INFRA.CABEAMENTO.UTP', ['Cabo UTP', 'Cabo de Rede', 'Cabo CAT5e', 'Cabo CAT6']),
  ...aliasList('INFRA.CABEAMENTO.COAXIAL', ['Cabo Coaxial', 'Coaxial', 'Cabo Coaxial Bipolar']),
  ...aliasList('INFRA.CABEAMENTO.FIBRA', ['Fibra Óptica', 'Cabo de Fibra', 'Cordão Óptico']),
  ...aliasList('INFRA.CABEAMENTO.ENERGIA', ['Cabo PP', 'Cabo de Energia']),
  ...aliasList('INFRA.CABEAMENTO.VIDEO', ['Cabo HDMI', 'Cabo VGA']),
  ...aliasList('INFRA.CABEAMENTO.CONECTORES', ['Conector', 'Conector RJ45', 'Conector BNC', 'Conector P4', 'RJ45', 'BNC']),
  ...aliasList('INFRA.RACKS.RACK', ['Rack', 'Rack de Parede', 'Rack de Piso']),
  ...aliasList('INFRA.RACKS.PATCH_PANEL', ['Patch Panel']),
  ...aliasList('INFRA.RACKS.ORGANIZADOR', ['Organizador de Cabos', 'Guia de Cabos']),
  ...aliasList('INFRA.RACKS.ACESSORIOS', ['Acessório de Rack', 'Bandeja de Rack', 'Régua de Tomadas']),
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

/** Famílias raiz do domínio transversal (INFRA). */
export function getTransversalFamilies(): CatalogTaxonomyNode[] {
  return CATALOG_TAXONOMY_NODES
    .filter((node) => node.parentCode === null && node.scope === 'TRANSVERSAL')
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
    // Espelha o CHECK scope/area e o trigger pai/filho da 0116.
    if (node.scope === 'AREA' && !node.area) problems.push(`nó AREA sem área: ${node.code}`);
    if (node.scope === 'TRANSVERSAL' && node.area !== null) problems.push(`nó TRANSVERSAL com área: ${node.code}`);
    if (node.parentCode) {
      const parent = NODE_BY_CODE.get(node.parentCode);
      if (parent && parent.area !== node.area) problems.push(`área divergente do pai: ${node.code}`);
      if (parent && parent.scope !== node.scope) problems.push(`scope divergente do pai: ${node.code}`);
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
