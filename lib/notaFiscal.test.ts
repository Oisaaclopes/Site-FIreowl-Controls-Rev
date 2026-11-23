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
  salvarNotasDoPedido,
  notasDoPedido,
  valorDaNota,
  linhasNotasEmitidas,
  resumoSeloNotas,
  tipoNotaPadrao,
} from './notaFiscal';
import type { CommercialProposalData, NotaFiscalItem, Pedido, PedidoStatus } from './types';

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
});

const nota = (over: Partial<NotaFiscalItem> = {}): NotaFiscalItem =>
  ({ id: over.id || 'n1', tipo: 'servico', ...over } as NotaFiscalItem);

describe('notaFiscal — registro antecipado (a partir de ACEITO)', () => {
  it('pode informar em aceito/concluído com valor, inclusive recorrente', () => {
    expect(podeInformarNotaFiscal(ped({ status: 'aceito' }))).toBe(true);
    expect(podeInformarNotaFiscal(ped({ status: 'concluido' }))).toBe(true);
    expect(podeInformarNotaFiscal(ped({ status: 'em_negociacao' }))).toBe(false);
    // Recorrente: registro manual liberado (bug: botão sumia em pedidos aceitos recorrentes).
    expect(podeInformarNotaFiscal(ped({ status: 'aceito' }, { recorrente: true }))).toBe(true);
    // ...mas o lembrete automático segue excluindo recorrente.
    expect(isNotaFiscalPendente(salvarNotasDoPedido(ped({ status: 'concluido' }, { recorrente: true }), [nota()]))).toBe(false);
    expect(isNotaFiscalElegivel(ped({ status: 'concluido' }, { recorrente: true }))).toBe(false);
    expect(podeInformarNotaFiscal(ped({ status: 'aceito' }, { valorTotal: 0 }))).toBe(false);
  });

  it('salvar notas no aceito marca emitida e concluir depois não reabre', () => {
    const aceito = salvarNotasDoPedido(ped({ status: 'aceito' }), [nota({ numero: ' 4521 ', dataEmissao: '2026-11-18' })], 'Ana');
    expect(aceito.proposal.notaFiscal).toMatchObject({ status: 'emitida', dataEmissao: '2026-11-18', atualizadaPor: 'Ana' });
    expect(aceito.proposal.notaFiscal?.notas?.[0]).toMatchObject({ numero: '4521', registradaPor: 'Ana' });
    const concluido = semearNotaFiscalAoConcluir({ ...aceito, status: 'concluido' });
    expect(notaFiscalStatus(concluido)).toBe('emitida');
    expect(isNotaFiscalPendente(concluido)).toBe(false);
  });

  it('data vazia usa hoje; campos vazios ficam indefinidos', () => {
    const r = salvarNotasDoPedido(ped({ status: 'aceito' }), [nota({ numero: '  ', observacao: '' })]);
    const n = r.proposal.notaFiscal!.notas![0];
    expect(n.numero).toBeUndefined();
    expect(n.observacao).toBeUndefined();
    expect(n.dataEmissao).toBe(new Date().toISOString().slice(0, 10));
  });
});

describe('notaFiscal — várias notas por pedido (serviço / material)', () => {
  it('guarda notas de serviço e material; data de topo = mais recente', () => {
    const p = salvarNotasDoPedido(ped({ status: 'aceito' }, { valorTotal: 3000 }), [
      nota({ id: 's', tipo: 'servico', numero: '10', dataEmissao: '2026-11-10', valor: 1800 }),
      nota({ id: 'm', tipo: 'material', numero: '77', dataEmissao: '2026-11-15', valor: 1200 }),
    ]);
    expect(notasDoPedido(p).map((n) => n.tipo)).toEqual(['servico', 'material']);
    expect(p.proposal.notaFiscal?.dataEmissao).toBe('2026-11-15');
    expect(resumoSeloNotas(p)).toBe('NFS-e 10 · NF-e 77');
  });

  it('remover todas as notas volta a pendente', () => {
    const emit = salvarNotasDoPedido(ped(), [nota()]);
    const vazio = salvarNotasDoPedido(emit, []);
    expect(notaFiscalStatus(vazio)).toBe('pendente');
    expect(isNotaFiscalPendente(vazio)).toBe(true);
  });

  it('valor: informado por nota; nota única sem valor herda o do pedido', () => {
    const unica = salvarNotasDoPedido(ped({}, { valorTotal: 900 }), [nota()]);
    expect(valorDaNota(notasDoPedido(unica)[0], unica)).toBe(900);
    const duas = salvarNotasDoPedido(ped({}, { valorTotal: 900 }), [nota({ id: 'a' }), nota({ id: 'b', valor: 300 })]);
    const [a, b] = notasDoPedido(duas);
    expect(valorDaNota(a, duas)).toBe(0);
    expect(valorDaNota(b, duas)).toBe(300);
  });

  it('registro legado (nota única no topo) é lido como uma nota', () => {
    const legado = aplicarNotaFiscal(ped({}, { modalidade: 'somente_material' }), { status: 'emitida', numero: '55', dataEmissao: '2026-10-01' });
    expect(notasDoPedido(legado)).toEqual([expect.objectContaining({ id: 'legado', tipo: 'material', numero: '55' })]);
    const chave44 = aplicarNotaFiscal(ped(), { status: 'emitida', chaveAcesso: '4'.repeat(44) });
    expect(notasDoPedido(chave44)[0].tipo).toBe('material');
    expect(notasDoPedido(aplicarNotaFiscal(ped(), { status: 'emitida' }))[0].tipo).toBe('servico');
    expect(notasDoPedido(semearNotaFiscalAoConcluir(ped()))).toEqual([]);
  });

  it('tipo padrão pela modalidade', () => {
    expect(tipoNotaPadrao(ped({}, { modalidade: 'somente_material' }))).toBe('material');
    expect(tipoNotaPadrao(ped({}, { modalidade: 'material_servico' }))).toBe('servico');
  });

  it('linhas e resumo contam por NOTA, com tipo e incompletas', () => {
    const anexo = { path: 'x', nome: 'n.xml', enviadoEm: '2026-11-01T00:00:00Z' };
    const p1 = salvarNotasDoPedido(ped({ id: 'p1' }, { valorTotal: 3000 }), [
      nota({ id: 's', tipo: 'servico', numero: '1', dataEmissao: '2026-11-10', valor: 2000, anexos: { xml: anexo } }),
      nota({ id: 'm', tipo: 'material', dataEmissao: '2026-11-12', valor: 1000 }),
    ]);
    const p2 = salvarNotasDoPedido(ped({ id: 'p2' }, { valorTotal: 500 }), [nota({ id: 'x', numero: '9', dataEmissao: '2026-10-03' })]);
    const linhas = linhasNotasEmitidas([p2, p1, ped({ id: 'semnf' })]);
    expect(linhas.map((l) => l.nota.id)).toEqual(['m', 's', 'x']);
    expect(resumoNotasEmitidas([p1, p2], '2026-11')).toEqual({
      total: 3, valorTotal: 3500, mes: 2, valorMes: 3000, servicoMes: 1, materialMes: 1,
      servico: 2, material: 1, semNumero: 1, semXml: 2, incompletas: 2,
    });
  });
});
