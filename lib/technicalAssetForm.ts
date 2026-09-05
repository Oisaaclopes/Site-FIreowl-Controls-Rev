/* ===================================================================
 * ETAPA 3D.5 — Configuração CONTEXTUAL única do formulário de ativo (§7/§54).
 * FONTE ÚNICA consumida por: cadastro manual da Base Técnica, Levantamento
 * (TechnicalSurveyFlow), importação e modelo XLSX. Deriva os campos de cada
 * (ÁREA, GRUPO) a partir de technicalBase (identificadores aplicáveis por grupo)
 * + campos comuns (fabricante/modelo do catálogo, série, localização, condição,
 * observação) + extras por grupo (tecnologia, nº de laços, subtipo de infra…).
 * PURO e testável; sem I/O. NÃO espalha if/else por componentes.
 * =================================================================== */
import { TechArea, FieldKind, identifierFieldsForGroup, isInfraGroup, validateIdentifier } from './technicalBase';
import { AssetConditionValue } from './types';

export type AssetFieldStore = 'central' | 'laco' | 'endereco' | 'attr' | 'serial' | 'localizacao';
export type AssetFieldInput = 'text' | 'number' | 'ip' | 'mac' | 'select' | 'textarea';

export interface AssetFormField {
  key: string;
  label: string;
  store: AssetFieldStore;
  attrKey?: string;              // quando store = 'attr'
  input: AssetFieldInput;
  inputMode?: 'numeric';         // teclado numérico no mobile (§14/§65)
  kind?: FieldKind;              // para validateIdentifier (ip/mac/number)
  options?: string[];
  placeholder?: string;
  required?: boolean;
}

export interface AssetFormSpec {
  showCatalog: boolean;          // fabricante/modelo (EquipmentIdentifier)
  catalogOptional: boolean;      // infra: identificação é opcional (§16)
  fields: AssetFormField[];      // identificadores (por grupo) + extras, em ordem
  showSerial: boolean;
  showLocalizacao: boolean;
  showCondition: boolean;
  showObservacao: boolean;
}

const inputForKind = (kind?: FieldKind): { input: AssetFieldInput; inputMode?: 'numeric' } => {
  if (kind === 'ip') return { input: 'ip' };
  if (kind === 'mac') return { input: 'mac' };
  if (kind === 'number') return { input: 'number', inputMode: 'numeric' };
  return { input: 'text' };
};

/** Extras por (área, grupo): atributos que não são identificadores estruturais. */
function extraFields(area: TechArea, group?: string): AssetFormField[] {
  const g = (group || '').trim();
  if (area === 'SDAI' && (g === 'Central SDAI' || g === 'Central')) {
    return [
      { key: 'tecnologia', label: 'Tecnologia', store: 'attr', attrKey: 'tecnologia', input: 'select', options: ['Convencional', 'Endereçável', 'Híbrida', 'Não identificado'] },
      { key: 'qtd_lacos', label: 'Nº de laços instalados', store: 'attr', attrKey: 'qtd_lacos', input: 'number', inputMode: 'numeric', kind: 'number' },
    ];
  }
  if (area === 'CFTV' && (g === 'NVR' || g === 'DVR' || g === 'XVR')) {
    return [{ key: 'qtd_canais', label: 'Nº de canais', store: 'attr', attrKey: 'qtd_canais', input: 'number', inputMode: 'numeric', kind: 'number' }];
  }
  if (isInfraGroup(g)) {
    return [{ key: 'subtipo', label: 'Subtipo', store: 'attr', attrKey: 'subtipo', input: 'select', options: ['Eletroduto', 'Eletrocalha', 'Caixa', 'Cabeamento', 'Fixação', 'Vedação', 'Alimentação', 'Rede', 'Outro'] }];
  }
  return [];
}

/** Monta a especificação completa do formulário para (área, grupo). */
export function assetFormSpec(area: TechArea, group?: string): AssetFormSpec {
  const idents: AssetFormField[] = identifierFieldsForGroup(area, group).map((f) => {
    const io = inputForKind(f.kind);
    return {
      key: f.key,
      label: f.label,
      store: (f.store === 'attr' ? 'attr' : f.store) as AssetFieldStore,
      attrKey: f.store === 'attr' ? f.key : undefined,
      input: io.input,
      inputMode: io.inputMode,
      kind: f.kind,
      placeholder: f.placeholder,
    };
  });
  const infra = isInfraGroup(group);
  return {
    showCatalog: true,
    catalogOptional: infra,
    fields: [...idents, ...extraFields(area, group)],
    showSerial: !infra,          // infra normalmente não tem nº de série
    showLocalizacao: true,
    showCondition: true,
    showObservacao: true,
  };
}

export const SERIAL_FIELD: AssetFormField = { key: 'serial', label: 'Nº de Série', store: 'serial', input: 'text' }; // alfanumérico (§14/§32)
export const LOCALIZACAO_FIELD: AssetFormField = { key: 'localizacao', label: 'Localização', store: 'localizacao', input: 'text' };
export const OBSERVACAO_FIELD: AssetFormField = { key: 'observacao', label: 'Observação técnica', store: 'attr', attrKey: 'observacao', input: 'textarea' };

/* ------------------------- Valores + persistência (fonte única) ------------------------- */
export interface AssetFormValues {
  central?: string; laco?: string; endereco?: string; serial?: string; localizacao?: string;
  condicao?: AssetConditionValue;
  fabricante?: string; modelo?: string; catalogItemId?: string;
  attrs: Record<string, string>;   // descricao_programada, ip, canal, tecnologia, subtipo, observacao…
}

export const emptyAssetValues = (): AssetFormValues => ({ attrs: {}, condicao: 'NORMAL' });

/** Valida os campos segundo o tipo (ip/mac/número). Vazio é válido (opcional). */
export function firstInvalidField(area: TechArea, group: string | undefined, v: AssetFormValues): AssetFormField | null {
  for (const f of assetFormSpec(area, group).fields) {
    const raw = f.store === 'attr' ? (v.attrs[f.attrKey || f.key] || '') : ((v as any)[f.store] || '');
    const val = String(raw).trim();
    if (!val) continue;
    if ((f.input === 'ip' || f.input === 'mac') && !validateIdentifier(f.kind, val)) return f;
    if (f.input === 'number' && !/^[0-9]+$/.test(val)) return f;   // §14 — só números
  }
  return null;
}

/**
 * Converte os valores do formulário no patch de Device (colunas + attrs),
 * respeitando o `store` de cada campo do grupo. NÃO grava serial em número;
 * NÃO herda nada silenciosamente. Base para cadastro manual e levantamento.
 */
export function buildDevicePatch(area: TechArea, group: string | undefined, v: AssetFormValues): Record<string, unknown> {
  const spec = assetFormSpec(area, group);
  const technicalAttributes: Record<string, unknown> = {};
  const patch: Record<string, unknown> = {
    sistema: area,
    grupo: group || undefined,
    fabricante: v.fabricante || undefined,
    modelo: v.modelo || undefined,
    itemCatalogoId: v.catalogItemId || undefined,
    localizacao: v.localizacao || undefined,
    serial: v.serial || undefined,
    condicao: v.condicao || undefined,
    central: undefined, laco: undefined, endereco: undefined,
  };
  for (const f of spec.fields) {
    if (f.store === 'attr') {
      const val = (v.attrs[f.attrKey || f.key] || '').trim();
      if (val) technicalAttributes[f.attrKey || f.key] = val;
    } else if (f.store === 'central' || f.store === 'laco' || f.store === 'endereco') {
      const val = ((v as any)[f.store] || '').trim();
      if (val) (patch as any)[f.store] = val;
    }
  }
  // observação técnica (attr) — sempre disponível
  const obs = (v.attrs['observacao'] || '').trim();
  if (obs) technicalAttributes['observacao'] = obs;
  patch.technicalAttributes = technicalAttributes;
  return patch;
}
