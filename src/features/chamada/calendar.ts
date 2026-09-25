const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'] as const;

export type ModoCalendario = 'semana' | 'mes';

export type DiaCalendario = {
  data: Date;
  iso: string;
  diaMes: number;
  diaSemana: number;
  rotuloCurto: string;
  isHoje: boolean;
};

export function paraDataSemHorario(base: Date) {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate());
}

export function formatDataISO(data: Date) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export function parseDataISO(iso: string) {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, ano, mes, dia] = match;
  return new Date(Number(ano), Number(mes) - 1, Number(dia));
}

export function addDias(data: Date, dias: number) {
  const nova = paraDataSemHorario(data);
  nova.setDate(nova.getDate() + dias);
  return nova;
}

export function inicioDaSemana(data: Date) {
  return addDias(data, -data.getDay());
}

export function getDiasDaSemana(referencia: Date) {
  const hoje = paraDataSemHorario(new Date());
  const inicio = inicioDaSemana(referencia);
  return Array.from({ length: 7 }, (_, i) => {
    const data = addDias(inicio, i);
    return {
      data,
      iso: formatDataISO(data),
      diaMes: data.getDate(),
      diaSemana: data.getDay(),
      rotuloCurto: DIAS_CURTOS[data.getDay()],
      isHoje: formatDataISO(data) === formatDataISO(hoje),
    } satisfies DiaCalendario;
  });
}

export function getGradeMes(referencia: Date) {
  const primeiroDia = new Date(referencia.getFullYear(), referencia.getMonth(), 1);
  const ultimoDia = new Date(referencia.getFullYear(), referencia.getMonth() + 1, 0);
  const inicioGrade = addDias(primeiroDia, -primeiroDia.getDay());
  const fimGrade = addDias(ultimoDia, 6 - ultimoDia.getDay());
  const dias: DiaCalendario[] = [];
  let cursor = inicioGrade;

  while (formatDataISO(cursor) <= formatDataISO(fimGrade)) {
    const data = paraDataSemHorario(cursor);
    dias.push({
      data,
      iso: formatDataISO(data),
      diaMes: data.getDate(),
      diaSemana: data.getDay(),
      rotuloCurto: DIAS_CURTOS[data.getDay()],
      isHoje: formatDataISO(data) === formatDataISO(new Date()),
    });
    cursor = addDias(cursor, 1);
  }

  return dias;
}

export function formatDataExtenso(data: Date) {
  return data.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function formatMesAno(data: Date) {
  return data.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
}

// "Semana" sozinho não diz nada — mostra o intervalo de fato, igual o modo
// mês já mostra "janeiro 2026" em vez de só "Mês".
export function formatIntervaloSemana(dias: DiaCalendario[]) {
  return dias[0].data.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
}

export function dataISOAntesDeHoje(dataISO: string) {
  return dataISO < formatDataISO(new Date());
}

export function formatHora(hora: string) {
  return hora.slice(0, 5);
}

export function formatModulos(modulos: number[]) {
  return modulos.length === 1 ? `Módulo ${modulos[0]}` : `Módulos ${modulos.join(', ')}`;
}