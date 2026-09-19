jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

import { diaSemanaPorDataISO } from './api';
import {
  formatDataISO,
  getDiasDaSemana,
  getGradeMes,
  parseDataISO,
} from './calendar';

describe('calendar helpers', () => {
  it('parses and formats local ISO date correctly', () => {
    const data = parseDataISO('2026-09-18');
    expect(data).not.toBeNull();
    expect(formatDataISO(data!)).toBe('2026-09-18');
  });

  it('returns a 7-day week segment starting on Sunday', () => {
    const dias = getDiasDaSemana(new Date(2026, 8, 18));
    expect(dias).toHaveLength(7);
    expect(dias[0].diaSemana).toBe(0);
    expect(dias[6].diaSemana).toBe(6);
  });

  it('returns a full month grid aligned to full weeks', () => {
    const grade = getGradeMes(new Date(2026, 8, 1));
    expect(grade.length % 7).toBe(0);
    expect(grade.length).toBeGreaterThanOrEqual(35);
  });
});

describe('date to turma day mapping', () => {
  it('maps ISO date to weekday index', () => {
    expect(diaSemanaPorDataISO('2026-09-20')).toBe(0);
    expect(diaSemanaPorDataISO('2026-09-21')).toBe(1);
  });

  it('rejects invalid ISO date format', () => {
    expect(() => diaSemanaPorDataISO('18/09/2026')).toThrow('Data invalida. Use o formato AAAA-MM-DD.');
  });
});