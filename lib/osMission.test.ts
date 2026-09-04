import { describe, expect, it } from 'vitest';
import { buildOsMissionFromProposal, missionHasContent } from './osMission';
import { CommercialProposalData, OrdemServico, PedidoEquipmentItem } from './types';

const item = (over: Partial<PedidoEquipmentItem>): PedidoEquipmentItem => ({
  itemNumero: 1, descricao: 'X', marcaModelo: '', unidade: 'un', quantidade: 1, ...over,
});

const proposal = (over: Partial<CommercialProposalData> = {}): CommercialProposalData =>
  ({
    equipmentItems: [],
    responsabilidadesContratada: [],
    responsabilidadesContratante: [],
    ...over,
  } as unknown as CommercialProposalData);

const os = (over: Partial<OrdemServico> = {}): OrdemServico => ({
  id: 'os1', numero: 'OS-2026-0003', tipo: 'corretiva', status: 'aberta', prioridade: 'media',
  pendenciaIds: [], sourcePedidoId: 'ped1', ...over,
});

describe('buildOsMissionFromProposal (§18–§21)', () => {
  it('separa serviços e materiais pelo tipo', () => {
    const p = proposal({
      equipmentItems: [
        item({ descricao: 'Manutenção corretiva SDAI', tipo: 'servico', quantidade: 1, unidade: 'vb' }),
        item({ descricao: 'Fonte auxiliar 24V', tipo: 'material', quantidade: 1, unidade: 'un' }),
        item({ descricao: 'Bateria 12V 7Ah', tipo: 'material', quantidade: 2, unidade: 'un' }),
      ],
    });
    const m = buildOsMissionFromProposal(p, os());
    expect(m.services.map((s) => s.descricao)).toEqual(['Manutenção corretiva SDAI']);
    expect(m.materials.map((s) => s.descricao)).toEqual(['Fonte auxiliar 24V', 'Bateria 12V 7Ah']);
    expect(m.materials[1].quantidade).toBe(2);
  });

  it('item sem tipo é tratado como material (compatibilidade)', () => {
    const p = proposal({ equipmentItems: [item({ descricao: 'Cabo', tipo: undefined })] });
    const m = buildOsMissionFromProposal(p, os());
    expect(m.materials.map((s) => s.descricao)).toEqual(['Cabo']);
    expect(m.services).toHaveLength(0);
  });

  it('NUNCA expõe preço/desconto ao técnico (§22)', () => {
    const p = proposal({
      equipmentItems: [item({ descricao: 'Fonte', tipo: 'material', precoUnitario: 999.9, desconto: 50 })],
    });
    const m = buildOsMissionFromProposal(p, os());
    const flat = JSON.stringify(m);
    expect(flat).not.toContain('999');
    expect(flat).not.toContain('preco');
    expect(flat).not.toContain('desconto');
    expect(Object.keys(m.materials[0])).not.toContain('precoUnitario');
  });

  it('reaproveita responsabilidades da contratada', () => {
    const p = proposal({ responsabilidadesContratada: ['Executar o escopo aprovado', 'Realizar testes'] });
    const m = buildOsMissionFromProposal(p, os());
    expect(m.responsibilities).toEqual(['Executar o escopo aprovado', 'Realizar testes']);
  });

  it('marca source=pedido quando há origem e os=fallback quando não há', () => {
    expect(buildOsMissionFromProposal(proposal(), os()).source).toBe('pedido');
    expect(buildOsMissionFromProposal(proposal(), os({ sourcePedidoId: undefined })).source).toBe('os');
  });

  it('missionHasContent detecta missão vazia', () => {
    expect(missionHasContent(buildOsMissionFromProposal(proposal(), os()))).toBe(false);
    const p = proposal({ equipmentItems: [item({ descricao: 'Serviço', tipo: 'servico' })] });
    expect(missionHasContent(buildOsMissionFromProposal(p, os()))).toBe(true);
  });
});
