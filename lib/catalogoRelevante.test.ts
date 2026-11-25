import { describe, expect, it } from 'vitest';
import { catalogoRelevante } from '../supabase/functions/gerar-orcamento/catalogoRelevante';

const cadastro = [
  { id: '1', model: 'AMT 8000 PRO', notes: 'Código fornecedor: 4543589' },
  { id: '2', model: 'IVP 8000 EX', notes: null },
  { id: '3', model: 'IVP 8000 MW PET', notes: null },
  { id: '4', model: 'IVP 8000 PET', notes: null },
  { id: '5', model: 'VIP 3430 B IA', notes: null },
  { id: '6', model: 'DFC 421', notes: null },
  { id: '7', model: 'XG 4G', notes: 'Código fornecedor: 4543584' },
  { id: '8', model: 'AMT 8000 LITE', notes: null },
];

describe('catalogoRelevante', () => {
  it('manda só os citados (modelo com espaço/hífen diferente) e as variantes da família', () => {
    const r = catalogoRelevante(cadastro, 'Orçamento: 8x ivp-8000 ex e 1 central AMT8000PRO');
    expect(r.completo).toBe(false);
    expect(r.produtos.map((p) => p.id).sort()).toEqual(['1', '2', '3', '4', '8']);
  });

  it('reconhece pelo código do fornecedor', () => {
    const r = catalogoRelevante(cadastro, 'Módulo 4G cód. 4543584, quantidade 1');
    expect(r.produtos.map((p) => p.id)).toEqual(['7']);
  });

  it('sem nenhum produto reconhecido, manda o cadastro inteiro', () => {
    const r = catalogoRelevante(cadastro, 'Manutenção preventiva do sistema de incêndio, sem materiais');
    expect(r.completo).toBe(true);
    expect(r.produtos).toHaveLength(cadastro.length);
  });

  it('respeita o limite de produtos', () => {
    const muitos = Array.from({ length: 300 }, (_, i) => ({ id: `f${i}`, model: `IVP 8000 V${i}`, notes: null }));
    const r = catalogoRelevante([...cadastro, ...muitos], 'IVP 8000 EX', 50);
    expect(r.produtos.length).toBe(50);
  });
});
