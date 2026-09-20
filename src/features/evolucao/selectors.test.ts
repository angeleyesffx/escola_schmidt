import {
  calcularFocoAtual,
  calcularFrequenciaPorPlano,
  calcularPercentualCriterios,
  calcularPontuacaoAluno,
  calcularProgressoNivel,
  calcularResumoCategorias,
  derivarStatusPorPercentual,
  getStatusOrdem,
} from './selectors';
import type { CriterioHabilidadeEvolucao, RequisitoNivelEvolucao, StatusAtualHabilidade } from './types';

const requisitos: RequisitoNivelEvolucao[] = [
  {
    habilidadeId: 'salchow',
    habilidadeNome: 'Salchow',
    categoriaId: 'saltos',
    categoriaNome: 'Saltos',
    obrigatorio: true,
    peso: 3,
    notaMinima: 70,
    statusMinimo: 'dominado',
    valorBase: 10,
  },
  {
    habilidadeId: 'sit-spin',
    habilidadeNome: 'Sit Spin',
    categoriaId: 'giros',
    categoriaNome: 'Giros',
    obrigatorio: true,
    peso: 2,
    notaMinima: 60,
    statusMinimo: 'em_desenvolvimento',
    valorBase: 6,
  },
  {
    habilidadeId: 'musicalidade',
    habilidadeNome: 'Musicalidade',
    categoriaId: 'artistico',
    categoriaNome: 'Artistico',
    obrigatorio: true,
    peso: 1,
    notaMinima: null,
    statusMinimo: 'aprendendo',
    valorBase: 4,
  },
];

const statusHabilidades: StatusAtualHabilidade[] = [
  {
    habilidadeId: 'salchow',
    categoriaId: 'saltos',
    categoriaNome: 'Saltos',
    habilidadeNome: 'Salchow',
    statusAtual: 'dominado',
    percentualAtual: 82,
    precisaAtencao: false,
    prioridadeAtual: null,
  },
  {
    habilidadeId: 'sit-spin',
    categoriaId: 'giros',
    categoriaNome: 'Giros',
    habilidadeNome: 'Sit Spin',
    statusAtual: 'aprendendo',
    percentualAtual: 55,
    precisaAtencao: true,
    prioridadeAtual: 1,
  },
  {
    habilidadeId: 'musicalidade',
    categoriaId: 'artistico',
    categoriaNome: 'Artistico',
    habilidadeNome: 'Musicalidade',
    statusAtual: 'aprendendo',
    percentualAtual: 40,
    precisaAtencao: false,
    prioridadeAtual: 2,
  },
];

const criterios: CriterioHabilidadeEvolucao[] = [
  { id: 'entrada', habilidadeId: 'salchow', nome: 'Entrada', descricao: null, ordem: 1, peso: 1 },
  { id: 'rotacao', habilidadeId: 'salchow', nome: 'Rotação', descricao: null, ordem: 2, peso: 2 },
  { id: 'aterrissagem', habilidadeId: 'salchow', nome: 'Aterrissagem', descricao: null, ordem: 3, peso: 3 },
];

describe('evolucao selectors', () => {
  it('calcula progresso ponderado do nivel', () => {
    const progresso = calcularProgressoNivel(requisitos, statusHabilidades);

    expect(progresso.percentual).toBeCloseTo(66.67, 2);
    expect(progresso.pesoAtingido).toBe(4);
    expect(progresso.pesoTotal).toBe(6);
    expect(progresso.habilidadesAtingidas).toBe(2);
    expect(progresso.habilidadesTotais).toBe(3);
  });

  it('lista faltantes com status atual e criterio esperado', () => {
    const progresso = calcularProgressoNivel(requisitos, statusHabilidades);

    expect(progresso.faltantes).toHaveLength(1);
    expect(progresso.faltantes[0]).toMatchObject({
      habilidadeId: 'sit-spin',
      habilidadeNome: 'Sit Spin',
      categoriaNome: 'Giros',
      statusAtual: 'aprendendo',
      statusMinimo: 'em_desenvolvimento',
      notaMinima: 60,
    });
  });

  it('resume categorias e escolhe o foco atual pelo menor progresso com pendencia', () => {
    const resumo = calcularResumoCategorias(requisitos, statusHabilidades);
    const foco = calcularFocoAtual(resumo);

    expect(resumo).toEqual([
      expect.objectContaining({ categoriaId: 'giros', percentual: 0, emAtencao: 1 }),
      expect.objectContaining({ categoriaId: 'artistico', percentual: 100, emAtencao: 0 }),
      expect.objectContaining({ categoriaId: 'saltos', percentual: 100, emAtencao: 0 }),
    ]);
    expect(foco?.categoriaId).toBe('giros');
  });

  it('calcula pontuacao somando valor base ponderado pelo fator de qualidade do status', () => {
    // salchow: dominado -> fator 0.85 x valorBase 10 = 8.5
    // sit-spin: aprendendo -> fator 0.25 x valorBase 6 = 1.5
    // musicalidade: aprendendo -> fator 0.25 x valorBase 4 = 1
    const pontuacao = calcularPontuacaoAluno(requisitos, statusHabilidades);

    expect(pontuacao).toBe(11);
  });

  it('ignora habilidades exigidas que ainda nao tem avaliacao registrada', () => {
    const pontuacao = calcularPontuacaoAluno(requisitos, [statusHabilidades[0]]);

    expect(pontuacao).toBe(8.5);
  });

  it('ordena status de evolucao de forma crescente', () => {
    expect(getStatusOrdem('nao_iniciado')).toBeLessThan(getStatusOrdem('aprendendo'));
    expect(getStatusOrdem('em_desenvolvimento')).toBeLessThan(getStatusOrdem('dominado'));
    expect(getStatusOrdem('dominado')).toBeLessThan(getStatusOrdem('consolidado'));
  });

  it('calcula percentual ponderado por criterio', () => {
    const percentual = calcularPercentualCriterios(criterios, {
      entrada: 100,
      rotacao: 80,
      aterrissagem: 50,
    });

    expect(percentual).toBeCloseTo(68.33, 2);
  });

  it('deriva status a partir do percentual detalhado', () => {
    expect(derivarStatusPorPercentual(10)).toBe('nao_iniciado');
    expect(derivarStatusPorPercentual(35)).toBe('aprendendo');
    expect(derivarStatusPorPercentual(60)).toBe('em_desenvolvimento');
    expect(derivarStatusPorPercentual(80)).toBe('dominado');
    expect(derivarStatusPorPercentual(95)).toBe('consolidado');
  });

  it('calcula frequencia contra as aulas esperadas pela grade do modulo, nao pelo total de presencas', () => {
    // Contrato de 4 semanas, 2 aulas por semana -> 8 aulas esperadas.
    // Só 2 presenças foram registradas, mas nenhuma falta -> 100%, não 100%
    // por "2 de 2", que seria o bug antigo.
    const percentual = calcularFrequenciaPorPlano({
      dataInicio: '2026-01-01',
      dataFim: '2026-03-01',
      aulasPorSemana: 2,
      registros: [
        { status: 'presente', data: '2026-01-06' },
        { status: 'presente', data: '2026-01-13' },
      ],
      hojeISO: '2026-01-29',
    });

    expect(percentual).toBe(100);
  });

  it('desconta faltas nao justificadas das aulas esperadas no periodo', () => {
    // 4 semanas decorridas x 2 aulas/semana = 8 esperadas, 2 faltas -> 75%.
    const percentual = calcularFrequenciaPorPlano({
      dataInicio: '2026-01-01',
      dataFim: '2026-03-01',
      aulasPorSemana: 2,
      registros: [
        { status: 'falta', data: '2026-01-06' },
        { status: 'falta', data: '2026-01-13' },
      ],
      hojeISO: '2026-01-29',
    });

    expect(percentual).toBe(75);
  });

  it('nao desconta falta justificada', () => {
    const percentual = calcularFrequenciaPorPlano({
      dataInicio: '2026-01-01',
      dataFim: '2026-03-01',
      aulasPorSemana: 2,
      registros: [{ status: 'falta_justificada', data: '2026-01-06' }],
      hojeISO: '2026-01-29',
    });

    expect(percentual).toBe(100);
  });

  it('ignora faltas fora do periodo do contrato', () => {
    const percentual = calcularFrequenciaPorPlano({
      dataInicio: '2026-01-01',
      dataFim: '2026-03-01',
      aulasPorSemana: 2,
      registros: [{ status: 'falta', data: '2025-12-20' }],
      hojeISO: '2026-01-29',
    });

    expect(percentual).toBe(100);
  });

  it('retorna null sem aulas por semana ou sem contrato vigente ainda', () => {
    expect(
      calcularFrequenciaPorPlano({
        dataInicio: '2026-01-01',
        dataFim: '2026-03-01',
        aulasPorSemana: 0,
        registros: [],
        hojeISO: '2026-01-15',
      })
    ).toBeNull();

    expect(
      calcularFrequenciaPorPlano({
        dataInicio: '2026-02-01',
        dataFim: '2026-03-01',
        aulasPorSemana: 2,
        registros: [],
        hojeISO: '2026-01-15',
      })
    ).toBeNull();
  });

  it('nunca fica negativo quando as faltas superam as aulas esperadas', () => {
    const percentual = calcularFrequenciaPorPlano({
      dataInicio: '2026-01-01',
      dataFim: '2026-03-01',
      aulasPorSemana: 1,
      registros: [
        { status: 'falta', data: '2026-01-02' },
        { status: 'falta', data: '2026-01-03' },
        { status: 'falta', data: '2026-01-04' },
      ],
      hojeISO: '2026-01-05',
    });

    expect(percentual).toBe(0);
  });
});