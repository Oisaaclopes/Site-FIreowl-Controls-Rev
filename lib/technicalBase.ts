/* ===================================================================
 * ETAPA 3D — Motor multidisciplinar da Base Técnica (configuração ÚNICA).
 * Define, por ÁREA, os grupos (taxonomia), os campos IDENTIFICADORES (que
 * variam por disciplina — §17: identificador não é universal) e ajuda a montar/
 * comparar/exibir ativos. PURO e testável; nada de I/O. A UI e a camada de dados
 * consomem esta config em vez de espalhar regras por dezenas de componentes.
 * =================================================================== */

export type TechArea = 'SDAI' | 'CFTV' | 'CONTROLE_ACESSO' | 'BMS' | 'ALARME';
export type AssetCondition = 'NORMAL' | 'COM_AVARIA' | 'INOPERANTE' | 'NAO_TESTADO' | 'NAO_LOCALIZADO' | 'INADEQUADO';
export type AssetSource = 'LEVANTAMENTO' | 'IMPORTACAO' | 'MANUAL' | 'ATENDIMENTO';
export type SurveyMode = 'PONTUAL' | 'PARCIAL' | 'COMPLETO';

export const AREA_LABEL: Record<TechArea, string> = {
  SDAI: 'SDAI', CFTV: 'CFTV', ALARME: 'Alarme', BMS: 'Automação / BMS', CONTROLE_ACESSO: 'Controle de Acesso',
};
export const AREAS: TechArea[] = ['SDAI', 'CFTV', 'ALARME', 'BMS', 'CONTROLE_ACESSO'];

export const CONDITION_LABEL: Record<AssetCondition, string> = {
  NORMAL: 'Normal', COM_AVARIA: 'Com avaria', INOPERANTE: 'Inoperante',
  NAO_TESTADO: 'Não testado', NAO_LOCALIZADO: 'Não localizado', INADEQUADO: 'Inadequado',
};
export const CONDITIONS: AssetCondition[] = ['NORMAL', 'COM_AVARIA', 'INOPERANTE', 'NAO_TESTADO', 'NAO_LOCALIZADO', 'INADEQUADO'];

export const SOURCE_LABEL: Record<AssetSource, string> = {
  LEVANTAMENTO: 'Levantamento', IMPORTACAO: 'Importação', MANUAL: 'Manual', ATENDIMENTO: 'Atendimento',
};

export const SURVEY_MODE_LABEL: Record<SurveyMode, string> = {
  PONTUAL: 'Pontual', PARCIAL: 'Parcial', COMPLETO: 'Completo',
};

/** Onde o valor do campo é persistido: colunas canônicas (SDAI) ou atributo. */
export type FieldStore = 'central' | 'laco' | 'endereco' | 'attr';
export type FieldKind = 'text' | 'number' | 'ip' | 'mac';
export interface IdentifierField {
  key: string;          // chave (coluna ou nome do atributo)
  label: string;        // rótulo adaptado à disciplina (§17)
  store: FieldStore;    // coluna canônica ou technical_attributes[key]
  kind?: FieldKind;
  placeholder?: string;
  optional?: boolean;
}

/** Grupos (taxonomia) por área — §27/§29/§32/§34/§36. */
export const GROUPS_BY_AREA: Record<TechArea, string[]> = {
  // §5/§6 — "Central SDAI"/"Repetidora de SDAI" desfazem a ambiguidade multidisciplinar
  // com "Central de Alarme". Valores legados ('Central'/'Repetidora') são lidos via legacyGroupLabel().
  SDAI: ['Central SDAI', 'Repetidora de SDAI', 'Acionador Manual', 'Sirene / Sinalizador', 'Detector de Fumaça', 'Detector de Temperatura', 'Detector Multicritério', 'Detector Linear', 'Módulo', 'Fonte / Alimentação', 'Infraestrutura', 'Cabeamento', 'Outro'],
  CFTV: ['DVR', 'NVR', 'XVR', 'Câmera', 'Switch / PoE', 'Fonte', 'Armazenamento', 'Rack', 'Monitor', 'Estação de Monitoramento', 'Rede', 'Cabeamento', 'Infraestrutura', 'Outro'],
  ALARME: ['Central', 'Teclado', 'Sensor PIR', 'Sensor Magnético', 'Sensor Perimetral', 'Sensor de Barreira', 'Sirene', 'Módulo', 'Comunicador', 'Fonte', 'Bateria', 'Infraestrutura', 'Cabeamento', 'Outro'],
  BMS: ['Controlador', 'CLP', 'Módulo I/O', 'Sensor', 'Atuador', 'Inversor', 'Medidor', 'Gateway', 'Painel', 'Rede', 'Fonte', 'Equipamento Monitorado', 'Infraestrutura', 'Outro'],
  CONTROLE_ACESSO: ['Controladora', 'Leitora', 'Fechadura', 'Eletroímã', 'Botoeira', 'Sensor de Porta', 'Fonte', 'Catraca', 'Gateway', 'Rede', 'Infraestrutura', 'Outro'],
};

/** Campos identificadores por área (§18–§23). Não são universais. */
const IDENTIFIERS_BY_AREA: Record<TechArea, IdentifierField[]> = {
  SDAI: [
    { key: 'central', label: 'Nº da Central', store: 'central', kind: 'number', optional: true },
    { key: 'laco', label: 'Nº do Laço', store: 'laco', kind: 'number', optional: true },
    { key: 'endereco', label: 'Nº do Endereço', store: 'endereco', kind: 'number', optional: true },
    { key: 'descricao_programada', label: 'Descrição programada', store: 'attr', optional: true, placeholder: 'Texto EXATO da central (ex.: L2 DF 125 SALA CPD)' },
  ],
  CFTV: [
    { key: 'nvr', label: 'Gravador (NVR/DVR)', store: 'attr', optional: true },
    { key: 'ip', label: 'IP', store: 'attr', kind: 'ip', optional: true, placeholder: '192.168.10.31' },
    { key: 'canal', label: 'Canal', store: 'attr', optional: true, placeholder: '08' },
    { key: 'mac', label: 'MAC', store: 'attr', kind: 'mac', optional: true },
  ],
  ALARME: [
    { key: 'central', label: 'Nº da Central', store: 'central', kind: 'number', optional: true },
    { key: 'particao', label: 'Partição', store: 'attr', optional: true },
    { key: 'zona', label: 'Zona', store: 'attr', kind: 'number', optional: true },
    { key: 'endereco', label: 'Nº do Endereço (barramento)', store: 'endereco', kind: 'number', optional: true },
    { key: 'descricao_programada', label: 'Descrição programada', store: 'attr', optional: true },
  ],
  BMS: [
    { key: 'controlador', label: 'Controlador', store: 'attr', optional: true },
    { key: 'protocolo', label: 'Protocolo', store: 'attr', optional: true, placeholder: 'BACnet/IP, Modbus…' },
    { key: 'ip', label: 'IP', store: 'attr', kind: 'ip', optional: true },
    { key: 'device_instance', label: 'Device Instance', store: 'attr', optional: true },
    { key: 'modbus_id', label: 'Modbus ID', store: 'attr', optional: true },
    { key: 'ponto', label: 'Ponto lógico', store: 'attr', optional: true },
  ],
  CONTROLE_ACESSO: [
    { key: 'controladora', label: 'Controladora', store: 'attr', optional: true },
    { key: 'porta', label: 'Porta', store: 'attr', optional: true, placeholder: 'Entrada Funcionários' },
    { key: 'porta_controladora', label: 'Porta da controladora', store: 'attr', optional: true },
    { key: 'ip', label: 'IP', store: 'attr', kind: 'ip', optional: true },
  ],
};

export const areaLabel = (a?: string) => (a && AREA_LABEL[a as TechArea]) || a || '';
export const groupsForArea = (area: TechArea): string[] => GROUPS_BY_AREA[area] || [];
export const identifierFields = (area: TechArea): IdentifierField[] => IDENTIFIERS_BY_AREA[area] || [];

/**
 * Normaliza rótulos de grupo LEGADOS para a taxonomia canônica atual (§45).
 * Só toca o que é inequívoco POR ÁREA — NUNCA renomeia "Central" de ALARME.
 * Usado na leitura (frontend) para que devices gravados antes da 3D.5 continuem
 * coerentes mesmo antes de aplicar a migration de normalização.
 */
export function legacyGroupLabel(area: string | undefined, grupo: string | undefined): string {
  const g = (grupo || '').trim();
  if (!g) return g;
  if (area === 'SDAI') {
    if (g === 'Central') return 'Central SDAI';
    if (g === 'Repetidora') return 'Repetidora de SDAI';
  }
  return g;
}

/**
 * Identificadores APLICÁVEIS a um grupo (§7/§12). Uma Central SDAI não é um ativo
 * de laço/endereço; um NVR não tem "Canal". Retorna o subconjunto de chaves de
 * IDENTIFIERS_BY_AREA que faz sentido para o grupo. Grupos não mapeados usam o
 * conjunto completo da área (comportamento anterior, seguro).
 */
export function identifierKeysForGroup(area: TechArea, grupo?: string): string[] {
  const all = identifierFields(area).map((f) => f.key);
  const g = legacyGroupLabel(area, grupo);
  const rules = GROUP_IDENTIFIER_RULES[area];
  if (!g || !rules) return all;
  const only = rules[g];
  return only ? only.filter((k) => all.includes(k)) : all;
}

export function identifierFieldsForGroup(area: TechArea, grupo?: string): IdentifierField[] {
  const keys = new Set(identifierKeysForGroup(area, grupo));
  return identifierFields(area).filter((f) => keys.has(f.key));
}

/** Grupos de INFRAESTRUTURA/observação onde fabricante/modelo são opcionais (§16). */
export const INFRA_GROUPS = new Set(['Infraestrutura', 'Cabeamento']);
export const isInfraGroup = (grupo?: string): boolean => INFRA_GROUPS.has((grupo || '').trim());

/**
 * Regras de aplicabilidade de identificadores por grupo (§10–§13/§27–§30).
 * Só definimos exceções; o que não estiver aqui herda o conjunto completo da área.
 */
const GROUP_IDENTIFIER_RULES: Partial<Record<TechArea, Record<string, string[]>>> = {
  SDAI: {
    'Central SDAI': ['central'],                       // central não é endereço de laço
    'Repetidora de SDAI': ['central'],
    'Fonte / Alimentação': ['central'],
    'Infraestrutura': [],
    'Cabeamento': [],
    'Outro': ['central', 'laco', 'endereco', 'descricao_programada'],
    // endereçáveis (Acionador/Sirene/Detectores/Módulo) herdam o conjunto completo
  },
  CFTV: {
    'DVR': ['nvr', 'ip', 'mac'], 'NVR': ['nvr', 'ip', 'mac'], 'XVR': ['nvr', 'ip', 'mac'],
    'Câmera': ['nvr', 'ip', 'canal', 'mac'],
    'Switch / PoE': ['ip', 'mac'], 'Rede': ['ip', 'mac'], 'Monitor': [], 'Rack': [], 'Fonte': [],
    'Armazenamento': ['ip'], 'Estação de Monitoramento': ['ip', 'mac'],
    'Infraestrutura': [], 'Cabeamento': [],
  },
  ALARME: {
    'Central de Alarme': ['central'], 'Central': ['central'],
    'Teclado': ['central', 'particao'],
    'Sensor PIR': ['central', 'particao', 'zona', 'endereco', 'descricao_programada'],
    'Sensor Magnético': ['central', 'particao', 'zona', 'endereco', 'descricao_programada'],
    'Sensor Perimetral': ['central', 'particao', 'zona', 'endereco', 'descricao_programada'],
    'Sensor de Barreira': ['central', 'particao', 'zona', 'endereco', 'descricao_programada'],
    'Sirene': ['central', 'particao', 'zona'], 'Comunicador': ['central'],
    'Fonte': [], 'Bateria': [], 'Infraestrutura': [], 'Cabeamento': [],
  },
  BMS: {
    'Controlador': ['controlador', 'protocolo', 'ip', 'device_instance', 'modbus_id'],
    'CLP': ['controlador', 'protocolo', 'ip', 'device_instance', 'modbus_id'],
    'Gateway': ['controlador', 'protocolo', 'ip'],
    'Módulo I/O': ['controlador', 'device_instance', 'modbus_id', 'ponto'],
    'Sensor': ['controlador', 'ponto'], 'Atuador': ['controlador', 'ponto'], 'Medidor': ['controlador', 'ponto', 'modbus_id'],
    'Inversor': ['controlador', 'modbus_id'], 'Painel': [], 'Rede': ['ip'], 'Fonte': [],
    'Equipamento Monitorado': ['ponto'], 'Infraestrutura': [],
  },
  CONTROLE_ACESSO: {
    'Controladora': ['controladora', 'ip'],
    'Leitora': ['controladora', 'porta', 'porta_controladora'],
    'Fechadura': ['controladora', 'porta'], 'Eletroímã': ['controladora', 'porta'],
    'Botoeira': ['controladora', 'porta'], 'Sensor de Porta': ['controladora', 'porta'],
    'Catraca': ['controladora', 'porta', 'ip'], 'Gateway': ['controladora', 'ip'],
    'Fonte': [], 'Rede': ['ip'], 'Infraestrutura': [],
  },
};

/** Objeto mínimo de ativo que o motor entende (subset do Device). */
export interface AssetLike {
  central?: string; laco?: string; endereco?: string;
  technicalAttributes?: Record<string, unknown>;
}

/** Lê o valor de um campo identificador do ativo (coluna ou atributo). */
export function fieldValue(asset: AssetLike, f: IdentifierField): string {
  const raw = f.store === 'attr' ? asset.technicalAttributes?.[f.key] : (asset as any)[f.store];
  return raw == null ? '' : String(raw);
}

/**
 * Identificador de APRESENTAÇÃO adaptado à área (§17/§19/§24). Ex.: SDAI
 * "Laço 2 · End. 31", CFTV "IP 192.168.10.31 · Canal 08".
 */
export function assetDisplayIdentifier(area: TechArea, asset: AssetLike): string {
  const parts: string[] = [];
  for (const f of identifierFields(area)) {
    const v = fieldValue(asset, f).trim();
    if (!v) continue;
    if (f.key === 'laco') parts.push(`Laço ${v}`);
    else if (f.key === 'endereco') parts.push(`End. ${v}`);
    else if (f.key === 'ip') parts.push(`IP ${v}`);
    else if (f.key === 'canal') parts.push(`Canal ${v}`);
    else if (f.key === 'zona') parts.push(`Zona ${v}`);
    else if (f.key === 'particao') parts.push(`Part. ${v}`);
    else if (f.key === 'device_instance') parts.push(`DI ${v}`);
    else if (f.key === 'porta') parts.push(v);
    else if (f.key === 'descricao_programada') { /* não polui o identificador curto */ }
    else parts.push(`${f.label}: ${v}`);
  }
  return parts.join(' · ');
}

/**
 * Chave de IDENTIDADE técnica p/ deduplicação DENTRO do mesmo cliente+área
 * (§6K). Combina os campos estruturais relevantes; NÃO usa fabricante/modelo.
 * Retorna null quando não há identificador suficiente (não deduplica às cegas).
 */
export function assetIdentityKey(area: TechArea, asset: AssetLike): string | null {
  const g = (k: string, store: FieldStore = 'attr') => fieldValue(asset, { key: k, label: k, store }).trim().toLowerCase();
  // `values` = valores estruturais reais; `disc` = discriminador (não conta como valor).
  let values: string[] = [];
  let disc = '';
  if (area === 'SDAI') values = [g('central', 'central'), g('laco', 'laco'), g('endereco', 'endereco')];
  else if (area === 'CFTV') { const ip = g('ip'); if (ip) { disc = 'ip'; values = [ip]; } else { disc = 'ch'; values = [g('nvr'), g('canal')]; } }
  else if (area === 'ALARME') values = [g('central', 'central'), g('particao'), g('zona'), g('endereco', 'endereco')];
  else if (area === 'BMS') { const di = g('device_instance') || g('ip'); values = [g('controlador'), di]; }
  else if (area === 'CONTROLE_ACESSO') values = [g('controladora'), g('porta'), g('porta_controladora')];
  // Sem NENHUM valor estrutural → não deduplica às cegas.
  if (!values.some((v) => v.trim())) return null;
  const key = [disc, ...values].filter(Boolean).length ? [disc, ...values].join('|') : '';
  return `${area}:${key}`;
}

/**
 * Ativos do POOL cuja identidade técnica bate com `asset` (§5). Vazio quando não
 * há identificador suficiente (não deduplica às cegas) ou nenhum bate. Mais de um
 * resultado = AMBÍGUO → a UI deve pedir confirmação (nunca merge silencioso).
 */
export function findIdentityMatches<T extends AssetLike & { id?: string }>(area: TechArea, asset: AssetLike, pool: T[]): T[] {
  const key = assetIdentityKey(area, asset);
  if (!key) return [];
  return pool.filter((p) => assetIdentityKey(area, p) === key);
}

/** Validação de valor por tipo de campo (§91). Vazio é válido (campos opcionais). */
export function validateIdentifier(kind: FieldKind | undefined, value: string): boolean {
  const v = (value || '').trim();
  if (!v) return true;
  if (kind === 'ip') return /^(\d{1,3})(\.\d{1,3}){3}$/.test(v) && v.split('.').every((o) => Number(o) <= 255);
  if (kind === 'mac') return /^([0-9a-fA-F]{2})([:-][0-9a-fA-F]{2}){5}$/.test(v);
  return true;
}

/** Cobertura de um levantamento (§76/§77). */
export function coverage(expected?: number, verified?: number): { pct: number | null; complete: boolean } {
  if (expected == null || expected <= 0) return { pct: null, complete: false };
  const v = Math.min(verified || 0, expected);
  const pct = Math.round((v / expected) * 1000) / 10;
  return { pct, complete: v >= expected };
}
