import { describe, expect, it } from 'vitest';
import { activeAttendanceBlockMessage } from './serviceAttendances';

describe('activeAttendanceBlockMessage — exclusividade com contexto (PART A)', () => {
  it('próprio usuário: "Você" + OS/cliente/descrição + regra de conclusão', () => {
    const msg = activeAttendanceBlockMessage({
      isSelf: true,
      osNumero: 'OS-2026-0004',
      clienteNome: 'ACME',
      osTitulo: 'Preventiva SDAI — 2026-10',
    });
    expect(msg).toContain('Você já tem um atendimento em andamento');
    expect(msg).toContain('OS-2026-0004 · ACME · Preventiva SDAI — 2026-10');
    expect(msg).toContain('Conclua ou continue esse atendimento');
  });

  it('gestor selecionou técnico ocupado: usa o NOME do técnico, não "Você"', () => {
    const msg = activeAttendanceBlockMessage({
      isSelf: false,
      tecnicoNome: 'Isaac Lopes',
      osNumero: 'OS-2026-0005',
    });
    expect(msg).toContain('Isaac Lopes já tem um atendimento em andamento');
    expect(msg).not.toContain('Você');
    expect(msg).toContain('OS-2026-0005');
    expect(msg).toContain('Cada técnico só pode ter um atendimento ativo por vez.');
  });

  it('sem nome do técnico → fallback neutro; sem contexto → só a frase', () => {
    expect(activeAttendanceBlockMessage({ isSelf: false }))
      .toContain('O técnico selecionado já tem um atendimento em andamento.');
    expect(activeAttendanceBlockMessage({ isSelf: true }))
      .toBe('Você já tem um atendimento em andamento. Conclua ou continue esse atendimento antes de iniciar outro.');
  });
});
