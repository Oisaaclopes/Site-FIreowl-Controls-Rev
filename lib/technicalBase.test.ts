import { describe, expect, it } from 'vitest';
import {
  AREAS, GROUPS_BY_AREA, areaLabel, groupsForArea, identifierFields, fieldValue,
  assetDisplayIdentifier, assetIdentityKey, validateIdentifier, coverage,
  AssetLike, TechArea,
} from './technicalBase';

describe('identificadores por área (§17/§18–§23/§102) — NÃO são universais', () => {
  it('cada área tem seu próprio conjunto de campos identificadores', () => {
    const keys = (a: TechArea) => identifierFields(a).map((f) => f.key).sort();
    expect(keys('SDAI')).toEqual(['central', 'descricao_programada', 'endereco', 'laco']);
    expect(keys('CFTV')).toEqual(['canal', 'ip', 'mac', 'nvr']);
    expect(keys('ALARME')).toEqual(['central', 'descricao_programada', 'endereco', 'particao', 'zona']);
    expect(identifierFields('BMS').map((f) => f.key)).toContain('device_instance');
    expect(identifierFields('CONTROLE_ACESSO').map((f) => f.key)).toContain('controladora');
  });

  it('device_address NÃO é campo de nenhuma área (§17)', () => {
    for (const a of AREAS) {
      expect(identifierFields(a).map((f) => f.key)).not.toContain('device_address');
    }
  });

  it('SDAI usa colunas canônicas (central/laco/endereco); CFTV usa attr', () => {
    const sdai = Object.fromEntries(identifierFields('SDAI').map((f) => [f.key, f.store]));
    expect(sdai.central).toBe('central');
    expect(sdai.laco).toBe('laco');
    expect(sdai.endereco).toBe('endereco');
    const cftv = Object.fromEntries(identifierFields('CFTV').map((f) => [f.key, f.store]));
    expect(cftv.ip).toBe('attr');
    expect(cftv.canal).toBe('attr');
  });
});

describe('fieldValue — lê de coluna ou de technical_attributes', () => {
  it('lê coluna canônica (SDAI laço)', () => {
    const asset: AssetLike = { laco: '2', endereco: '31' };
    const f = identifierFields('SDAI').find((x) => x.key === 'laco')!;
    expect(fieldValue(asset, f)).toBe('2');
  });
  it('lê atributo estruturado (CFTV ip)', () => {
    const asset: AssetLike = { technicalAttributes: { ip: '192.168.10.31' } };
    const f = identifierFields('CFTV').find((x) => x.key === 'ip')!;
    expect(fieldValue(asset, f)).toBe('192.168.10.31');
  });
  it('ausente → string vazia', () => {
    const f = identifierFields('CFTV').find((x) => x.key === 'canal')!;
    expect(fieldValue({}, f)).toBe('');
  });
});

describe('assetDisplayIdentifier — apresentação adaptada por disciplina (§24)', () => {
  it('SDAI → "Laço 2 · End. 31"', () => {
    expect(assetDisplayIdentifier('SDAI', { laco: '2', endereco: '31' })).toBe('Laço 2 · End. 31');
  });
  it('CFTV → "IP … · Canal …"', () => {
    const s = assetDisplayIdentifier('CFTV', { technicalAttributes: { ip: '192.168.10.31', canal: '08' } });
    expect(s).toBe('IP 192.168.10.31 · Canal 08');
  });
  it('ALARME → zona/partição', () => {
    const s = assetDisplayIdentifier('ALARME', { technicalAttributes: { zona: '12', particao: 'A' } });
    expect(s).toContain('Zona 12');
    expect(s).toContain('Part. A');
  });
  it('descrição programada não polui o identificador curto', () => {
    const s = assetDisplayIdentifier('SDAI', { laco: '1', endereco: '5', technicalAttributes: { descricao_programada: 'CPD' } });
    expect(s).toBe('Laço 1 · End. 5');
  });
});

describe('assetIdentityKey — deduplicação por identidade técnica (§6K)', () => {
  it('mesmos identificadores SDAI → mesma chave', () => {
    const a: AssetLike = { central: '1', laco: '2', endereco: '31' };
    const b: AssetLike = { central: '1', laco: '2', endereco: '31' };
    expect(assetIdentityKey('SDAI', a)).toBe(assetIdentityKey('SDAI', b));
    expect(assetIdentityKey('SDAI', a)).not.toBeNull();
  });
  it('endereços diferentes → chaves diferentes', () => {
    const a: AssetLike = { central: '1', laco: '2', endereco: '31' };
    const b: AssetLike = { central: '1', laco: '2', endereco: '32' };
    expect(assetIdentityKey('SDAI', a)).not.toBe(assetIdentityKey('SDAI', b));
  });
  it('CFTV: IP é a identidade quando presente', () => {
    const a: AssetLike = { technicalAttributes: { ip: '10.0.0.5', canal: '1' } };
    const b: AssetLike = { technicalAttributes: { ip: '10.0.0.5', canal: '9' } };
    expect(assetIdentityKey('CFTV', a)).toBe(assetIdentityKey('CFTV', b));
  });
  it('CFTV: sem IP cai para gravador+canal', () => {
    const a: AssetLike = { technicalAttributes: { nvr: 'NVR1', canal: '8' } };
    const b: AssetLike = { technicalAttributes: { nvr: 'NVR1', canal: '8' } };
    expect(assetIdentityKey('CFTV', a)).toBe(assetIdentityKey('CFTV', b));
  });
  it('sem identificador suficiente → null (não deduplica às cegas)', () => {
    expect(assetIdentityKey('CFTV', {})).toBeNull();
    expect(assetIdentityKey('SDAI', { technicalAttributes: { descricao_programada: 'só descrição' } })).toBeNull();
  });
  it('a chave é prefixada pela área (não colide entre disciplinas)', () => {
    const sdai = assetIdentityKey('SDAI', { central: '1', laco: '1', endereco: '1' });
    expect(sdai?.startsWith('SDAI:')).toBe(true);
  });
});

describe('validateIdentifier — validação por tipo (§91)', () => {
  it('IP válido/ inválido', () => {
    expect(validateIdentifier('ip', '192.168.0.1')).toBe(true);
    expect(validateIdentifier('ip', '999.1.1.1')).toBe(false);
    expect(validateIdentifier('ip', 'abc')).toBe(false);
  });
  it('MAC válido/ inválido', () => {
    expect(validateIdentifier('mac', '00:1A:2B:3C:4D:5E')).toBe(true);
    expect(validateIdentifier('mac', '00-1A-2B-3C-4D-5E')).toBe(true);
    expect(validateIdentifier('mac', 'xyz')).toBe(false);
  });
  it('vazio é válido (campos opcionais) e texto livre passa', () => {
    expect(validateIdentifier('ip', '')).toBe(true);
    expect(validateIdentifier('text', 'qualquer coisa')).toBe(true);
    expect(validateIdentifier(undefined, 'qualquer coisa')).toBe(true);
  });
});

describe('coverage — cobertura do levantamento (§76/§77)', () => {
  it('sem esperado → pct null, incompleto', () => {
    expect(coverage(undefined, 5)).toEqual({ pct: null, complete: false });
    expect(coverage(0, 5)).toEqual({ pct: null, complete: false });
  });
  it('parcial → percentual arredondado', () => {
    expect(coverage(200, 50)).toEqual({ pct: 25, complete: false });
  });
  it('completo quando verificado ≥ esperado (satura em 100%)', () => {
    expect(coverage(10, 10)).toEqual({ pct: 100, complete: true });
    expect(coverage(10, 15)).toEqual({ pct: 100, complete: true });
  });
});

describe('taxonomia de grupos por área', () => {
  it('toda área tem grupos e rótulo', () => {
    for (const a of AREAS) {
      expect(groupsForArea(a).length).toBeGreaterThan(0);
      expect(GROUPS_BY_AREA[a]).toBe(groupsForArea(a));
      expect(areaLabel(a).length).toBeGreaterThan(0);
    }
  });
  it('areaLabel de valor desconhecido devolve o próprio valor', () => {
    expect(areaLabel('OUTRA_COISA')).toBe('OUTRA_COISA');
    expect(areaLabel(undefined)).toBe('');
  });
});
