import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const survey = read('components/clients/TechnicalSurveyFlow.tsx');
const viewer = read('components/ui/PhotoViewer.tsx');
const camera = read('components/ui/CameraCapture.tsx');
const attendance = read('components/operacoes/AttendanceEvidence.tsx');
const quick = read('components/field-photos/QuickFieldPhotoModal.tsx');
const reportForm = read('components/reports/ReportForm.tsx');
const formEngine = read('components/reports/FormEngine.tsx');
const reportMedia = read('lib/reportMedia.ts');
const fieldCapture = read('lib/fieldPhotoCapture.ts');
const outbox = read('lib/offline/fieldPhotoSync.ts');
const assetDetail = read('components/clients/AssetDetailDrawer.tsx');

describe('visualização de fotos no levantamento', () => {
  it('foto confirmada aparece no equipamento atual antes de salvar', () => {
    expect(survey).toContain('photoPreviews: [...p.photoPreviews, captured.previewUrl]');
    expect(survey).toContain('<PhotoStrip urls={draft.photoPreviews}');
  });

  it('cada thumbnail abre a sua própria URL', () => {
    expect(survey).toContain('urls.map((url, index) =>');
    expect(survey).toContain('onClick={() => onOpen(url, index)}');
  });

  it('múltiplas fotos do equipamento salvo permanecem disponíveis', () => {
    expect(survey).toContain('setSavedPhotoPreviews((p) => ({ ...p, [id]: draft.photoPreviews }))');
    expect(survey).toContain('<PhotoStrip urls={previews}');
  });

  it('editar reutiliza o mesmo device id e as mesmas fotos sem cópia', () => {
    expect(survey).toContain('assetId: device.id');
    expect(survey).toContain('photoPreviews: savedPhotoPreviews[device.id] || []');
    expect(survey).not.toContain('photoPreviews: [...savedPhotoPreviews[device.id]');
  });

  it('foto local continua visível enquanto está na outbox', () => {
    expect(fieldCapture).toContain('previewUrl: URL.createObjectURL(input.file)');
    expect(outbox).toContain('original: Blob');
    expect(survey).toContain('localPreviewUrlsRef.current.add(captured.previewUrl)');
  });

  it('previews locais são liberados somente ao desmontar o levantamento', () => {
    expect(survey).toContain('localPreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))');
    expect(survey).toContain('localPreviewUrlsRef.current.clear()');
  });
});

describe('PhotoViewer compartilhado', () => {
  it('fecha somente a si próprio e contém eventos do modal pai', () => {
    for (const handler of ['onClick', 'onPointerDown', 'onPointerUp', 'onTouchStart', 'onTouchEnd']) expect(viewer).toContain(`${handler}={contain}`);
    expect(viewer).toContain('event.stopPropagation()');
    expect(viewer.match(/onClose/g)).toHaveLength(3);
  });

  it('seu botão não submete formulários e imagem possui fallback', () => {
    expect(viewer).toContain('<button type="button" onClick={onClose}');
    expect(viewer).toContain('onError={() => setFailed(true)}');
    expect(viewer).toContain('Não foi possível carregar esta imagem agora.');
  });

  it('é usado tanto no levantamento quanto nas fotos persistidas da Base Técnica', () => {
    expect(survey).toContain('<PhotoViewer');
    expect(assetDetail).toContain('<PhotoViewer');
    expect(assetDetail).not.toContain('target="_blank"');
  });
});

describe('inventário e diferenças legítimas dos fluxos de foto', () => {
  it('todos os consumidores de CameraCapture herdam preview e confirmação explícita', () => {
    expect(camera).toContain('onClick={usePhoto}');
    expect(survey).toContain('<CameraCapture');
    expect(attendance).toContain('<CameraCapture');
  });

  it('Registro Rápido mostra preview e só enfileira ao salvar', () => {
    expect(quick).toContain('Prévia da foto capturada');
    expect(quick).toContain("savePhoto(false)");
    const captureHandler = quick.slice(quick.indexOf('const capture = async'), quick.indexOf('const savePhoto'));
    const saveHandler = quick.slice(quick.indexOf('const savePhoto'), quick.indexOf('const finalize'));
    expect(captureHandler).toContain('setCurrent({ file');
    expect(captureHandler).not.toContain('enqueueFieldPhoto({');
    expect(saveHandler).toContain('await enqueueFieldPhoto({');
  });

  it('relatórios mantêm mídia transitória editável até a finalização', () => {
    expect(reportForm).toContain('registerPhoto(file)');
    expect(formEngine).toContain('getPhotoPreview(pid)');
    expect(formEngine).toContain('onValue([])');
    expect(reportMedia).toContain('fica aqui até a');
    expect(reportMedia).toContain('finalização, quando é comprimido, enviado ao Storage');
  });

  it('field_photos continua no pipeline offline existente e com vínculo de device', () => {
    expect(fieldCapture).toContain('enqueueFieldPhoto({ photo, session: input.session');
    expect(fieldCapture).toContain('deviceId: input.deviceId');
    expect(outbox).toContain("registerOfflineHandler<FieldPhotoPayload>('FIELD_PHOTO'");
  });

  it('a auditoria não altera RLS, bucket privado ou cria confirmação paralela', () => {
    expect(camera).not.toMatch(/service.?role|publicUrl|public bucket/i);
    expect(viewer).not.toMatch(/service.?role|publicUrl|upload|delete/i);
  });
});
