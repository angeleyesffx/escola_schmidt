export type StatusHabilidadeEvolucao =
  | 'nao_iniciado'
  | 'aprendendo'
  | 'em_desenvolvimento'
  | 'dominado'
  | 'consolidado';

export type RequisitoNivelEvolucao = {
  habilidadeId: string;
  habilidadeNome: string;
  categoriaId: string;
  categoriaNome: string;
  obrigatorio: boolean;
  peso: number;
  notaMinima: number | null;
  statusMinimo: StatusHabilidadeEvolucao;
};

export type StatusAtualHabilidade = {
  habilidadeId: string;
  categoriaId: string;
  categoriaNome: string;
  habilidadeNome: string;
  statusAtual: StatusHabilidadeEvolucao;
  percentualAtual: number | null;
  precisaAtencao: boolean;
  prioridadeAtual: number | null;
};

export type CriterioHabilidadeEvolucao = {
  id: string;
  habilidadeId: string;
  nome: string;
  descricao: string | null;
  ordem: number;
  peso: number;
};

export type ResumoCategoriaEvolucao = {
  categoriaId: string;
  categoriaNome: string;
  percentual: number;
  habilidadesAtingidas: number;
  habilidadesTotais: number;
  emAtencao: number;
  emDesenvolvimento: number;
};

export type FaltanteNivel = {
  habilidadeId: string;
  habilidadeNome: string;
  categoriaId: string;
  categoriaNome: string;
  statusAtual: StatusHabilidadeEvolucao | null;
  percentualAtual: number | null;
  statusMinimo: StatusHabilidadeEvolucao;
  notaMinima: number | null;
};

export type ProgressoNivelEvolucao = {
  percentual: number;
  pesoAtingido: number;
  pesoTotal: number;
  habilidadesAtingidas: number;
  habilidadesTotais: number;
  faltantes: FaltanteNivel[];
  resumoCategorias: ResumoCategoriaEvolucao[];
  focoAtual: ResumoCategoriaEvolucao | null;
};

export type HistoricoNivelEvolucao = {
  id: string;
  tipo: 'atribuicao_inicial' | 'pronto_para_avaliacao' | 'aprovado' | 'reprovado' | 'promovido';
  dataEvento: string;
  nivelId: string;
  observacoes: string | null;
};

export type MetodologiaAtualAluno = {
  metodologiaId: string;
  metodologiaNome: string;
  nivelAtualId: string | null;
  nivelAtualNome: string | null;
  nivelAtualOrdem: number | null;
  dataInicio: string;
  dataFim: string | null;
};

export type MetodologiaDisponivel = {
  id: string;
  nome: string;
  niveis: { id: string; nome: string; ordem: number }[];
};

export type AvaliacaoRapidaEvolucaoInput = {
  alunoId: string;
  habilidadeId: string;
  metodologiaId: string;
  professorId: string | null;
  status: StatusHabilidadeEvolucao;
  percentualGeral: number | null;
  precisaAtencao: boolean;
  prioridadeTreinamento: number | null;
  observacoes: string | null;
  dataAvaliacao?: string;
};

export type AvaliacaoDetalhadaEvolucaoInput = {
  alunoId: string;
  habilidadeId: string;
  metodologiaId: string;
  professorId: string | null;
  observacoes: string | null;
  precisaAtencao: boolean;
  prioridadeTreinamento: number | null;
  criterios: Array<{
    criterioId: string;
    percentual: number;
    observacoes: string | null;
  }>;
  dataAvaliacao?: string;
};