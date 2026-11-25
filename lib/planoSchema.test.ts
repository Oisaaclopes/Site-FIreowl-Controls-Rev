import { describe, expect, it } from 'vitest';
import { PLANO_SCHEMA, extrairJson } from '../supabase/functions/gerar-orcamento/planoSchema';

describe('extrairJson', () => {
  it('lê JSON puro, com cerca markdown ou com texto em volta', () => {
    expect(extrairJson('{"a":1}')).toEqual({ a: 1 });
    expect(extrairJson('```json\n{"a":{"b":[1,2]}}\n```')).toEqual({ a: { b: [1, 2] } });
    expect(extrairJson('Aqui está o plano:\n{"a":"x}"}\nObrigado')).toEqual({ a: 'x}' });
  });
  it('devolve null quando não há JSON válido', () => {
    expect(extrairJson('sem json')).toBeNull();
    expect(extrairJson('{"a":')).toBeNull();
  });
});
import { validarPlano } from './orcamentoIA';

/** Conta propriedades com união de tipos (type: [...] ou anyOf) em todo o schema. */
function contarUnioes(no: unknown): number {
  if (!no || typeof no !== 'object') return 0;
  const o = no as Record<string, unknown>;
  let n = Array.isArray(o.type) || Array.isArray(o.anyOf) ? 1 : 0;
  for (const v of Object.values(o)) {
    if (Array.isArray(v)) n += v.reduce((s: number, x) => s + contarUnioes(x), 0);
    else if (v && typeof v === 'object') n += contarUnioes(v);
  }
  return n;
}

/** Todo objeto precisa de additionalProperties:false e required = todas as chaves (structured outputs). */
function objetosEstritos(no: unknown): boolean {
  if (!no || typeof no !== 'object') return true;
  const o = no as Record<string, unknown>;
  if (o.type === 'object') {
    const props = Object.keys((o.properties as object) || {});
    const req = (o.required as string[]) || [];
    if (o.additionalProperties !== false || props.length !== req.length || !props.every((p) => req.includes(p))) return false;
  }
  return Object.values(o).every((v) => (Array.isArray(v) ? v.every(objetosEstritos) : objetosEstritos(v)));
}

describe('PLANO_SCHEMA (structured outputs)', () => {
  it('respeita o limite da API de 16 campos com união de tipos', () => {
    // Em 25/11/2026 a API recusou o schema com 17 uniões (invalid_request_error).
    expect(contarUnioes(PLANO_SCHEMA)).toBeLessThanOrEqual(16);
  });

  it('todos os objetos são estritos', () => {
    expect(objetosEstritos(PLANO_SCHEMA)).toBe(true);
  });

  it('o validador trata "" como não informado (texto vazio vira null)', () => {
    const { plano, erros } = validarPlano({
      cliente: { clienteId: 'c1', nomeInformado: 'Atlas', candidatosIds: [] },
      dados: { titulo: 'T', local: '', dataEmissao: '', validadeDias: null, prazoExecucao: '', garantiaServicosDias: null, garantiaMateriais: '', formaPagamento: '', areas: ['alarme'], tipoServico: 'instalacao' },
      produtos: [{ chave: 'XG 4G', inventoryItemId: '', acao: 'criar', modelo: 'XG 4G', nome: 'XG 4G', descricao: '', marca: 'Intelbras', categoria: 'ALARME', subcategoria: '', unidade: 'un', custo: 314.23, venda: 408.5, codigoFornecedor: '' }],
      itens: [
        { tipo: 'material', produtoChave: 'XG 4G', descricao: 'Módulo 4G', quantidade: 1, unidade: 'un', precoUnitario: 408.5, opcional: false },
        { tipo: 'servico', produtoChave: '', descricao: 'Instalação', quantidade: 1, unidade: 'vb', precoUnitario: 100, opcional: false },
      ],
      textos: { objetivo: '', solucao: '', responsabilidadesContratada: [], responsabilidadesContratante: [], naoIncluso: [], premissas: [], servicosOfertados: [] },
      totaisInformados: { equipamentos: null, servicos: null, total: null },
      alertas: [],
    });
    expect(erros).toEqual([]);
    expect(plano!.dados.local).toBeNull();
    expect(plano!.dados.dataEmissao).toBeNull();
    expect(plano!.produtos[0].inventoryItemId).toBeNull();
    expect(plano!.produtos[0].codigoFornecedor).toBeNull();
    expect(plano!.itens[1].produtoChave).toBeNull();
  });
});
