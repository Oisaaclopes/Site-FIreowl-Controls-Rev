import { describe, expect, it } from 'vitest';
import { assetFormSpec } from './technicalAssetForm';
import { legacyGroupLabel, identifierKeysForGroup, identifierFieldsForGroup, GROUPS_BY_AREA, isInfraGroup } from './technicalBase';

const keys = (area: any, group?: string) => assetFormSpec(area, group).fields.map((f) => f.key);

describe('taxonomia SDAI (§5/§6) — Central SDAI / Repetidora de SDAI', () => {
  it('grupos canônicos renomeados', () => {
    expect(GROUPS_BY_AREA.SDAI).toContain('Central SDAI');
    expect(GROUPS_BY_AREA.SDAI).toContain('Repetidora de SDAI');
    expect(GROUPS_BY_AREA.SDAI).not.toContain('Central');
    expect(GROUPS_BY_AREA.SDAI).not.toContain('Repetidora');
  });
  it('legacyGroupLabel normaliza SÓ SDAI (nunca Central de ALARME)', () => {
    expect(legacyGroupLabel('SDAI', 'Central')).toBe('Central SDAI');
    expect(legacyGroupLabel('SDAI', 'Repetidora')).toBe('Repetidora de SDAI');
    expect(legacyGroupLabel('ALARME', 'Central')).toBe('Central'); // preservado
    expect(legacyGroupLabel('SDAI', 'Acionador Manual')).toBe('Acionador Manual');
  });
});

describe('SDAI — formulário contextual por grupo (§10/§12)', () => {
  it('Central SDAI: sem laço/endereço; com tecnologia e nº de laços', () => {
    const k = keys('SDAI', 'Central SDAI');
    expect(k).toContain('central');
    expect(k).not.toContain('laco');
    expect(k).not.toContain('endereco');
    expect(k).toContain('tecnologia');
    expect(k).toContain('qtd_lacos');
  });
  it('Central SDAI aceita rótulo legado "Central"', () => {
    expect(keys('SDAI', 'Central')).toContain('tecnologia');
    expect(keys('SDAI', 'Central')).not.toContain('laco');
  });
  it('Acionador Manual: central+laço+endereço+descrição', () => {
    const k = keys('SDAI', 'Acionador Manual');
    expect(k).toEqual(expect.arrayContaining(['central', 'laco', 'endereco', 'descricao_programada']));
  });
  it('Nº da Central/Laço/Endereço são numéricos (inputMode)', () => {
    const spec = assetFormSpec('SDAI', 'Acionador Manual');
    const central = spec.fields.find((f) => f.key === 'central')!;
    expect(central.label).toBe('Nº da Central');
    expect(central.inputMode).toBe('numeric');
    expect(spec.fields.find((f) => f.key === 'laco')!.label).toBe('Nº do Laço');
    expect(spec.fields.find((f) => f.key === 'endereco')!.label).toBe('Nº do Endereço');
  });
  it('Infraestrutura: sem catálogo obrigatório, com subtipo, sem série', () => {
    const spec = assetFormSpec('SDAI', 'Infraestrutura');
    expect(spec.catalogOptional).toBe(true);
    expect(spec.showSerial).toBe(false);
    expect(spec.fields.map((f) => f.key)).toContain('subtipo');
    expect(isInfraGroup('Infraestrutura')).toBe(true);
  });
});

describe('CFTV — IP/Canal, nunca "Endereço" (§27/§56)', () => {
  it('Câmera: IP + Canal + Gravador, sem endereco/laco', () => {
    const k = keys('CFTV', 'Câmera');
    expect(k).toEqual(expect.arrayContaining(['ip', 'canal', 'nvr']));
    expect(k).not.toContain('endereco');
    expect(k).not.toContain('laco');
  });
  it('NVR: NÃO recebe "Canal" (não é câmera); tem nº de canais', () => {
    const k = keys('CFTV', 'NVR');
    expect(k).not.toContain('canal');
    expect(k).toContain('qtd_canais');
    expect(k).toContain('ip');
  });
  it('IP é campo do tipo ip (validação)', () => {
    const ip = assetFormSpec('CFTV', 'Câmera').fields.find((f) => f.key === 'ip')!;
    expect(ip.input).toBe('ip');
  });
});

describe('ALARME/BMS/ACESSO — contextual por grupo', () => {
  it('ALARME Central de Alarme: só central (sem zona/endereço)', () => {
    const k = keys('ALARME', 'Central de Alarme');
    expect(k).toContain('central');
    expect(k).not.toContain('zona');
  });
  it('ALARME Sensor PIR: zona + partição + endereço', () => {
    expect(keys('ALARME', 'Sensor PIR')).toEqual(expect.arrayContaining(['central', 'particao', 'zona', 'endereco']));
  });
  it('BMS Controlador: device instance + protocolo + IP', () => {
    expect(keys('BMS', 'Controlador')).toEqual(expect.arrayContaining(['device_instance', 'protocolo', 'ip']));
  });
  it('ACESSO Leitora: controladora + porta', () => {
    expect(keys('CONTROLE_ACESSO', 'Leitora')).toEqual(expect.arrayContaining(['controladora', 'porta']));
  });
});

describe('grupo não mapeado herda conjunto completo da área (seguro)', () => {
  it('SDAI "Detector de Fumaça" (sem regra) traz identificadores completos', () => {
    const k = identifierKeysForGroup('SDAI', 'Detector de Fumaça');
    expect(k).toEqual(expect.arrayContaining(['central', 'laco', 'endereco', 'descricao_programada']));
  });
  it('identifierFieldsForGroup respeita o subconjunto', () => {
    const f = identifierFieldsForGroup('SDAI', 'Central SDAI').map((x) => x.key);
    expect(f).toEqual(['central']);
  });
});

describe('série alfanumérica (§14/§32)', () => {
  it('campo de série é texto (aceita letras)', () => {
    const spec = assetFormSpec('SDAI', 'Acionador Manual');
    expect(spec.showSerial).toBe(true);
  });
});
