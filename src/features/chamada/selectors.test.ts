import {
  agruparAulasPorDiaSemana,
  filtrarAulasDoProfessor,
  filtrarEventosNoDia,
  filtrarParticularesNoDia,
  filtrarTestesNoDia,
  montarCorPorTipo,
  montarMeusSlots,
} from './selectors';
import type { AulaParticular, AulaRecorrente, AulaTeste, ResponsabilidadeProfessor } from './api';
import type { EventoCalendario, TipoEvento } from '../eventos/api';

describe('agruparAulasPorDiaSemana', () => {
  it('agrupa aulas pelo dia_semana, preservando a ordem de chegada', () => {
    const gradeSemanal: AulaRecorrente[] = [
      { id: 'a1', dia_semana: 1, hora: '08:00', modulos: [1] },
      { id: 'a2', dia_semana: 3, hora: '09:00', modulos: [2] },
      { id: 'a3', dia_semana: 1, hora: '10:00', modulos: [1] },
    ];

    const resultado = agruparAulasPorDiaSemana(gradeSemanal);

    expect(resultado.get(1)).toEqual([gradeSemanal[0], gradeSemanal[2]]);
    expect(resultado.get(3)).toEqual([gradeSemanal[1]]);
    expect(resultado.get(2)).toBeUndefined();
  });

  it('retorna mapa vazio para grade vazia', () => {
    expect(agruparAulasPorDiaSemana([]).size).toBe(0);
  });
});

describe('montarCorPorTipo', () => {
  it('mapeia id do tipo de evento para sua cor', () => {
    const tipos: TipoEvento[] = [
      { id: 't1', nome: 'Treino', cor: '#00B4CC', ordem: 1 },
      { id: 't2', nome: 'Prova', cor: '#C4453D', ordem: 2 },
    ];

    const resultado = montarCorPorTipo(tipos);

    expect(resultado.get('t1')).toBe('#00B4CC');
    expect(resultado.get('t2')).toBe('#C4453D');
  });
});

describe('filtrarEventosNoDia', () => {
  const eventos: EventoCalendario[] = [
    { id: 'e1', tipo_id: 't1', titulo: 'Único dia', data_inicio: '2026-09-20', data_fim: '2026-09-20', descricao: null },
    { id: 'e2', tipo_id: 't1', titulo: 'Vários dias', data_inicio: '2026-09-18', data_fim: '2026-09-22', descricao: null },
    { id: 'e3', tipo_id: 't1', titulo: 'Antes', data_inicio: '2026-09-10', data_fim: '2026-09-12', descricao: null },
  ];

  it('inclui eventos cujo período contém a data', () => {
    const resultado = filtrarEventosNoDia(eventos, '2026-09-20');
    expect(resultado.map((e) => e.id)).toEqual(['e1', 'e2']);
  });

  it('exclui eventos fora do período', () => {
    expect(filtrarEventosNoDia(eventos, '2026-09-30')).toEqual([]);
  });
});

describe('filtrarParticularesNoDia', () => {
  it('filtra particulares pela data exata', () => {
    const particulares: AulaParticular[] = [
      { id: 'p1', data: '2026-09-20', hora: '08:00', observacoes: null, aluno_id: 'al1', aluno_nome: 'Ana', professor_id: 'pr1', professor_nome: 'João' },
      { id: 'p2', data: '2026-09-21', hora: '09:00', observacoes: null, aluno_id: 'al2', aluno_nome: 'Bia', professor_id: 'pr1', professor_nome: 'João' },
    ];

    expect(filtrarParticularesNoDia(particulares, '2026-09-20')).toEqual([particulares[0]]);
  });
});

describe('filtrarTestesNoDia', () => {
  it('filtra aulas teste pela data exata', () => {
    const testes: AulaTeste[] = [
      { id: 't1', aula_recorrente_id: 'ar1', data: '2026-09-20', observacoes: null, dia_semana: 1, hora: '08:00', modulos: [1], candidatos: [] },
      { id: 't2', aula_recorrente_id: 'ar1', data: '2026-09-22', observacoes: null, dia_semana: 3, hora: '09:00', modulos: [1], candidatos: [] },
    ];

    expect(filtrarTestesNoDia(testes, '2026-09-22')).toEqual([testes[1]]);
  });
});

describe('montarMeusSlots', () => {
  it('extrai o conjunto de aula_recorrente_id das responsabilidades', () => {
    const responsabilidades: ResponsabilidadeProfessor[] = [
      { id: 'r1', aula_recorrente_id: 'ar1', modulo: 1 },
      { id: 'r2', aula_recorrente_id: 'ar2', modulo: 2 },
    ];

    const resultado = montarMeusSlots(responsabilidades);

    expect(resultado.has('ar1')).toBe(true);
    expect(resultado.has('ar2')).toBe(true);
    expect(resultado.has('ar3')).toBe(false);
  });
});

describe('filtrarAulasDoProfessor', () => {
  const aulas: AulaRecorrente[] = [
    { id: 'ar1', dia_semana: 1, hora: '08:00', modulos: [1] },
    { id: 'ar2', dia_semana: 1, hora: '09:00', modulos: [1] },
  ];

  it('não filtra quando não é professor (dono/aluno veem a grade inteira)', () => {
    const resultado = filtrarAulasDoProfessor(aulas, false, new Set());
    expect(resultado).toEqual(aulas);
  });

  it('quando é professor, mantém só as aulas dos seus próprios slots', () => {
    const meusSlots = new Set(['ar1']);
    const resultado = filtrarAulasDoProfessor(aulas, true, meusSlots);
    expect(resultado.map((a) => a.id)).toEqual(['ar1']);
  });
});
