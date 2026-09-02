/* =====================================================================
 * CAMPO 2A — Motor genérico de condicionais do FormEngine.
 * Função PURA de avaliação de condições sobre as ANSWERS (não sobre
 * visibilidade). Usada IGUALMENTE pela renderização e pela validação, para
 * nunca duplicar a lógica. Sem hardcode por disciplina, sem chamadas ao banco.
 * ===================================================================== */

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'truthy'
  | 'falsy'
  | 'in'
  | 'not_in'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'greater_or_equal'
  | 'less_than'
  | 'less_or_equal';

/** Condição simples: compara a resposta de `field` com `value`. */
export interface FieldCondition {
  field: string;
  operator: ConditionOperator;
  value?: unknown;
}
export interface ConditionGroupAll { all: Condition[] }
export interface ConditionGroupAny { any: Condition[] }
export type Condition = FieldCondition | ConditionGroupAll | ConditionGroupAny;

/** Propriedades condicionais que um campo pode declarar. */
export interface ConditionalField {
  obrigatorio?: boolean;
  show_if?: Condition;
  hide_if?: Condition;
  required_if?: Condition;
  disable_if?: Condition;
}
/** Propriedades condicionais de uma seção (mantém `pula_se` legado). */
export interface ConditionalSection {
  pula_se?: { campo: string; igual: string };
  show_if?: Condition;
  hide_if?: Condition;
}

type Answers = Record<string, unknown>;

function isGroupAll(c: Condition): c is ConditionGroupAll {
  return (c as ConditionGroupAll).all !== undefined;
}
function isGroupAny(c: Condition): c is ConditionGroupAny {
  return (c as ConditionGroupAny).any !== undefined;
}

/** Verdadeiro/falso "de formulário": vazio, nulo, false, 0, NaN e array vazio
 *  são FALSY. Atenção: a string 'Não' é uma string não-vazia → TRUTHY. Para
 *  perguntas Sim/Não use `equals`/`in`, não `truthy/falsy`. */
export function isFormTruthy(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0 && !Number.isNaN(v);
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  return true; // objeto/card não-vazio
}

/** Igualdade SEM coerção de tipos (FASE 9): 'false' !== false, '1' !== 1.
 *  Arrays comparam como conjunto (mesmo tamanho e mesmos membros). */
export function valuesEqual(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((x) => b.some((y) => valuesEqual(x, y)));
  }
  if (Array.isArray(a) || Array.isArray(b)) return false;
  return a === b;
}

/** Número previsível: só number e string numérica não-vazia convertem; o resto
 *  vira NaN (comparações numéricas com NaN retornam false). */
function toNum(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  return NaN;
}

function containsVal(a: unknown, b: unknown): boolean {
  if (typeof a === 'string') return typeof b === 'string' && a.includes(b);
  if (Array.isArray(a)) return a.some((x) => valuesEqual(x, b));
  return false; // tipo incompatível → não contém
}

function evalLeaf(c: FieldCondition, values: Answers): boolean {
  const a = values[c.field];
  const b = c.value;
  switch (c.operator) {
    case 'equals': return valuesEqual(a, b);
    case 'not_equals': return !valuesEqual(a, b);
    case 'truthy': return isFormTruthy(a);
    case 'falsy': return !isFormTruthy(a);
    case 'in': {
      const member = Array.isArray(b) && b.some((x) => valuesEqual(a, x));
      return member;
    }
    case 'not_in': {
      const member = Array.isArray(b) && b.some((x) => valuesEqual(a, x));
      return !member;
    }
    case 'contains': return containsVal(a, b);
    case 'not_contains': return !containsVal(a, b);
    case 'greater_than': { const x = toNum(a), y = toNum(b); return !Number.isNaN(x) && !Number.isNaN(y) && x > y; }
    case 'greater_or_equal': { const x = toNum(a), y = toNum(b); return !Number.isNaN(x) && !Number.isNaN(y) && x >= y; }
    case 'less_than': { const x = toNum(a), y = toNum(b); return !Number.isNaN(x) && !Number.isNaN(y) && x < y; }
    case 'less_or_equal': { const x = toNum(a), y = toNum(b); return !Number.isNaN(x) && !Number.isNaN(y) && x <= y; }
    default: return false; // operador desconhecido: fail-safe (nunca lança na UI)
  }
}

/**
 * Avalia uma condição contra as respostas atuais. PURA e sem recursão de
 * visibilidade — só lê ANSWERS, então A→B e B→A não geram loop. Uma condição
 * ausente resolve como `true` (o "presente/ausente" é decidido pelos wrappers).
 * Campo referenciado inexistente resolve como `undefined` (fail-safe da FASE 11:
 * show_if inválido esconde, hide_if inválido não esconde, required_if inválido
 * não obriga) — nunca lança erro em produção.
 */
export function evaluateCondition(cond: Condition | undefined | null, values: Answers): boolean {
  if (cond === undefined || cond === null) return true;
  if (isGroupAll(cond)) return cond.all.every((c) => evaluateCondition(c, values));
  if (isGroupAny(cond)) return cond.any.some((c) => evaluateCondition(c, values));
  return evalLeaf(cond, values);
}

/* ----------------------- Wrappers de campo/seção ---------------------- */

export function isFieldHidden(field: ConditionalField, values: Answers): boolean {
  if (field.hide_if && evaluateCondition(field.hide_if, values)) return true;      // 1
  if (field.show_if && !evaluateCondition(field.show_if, values)) return true;     // 2
  return false;
}
export function isFieldVisible(field: ConditionalField, values: Answers): boolean {
  return !isFieldHidden(field, values);
}
export function isFieldDisabled(field: ConditionalField, values: Answers): boolean { // 3
  return !!field.disable_if && evaluateCondition(field.disable_if, values);
}
/** required:true = sempre obrigatório quando VISÍVEL; required_if só adiciona
 *  obrigatoriedade. Campo oculto ou desabilitado nunca é obrigatório (FASE 4). */
export function isFieldRequired(field: ConditionalField, values: Answers): boolean { // 4
  if (isFieldHidden(field, values)) return false;
  if (isFieldDisabled(field, values)) return false;
  if (field.obrigatorio) return true;
  return !!field.required_if && evaluateCondition(field.required_if, values);
}

export function isSectionHidden(section: ConditionalSection, values: Answers): boolean {
  // Compatibilidade: `pula_se` legado continua valendo (adaptado ao evaluator).
  if (section.pula_se && String(values[section.pula_se.campo]) === section.pula_se.igual) return true;
  if (section.hide_if && evaluateCondition(section.hide_if, values)) return true;
  if (section.show_if && !evaluateCondition(section.show_if, values)) return true;
  return false;
}
export function isSectionVisible(section: ConditionalSection, values: Answers): boolean {
  return !isSectionHidden(section, values);
}

/* --------------------- Diagnóstico de configuração -------------------- */

/** Todos os `field` referenciados por uma condição (para validar em dev). */
export function collectConditionFieldRefs(cond: Condition | undefined | null): string[] {
  if (!cond) return [];
  if (isGroupAll(cond)) return cond.all.flatMap(collectConditionFieldRefs);
  if (isGroupAny(cond)) return cond.any.flatMap(collectConditionFieldRefs);
  return [cond.field];
}
