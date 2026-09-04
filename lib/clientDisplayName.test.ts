import { describe, expect, it } from 'vitest';
import {
  getClientLegalName,
  getClientOperationalName,
  nomeFantasiaCliente,
  razaoSocialCliente,
} from './utils';

/* ===================================================================
 * CORREÇÃO 3B.1 — regra canônica do nome do cliente. Convenção real de dados
 * (confirmada em CrmView): clients.name é gravado como "Razão (Fantasia)".
 * OPERACIONAL → nome fantasia; FORMAL → razão social. §15
 * =================================================================== */

// Formato REAL do bug relatado.
const MUFFATO = 'IRMAOS MUFFATO & CIA LTDA (Super Muffato Aeroporto)';
const SEM_FANTASIA = 'CONDOMÍNIO EDIFÍCIO CENTRAL';

describe('getClientOperationalName (interface operacional §1/§4)', () => {
  it('CASO 1 — cliente com nome fantasia → mostra o fantasia', () => {
    expect(getClientOperationalName({ name: MUFFATO })).toBe('Super Muffato Aeroporto');
    expect(getClientOperationalName(MUFFATO)).toBe('Super Muffato Aeroporto');
  });

  it('CASO 2 — cliente sem fantasia → fallback para a razão/nome cadastral', () => {
    expect(getClientOperationalName({ name: SEM_FANTASIA })).toBe(SEM_FANTASIA);
  });

  it('cliente/nome ausente → fallback configurável (nunca vazio)', () => {
    expect(getClientOperationalName(undefined)).toBe('Cliente');
    expect(getClientOperationalName(null, '—')).toBe('—');
    expect(getClientOperationalName({ name: '' }, 'Cliente')).toBe('Cliente');
  });
});

describe('getClientLegalName (documento formal §5/§10)', () => {
  it('CASO 8 — documento formal usa a razão social, sem o parêntese', () => {
    expect(getClientLegalName({ name: MUFFATO })).toBe('IRMAOS MUFFATO & CIA LTDA');
    expect(getClientLegalName(SEM_FANTASIA)).toBe(SEM_FANTASIA);
  });
});

describe('parsers subjacentes reutilizados', () => {
  it('nomeFantasiaCliente e razaoSocialCliente concordam com o formato real', () => {
    expect(nomeFantasiaCliente(MUFFATO)).toBe('Super Muffato Aeroporto');
    expect(razaoSocialCliente(MUFFATO)).toBe('IRMAOS MUFFATO & CIA LTDA');
    // Operacional e formal coincidem quando não há fantasia.
    expect(getClientOperationalName(SEM_FANTASIA)).toBe(getClientLegalName(SEM_FANTASIA));
  });
});
