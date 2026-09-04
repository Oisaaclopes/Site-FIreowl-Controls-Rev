import { describe, expect, it } from 'vitest';
import { websiteDisplay, websiteHref } from './companyProfile';

describe('website institucional — normalização (§3/§45)', () => {
  it('exibição remove protocolo e barra final', () => {
    expect(websiteDisplay('https://www.fireowlcontrols.com.br')).toBe('www.fireowlcontrols.com.br');
    expect(websiteDisplay('http://www.fireowlcontrols.com.br/')).toBe('www.fireowlcontrols.com.br');
    expect(websiteDisplay('www.fireowlcontrols.com.br')).toBe('www.fireowlcontrols.com.br');
  });

  it('link garante https:// e sem barra final', () => {
    expect(websiteHref('www.fireowlcontrols.com.br')).toBe('https://www.fireowlcontrols.com.br');
    expect(websiteHref('https://www.fireowlcontrols.com.br/')).toBe('https://www.fireowlcontrols.com.br');
    expect(websiteHref('http://fireowlcontrols.com.br')).toBe('http://fireowlcontrols.com.br');
  });

  it('website ausente não quebra (string vazia)', () => {
    expect(websiteDisplay(undefined)).toBe('');
    expect(websiteDisplay('')).toBe('');
    expect(websiteHref(undefined)).toBe('');
    expect(websiteHref('   ')).toBe('');
  });
});
