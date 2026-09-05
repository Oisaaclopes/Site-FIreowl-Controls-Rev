import { describe, expect, it } from 'vitest';
import { reconcile, summarizeOpenSurvey } from './reconciliation';
import { findIdentityMatches } from './technicalBase';

describe('reconcile — levantamento COMPLETO (§4)', () => {
  const existing = ['d1', 'd2', 'd3', 'd4'];

  it('início: 0 verificados, cobertura 0, não fecha', () => {
    const s = reconcile(existing, []);
    expect(s.expected).toBe(4);
    expect(s.verified).toBe(0);
    expect(s.pendente).toBe(4);
    expect(s.complete).toBe(false);
    expect(s.canDeclare100).toBe(false);
  });

  it('verificado + alterado contam como resolvidos', () => {
    const s = reconcile(existing, [
      { deviceId: 'd1', reconciliation: 'VERIFICADO' },
      { deviceId: 'd2', reconciliation: 'ALTERADO' },
    ]);
    expect(s.verified).toBe(2);
    expect(s.alterado).toBe(1);
    expect(s.pendente).toBe(2);
    expect(s.complete).toBe(false);
  });

  it('não localizado também resolve o item (fecha reconciliação)', () => {
    const s = reconcile(existing, [
      { deviceId: 'd1', reconciliation: 'VERIFICADO' },
      { deviceId: 'd2', reconciliation: 'VERIFICADO' },
      { deviceId: 'd3', reconciliation: 'VERIFICADO' },
      { deviceId: 'd4', reconciliation: 'NAO_LOCALIZADO' },
    ]);
    expect(s.naoLocalizado).toBe(1);
    expect(s.resolved).toBe(4);
    expect(s.pendente).toBe(0);
    expect(s.complete).toBe(true);
    expect(s.canDeclare100).toBe(true);
    expect(s.coveragePct).toBe(100);
  });

  it('não permite 100% enquanto houver pendente (trava §4)', () => {
    const s = reconcile(existing, [
      { deviceId: 'd1', reconciliation: 'VERIFICADO' },
      { deviceId: 'd2', reconciliation: 'VERIFICADO' },
      { deviceId: 'd3', reconciliation: 'VERIFICADO' },
    ]);
    expect(s.pendente).toBe(1);
    expect(s.canDeclare100).toBe(false);
  });

  it('novo encontrado conta separado e não infla verificados', () => {
    const s = reconcile(existing, [
      { deviceId: 'd1', reconciliation: 'VERIFICADO' },
      { deviceId: 'novoX', reconciliation: 'NOVO' },
    ]);
    expect(s.novo).toBe(1);
    expect(s.verified).toBe(1);
    expect(s.expected).toBe(4);
  });

  it('último registro por ativo prevalece', () => {
    const s = reconcile(['d1'], [
      { deviceId: 'd1', reconciliation: 'NAO_LOCALIZADO' },
      { deviceId: 'd1', reconciliation: 'VERIFICADO' },
    ]);
    expect(s.verified).toBe(1);
    expect(s.naoLocalizado).toBe(0);
  });
});

describe('summarizeOpenSurvey — PONTUAL/PARCIAL (§2/§3)', () => {
  it('pontual: 1 conhecido, cobertura não determinada', () => {
    const s = summarizeOpenSurvey({ known: 1, added: 1 });
    expect(s.known).toBe(1);
    expect(s.coverageDetermined).toBe(false);
    expect(s.coveragePct).toBeNull();
  });
  it('parcial: cobertura dentro do escopo declarado', () => {
    const s = summarizeOpenSurvey({ known: 10, added: 4, scopeExpected: 40 });
    expect(s.coveragePct).toBe(25);
    expect(s.coverageDetermined).toBe(true);
  });
});

describe('findIdentityMatches — dedup contextual (§5)', () => {
  const pool = [
    { id: 'a', central: '1', laco: '2', endereco: '45' },
    { id: 'b', central: '1', laco: '2', endereco: '46' },
  ];
  it('acha o ativo existente pela identidade SDAI', () => {
    const m = findIdentityMatches('SDAI', { central: '1', laco: '2', endereco: '45' }, pool);
    expect(m.map((x) => x.id)).toEqual(['a']);
  });
  it('sem identificador suficiente → nenhum match (não deduplica às cegas)', () => {
    expect(findIdentityMatches('CFTV', { technicalAttributes: {} }, pool as any)).toEqual([]);
  });
  it('ambiguidade (2+ matches) é detectável para pedir confirmação', () => {
    const dupPool = [{ id: 'a', endereco: '45', laco: '2', central: '1' }, { id: 'a2', endereco: '45', laco: '2', central: '1' }];
    const m = findIdentityMatches('SDAI', { central: '1', laco: '2', endereco: '45' }, dupPool);
    expect(m.length).toBe(2);
  });
});
