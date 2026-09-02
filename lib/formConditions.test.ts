import { describe, expect, it } from 'vitest';
import {
  evaluateCondition, isFormTruthy, valuesEqual,
  isFieldVisible, isFieldHidden, isFieldRequired, isFieldDisabled,
  isSectionVisible, collectConditionFieldRefs,
  type Condition,
} from './formConditions';
import { validateFinalize, TemplateSchema, FieldSchema, SectionSchema } from './reportSchema';
import { LEVANTAMENTO_SDAI } from './reportTemplatesData';

const V = (over: Record<string, unknown>) => over;
const cond = (field: string, operator: any, value?: unknown): Condition => ({ field, operator, value });

describe('CAMPO 2A — evaluator (operadores e tipos)', () => {
  it('1. equals true', () => expect(evaluateCondition(cond('a', 'equals', 'x'), V({ a: 'x' }))).toBe(true));
  it('2. equals false', () => expect(evaluateCondition(cond('a', 'equals', 'x'), V({ a: 'y' }))).toBe(false));
  it('3. not_equals', () => expect(evaluateCondition(cond('a', 'not_equals', 'x'), V({ a: 'y' }))).toBe(true));
  it('4. truthy', () => {
    expect(evaluateCondition(cond('a', 'truthy'), V({ a: 'algo' }))).toBe(true);
    expect(evaluateCondition(cond('a', 'truthy'), V({ a: '' }))).toBe(false);
  });
  it('5. falsy', () => {
    expect(evaluateCondition(cond('a', 'falsy'), V({ a: '' }))).toBe(true);
    expect(evaluateCondition(cond('a', 'falsy'), V({ a: 0 }))).toBe(true);
    expect(evaluateCondition(cond('a', 'falsy'), V({ a: [] }))).toBe(true);
  });
  it('6. in', () => expect(evaluateCondition(cond('a', 'in', ['x', 'y']), V({ a: 'y' }))).toBe(true));
  it('7. not_in', () => expect(evaluateCondition(cond('a', 'not_in', ['x', 'y']), V({ a: 'z' }))).toBe(true));
  it('8. contains string', () => expect(evaluateCondition(cond('a', 'contains', 'lo'), V({ a: 'hello' }))).toBe(true));
  it('9. contains array', () => expect(evaluateCondition(cond('a', 'contains', 'x'), V({ a: ['x', 'y'] }))).toBe(true));
  it('10. not_contains', () => expect(evaluateCondition(cond('a', 'not_contains', 'z'), V({ a: ['x', 'y'] }))).toBe(true));
  it('11. greater_than', () => {
    expect(evaluateCondition(cond('a', 'greater_than', 5), V({ a: 6 }))).toBe(true);
    expect(evaluateCondition(cond('a', 'greater_than', 5), V({ a: 5 }))).toBe(false);
  });
  it('12. greater_or_equal', () => expect(evaluateCondition(cond('a', 'greater_or_equal', 5), V({ a: 5 }))).toBe(true));
  it('13. less_than', () => expect(evaluateCondition(cond('a', 'less_than', 5), V({ a: 4 }))).toBe(true));
  it('14. less_or_equal', () => expect(evaluateCondition(cond('a', 'less_or_equal', 5), V({ a: 5 }))).toBe(true));
  it('15. valor null', () => {
    expect(evaluateCondition(cond('a', 'equals', null), V({ a: null }))).toBe(true);
    expect(evaluateCondition(cond('a', 'falsy'), V({ a: null }))).toBe(true);
  });
  it('16. undefined', () => {
    expect(evaluateCondition(cond('a', 'equals', 'x'), V({}))).toBe(false);
    expect(evaluateCondition(cond('a', 'falsy'), V({}))).toBe(true);
  });
  it('17. tipo incompatível → false, sem lançar', () => {
    expect(evaluateCondition(cond('a', 'contains', 'x'), V({ a: 42 }))).toBe(false);
    expect(evaluateCondition(cond('a', 'greater_than', 5), V({ a: 'abc' }))).toBe(false);
    // Sem coerção: 'false' !== false, '1' !== 1.
    expect(valuesEqual('false', false)).toBe(false);
    expect(valuesEqual('1', 1)).toBe(false);
    expect(isFormTruthy('Não')).toBe(true); // string não-vazia é truthy (documentado)
  });
  it('18. AND (all)', () => {
    const c: Condition = { all: [cond('a', 'equals', 'x'), cond('b', 'equals', 'y')] };
    expect(evaluateCondition(c, V({ a: 'x', b: 'y' }))).toBe(true);
    expect(evaluateCondition(c, V({ a: 'x', b: 'z' }))).toBe(false);
  });
  it('19. OR (any)', () => {
    const c: Condition = { any: [cond('a', 'equals', 'x'), cond('b', 'equals', 'y')] };
    expect(evaluateCondition(c, V({ a: 'no', b: 'y' }))).toBe(true);
    expect(evaluateCondition(c, V({ a: 'no', b: 'no' }))).toBe(false);
  });
  it('20. nested (grupo dentro de grupo)', () => {
    const c: Condition = { all: [cond('a', 'equals', 'x'), { any: [cond('b', 'equals', 'y'), cond('c', 'equals', 'z')] }] };
    expect(evaluateCondition(c, V({ a: 'x', b: 'no', c: 'z' }))).toBe(true);
    expect(evaluateCondition(c, V({ a: 'x', b: 'no', c: 'no' }))).toBe(false);
  });
});

describe('CAMPO 2A — wrappers de campo/seção', () => {
  const f = (over: Partial<FieldSchema>): FieldSchema => ({ key: 'k', tipo: 'texto', ...over });

  it('21. show_if verdadeiro → visível', () => {
    const field = f({ show_if: cond('p', 'equals', 'Sim') });
    expect(isFieldVisible(field, V({ p: 'Sim' }))).toBe(true);
  });
  it('22. show_if falso → oculto', () => {
    const field = f({ show_if: cond('p', 'equals', 'Sim') });
    expect(isFieldVisible(field, V({ p: 'Não' }))).toBe(false);
  });
  it('23. hide_if verdadeiro → oculto', () => {
    const field = f({ hide_if: cond('p', 'equals', 'Não possui') });
    expect(isFieldHidden(field, V({ p: 'Não possui' }))).toBe(true);
    expect(isFieldVisible(field, V({ p: 'Sim' }))).toBe(true);
  });
  it('24. required_if verdadeiro → obrigatório', () => {
    const field = f({ required_if: cond('t', 'equals', 'Não') });
    expect(isFieldRequired(field, V({ t: 'Não' }))).toBe(true);
  });
  it('25. required_if falso → não obrigatório', () => {
    const field = f({ required_if: cond('t', 'equals', 'Não') });
    expect(isFieldRequired(field, V({ t: 'Sim' }))).toBe(false);
  });
  it('required: true nunca é desobrigado por required_if ausente; oculto/disabled nunca obriga', () => {
    expect(isFieldRequired(f({ obrigatorio: true }), V({}))).toBe(true);
    // oculto não é obrigatório mesmo com obrigatorio:true
    expect(isFieldRequired(f({ obrigatorio: true, hide_if: cond('p', 'equals', 'x') }), V({ p: 'x' }))).toBe(false);
    // disable_if → visível porém não obrigatório
    const dis = f({ obrigatorio: true, disable_if: cond('p', 'equals', 'x') });
    expect(isFieldDisabled(dis, V({ p: 'x' }))).toBe(true);
    expect(isFieldRequired(dis, V({ p: 'x' }))).toBe(false);
  });
  it('33. condição aponta para campo inexistente — sem crash, fail-safe', () => {
    // show_if inválido → não exibido; hide_if inválido → não esconde; required_if inválido → não obriga.
    expect(() => isFieldVisible(f({ show_if: cond('naoexiste', 'equals', 'x') }), V({}))).not.toThrow();
    expect(isFieldVisible(f({ show_if: cond('naoexiste', 'equals', 'x') }), V({}))).toBe(false);
    expect(isFieldVisible(f({ hide_if: cond('naoexiste', 'equals', 'x') }), V({}))).toBe(true);
    expect(isFieldRequired(f({ required_if: cond('naoexiste', 'equals', 'x') }), V({}))).toBe(false);
  });
  it('pula_se legado continua ocultando a seção (compat)', () => {
    const s: SectionSchema = { key: 's', titulo: 'S', campos: [], pula_se: { campo: 'p', igual: 'Não possui' } };
    expect(isSectionVisible(s, V({ p: 'Não possui' }))).toBe(false);
    expect(isSectionVisible(s, V({ p: 'Sim' }))).toBe(true);
  });
  it('collectConditionFieldRefs lista todos os campos referenciados', () => {
    const c: Condition = { all: [cond('a', 'equals', 1), { any: [cond('b', 'truthy'), cond('c', 'equals', 2)] }] };
    expect(collectConditionFieldRefs(c).sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('CAMPO 2A — validateFinalize respeita condicionais', () => {
  const hasPhoto = (_k: string, _i?: number) => false;
  const tpl = (campos: FieldSchema[], secOver: Partial<SectionSchema> = {}): TemplateSchema => ({
    codigo: 'T', nome: 'T', tipo: 'LEVANTAMENTO',
    secoes: [{ key: 's', titulo: 'Seção', campos, ...secOver }],
  });

  it('26. campo oculto obrigatório NÃO bloqueia', () => {
    const t = tpl([{ key: 'x', tipo: 'texto', obrigatorio: true, hide_if: cond('p', 'equals', 'Não') }]);
    // p = 'Não' → x oculto → sem issue mesmo vazio.
    expect(validateFinalize(t, V({ p: 'Não' }), hasPhoto)).toHaveLength(0);
    // p = 'Sim' → x visível e vazio → 1 issue.
    expect(validateFinalize(t, V({ p: 'Sim' }), hasPhoto)).toHaveLength(1);
  });
  it('27. foto oculta obrigatória NÃO bloqueia', () => {
    const t = tpl([{ key: 'foto_x', tipo: 'foto', obrigatorio: true, hide_if: cond('p', 'equals', 'Não') }]);
    expect(validateFinalize(t, V({ p: 'Não' }), hasPhoto)).toHaveLength(0);
    expect(validateFinalize(t, V({ p: 'Sim' }), hasPhoto).length).toBeGreaterThan(0);
  });
  it('28. foto OPCIONAL nunca é obrigatória', () => {
    const t = tpl([{ key: 'foto_opt', tipo: 'foto' }]);
    expect(validateFinalize(t, V({}), hasPhoto)).toHaveLength(0);
  });
  it('29. repeater oculto NÃO bloqueia (foto por card não é cobrada)', () => {
    const t = tpl([{ key: 'rep', tipo: 'repeater', gera_pendencia: true, hide_if: cond('p', 'equals', 'Não'),
      card_schema: [{ key: 'foto', tipo: 'foto' }] }]);
    // Card iniciado, mas repeater oculto → sem issue.
    expect(validateFinalize(t, V({ p: 'Não', rep: [{ descricao: 'x' }] }), hasPhoto)).toHaveLength(0);
  });
  it('24b/25b. required_if participa da validação', () => {
    const t = tpl([
      { key: 'teste', tipo: 'select', opcoes: ['Sim', 'Não'] },
      { key: 'motivo', tipo: 'texto', required_if: cond('teste', 'equals', 'Não') },
    ]);
    expect(validateFinalize(t, V({ teste: 'Não' }), hasPhoto).some((i) => i.campo === 'motivo')).toBe(true);
    expect(validateFinalize(t, V({ teste: 'Sim' }), hasPhoto)).toHaveLength(0);
  });
  it('30. template SEM condição mantém comportamento (obrigatório vazio bloqueia)', () => {
    const t = tpl([{ key: 'x', tipo: 'texto', obrigatorio: true }]);
    expect(validateFinalize(t, V({}), hasPhoto)).toHaveLength(1);
    expect(validateFinalize(t, V({ x: 'ok' }), hasPhoto)).toHaveLength(0);
  });
  it('34. seção oculta (show_if) não valida', () => {
    const t = tpl([{ key: 'x', tipo: 'texto', obrigatorio: true }], { show_if: cond('p', 'equals', 'Sim') });
    expect(validateFinalize(t, V({ p: 'Não' }), hasPhoto)).toHaveLength(0);
    expect(validateFinalize(t, V({ p: 'Sim' }), hasPhoto)).toHaveLength(1);
  });
  it('31. resposta preservada ao ocultar: valor continua no estado e é ignorado', () => {
    const field: FieldSchema = { key: 'modelo', tipo: 'texto', hide_if: cond('possui', 'equals', 'Não') };
    const values = V({ possui: 'Não', modelo: 'ABC' }); // valor NÃO é apagado pelo motor
    expect((values as any).modelo).toBe('ABC');
    expect(isFieldVisible(field, values)).toBe(false); // oculto, mas preservado
  });
  it('32. mudança de resposta recalcula visibilidade', () => {
    const field: FieldSchema = { key: 'modelo', tipo: 'texto', hide_if: cond('possui', 'equals', 'Não') };
    expect(isFieldVisible(field, V({ possui: 'Sim' }))).toBe(true);
    expect(isFieldVisible(field, V({ possui: 'Não' }))).toBe(false);
  });
});

describe('CAMPO 2A — 35. piloto Levantamento SDAI', () => {
  const hasPhoto = (_k: string, _i?: number) => false;

  it('"Não possui" oculta central e NÃO cobra foto_painel obrigatória', () => {
    const ids = LEVANTAMENTO_SDAI.secoes[0].campos;
    const fotoPainel = ids.find((f) => f.key === 'foto_painel')!;
    // Sanidade: o campo é obrigatório e tem hide_if do piloto.
    expect(fotoPainel.obrigatorio).toBe(true);
    expect(fotoPainel.hide_if).toBeTruthy();
    // Com "Não possui", foto_painel fica oculto → não valida.
    expect(isFieldVisible(fotoPainel, V({ possui_sdai: 'Não possui' }))).toBe(false);
    const naoPossui = validateFinalize(LEVANTAMENTO_SDAI, V({ possui_sdai: 'Não possui' }), hasPhoto);
    expect(naoPossui.some((i) => /painel/i.test(i.campo))).toBe(false);
  });

  it('"Sim, completo" volta a exigir foto_painel', () => {
    const fotoPainel = LEVANTAMENTO_SDAI.secoes[0].campos.find((f) => f.key === 'foto_painel')!;
    expect(isFieldVisible(fotoPainel, V({ possui_sdai: 'Sim, completo' }))).toBe(true);
    const comSdai = validateFinalize(LEVANTAMENTO_SDAI, V({ possui_sdai: 'Sim, completo' }), hasPhoto);
    expect(comSdai.some((i) => /painel/i.test(i.campo))).toBe(true);
  });

  it('motivo_sem_acesso: show_if + required_if pela central inacessível', () => {
    const motivo = LEVANTAMENTO_SDAI.secoes[0].campos.find((f) => f.key === 'motivo_sem_acesso')!;
    const base = { possui_sdai: 'Sim, completo' };
    // Central acessada → campo oculto, não obrigatório.
    expect(isFieldVisible(motivo, V({ ...base, central_operante: 'Sim' }))).toBe(false);
    // Não foi possível acessar → visível e obrigatório.
    const semAcesso = V({ ...base, central_operante: 'Não foi possível acessar' });
    expect(isFieldVisible(motivo, semAcesso)).toBe(true);
    expect(isFieldRequired(motivo, semAcesso)).toBe(true);
  });
});
