import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gerarReferenciaPedido, gerarTituloPedido, resolverTituloPedido, resolverTextoSugerido } from './pedidoTitulos';
import { gerarTituloProposta } from './propostaTitulo';
import type { CommercialProposalData } from './types';

const contexto: Partial<CommercialProposalData> = { pedidoTipo: 'orcamento', areaPrincipal: ['acesso'], tipoServico: 'instalacao', modalidade: 'material_servico' };

describe('sugestões canônicas do pedido', () => {
  it.each([
    ['acesso', 'instalacao', 'Instalação de Sistema de Controle de Acesso'],
    ['sdai', 'manut_preventiva', 'Manutenção Preventiva do Sistema de Detecção e Alarme de Incêndio'],
    ['cftv', 'instalacao', 'Instalação de Sistema de CFTV'],
    ['bms', 'manut_preventiva', 'Manutenção Preventiva do Sistema de Automação/BMS'],
    ['sdai', 'retrofit', 'Retrofit do Sistema de Detecção e Alarme de Incêndio'],
  ])('%s + %s usa o tipo documental', (area, tipoServico, referencia) => {
    const p = { ...contexto, areaPrincipal: [area], tipoServico };
    expect(gerarReferenciaPedido(p)).toBe(referencia);
    expect(gerarTituloPedido(p)).toBe(`Orçamento para ${referencia}`);
    expect(gerarTituloPedido({ ...p, pedidoTipo: 'proposta' })).toBe(`Proposta Técnico-Comercial para ${referencia}`);
  });
  it('compõe múltiplas áreas sem repetir nomes longos', () => {
    expect(gerarTituloPedido({ ...contexto, areaPrincipal: ['sdai', 'cftv'] })).toBe('Orçamento para Instalação de Sistemas de SDAI e CFTV');
  });
  it('somente material não vira instalação, mesmo com serviço selecionado', () => {
    expect(gerarTituloPedido({ ...contexto, modalidade: 'somente_material', areaPrincipal: ['sdai'] })).toBe('Orçamento para Fornecimento de Materiais para SDAI');
  });
  it('novo pedido sem contexto permanece vazio', () => {
    expect(gerarReferenciaPedido({})).toBe('');
    expect(gerarTituloPedido({})).toBe('');
    expect(gerarReferenciaPedido({ areaPrincipal: ['invalida'], tipoServico: 'instalacao' })).toBe('');
  });
  it('atualiza serviço e prefixo sem depender do nível', () => {
    const p = { ...contexto, tipoServico: 'manut_preventiva', nivelProposta: 'corporativa' as const };
    expect(gerarTituloPedido(p)).toBe('Orçamento para Manutenção Preventiva do Sistema de Controle de Acesso');
    expect(gerarTituloPedido({ ...p, pedidoTipo: 'proposta' })).toBe('Proposta Técnico-Comercial para Manutenção Preventiva do Sistema de Controle de Acesso');
  });
  it('preserva texto manual, inclusive vazio, até reaplicar sugestão', () => {
    const manual = 'Retrofit Controle de Acesso — Sede Administrativa';
    expect(resolverTextoSugerido(gerarReferenciaPedido(contexto), manual)).toBe(manual);
    expect(resolverTextoSugerido('Nova sugestão', '')).toBe('');
    expect(resolverTextoSugerido('Nova sugestão', null)).toBe('Nova sugestão');
    expect(resolverTituloPedido({ ...contexto, tituloManual: manual, tituloEditadoManualmente: true })).toBe(manual);
  });
  it('corrige snapshot automático antigo e mantém personalização histórica', () => {
    expect(resolverTituloPedido({ ...contexto, tituloManual: gerarTituloProposta(['acesso'], 'instalacao')! })).toBe(gerarTituloPedido(contexto));
    expect(resolverTituloPedido({ ...contexto, tituloManual: 'Título do cliente' })).toBe('Título do cliente');
  });
  it('snapshot salvo e reaberto usa o mesmo título canônico', () => {
    const salvo = JSON.parse(JSON.stringify({ ...contexto, tituloManual: gerarTituloPedido(contexto), tituloEditadoManualmente: false }));
    expect(resolverTituloPedido(salvo)).toBe(gerarTituloPedido(contexto));
  });
  it('editor e PDFs estão ligados à fonte compartilhada', () => {
    for (const path of ['proposta/PropostaDocument', 'documentos/OrcamentoDocument', 'documentos/FornecimentoMateriaisDocument']) {
      expect(readFileSync(`components/${path}.tsx`, 'utf8')).toContain('resolverTituloPedido(p)');
    }
    const editor = readFileSync('components/proposta/CommercialProposalModal.tsx', 'utf8');
    expect(editor).not.toContain("'Manutenção Preventiva SDAI'");
    expect(editor).toContain('tituloManual: tituloDinamico,');
    expect(editor).toContain('referenciaEditadaManualmente: referenciaManual !== null');
  });
});
