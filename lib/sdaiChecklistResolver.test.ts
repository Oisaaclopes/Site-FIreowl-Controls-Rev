import { describe, expect, it } from 'vitest';
import type { Device } from './types';
import {
  resolveSdaiFieldOptions,
  resolveSdaiItemPatch,
  seedLacoCards,
  deviceShortLabel,
  type SdaiCentralContext,
} from './sdaiChecklistResolver';

const C1: Device = { id: 'C1', clienteId: 'A', sistema: 'SDAI', status: 'ativo', grupo: 'Central SDAI', central: 'EST-01' };
const C2: Device = { id: 'C2', clienteId: 'A', sistema: 'SDAI', status: 'ativo', grupo: 'Central SDAI', central: 'EST-02' };
const mk = (id: string, parent: string, laco: string, endereco: string, over: Partial<Device> = {}): Device =>
  ({ id, clienteId: 'A', sistema: 'SDAI', status: 'ativo', parentDeviceId: parent, laco, endereco, ...over } as Device);

// C1: laço 1 com endereços 1,2,4 (sem 3); C2: laço 1 endereço 2.
const devices: Device[] = [
  C1, C2,
  mk('d1', 'C1', '1', '1', { grupo: 'Detector de Fumaça' }),
  mk('d2', 'C1', '1', '2', { grupo: 'Acionador Manual', technicalIdentifier: 'AM-025', localizacao: 'Loja X - Estoque', fabricante: 'Tecnohold', modelo: 'AME07' }),
  mk('d3', 'C1', '1', '4', { grupo: 'Sirene / Sinalizador' }),
  mk('bat1', 'C1', '', '', { grupo: 'Fonte / Alimentação', tipoAtivo: 'Bateria', fabricante: 'Moura', modelo: '12V7Ah' }),
  mk('bat2', 'C1', '', '', { grupo: 'Bateria', fabricante: 'Unipower', modelo: '12V7Ah' }),
  mk('x1', 'C2', '1', '2', { grupo: 'Sirene / Sinalizador' }),
];
const ctx: SdaiCentralContext = { central: C1, devices };

describe('cascata da falha — laço/endereço/device (§5/§6)', () => {
  it('laço único → auto + readonly; endereços reais sem inventar o 3', () => {
    const laco = resolveSdaiFieldOptions(ctx, 'falhas', 'laco', {})!;
    expect(laco.options?.map((o) => o.value)).toEqual(['1']);
    expect(laco.autoValue).toBe('1');
    expect(laco.readonly).toBe(true);

    const end = resolveSdaiFieldOptions(ctx, 'falhas', 'endereco', { laco: '1' })!;
    expect(end.options?.map((o) => o.value)).toEqual(['1', '2', '4']); // nunca 3
  });

  it('device auto por laço+endereço inequívoco (readonly)', () => {
    const dev = resolveSdaiFieldOptions(ctx, 'falhas', 'device_id', { laco: '1', endereco: '2' })!;
    expect(dev.autoValue).toBe('d2');
    expect(dev.readonly).toBe(true);
    expect(dev.options?.[0].label).toContain('Acionador Manual');
  });

  it('endereço não cadastrado → emptyState (manual), sem device', () => {
    const dev = resolveSdaiFieldOptions(ctx, 'falhas', 'device_id', { laco: '1', endereco: '3' })!;
    expect(dev.emptyState).toBeTruthy();
    expect(dev.autoValue).toBeUndefined();
  });

  it('isolamento entre centrais: C2 não vê endereços de C1', () => {
    const end = resolveSdaiFieldOptions({ central: C2, devices }, 'falhas', 'endereco', { laco: '1' })!;
    expect(end.options?.map((o) => o.value)).toEqual(['2']); // só o device de C2
  });
});

describe('reset de dependências e auto-preenchimento (§7/§5/§8)', () => {
  it('trocar o laço zera endereço/device/código/local', () => {
    const patch = resolveSdaiItemPatch(ctx, 'falhas', 'laco', '2', { laco: '1', endereco: '2', device_id: 'd2' });
    expect(patch).toEqual({ endereco: '', device_id: '', codigo: '', local: '' });
  });
  it('escolher endereço resolve device e auto-preenche código/local (default editável)', () => {
    const patch = resolveSdaiItemPatch(ctx, 'falhas', 'endereco', '2', { laco: '1' });
    expect(patch).toMatchObject({ device_id: 'd2', codigo: 'AM-025', local: 'Loja X - Estoque' });
  });
  it('endereço sem device limpa derivados', () => {
    const patch = resolveSdaiItemPatch(ctx, 'falhas', 'endereco', '3', { laco: '1' });
    expect(patch).toEqual({ device_id: '', codigo: '', local: '' });
  });
});

describe('baterias da central (§12/§14)', () => {
  it('lista só as baterias da central (Fonte/Alimentação+Bateria ou grupo Bateria)', () => {
    const bat = resolveSdaiFieldOptions(ctx, 'baterias', 'device_id', {})!;
    expect(bat.options?.map((o) => o.value).sort()).toEqual(['bat1', 'bat2']);
  });
  it('central sem bateria → emptyState (catálogo/manual), nunca dispositivos de campo', () => {
    const semBat: SdaiCentralContext = { central: C2, devices };
    const bat = resolveSdaiFieldOptions(semBat, 'baterias', 'device_id', {})!;
    expect(bat.options).toBeUndefined();
    expect(bat.emptyState).toBeTruthy();
  });
});

describe('laços de medição (§17)', () => {
  it('semeia um card por laço real; laço único é auto/readonly', () => {
    expect(seedLacoCards(ctx)).toEqual([{ identificacao: '1' }]);
    const laco = resolveSdaiFieldOptions(ctx, 'lacos', 'identificacao', {})!;
    expect(laco.autoValue).toBe('1');
    expect(laco.readonly).toBe(true);
  });
});

describe('sem central / campo não governado', () => {
  it('sem central → laço pede seleção da central (emptyState)', () => {
    const r = resolveSdaiFieldOptions({ central: undefined, devices }, 'falhas', 'laco', {})!;
    expect(r.emptyState).toBeTruthy();
  });
  it('campo fora da cascata → undefined (FormEngine usa padrão)', () => {
    expect(resolveSdaiFieldOptions(ctx, 'falhas', 'descricao', {})).toBeUndefined();
    expect(resolveSdaiFieldOptions(ctx, 'outro', 'device_id', {})).toBeUndefined();
    expect(resolveSdaiItemPatch(ctx, 'baterias', 'device_id', 'x', {})).toBeUndefined();
  });
  it('deviceShortLabel usa grupo canônico + fab/modelo + id', () => {
    expect(deviceShortLabel(devices.find((d) => d.id === 'd2')!)).toBe('Acionador Manual · Tecnohold AME07 · AM-025');
  });
});
