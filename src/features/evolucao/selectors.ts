import type { StatusPresenca } from '../chamada/api';
import type {
  CriterioHabilidadeEvolucao,
  FaltanteNivel,
  ProgressoNivelEvolucao,
  RequisitoNivelEvolucao,
  ResumoCategoriaEvolucao,
  StatusAtualHabilidade,
  StatusHabilidadeEvolucao,
} from './types';

const STATUS_ORDEM: Record<StatusHabilidadeEvolucao, number> = {
  nao_iniciado: 0,
  aprendendo: 1,
  em_desenvolvimento: 2,
  dominado: 3,
  consolidado: 4,
};

function arredondar(percentual: number) {
  return Math.round(percentual * 100) / 100;
}

function atingiuRequisito(requisito: RequisitoNivelEvolucao, status: StatusAtualHabilidade | undefined) {
  if (!status) return false;
  if (STATUS_ORDEM[status.statusAtual] < STATUS_ORDEM[requisito.statusMinimo]) return false;
  if (requisito.notaMinima != null && (status.percentualAtual ?? 0) < requisito.notaMinima) return false;
  return true;
}

function montarFaltante(requisito: RequisitoNivelEvolucao, status: StatusAtualHabilidade | undefined): FaltanteNivel {
  return {
    habilidadeId: requisito.habilidadeId,
    habilidadeNome: status?.habilidadeNome ?? 'Habilidade nao carregada',
    categoriaId: requisito.categoriaId,
    categoriaNome: requisito.categoriaNome,
    statusAtual: status?.statusAtual ?? null,
    percentualAtual: status?.percentualAtual ?? null,
    statusMinimo: requisito.statusMinimo,
    notaMinima: requisito.notaMinima,
  };
}

export function calcularResumoCategorias(
  requisitos: RequisitoNivelEvolucao[],
  statusHabilidades: StatusAtualHabilidade[]
): ResumoCategoriaEvolucao[] {
  const statusPorHabilidade = new Map(statusHabilidades.map((item) => [item.habilidadeId, item]));
  const categorias = new Map<string, ResumoCategoriaEvolucao & { pesoAtingido: number; pesoTotal: number }>();

  for (const requisito of requisitos) {
    const status = statusPorHabilidade.get(requisito.habilidadeId);
    const atual =
      categorias.get(requisito.categoriaId) ?? {
        categoriaId: requisito.categoriaId,
        categoriaNome: requisito.categoriaNome,
        percentual: 0,
        habilidadesAtingidas: 0,
        habilidadesTotais: 0,
        emAtencao: 0,
        emDesenvolvimento: 0,
        pesoAtingido: 0,
        pesoTotal: 0,
      };

    atual.habilidadesTotais += 1;
    atual.pesoTotal += requisito.peso;

    if (status?.precisaAtencao) {
      atual.emAtencao += 1;
    }

    if (status && STATUS_ORDEM[status.statusAtual] <= STATUS_ORDEM.em_desenvolvimento) {
      atual.emDesenvolvimento += 1;
    }

    if (atingiuRequisito(requisito, status)) {
      atual.habilidadesAtingidas += 1;
      atual.pesoAtingido += requisito.peso;
    }

    categorias.set(requisito.categoriaId, atual);
  }

  return [...categorias.values()]
    .map((categoria) => ({
      categoriaId: categoria.categoriaId,
      categoriaNome: categoria.categoriaNome,
      percentual: categoria.pesoTotal === 0 ? 0 : arredondar((categoria.pesoAtingido / categoria.pesoTotal) * 100),
      habilidadesAtingidas: categoria.habilidadesAtingidas,
      habilidadesTotais: categoria.habilidadesTotais,
      emAtencao: categoria.emAtencao,
      emDesenvolvimento: categoria.emDesenvolvimento,
    }))
    .sort((a, b) => a.percentual - b.percentual || b.emAtencao - a.emAtencao || a.categoriaNome.localeCompare(b.categoriaNome));
}

export function calcularFocoAtual(resumoCategorias: ResumoCategoriaEvolucao[]) {
  if (resumoCategorias.length === 0) return null;
  const categoriasComPendencia = resumoCategorias.filter(
    (categoria) => categoria.percentual < 100 || categoria.emAtencao > 0 || categoria.emDesenvolvimento > 0
  );
  return categoriasComPendencia[0] ?? resumoCategorias[0];
}

export function calcularProgressoNivel(
  requisitos: RequisitoNivelEvolucao[],
  statusHabilidades: StatusAtualHabilidade[]
): ProgressoNivelEvolucao {
  const statusPorHabilidade = new Map(statusHabilidades.map((item) => [item.habilidadeId, item]));
  let pesoAtingido = 0;
  let pesoTotal = 0;
  let habilidadesAtingidas = 0;
  const faltantes: FaltanteNivel[] = [];

  for (const requisito of requisitos) {
    pesoTotal += requisito.peso;
    const status = statusPorHabilidade.get(requisito.habilidadeId);
    if (atingiuRequisito(requisito, status)) {
      pesoAtingido += requisito.peso;
      habilidadesAtingidas += 1;
    } else {
      faltantes.push(montarFaltante(requisito, status));
    }
  }

  const resumoCategorias = calcularResumoCategorias(requisitos, statusHabilidades);

  return {
    percentual: pesoTotal === 0 ? 0 : arredondar((pesoAtingido / pesoTotal) * 100),
    pesoAtingido: arredondar(pesoAtingido),
    pesoTotal: arredondar(pesoTotal),
    habilidadesAtingidas,
    habilidadesTotais: requisitos.length,
    faltantes,
    resumoCategorias,
    focoAtual: calcularFocoAtual(resumoCategorias),
  };
}

export function getStatusOrdem(status: StatusHabilidadeEvolucao) {
  return STATUS_ORDEM[status];
}

// docs/product/evolucao-vs-desempenho.md §8.2 — mesmo principio das tabelas
// oficiais de patinação: cada elemento tem um valor base, ajustado por um
// fator de qualidade da execução, gerando a pontuação daquele elemento.
// Equivalente simplificado ao "confirmado/não confirmado" oficial — não é
// avaliação detalhada por critério (essa já usa percentual_geral/100 direto,
// ver calcularPontuacaoAluno abaixo).
const FATOR_QUALIDADE: Record<StatusHabilidadeEvolucao, number> = {
  nao_iniciado: 0,
  aprendendo: 0.25,
  em_desenvolvimento: 0.5,
  dominado: 0.85,
  consolidado: 1,
};

// Pontuação do aluno no nível atual = soma de (valor_base × fator de
// qualidade) de cada habilidade exigida no nível que já tem avaliação —
// mesmo escopo de calcularProgressoNivel (itera sobre `requisitos`, não
// sobre habilidades soltas), só que sem exigir status mínimo: aqui é
// indicador de desempenho, não critério de "passou/não passou".
//
// Simplificação deliberada: `status_habilidade_aluno` não distingue se a
// última avaliação foi rápida ou detalhada por critério (as duas gravam
// `percentual_atual`), então o fator usa sempre o status — que já reflete
// a avaliação detalhada por baixo (o status é derivado do percentual real
// via `derivarStatusPorPercentual`), sem precisar de join novo só pra essa
// distinção.
export function calcularPontuacaoAluno(
  requisitos: RequisitoNivelEvolucao[],
  statusHabilidades: StatusAtualHabilidade[]
): number {
  const statusPorHabilidade = new Map(statusHabilidades.map((item) => [item.habilidadeId, item]));
  let pontuacao = 0;

  for (const requisito of requisitos) {
    const status = statusPorHabilidade.get(requisito.habilidadeId);
    if (!status) continue;
    pontuacao += requisito.valorBase * FATOR_QUALIDADE[status.statusAtual];
  }

  return arredondar(pontuacao);
}

export function calcularPercentualCriterios(criterios: CriterioHabilidadeEvolucao[], valores: Record<string, number>) {
  let pesoTotal = 0;
  let pesoAtingido = 0;

  for (const criterio of criterios) {
    const valor = valores[criterio.id];
    if (typeof valor !== 'number' || Number.isNaN(valor)) continue;
    pesoTotal += criterio.peso;
    pesoAtingido += criterio.peso * valor;
  }

  if (pesoTotal === 0) return null;
  return arredondar(pesoAtingido / pesoTotal);
}

export function derivarStatusPorPercentual(percentual: number): StatusHabilidadeEvolucao {
  if (percentual >= 90) return 'consolidado';
  if (percentual >= 75) return 'dominado';
  if (percentual >= 55) return 'em_desenvolvimento';
  if (percentual >= 20) return 'aprendendo';
  return 'nao_iniciado';
}

// Frequência não é "presenças registradas / total registrado" — isso ignora
// aulas da grade que nunca ganharam chamada. O que conta é quantas aulas por
// semana o módulo do aluno tem na grade, multiplicado pelas semanas já
// decorridas dentro do contrato (plano), contra as faltas (não justificadas)
// nesse mesmo período.
export function calcularFrequenciaPorPlano({
  dataInicio,
  dataFim,
  aulasPorSemana,
  registros,
  hojeISO,
}: {
  dataInicio: string;
  dataFim: string;
  aulasPorSemana: number;
  registros: { status: StatusPresenca; data: string }[];
  hojeISO: string;
}): number | null {
  if (aulasPorSemana <= 0) return null;

  const fimContagem = hojeISO < dataFim ? hojeISO : dataFim;
  if (fimContagem <= dataInicio) return null;

  const dias = (new Date(`${fimContagem}T00:00:00`).getTime() - new Date(`${dataInicio}T00:00:00`).getTime()) / 86_400_000;
  const semanasDecorridas = Math.max(1, Math.ceil(dias / 7));
  const aulasEsperadas = aulasPorSemana * semanasDecorridas;

  const faltas = registros.filter(
    (registro) => registro.status === 'falta' && registro.data >= dataInicio && registro.data <= fimContagem
  ).length;

  const percentual = ((aulasEsperadas - faltas) / aulasEsperadas) * 100;
  return Math.round(Math.max(0, Math.min(100, percentual)));
}