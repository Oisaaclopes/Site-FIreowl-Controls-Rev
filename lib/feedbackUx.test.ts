import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const feedback = readFileSync(resolve(process.cwd(), 'components/ui/Feedback.tsx'), 'utf8');
const reports = readFileSync(resolve(process.cwd(), 'components/views/RelatoriosView.tsx'), 'utf8');

describe('Feedback Fireowl sem dialogs nativos', () => {
  it('mantém o contrato acessível e os caminhos de cancelamento', () => {
    expect(feedback).toContain('role="dialog"');
    expect(feedback).toContain('aria-modal="true"');
    expect(feedback).toContain("e.key === 'Escape'");
    expect(feedback).toContain('opener.current?.focus()');
    expect(feedback).toContain("e.key === 'Enter' && dialog.kind === 'confirm'");
  });

  it('bloqueia confirmação repetida enquanto a ação está em andamento', () => {
    expect(feedback).toContain('if (!dialog || busy) return');
    expect(feedback).toContain('disabled={busy');
    expect(feedback).toContain("busy ? 'Processando…'");
  });

  it('identifica o relatório e publica feedback de sucesso e erro', () => {
    expect(reports).toContain("title: 'Excluir relatório?'");
    expect(reports).toContain("confirmLabel: 'Excluir permanentemente'");
    expect(reports).toContain("showToast('Relatório excluído com sucesso.', 'success')");
    expect(reports).toContain("'Não foi possível excluir o relatório. O registro foi mantido.'");
  });
});
