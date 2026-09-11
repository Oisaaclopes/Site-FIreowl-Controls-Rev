import { beforeEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ read: vi.fn(), start: vi.fn(), resume: vi.fn(), event: vi.fn() }));
vi.mock('./serviceAttendances', () => ({ fetchServiceAttendances: api.read, startAttendance: api.start, resumeAttendance: api.resume, insertAttendanceEvent: api.event }));
import { restoreAttendanceNavigation } from './attendanceNavigation';
beforeEach(() => vi.clearAllMocks());
it.each(['EM_EXECUCAO', 'PAUSADO'])('reopens %s without creating attendance, resuming or emitting STARTED', async (status) => {
  const existing = { id: 'a1', technicianId: 'u1', status };
  api.read.mockResolvedValue([existing]);
  expect(await restoreAttendanceNavigation('a1', 'u1')).toEqual(existing);
  expect(api.read).toHaveBeenCalledWith({ technicianId: 'u1' });
  expect(api.start).not.toHaveBeenCalled(); expect(api.resume).not.toHaveBeenCalled(); expect(api.event).not.toHaveBeenCalled();
});
it('rejects completed attendance and other technician context', async () => {
  api.read.mockResolvedValue([{ id: 'a1', technicianId: 'u1', status: 'FINALIZADO' }, { id: 'a2', technicianId: 'u2', status: 'EM_EXECUCAO' }]);
  expect(await restoreAttendanceNavigation('a1', 'u1')).toBeNull();
  expect(await restoreAttendanceNavigation('a2', 'u1')).toBeNull();
});
it('missing record does not create a replacement', async () => {
  api.read.mockResolvedValue([]);
  expect(await restoreAttendanceNavigation('missing', 'u1')).toBeNull();
  expect(api.start).not.toHaveBeenCalled();
});
it('does not read without a signed-in user', async () => {
  expect(await restoreAttendanceNavigation('a1', '')).toBeNull();
  expect(api.read).not.toHaveBeenCalled();
});
