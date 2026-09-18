import { describe, expect, it, vi } from 'vitest';
import { runSurveyFinalize } from './surveyFinalize';

describe('runSurveyFinalize (§D — sem falso sucesso)', () => {
  it('sucesso: fecha (onSuccess) e não chama onError; solta o busy; retorna true', async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const busy: boolean[] = [];
    const ok = await runSurveyFinalize({
      finalize: () => Promise.resolve({ status: 'FINALIZADO' }),
      onSuccess, onError, setBusy: (b) => busy.push(b),
    });
    expect(ok).toBe(true);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    expect(busy).toEqual([true, false]); // trava e destrava o botão
  });

  it('erro: NÃO fecha (onSuccess intacto), mostra feedback e destrava; retorna false', async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const busy: boolean[] = [];
    const ok = await runSurveyFinalize({
      finalize: () => Promise.reject(new Error('RLS negou o update')),
      onSuccess, onError, setBusy: (b) => busy.push(b),
    });
    expect(ok).toBe(false);
    expect(onSuccess).not.toHaveBeenCalled(); // a tela/draft permanece aberto
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith('RLS negou o update');
    expect(busy).toEqual([true, false]);
  });

  it('erro sem Error (string/valor cru) ainda produz mensagem legível e não fecha', async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const ok = await runSurveyFinalize({
      finalize: () => Promise.reject('timeout'),
      onSuccess, onError,
    });
    expect(ok).toBe(false);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith('timeout');
  });

  it('setBusy é opcional (não quebra sem ele)', async () => {
    const onSuccess = vi.fn();
    await runSurveyFinalize({ finalize: () => Promise.resolve(), onSuccess, onError: vi.fn() });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });
});
