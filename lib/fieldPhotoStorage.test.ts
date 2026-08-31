import { describe, expect, it } from 'vitest';
import { buildFieldPhotoPath } from './fieldPhotoStorage';

const TECH_A = '00000000-0000-4000-8000-000000000001';
const TECH_B = '00000000-0000-4000-8000-000000000002';
const SESSION = '10000000-0000-4000-8000-000000000001';
const PHOTO = '20000000-0000-4000-8000-000000000001';

describe('field photo storage paths', () => {
  it('isola o primeiro segmento pelo UUID do técnico', () => {
    const a = buildFieldPhotoPath({ technicianId: TECH_A, sessionClientUuid: SESSION, photoClientUuid: PHOTO, asset: 'original' });
    const b = buildFieldPhotoPath({ technicianId: TECH_B, sessionClientUuid: SESSION, photoClientUuid: PHOTO, asset: 'original' });
    expect(a.split('/')[0]).toBe(TECH_A);
    expect(b.split('/')[0]).toBe(TECH_B);
  });
  it('mantém retry estável e separa os derivados', () => {
    const base = { technicianId: TECH_A, sessionClientUuid: SESSION, photoClientUuid: PHOTO };
    expect(buildFieldPhotoPath({ ...base, asset: 'original' })).toBe(buildFieldPhotoPath({ ...base, asset: 'original' }));
    expect(buildFieldPhotoPath({ ...base, asset: 'evidence' })).not.toBe(buildFieldPhotoPath({ ...base, asset: 'markup' }));
  });
});
