import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const camera = read('components/ui/CameraCapture.tsx');
const survey = read('components/clients/TechnicalSurveyFlow.tsx');
const attendance = read('components/operacoes/AttendanceEvidence.tsx');

describe('CameraCapture — confirmação explícita e isolamento', () => {
  it('contém click, pointer e touch no boundary da câmera', () => {
    for (const handler of ['onClick', 'onPointerDown', 'onPointerUp', 'onTouchStart', 'onTouchEnd']) expect(camera).toContain(`${handler}={containInteraction}`);
    expect(camera).toContain('event.stopPropagation()');
  });

  it('todos os botões são type="button" e não submetem formulário ancestral', () => {
    const buttons = [...camera.matchAll(/<button\b[^>]*>/g)].map(([tag]) => tag);
    expect(buttons).toHaveLength(8);
    expect(buttons.every((tag) => /\btype="button"/.test(tag))).toBe(true);
  });

  it('capturar e selecionar na galeria criam preview sem chamar onCapture', () => {
    const captureHandler = camera.slice(camera.indexOf('const capture = useCallback'), camera.indexOf('const onGallery'));
    const galleryHandler = camera.slice(camera.indexOf('const onGallery'), camera.indexOf('const retake'));
    expect(captureHandler).toContain("replacePreview(blobToCapturedFile(blob), 'camera')");
    expect(galleryHandler).toContain("replacePreview(file, 'gallery')");
    expect(captureHandler).not.toContain('onCapture(');
    expect(galleryHandler).not.toContain('onCapture(');
    expect(camera).toContain('aria-label="Pré-visualização da foto"');
  });

  it('Tirar novamente descarta somente o preview e reabre a câmera', () => {
    expect(camera).toMatch(/const retake = \(\) => \{\s*discardPreview\(\);\s*start\(facing\);/);
    expect(camera).toContain('Tirar novamente');
  });

  it('Usar foto é a única confirmação e possui trava contra chamada dupla', () => {
    expect(camera).toContain('onClick={usePhoto}');
    expect(camera).toContain('onCapture(preview.file)');
    expect(camera).toContain('confirmedRef.current = true');
    expect(camera.match(/onCapture\(/g)).toHaveLength(1);
  });

  it('galeria permite escolher outra antes de confirmar', () => {
    expect(camera).toContain("preview.source === 'gallery'");
    expect(camera).toContain('Escolher outra');
    expect(camera).toContain('Usar foto');
  });

  it('trocar câmera não fecha; fechar descarta somente preview/câmera', () => {
    expect(camera).toContain("setFacing((f) => (f === 'environment' ? 'user' : 'environment'))");
    expect(camera.match(/onClose\(\)/g)).toHaveLength(1);
    expect(camera).toContain('const close = () => { stop(); discardPreview(); onClose(); };');
  });
});

describe('Levantamento Técnico — preservação e cadastro sequencial', () => {
  it('não fecha por backdrop; câmera altera somente showCamera', () => {
    expect(survey).not.toMatch(/bg-black\/50 sm:items-center sm:p-4" onClick=\{onClose\}/);
    expect(survey).toContain('aria-label="Sair do levantamento"');
    expect(survey).toContain('onClick={() => setShowCamera(true)}');
    expect(survey).toContain('onClose={() => setShowCamera(false)}');
  });

  it('erro de câmera/foto/upload não fecha nem reinicia o levantamento', () => {
    expect(camera).toContain('setError(cameraErrorMessage(e))');
    const captureHandler = survey.slice(survey.indexOf('const onCapture = async'), survey.indexOf('const doSaveNew'));
    expect(captureHandler).toMatch(/catch \(e: any\) \{ showToast\(`Falha na foto:/);
    expect(captureHandler).not.toContain('onClose()');
    expect(captureHandler).not.toContain('setDraft(emptyDraft())');
  });

  it('persiste antes de preparar o próximo registro', () => {
    const saveHandler = survey.slice(survey.indexOf('const doSaveNew'), survey.indexOf('const doVerifyExisting'));
    expect(saveHandler.indexOf('await persistSurveyAsset')).toBeLessThan(saveHandler.indexOf('setDraft(goNext ? nextDraft() : emptyDraft())'));
    const catchBlock = saveHandler.slice(saveHandler.indexOf('catch'));
    expect(catchBlock).not.toContain('setDraft(');
    expect(catchBlock).not.toContain('focusCurrentAsset()');
  });

  it('próximo registro recebe nova identidade e limpa campos específicos/fotos/condição', () => {
    const next = survey.slice(survey.indexOf('const nextDraft'), survey.indexOf('const focusCurrentAsset'));
    for (const expected of ['assetId: newAssetId()', 'photos: 0', 'photoPreviews: []', "condicao: 'NORMAL'"]) expect(next).toContain(expected);
    for (const forbidden of ['endereco: v.endereco', 'serial: v.serial', 'localizacao: v.localizacao', 'attrs: v.attrs', 'condicao: v.condicao']) expect(next).not.toContain(forbidden);
  });

  it('mantém somente a repetição explícita e posiciona o novo formulário', () => {
    const next = survey.slice(survey.indexOf('const nextDraft'), survey.indexOf('const focusCurrentAsset'));
    for (const retained of ['grupo: draft.grupo', 'fabricante: v.fabricante', 'modelo: v.modelo', 'central: v.central', 'laco: v.laco']) expect(next).toContain(retained);
    expect(survey).toContain("scrollIntoView({ behavior: 'smooth', block: 'start' })");
    expect(survey).toContain("focus({ preventScroll: true })");
  });

  it('mantém anteriores em resumo com foto e edição', () => {
    expect(survey).toContain('Equipamentos salvos nesta visita');
    expect(survey).toContain('Equipamento {index + 1} — salvo ✓');
    expect(survey).toContain('setViewingPhoto(previews[0])');
    expect(survey).toContain('editCreatedAsset(device)');
  });

  it('edição atualiza sem duplicar e múltiplos sucessos acumulam', () => {
    expect(survey).toContain('editingCreatedId ? p.map((d) => d.id === id ? res.device : d) : [...p, res.device]');
  });
});

describe('auditoria dos consumidores e permissões', () => {
  it('o mesmo levantamento cobre todas as áreas técnicas', () => {
    const areas = read('lib/technicalBase.ts');
    expect(survey).toContain('<CameraCapture');
    for (const area of ['SDAI', 'CFTV', 'ALARME', 'BMS', 'CONTROLE_ACESSO']) expect(areas).toContain(area);
  });

  it('Atendimentos/evidências recebe o arquivo somente após confirmação', () => {
    expect(attendance).toContain('<CameraCapture');
    expect(attendance).toContain('setCameraOpen(false); receiveFile(file);');
    expect(attendance).toContain('setCameraOpen(false); pendingCfgRef.current = null;');
  });

  it('não altera regras de papel existentes', () => {
    expect(camera).not.toMatch(/ADMINISTRATIVO|TECNICO|GESTOR|FINANCEIRO/);
    expect(survey).toContain('userRole: UserRole;');
  });
});
