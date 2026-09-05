import type { ClassificationStatus } from './catalogTree';

// =====================================================================
// MAPA EXPLÍCITO de classificação canônica (category + subcategory → nó).
//
// Espelho, em TS testável, do backfill determinístico das migrations 0070/
// 0071/0072 (SDAI + CFTV). NÃO faz matching frouxo: normaliza igual ao
// `fireowl_catalog_norm` do banco e casa por SUBCATEGORIA EXATA normalizada,
// dentro da MESMA área (nunca cruza área). Correspondência inequívoca →
// CLASSIFICADO; família sabida mas tipo/tecnologia ambíguos → REVISAR;
// desconhecida → NAO_CLASSIFICADO (não inventa nó).
//
// A migration 0104 usa exatamente esta tabela (subnorm → code + status),
// resolvendo o UUID pelo `code` estável do nó. Alterar aqui e na 0104 juntos.
// =====================================================================

/** Normalizador determinístico (espelha public.fireowl_catalog_norm). */
export function fireowlCatalogNorm(v?: string): string {
  return (v || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export interface CanonicalMapEntry {
  /** subcategory normalizada (fireowlCatalogNorm). */
  subnorm: string;
  /** code do nó canônico (catalog_taxonomy_nodes.code). */
  code: string;
  status: Extract<ClassificationStatus, 'CLASSIFICADO' | 'REVISAR'>;
}

/** Área → mapa de subcategoria normalizada → nó. Sem cruzamento de área. */
export const CANONICAL_MAP: Record<string, CanonicalMapEntry[]> = {
  sdai: [
    // Precisos → CLASSIFICADO
    { subnorm: 'centraldealarmeenderecavel', code: 'SDAI.CENTRAIS.EQUIP.END', status: 'CLASSIFICADO' },
    { subnorm: 'centraldealarmeconvencional', code: 'SDAI.CENTRAIS.EQUIP.CONV', status: 'CLASSIFICADO' },
    { subnorm: 'placaderedecomunicacaointegracao', code: 'SDAI.CENTRAIS.COMPONENTES.COMUNICACAO', status: 'CLASSIFICADO' },
    { subnorm: 'programadordeenderecos', code: 'SDAI.CENTRAIS.COMPONENTES.PROGRAMACAO', status: 'CLASSIFICADO' },
    { subnorm: 'painelrepetidorsinoticodisplayremoto', code: 'SDAI.ANUNCIADORES', status: 'CLASSIFICADO' },
    { subnorm: 'detectordefumacaenderecaveloptico', code: 'SDAI.DETECTORES.FUMACA.END', status: 'CLASSIFICADO' },
    { subnorm: 'detectordetemperaturatermovelocimetricofixo', code: 'SDAI.DETECTORES.TEMP', status: 'CLASSIFICADO' },
    { subnorm: 'detectordegascoglpamonia', code: 'SDAI.DETECTORES.GAS', status: 'CLASSIFICADO' },
    { subnorm: 'detectorlineardefumacafeixebarreira', code: 'SDAI.DETECTORES.LINEAR', status: 'CLASSIFICADO' },
    { subnorm: 'moduloderelesaida', code: 'SDAI.MODULOS.RELE', status: 'CLASSIFICADO' },
    { subnorm: 'modulomonitorentrada', code: 'SDAI.MODULOS.ENTRADA', status: 'CLASSIFICADO' },
    { subnorm: 'moduloisoladordecurtocircuito', code: 'SDAI.MODULOS.ISOLADOR', status: 'CLASSIFICADO' },
    { subnorm: 'acionadormanualenderecavelrearmavel', code: 'SDAI.ACIONADORES.END', status: 'CLASSIFICADO' },
    { subnorm: 'sireneaudiovisualenderecavelstrobe', code: 'SDAI.SINALIZADORES.END', status: 'CLASSIFICADO' },
    { subnorm: 'sireneaudiovisualconvencional', code: 'SDAI.SINALIZADORES.CONV', status: 'CLASSIFICADO' },
    { subnorm: 'bateriaseladavrlachumboacido', code: 'SDAI.BATERIAS.SELADA', status: 'CLASSIFICADO' },
    { subnorm: 'luminariadeemergencia', code: 'SDAI.EMERGENCIA.LUMINARIAS', status: 'CLASSIFICADO' },
    { subnorm: 'fontedealimentacaoauxiliarsdai', code: 'SDAI.ALIMENTACAO.AUXILIAR', status: 'CLASSIFICADO' },
    // Família sabida, tipo/tecnologia ambíguos → REVISAR (nunca misclassifica)
    { subnorm: 'acionadormanualaprovadetempoip66', code: 'SDAI.ACIONADORES', status: 'REVISAR' },
    { subnorm: 'moduloenderecadordezonaconvencional', code: 'SDAI.MODULOS', status: 'REVISAR' },
    { subnorm: 'central', code: 'SDAI.CENTRAIS.EQUIP', status: 'REVISAR' },
    { subnorm: 'detector', code: 'SDAI.DETECTORES', status: 'REVISAR' },
    { subnorm: 'modulo', code: 'SDAI.MODULOS', status: 'REVISAR' },
    { subnorm: 'acionadormanual', code: 'SDAI.ACIONADORES', status: 'REVISAR' },
  ],
  cftv: [
    { subnorm: 'camerahdcvi', code: 'CFTV.CAMERAS.HDCVI', status: 'CLASSIFICADO' },
    { subnorm: 'gravadornvr', code: 'CFTV.GRAVADORES.NVR', status: 'CLASSIFICADO' },
    { subnorm: 'dvrgravadorhibrido', code: 'CFTV.GRAVADORES.DVR_HIBRIDO', status: 'CLASSIFICADO' },
    { subnorm: 'cameraip', code: 'CFTV.CAMERAS.IP', status: 'CLASSIFICADO' },
    { subnorm: 'cameraipbullet', code: 'CFTV.CAMERAS.IP', status: 'CLASSIFICADO' },
  ],
};

export interface CanonicalResult {
  code?: string;
  status: ClassificationStatus;
}

const UNCLASSIFIED: CanonicalResult = { status: 'NAO_CLASSIFICADO' };

/**
 * Resolve o nó canônico de um item por área + subcategoria (exato, normalizado).
 * `identity` (model/code) só desambigua o caso "Fonte Auxiliar" × "Placa Fonte":
 * placa de fonte da central não é fonte auxiliar → REVISAR na família.
 * Sem subcategoria → NAO_CLASSIFICADO (§7: não inventa família).
 */
export function classifyCanonical(category?: string, subcategory?: string, identity?: string): CanonicalResult {
  const area = fireowlCatalogNorm(category);
  const sub = fireowlCatalogNorm(subcategory);
  if (!area || !sub) return UNCLASSIFIED;
  const table = CANONICAL_MAP[area];
  if (!table) return UNCLASSIFIED; // ALARME/BMS/CONTROLE_ACESSO: sem taxonomia nesta fase
  const hit = table.find((e) => e.subnorm === sub);
  if (!hit) return UNCLASSIFIED;
  // Exceção controlada: "Placa Fonte da central" não é Fonte Auxiliar.
  if (hit.subnorm === 'fontedealimentacaoauxiliarsdai' && fireowlCatalogNorm(identity).includes('placafonte')) {
    return { code: 'SDAI.ALIMENTACAO', status: 'REVISAR' };
  }
  return { code: hit.code, status: hit.status };
}

/** Subcategorias (normalizadas) sem nó canônico — para o relatório (§8). */
export function subcategoriesWithoutNode(pairs: { category?: string; subcategory?: string }[]): string[] {
  const out = new Set<string>();
  for (const p of pairs) {
    const sub = fireowlCatalogNorm(p.subcategory);
    if (!sub) continue;
    if (classifyCanonical(p.category, p.subcategory).status === 'NAO_CLASSIFICADO') {
      out.add(`${fireowlCatalogNorm(p.category) || '—'}:${(p.subcategory || '').trim()}`);
    }
  }
  return [...out].sort();
}
