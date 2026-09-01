import { describe, expect, it } from 'vitest';
import {
  applyFieldPhotoFilters,
  attachClientNames,
  friendlyPhotoId,
  groupFieldPhotosByClient,
  GalleryPhoto,
  isUnclassified,
  matchesFieldPhotoSearch,
  mergeFieldPhotos,
  normalizeText,
  sortByCapturadoDesc,
} from './fieldPhotosGallery';
import type { Client } from './types';

const photo = (over: Partial<GalleryPhoto>): GalleryPhoto => ({
  clientUuid: over.clientUuid || 'uuid-1',
  id: over.id || over.clientUuid || 'uuid-1',
  source: over.source || 'remote',
  sessionId: over.sessionId || 'sess-1',
  clientId: over.clientId || 'cli-1',
  capturadoEm: over.capturadoEm || '2026-08-31T12:00:00.000Z',
  syncStatus: over.syncStatus || 'sincronizado',
  ...over,
});

describe('fotos de campo — gestão (regras puras)', () => {
  it('não classificada só quando não há vínculo algum', () => {
    expect(isUnclassified({})).toBe(true);
    expect(isUnclassified({ reportId: 'r1' })).toBe(false);
    expect(isUnclassified({ osId: 'o1' })).toBe(false);
    expect(isUnclassified({ pendenciaId: 'p1' })).toBe(false);
  });

  it('dedup local×remoto por client_uuid preferindo o remoto', () => {
    const remote = [photo({ clientUuid: 'a', source: 'remote', syncStatus: 'sincronizado' })];
    const local = [
      photo({ clientUuid: 'a', source: 'local', syncStatus: 'pendente' }), // duplicata → descartada
      photo({ clientUuid: 'b', source: 'local', syncStatus: 'pendente' }),
    ];
    const merged = mergeFieldPhotos(remote, local);
    expect(merged).toHaveLength(2);
    const a = merged.find((p) => p.clientUuid === 'a')!;
    expect(a.source).toBe('remote');
    expect(merged.find((p) => p.clientUuid === 'b')!.source).toBe('local');
  });

  it('ordena por capturado_em desc', () => {
    const merged = sortByCapturadoDesc([
      photo({ clientUuid: '1', capturadoEm: '2026-08-01T10:00:00.000Z' }),
      photo({ clientUuid: '2', capturadoEm: '2026-08-31T10:00:00.000Z' }),
      photo({ clientUuid: '3', capturadoEm: '2026-08-15T10:00:00.000Z' }),
    ]);
    expect(merged.map((p) => p.clientUuid)).toEqual(['2', '3', '1']);
  });

  it('busca por cliente/local/nota ignora acentos e caixa', () => {
    const p = photo({ clientName: 'Super Muffato Saul Elkind', localSetor: 'Bloco B · Central', notaRapida: 'Detector com falha' });
    expect(matchesFieldPhotoSearch(p, 'muffato')).toBe(true);
    expect(matchesFieldPhotoSearch(p, 'CENTRAL')).toBe(true);
    expect(matchesFieldPhotoSearch(p, 'falha')).toBe(true);
    expect(matchesFieldPhotoSearch(p, 'inexistente')).toBe(false);
    expect(matchesFieldPhotoSearch(p, '')).toBe(true);
    expect(normalizeText('  Ílhá  São ')).toBe('ilha sao');
  });

  it('aplica filtros combinados (cliente, técnico, marcador, sync, período, não classificadas)', () => {
    const list = [
      photo({ clientUuid: '1', clientId: 'cliA', tecnicoId: 'tecX', marcador: 'falha', syncStatus: 'sincronizado', capturadoEm: '2026-08-10T09:00:00Z', reportId: 'r1' }),
      photo({ clientUuid: '2', clientId: 'cliA', tecnicoId: 'tecY', marcador: 'depois', syncStatus: 'pendente', capturadoEm: '2026-08-20T09:00:00Z' }),
      photo({ clientUuid: '3', clientId: 'cliB', tecnicoId: 'tecX', marcador: 'falha', syncStatus: 'erro', capturadoEm: '2026-08-25T09:00:00Z' }),
    ];
    expect(applyFieldPhotoFilters(list, { clientId: 'cliA' }).map((p) => p.clientUuid)).toEqual(['1', '2']);
    expect(applyFieldPhotoFilters(list, { tecnicoId: 'tecX' }).map((p) => p.clientUuid)).toEqual(['1', '3']);
    expect(applyFieldPhotoFilters(list, { marcador: 'falha' }).map((p) => p.clientUuid)).toEqual(['1', '3']);
    expect(applyFieldPhotoFilters(list, { syncStatus: 'erro' }).map((p) => p.clientUuid)).toEqual(['3']);
    expect(applyFieldPhotoFilters(list, { from: '2026-08-15', to: '2026-08-22' }).map((p) => p.clientUuid)).toEqual(['2']);
    expect(applyFieldPhotoFilters(list, { unclassifiedOnly: true }).map((p) => p.clientUuid)).toEqual(['2', '3']);
  });

  it('vincular a uma OS tira a foto de "Não Classificadas"; remover o vínculo devolve', () => {
    const base = photo({ clientUuid: '1' });
    expect(isUnclassified(base)).toBe(true);
    const linked = { ...base, osId: 'os-9' };
    expect(applyFieldPhotoFilters([linked], { unclassifiedOnly: true })).toHaveLength(0);
    const unlinked = { ...linked, osId: undefined };
    expect(applyFieldPhotoFilters([unlinked], { unclassifiedOnly: true })).toHaveLength(1);
  });

  it('código amigável estável a partir do client_uuid', () => {
    expect(friendlyPhotoId('a1b2c3d4-0000-4000-8000-000000000000')).toBe('FOTO #A1B2C3');
    expect(friendlyPhotoId('')).toBe('FOTO #000000');
  });

  it('resolve nome do cliente pela base carregada sem sobrescrever o que já veio', () => {
    const clients = [{ id: 'cli-1', name: 'Cliente Um' } as Client, { id: 'cli-2', name: 'Cliente Dois' } as Client];
    const out = attachClientNames([
      photo({ clientUuid: '1', clientId: 'cli-1' }),
      photo({ clientUuid: '2', clientId: 'cli-2', clientName: 'Nome Local' }),
      photo({ clientUuid: '3', clientId: 'desconhecido' }),
    ], clients);
    expect(out[0].clientName).toBe('Cliente Um');
    expect(out[1].clientName).toBe('Nome Local');
    expect(out[2].clientName).toBeUndefined();
  });

  it('agrupa somente clientes com foto, em ordem alfabética, com contagens derivadas', () => {
    const clients = [
      { id: 'cli-z', name: 'Zeta Ltda. (Zeta)' } as Client,
      { id: 'cli-a', name: 'Alfa Ltda. (Alfa)' } as Client,
      { id: 'cli-sem', name: 'Sem Fotos' } as Client,
    ];
    const groups = groupFieldPhotosByClient([
      photo({ clientUuid:'z1', clientId:'cli-z', marcador:'pendente', capturadoEm:'2026-08-20T10:00:00Z' }),
      photo({ clientUuid:'a1', clientId:'cli-a', capturadoEm:'2026-08-31T10:00:00Z' }),
      photo({ clientUuid:'a2', clientId:'cli-a', marcador:'pendente', capturadoEm:'2026-08-10T10:00:00Z' }),
    ], clients, [{clientId:'cli-a'}]);
    expect(groups.map(g=>g.clientName)).toEqual(['Alfa','Zeta']);
    expect(groups.find(g=>g.clientId==='cli-a')).toMatchObject({photoCount:2,pendingCount:1,comparisonCount:1,lastEvidenceAt:'2026-08-31T10:00:00Z'});
    expect(groups.some(g=>g.clientId==='cli-sem')).toBe(false);
  });
});
