import { translateHours } from './translate-hours';

describe('translateHours', () => {
  it('translates Mo → Lu', () => {
    expect(translateHours('Mo 09:00-18:00')).toBe('Lu 09:00-18:00');
  });

  it('translates Tu → Ma', () => {
    expect(translateHours('Tu 10:00-20:00')).toBe('Ma 10:00-20:00');
  });

  it('translates We → Mi', () => {
    expect(translateHours('We 09:00-21:00')).toBe('Mi 09:00-21:00');
  });

  it('translates Th → Ju', () => {
    expect(translateHours('Th 09:00-21:00')).toBe('Ju 09:00-21:00');
  });

  it('translates Fr → Vi', () => {
    expect(translateHours('Fr 09:00-21:00')).toBe('Vi 09:00-21:00');
  });

  it('translates Sa → Sá', () => {
    expect(translateHours('Sa 10:00-15:00')).toBe('Sá 10:00-15:00');
  });

  it('translates Su → Do', () => {
    expect(translateHours('Su 12:00-17:00')).toBe('Do 12:00-17:00');
  });

  it('translates a full week range', () => {
    expect(translateHours('Mo-Fr 09:00-21:00; Sa-Su 10:00-15:00')).toBe(
      'Lu-Vi 09:00-21:00; Sá-Do 10:00-15:00',
    );
  });

  it('translates multiple separate days', () => {
    expect(translateHours('Mo,We,Fr 08:00-20:00')).toBe('Lu,Mi,Vi 08:00-20:00');
  });

  it('passes through strings without day abbreviations unchanged', () => {
    expect(translateHours('24/7')).toBe('24/7');
  });

  it('respects word boundaries and does not translate partial matches', () => {
    // "Month" starts with Mo but should not be changed
    expect(translateHours('Monthly special')).toBe('Monthly special');
  });
});
