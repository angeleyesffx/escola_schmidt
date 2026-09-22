import type {
  AulaParticular,
  AulaRecorrente,
  AulaTeste,
  RegistroPresenca,
  ResponsabilidadeProfessor,
  StatusPresenca,
} from './api';
import type { EventoCalendario, TipoEvento } from '../eventos/api';

export function agruparAulasPorDiaSemana(gradeSemanal: AulaRecorrente[]): Map<number, AulaRecorrente[]> {
  const aulasPorDiaSemana = new Map<number, AulaRecorrente[]>();
  for (const aula of gradeSemanal) {
    const lista = aulasPorDiaSemana.get(aula.dia_semana) ?? [];
    lista.push(aula);
    aulasPorDiaSemana.set(aula.dia_semana, lista);
  }
  return aulasPorDiaSemana;
}

export function montarCorPorTipo(tiposEvento: TipoEvento[]): Map<string, string> {
  return new Map(tiposEvento.map((t) => [t.id, t.cor]));
}

export function filtrarEventosNoDia(eventos: EventoCalendario[], iso: string): EventoCalendario[] {
  return eventos.filter((e) => iso >= e.data_inicio && iso <= e.data_fim);
}

export function filtrarParticularesNoDia(particulares: AulaParticular[], iso: string): AulaParticular[] {
  return particulares.filter((p) => p.data === iso);
}

export function filtrarTestesNoDia(aulasTeste: AulaTeste[], iso: string): AulaTeste[] {
  return aulasTeste.filter((t) => t.data === iso);
}

export function montarMeusSlots(responsabilidades: ResponsabilidadeProfessor[]): Set<string> {
  return new Set(responsabilidades.map((r) => r.aula_recorrente_id));
}

export function filtrarAulasDoProfessor(
  aulas: AulaRecorrente[],
  souProfessor: boolean,
  meusSlots: Set<string>
): AulaRecorrente[] {
  return aulas.filter((aula) => !souProfessor || meusSlots.has(aula.id));
}

export type RegistroLocal = { status: StatusPresenca; registradoEm: string | null };

export type EstadoPresenca = {
  status: StatusPresenca;
  label: string;
  legenda: string;
  cor: 'present' | 'justified' | 'absent';
};

export const ESTADOS: EstadoPresenca[] = [
  { status: 'presente', label: '✓', legenda: 'Presente', cor: 'present' },
  { status: 'falta_justificada', label: 'J', legenda: 'Falta justificada', cor: 'justified' },
  { status: 'falta', label: '✕', legenda: 'Falta', cor: 'absent' },
];

export function presencasParaRegistro(lista: RegistroPresenca[]): Record<string, RegistroLocal> {
  return Object.fromEntries(lista.map((p) => [p.aluno_id, { status: p.status, registradoEm: p.registrado_em }]));
}
