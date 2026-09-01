import { execFileSync } from 'node:child_process';

const output = execFileSync('git', ['grep', '-nE', '(^|[^[:alnum:]_])(window\\.)?(alert|confirm|prompt)[[:space:]]*\\(', '--', '*.ts', '*.tsx'], { encoding: 'utf8' });
const allowed = [
  /components\/ui\/Feedback\.tsx/,
  /components\/pwa\/PwaClient\.tsx.*installPrompt\.prompt\(/,
  /await confirm\(/,
];
const violations = output.split(/\r?\n/).filter(Boolean).filter((line) => !allowed.some((rule) => rule.test(line)));
if (violations.length) {
  console.error('Dialogs nativos do navegador não são permitidos:\n' + violations.join('\n'));
  process.exit(1);
}
console.log('OK: nenhuma chamada operacional a alert/confirm/prompt nativos.');
