import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';

/* Correção administrativa do ponto (0113): cliente + contrato do banco. */

const rpc = vi.fn();
vi.mock('./supabaseClient', () => ({ getSupabaseClient: () => ({ rpc }) }));

import { adminCorrectPunch, rowToAdjustment, validateAdminCorrection } from './adjustments';

const base = {
  userId: 'u1', type: 'RETORNO' as const, refDate: '2026-09-23', requestedTime: '13:02',
  reason: 'Funcionário esqueceu de registrar retorno',
};

beforeEach(() => rpc.mockReset());

describe('validateAdminCorrection', () => {
  it('inclusão válida (batida faltante)', () => {
    expect(validateAdminCorrection({ ...base, action: 'INCLUSAO' })).toBeNull();
  });
  it('motivo é obrigatório', () => {
    expect(validateAdminCorrection({ ...base, action: 'INCLUSAO', reason: '  ' })).toMatch(/motivo/i);
  });
  it('horário obrigatório exceto para desconsiderar', () => {
    expect(validateAdminCorrection({ ...base, action: 'INCLUSAO', requestedTime: '' })).toMatch(/horário/i);
    expect(validateAdminCorrection({ ...base, action: 'DESCONSIDERAR', requestedTime: '', originalPunchId: 'p1' })).toBeNull();
  });
  it('ajuste/desconsiderar exigem a batida alvo; inclusão não pode ter alvo', () => {
    expect(validateAdminCorrection({ ...base, action: 'AJUSTE' })).toMatch(/batida/i);
    expect(validateAdminCorrection({ ...base, action: 'INCLUSAO', originalPunchId: 'p1' })).toMatch(/inclus/i);
    expect(validateAdminCorrection({ ...base, action: 'AJUSTE', replacesAdjustmentId: 'a1' })).toBeNull();
  });
  it('sem funcionário identificado não envia', () => {
    expect(validateAdminCorrection({ ...base, action: 'INCLUSAO', userId: '' })).toMatch(/funcionário/i);
  });
});

describe('adminCorrectPunch', () => {
  it('chama a RPC auditada com os parâmetros e devolve o ajuste APROVADO/ADMINISTRATIVO', async () => {
    rpc.mockResolvedValue({
      data: {
        id: 'a9', user_id: 'u1', employee_name: 'Joao', ref_date: '2026-09-23', type: 'RETORNO',
        requested_time: '13:02', reason: base.reason, status: 'APROVADO', action: 'INCLUSAO',
        origin: 'ADMINISTRATIVO', created_by: 'g1', created_by_name: 'Gestora', created_at: '2026-09-24T12:00:00Z',
      },
      error: null,
    });
    const saved = await adminCorrectPunch({ ...base, action: 'INCLUSAO' });
    expect(rpc).toHaveBeenCalledWith('punch_admin_correct', {
      p_user_id: 'u1', p_action: 'INCLUSAO', p_type: 'RETORNO', p_ref_date: '2026-09-23',
      p_requested_time: '13:02', p_reason: base.reason, p_original_punch_id: null, p_replaces_adjustment_id: null,
    });
    expect(saved.origin).toBe('ADMINISTRATIVO');
    expect(saved.createdByName).toBe('Gestora');
  });

  it('desconsiderar não envia horário', async () => {
    rpc.mockResolvedValue({ data: { id: 'a1', status: 'APROVADO', action: 'DESCONSIDERAR' }, error: null });
    await adminCorrectPunch({ ...base, action: 'DESCONSIDERAR', requestedTime: '', originalPunchId: 'p7', type: 'SAIDA' });
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_requested_time: null, p_original_punch_id: 'p7' });
  });

  it('entrada inválida não chega ao banco', async () => {
    await expect(adminCorrectPunch({ ...base, action: 'INCLUSAO', reason: '' })).rejects.toThrow(/motivo/i);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('erro do banco (ex.: sem permissão) é propagado', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'Sem permissão para corrigir o ponto.' } });
    await expect(adminCorrectPunch({ ...base, action: 'INCLUSAO' })).rejects.toMatchObject({ code: '42501' });
  });

  it('linhas anteriores à 0113 recebem action/origin padrão', () => {
    const a = rowToAdjustment({ id: 'x', status: 'APROVADO' });
    expect(a.action).toBe('AJUSTE');
    expect(a.origin).toBe('SOLICITACAO');
  });
});

describe('migration 0113 — contrato de segurança', () => {
  const sql = readFileSync(resolve(__dirname, 'db/migrations/0113_punch_admin_corrections.sql'), 'utf8');
  const insertPolicy = sql.slice(sql.indexOf('create policy "adj insert request"'), sql.indexOf(');', sql.indexOf('create policy "adj insert request"')));

  it('solicitação do funcionário nasce obrigatoriamente PENDENTE (fecha a brecha APROVADO)', () => {
    expect(sql).toMatch(/drop policy if exists "adj insert own" on public\.punch_adjustments/);
    expect(insertPolicy).toMatch(/user_id = auth\.uid\(\)/);
    expect(insertPolicy).toMatch(/status = 'PENDENTE'/);
    expect(insertPolicy).toMatch(/origin = 'SOLICITACAO'/);
    expect(insertPolicy).toMatch(/reviewed_by is null/);
    expect(insertPolicy).not.toMatch(/DESCONSIDERAR'\)/);
  });

  it('correção administrativa só via RPC que valida o papel no banco', () => {
    expect(sql).toMatch(/create or replace function public\.punch_admin_correct/);
    expect(sql).toMatch(/if not public\.can_manage_time_clock\(\) then/);
    expect(sql).toMatch(/auth_role\(\) in \('ADMINISTRATIVO', 'GESTOR'\)/);
    expect(sql).toMatch(/revoke all on function public\.punch_admin_correct[^;]+from public, anon/);
    expect(sql).toMatch(/Motivo obrigatório/);
  });

  it('time_punches permanece evidência original: sem UPDATE e sem INSERT por terceiros', () => {
    expect(sql).toMatch(/drop policy if exists "punches update" on public\.time_punches/);
    expect(sql).toMatch(/revoke update on public\.time_punches from authenticated/);
    expect(sql).toMatch(/create policy "punches insert own"[\s\S]*?with check \(user_id = auth\.uid\(\)\)/);
    expect(sql).not.toMatch(/update public\.time_punches/i);
    expect(sql).not.toMatch(/delete from public\.time_punches/i);
  });

  it('ajuste é imutável: correção posterior substitui, nunca edita nem apaga', () => {
    expect(sql).toMatch(/punch_adjustments_guard_update/);
    expect(sql).toMatch(/'SUBSTITUIDO'/);
    expect(sql).not.toMatch(/delete from public\.punch_adjustments/i);
    expect(sql).toMatch(/A batida original pertence a outro funcionário/);
  });

  it('não inclui fechamento/assinatura (Rodada 2B)', () => {
    expect(sql).not.toMatch(/timesheet_closings|signature|snapshot_hash/i);
  });
});
