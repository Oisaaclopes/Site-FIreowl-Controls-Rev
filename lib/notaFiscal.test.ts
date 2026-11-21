import { describe, it, expect } from 'vitest';
import {
  canManageNotaFiscal,
  isNotaFiscalElegivel,
  isNotaFiscalPendente,
  notaFiscalPendencias,
  notaFiscalStatus,
  semearNotaFiscalAoConcluir,
  aplicarNotaFiscal,
  isNotaFiscalEmitida,
  notasFiscaisEmitidas,
  resumoNotasEmitidas,
  podeInformarNotaFiscal,
  registrarNotaFiscalEmitida,
} from './notaFiscal';
import type { CommercialProposalData, Pedido, PedidoStatus } from './types';

/**
 * Lembrete administrativo de NF — pendência derivada do pedido, idempotente.
 * NÃO é emissão fiscal. Ver [[lib/notaFiscal]].
 */

const proposal = (over: Partial<CommercialProposalData> = {}): CommercialProposalData =>
  ({ valorTotal: 1000, ...over } as CommercialProposalData);

const ped = (over: Partial<Pedido> = {}, propOver: Partial<CommercialProposalData> = {}): Pedido =>
  ({
    id: over.id || 'ped-1',
    numeroPedido: 'PED-2026-001',
    referencia: 'Ref',
    clienteId: 'c1',
    clienteNome: 'Cliente X',
    fornecedor: 'Fireowl',
    dataEmissao: '2026-09-01',
    responsavelComercialId: 'u1',
    responsavelComercialNome: 'Ana',
    status: (over.status || 'concluido') as PedidoStatus,
    proposal: proposal(propOver),
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-10T00:00:00.000Z',
    ...over,
  } as Pedido);

describe('notaFiscal — RBAC de visibilidade', () => {
  it('ADMINISTRATIVO/FINANCEIRO/GESTOR gerem; TÉCNICO nunca', () => {
    expect(canManageNotaFiscal('ADMINISTRATIVO')).toBe(true);
    expect(canManageNotaFiscal('FINANCEIRO')).toBe(true);
    expect(canManageNotaFiscal('GESTOR')).toBe(true);
    expect(canManageNotaFiscal('TECNICO')).toBe(false);
  });
});

describe('notaFiscal — elegibilidade (fato gerador)', () => {
  it('pedido concluído, com valor e não recorrente é elegível', () => {
    expect(isNotaFiscalElegivel(ped({ status: 'concluido' }))).toBe(true);
  });
  it('pedido não concluído não é elegível', () => {
    expect(isNotaFiscalElegivel(ped({ status: 'aceito' }))).toBe(false);
    expect(isNotaFiscalElegivel(ped({ status: 'rascunho' }))).toBe(false);
  });
  it('valor zero não é elegível', () => {
    expect(isNotaFiscalElegivel(ped({ status: 'concluido' }, { valorTotal: 0 }))).toBe(false);
  });
  it('recorrente (fatura por competência) não é elegível — §11', () => {
    expect(isNotaFiscalElegivel(ped({ status: 'concluido' }, { recorrente: true }))).toBe(false);
  });
});

describe('notaFiscal — pendência aberta e lista', () => {
  it('elegível sem registro = pendente', () => {
    const p = ped({ status: 'concluido' });
    expect(notaFiscalStatus(p)).toBe('pendente');
    expect(isNotaFiscalPendente(p)).toBe(true);
  });
  it('emitida/não aplicável saem da lista aberta', () => {
    const emitida = ped({ id: 'a' }, { notaFiscal: { status: 'emitida' } });
    const naoAplic = ped({ id: 'b' }, { notaFiscal: { status: 'nao_aplicavel' } });
    const aberta = ped({ id: 'c' });
    expect(isNotaFiscalPendente(emitida)).toBe(false);
    expect(isNotaFiscalPendente(naoAplic)).toBe(false);
    const abertas = notaFiscalPendencias([emitida, naoAplic, aberta]);
    expect(abertas.map((p) => p.id)).toEqual(['c']);
  });
  it('lista ordena por updatedAt desc', () => {
    const a = ped({ id: 'a', updatedAt: '2026-09-01T00:00:00.000Z' });
    const b = ped({ id: 'b', updatedAt: '2026-09-20T00:00:00.000Z' });
    expect(notaFiscalPendencias([a, b]).map((p) => p.id)).toEqual(['b', 'a']);
  });
});

describe('notaFiscal — semear na conclusão (idempotência)', () => {
  it('semeia pendente quando elegível e ainda sem registro', () => {
    const out = semearNotaFiscalAoConcluir(ped({ status: 'concluido' }));
    expect(out.proposal.notaFiscal?.status).toBe('pendente');
    expect(out.proposal.notaFiscal?.criadaEm).toBeTruthy();
  });
  it('NÃO sobrescreve registro existente (reprocessar não duplica/reabre)', () => {
    const emitida = ped({ status: 'concluido' }, { notaFiscal: { status: 'emitida', numero: '123' } });
    const out = semearNotaFiscalAoConcluir(emitida);
    expect(out.proposal.notaFiscal?.status).toBe('emitida');
    expect(out.proposal.notaFiscal?.numero).toBe('123');
    expect(out).toBe(emitida); // mesma referência: nada mudou
  });
  it('não elegível permanece intacto (sem NF)', () => {
    const naoElegivel = ped({ status: 'concluido' }, { recorrente: true });
    const out = semearNotaFiscalAoConcluir(naoElegivel);
    expect(out.proposal.notaFiscal).toBeUndefined();
  });
});

describe('notaFiscal — resolução preserva histórico', () => {
  it('marcar emitida grava número/data e sai da lista', () => {
    const p = aplicarNotaFiscal(ped({ status: 'concluido' }), { status: 'emitida', numero: 'NF-999', dataEmissao: '2026-09-14' }, 'Ana');
    expect(p.proposal.notaFiscal?.status).toBe('emitida');
    expect(p.proposal.notaFiscal?.numero).toBe('NF-999');
    expect(p.proposal.notaFiscal?.dataEmissao).toBe('2026-09-14');
    expect(p.proposal.notaFiscal?.atualizadaPor).toBe('Ana');
    expect(isNotaFiscalPendente(p)).toBe(false);
  });
  it('marcar não aplicável fecha a pendência', () => {
    const p = aplicarNotaFiscal(ped({ status: 'concluido' }), { status: 'nao_aplicavel', observacao: 'Garantia' });
    expect(notaFiscalStatus(p)).toBe('nao_aplicavel');
    expect(isNotaFiscalPendente(p)).toBe(false);
  });
});

describe('notaFiscal — NFs emitidas (card + selo)', () => {
  const emitida = (id: string, data: string, valor = 1000, numero?: string) =>
    aplicarNotaFiscal(ped({ id }, { valorTotal: valor }), { status: 'emitida', dataEmissao: data, ...(numero ? { numero } : {}) });

  it('selo só aparece para NF emitida', () => {
    expect(isNotaFiscalEmitida(emitida('a', '2026-11-02'))).toBe(true);
    expect(isNotaFiscalEmitida(semearNotaFiscalAoConcluir(ped()))).toBe(false);
    expect(isNotaFiscalEmitida(aplicarNotaFiscal(ped(), { status: 'nao_aplicavel' }))).toBe(false);
    expect(isNotaFiscalEmitida(ped())).toBe(false);
  });

  it('lista emitidas da mais recente para a mais antiga, ignorando outras', () => {
    const lista = notasFiscaisEmitidas([
      emitida('a', '2026-10-05'),
      ped({ id: 'x' }),
      emitida('b', '2026-11-10'),
      aplicarNotaFiscal(ped({ id: 'y' }), { status: 'nao_aplicavel' }),
    ]);
    expect(lista.map((p) => p.id)).toEqual(['b', 'a']);
  });

  it('resumo soma total, mês de referência e conta NFs sem número', () => {
    const r = resumoNotasEmitidas(
      [emitida('a', '2026-10-05', 500, '123'), emitida('b', '2026-11-10', 1500), emitida('c', '2026-11-20', 250, '9')],
      '2026-11',
    );
    expect(r).toEqual({ total: 3, valorTotal: 2250, mes: 2, valorMes: 1750, semNumero: 1, semXml: 3 });
  });
});

describe('notaFiscal — registro antecipado (a partir de ACEITO)', () => {
  it('pode informar em aceito/concluído, com valor e não recorrente', () => {
    expect(podeInformarNotaFiscal(ped({ status: 'aceito' }))).toBe(true);
    expect(podeInformarNotaFiscal(ped({ status: 'concluido' }))).toBe(true);
    expect(podeInformarNotaFiscal(ped({ status: 'em_negociacao' }))).toBe(false);
    expect(podeInformarNotaFiscal(ped({ status: 'aceito' }, { recorrente: true }))).toBe(false);
    expect(podeInformarNotaFiscal(ped({ status: 'aceito' }, { valorTotal: 0 }))).toBe(false);
  });

  it('registra emitida com nº/data e não é reaberta ao concluir depois', () => {
    const aceito = registrarNotaFiscalEmitida(ped({ status: 'aceito' }), { numero: ' 4521 ', dataEmissao: '2026-11-18' }, 'Ana');
    expect(aceito.proposal.notaFiscal).toMatchObject({ status: 'emitida', numero: '4521', dataEmissao: '2026-11-18', atualizadaPor: 'Ana' });
    expect(aceito.proposal.notaFiscal?.criadaEm).toBeTruthy();
    const concluido = semearNotaFiscalAoConcluir({ ...aceito, status: 'concluido' });
    expect(notaFiscalStatus(concluido)).toBe('emitida');
    expect(isNotaFiscalPendente(concluido)).toBe(false);
  });

  it('data vazia usa hoje; campos vazios ficam indefinidos', () => {
    const r = registrarNotaFiscalEmitida(ped({ status: 'aceito' }), { numero: '  ', observacao: '' });
    expect(r.proposal.notaFiscal?.numero).toBeUndefined();
    expect(r.proposal.notaFiscal?.dataEmissao).toBe(new Date().toISOString().slice(0, 10));
  });
});

describe('notaFiscal — anexos e chave de acesso', () => {
  const anexo = (n: string) => ({ path: `ped-1/${n}`, nome: n, enviadoEm: '2026-11-20T00:00:00.000Z' });

  it('grava chave e anexos; edição sem anexos preserva os existentes', () => {
    const com = registrarNotaFiscalEmitida(ped({ status: 'aceito' }), {
      numero: '1', chaveAcesso: ' 4126 ', anexos: { xml: anexo('n.xml'), pdf: anexo('n.pdf') },
    });
    expect(com.proposal.notaFiscal?.chaveAcesso).toBe('4126');
    expect(com.proposal.notaFiscal?.anexos?.pdf?.nome).toBe('n.pdf');
    const editado = registrarNotaFiscalEmitida(com, { numero: '2', chaveAcesso: '4126' });
    expect(editado.proposal.notaFiscal?.anexos?.xml?.nome).toBe('n.xml');
    expect(editado.proposal.notaFiscal?.numero).toBe('2');
  });
});
