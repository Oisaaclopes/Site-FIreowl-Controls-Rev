import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const camera = read('components/ui/CameraCapture.tsx');
const survey = read('components/clients/TechnicalSurveyFlow.tsx');
const attendance = read('components/operacoes/AttendanceEvidence.tsx');

describe('CameraCapture — isolamento de modal e formulário pai', () => {
  it('contém click, pointer e touch no boundary da câmera', () => {
    expect(camera).toContain('onClick={containInteraction}');
    expect(camera).toContain('onPointerDown={containInteraction}');
    expect(camera).toContain('onPointerUp={containInteraction}');
    expect(camera).toContain('onTouchStart={containInteraction}');
    expect(camera).toContain('onTouchEnd={containInteraction}');
    expect(camera).toContain('event.stopPropagation()');
  });

  it('todos os botões da câmera são type="button" e não submetem formulário ancestral', () => {
    const buttons = [...camera.matchAll(/<button\b[^>]*>/g)].map(([tag]) => tag);
    expect(buttons).toHaveLength(6);
    expect(buttons.every((tag) => /\btype="button"/.test(tag))).toBe(true);
  });

  it('captura, galeria e troca de câmera não invocam onClose', () => {
    expect(camera).toContain('onClick={capture}');
    expect(camera).toContain('onChange={onGallery}');
    expect(camera).toContain("setFacing((f) => (f === 'environment' ? 'user' : 'environment'))");
    expect(camera.match(/onClose\(\)/g)).toHaveLength(1);
    expect(camera).toContain('const close = () => { stop(); onClose(); };');
  });
});

describe('Levantamento Técnico — preservação do fluxo e do estado', () => {
  it('não fecha por backdrop; somente a ação explícita chama onClose', () => {
    expect(survey).not.toMatch(/bg-black\/50 sm:items-center sm:p-4" onClick=\{onClose\}/);
    expect(survey).toContain('aria-label="Sair do levantamento"');
    expect(survey).toContain('onClose={() => setShowCamera(false)}');
  });

  it('abrir/fechar a câmera altera somente showCamera e mantém o rascunho montado', () => {
    expect(survey).toContain('onClick={() => setShowCamera(true)}');
    expect(survey).toContain('onClose={() => setShowCamera(false)}');
    expect(survey).toContain('const [draft, setDraft] = useState<Draft>(emptyDraft());');
    expect(survey).toContain('const [obs, setObs] = useState<');
  });

  it('falha de foto/upload é tratada sem fechar ou reiniciar o levantamento', () => {
    expect(survey).toMatch(/catch \(e: any\) \{ showToast\(`Falha na foto:/);
    const captureHandler = survey.slice(survey.indexOf('const onCapture = async'), survey.indexOf('const doSaveNew'));
    expect(captureHandler).not.toContain('onClose()');
    expect(captureHandler).not.toContain('setDraft(emptyDraft())');
  });

  it('erro/permissão da câmera permanece no componente e oferece galeria', () => {
    expect(camera).toContain('setError(cameraErrorMessage(e))');
    expect(camera).toContain('Escolher da galeria');
    expect(camera).not.toMatch(/catch \(e\)[\s\S]{0,120}onClose/);
  });
});

describe('auditoria dos consumidores compartilhados', () => {
  it('o levantamento usa um único CameraCapture para todas as áreas técnicas', () => {
    expect(survey).toContain('<CameraCapture');
    for (const area of ['SDAI', 'CFTV', 'ALARME', 'BMS', 'CONTROLE_ACESSO']) {
      expect(read('lib/technicalBase.ts')).toContain(area);
    }
  });

  it('Atendimentos/evidências fecha somente a câmera e mantém sua configuração', () => {
    expect(attendance).toContain('<CameraCapture');
    expect(attendance).toContain('setCameraOpen(false); receiveFile(file);');
    expect(attendance).toContain('setCameraOpen(false); pendingCfgRef.current = null;');
  });

  it('a câmera não introduz regra de papel e preserva permissões existentes', () => {
    expect(camera).not.toMatch(/ADMINISTRATIVO|TECNICO|GESTOR|FINANCEIRO/);
    expect(survey).toContain('userRole: UserRole;');
  });
});
