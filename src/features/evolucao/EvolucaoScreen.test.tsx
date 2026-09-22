import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { EvolucaoScreen } from './EvolucaoScreen';
import { getAluno, getContratoAtual, getFrequenciaAluno } from '../alunos/api';
import { getGradeSemanal } from '../chamada/api';
import {
  atribuirMetodologiaAluno,
  getCriteriosHabilidades,
  getHistoricoNivelAluno,
  getMetodologiaAtualAluno,
  getMetodologiasAtivas,
  getRequisitosNivel,
  getStatusHabilidadesAluno,
  registrarAvaliacaoRapidaEvolucao,
  registrarPromocaoNivel,
} from './api';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: (callback: () => void | (() => void)) => {
    const React = require('react') as typeof import('react');
    React.useEffect(() => callback(), [callback]);
  },
}));

jest.mock('../alunos/api', () => ({
  getAluno: jest.fn(),
  getContratoAtual: jest.fn(),
  getFrequenciaAluno: jest.fn(),
}));

jest.mock('../chamada/api', () => ({
  getGradeSemanal: jest.fn(),
}));

jest.mock('./api', () => ({
  atribuirMetodologiaAluno: jest.fn(),
  getCriteriosHabilidades: jest.fn(),
  getHistoricoNivelAluno: jest.fn(),
  getMetodologiaAtualAluno: jest.fn(),
  getMetodologiasAtivas: jest.fn(),
  getRequisitosNivel: jest.fn(),
  hojeISO: () => '2026-09-22',
  registrarAvaliacaoDetalhadaEvolucao: jest.fn(),
  registrarAvaliacaoRapidaEvolucao: jest.fn(),
  registrarPromocaoNivel: jest.fn(),
  getStatusHabilidadesAluno: jest.fn(),
}));

const mockGetAluno = getAluno as jest.MockedFunction<typeof getAluno>;
const mockGetContratoAtual = getContratoAtual as jest.MockedFunction<typeof getContratoAtual>;
const mockGetFrequenciaAluno = getFrequenciaAluno as jest.MockedFunction<typeof getFrequenciaAluno>;
const mockGetGradeSemanal = getGradeSemanal as jest.MockedFunction<typeof getGradeSemanal>;
const mockGetMetodologiaAtualAluno = getMetodologiaAtualAluno as jest.MockedFunction<typeof getMetodologiaAtualAluno>;
const mockGetHistoricoNivelAluno = getHistoricoNivelAluno as jest.MockedFunction<typeof getHistoricoNivelAluno>;
const mockGetMetodologiasAtivas = getMetodologiasAtivas as jest.MockedFunction<typeof getMetodologiasAtivas>;
const mockGetRequisitosNivel = getRequisitosNivel as jest.MockedFunction<typeof getRequisitosNivel>;
const mockGetStatusHabilidadesAluno = getStatusHabilidadesAluno as jest.MockedFunction<typeof getStatusHabilidadesAluno>;
const mockGetCriteriosHabilidades = getCriteriosHabilidades as jest.MockedFunction<typeof getCriteriosHabilidades>;
const mockAtribuirMetodologiaAluno = atribuirMetodologiaAluno as jest.MockedFunction<typeof atribuirMetodologiaAluno>;
const mockRegistrarAvaliacaoRapidaEvolucao = registrarAvaliacaoRapidaEvolucao as jest.MockedFunction<
  typeof registrarAvaliacaoRapidaEvolucao
>;
const mockRegistrarPromocaoNivel = registrarPromocaoNivel as jest.MockedFunction<typeof registrarPromocaoNivel>;

const ALUNO_BASE = {
  id: 'aluno-1',
  nome: 'Ana',
  data_nascimento: null,
  modulo: 1,
  responsavel_nome: null,
  responsavel_telefone: null,
  responsavel_email: null,
  ativo: true,
  perfil_id: 'perfil-1',
};

const METODOLOGIA_ATIVA = {
  metodologiaId: 'met-1',
  metodologiaNome: 'Patinação artística',
  nivelAtualId: 'nivel-1',
  nivelAtualNome: 'Bronze',
  nivelAtualOrdem: 1,
  dataInicio: '2026-01-01',
  dataFim: null,
};

// Pesos desiguais de propósito: com os 3 iguais a progressão dá 33,33% (não
// "33%" exato), o que quebraria a asserção de texto do card de progresso.
const REQUISITOS = [
  {
    habilidadeId: 'hab-1',
    habilidadeNome: 'Salto simples',
    categoriaId: 'cat-1',
    categoriaNome: 'Saltos',
    obrigatorio: true,
    peso: 1,
    notaMinima: null,
    statusMinimo: 'em_desenvolvimento' as const,
    valorBase: 1,
  },
  {
    habilidadeId: 'hab-2',
    habilidadeNome: 'Giro básico',
    categoriaId: 'cat-2',
    categoriaNome: 'Giros',
    obrigatorio: true,
    peso: 1,
    notaMinima: null,
    statusMinimo: 'em_desenvolvimento' as const,
    valorBase: 1,
  },
  {
    habilidadeId: 'hab-3',
    habilidadeNome: 'Postura básica',
    categoriaId: 'cat-3',
    categoriaNome: 'Postura',
    obrigatorio: true,
    peso: 2,
    notaMinima: null,
    statusMinimo: 'em_desenvolvimento' as const,
    valorBase: 1,
  },
];

const STATUS_HABILIDADES = [
  {
    habilidadeId: 'hab-1',
    categoriaId: 'cat-1',
    categoriaNome: 'Saltos',
    habilidadeNome: 'Salto simples',
    statusAtual: 'consolidado' as const,
    percentualAtual: 100,
    precisaAtencao: false,
    prioridadeAtual: null,
  },
];

function configurarCargaFeliz() {
  mockGetAluno.mockResolvedValue(ALUNO_BASE);
  mockGetContratoAtual.mockResolvedValue({
    id: 'contrato-1',
    plano: 'mensal',
    data_inicio: '2026-01-01',
    data_fim: '2026-12-31',
  });
  mockGetFrequenciaAluno.mockResolvedValue([]);
  mockGetGradeSemanal.mockResolvedValue([{ id: 'g1', dia_semana: 2, hora: '18:00:00', modulos: [1] }]);
  mockGetMetodologiaAtualAluno.mockResolvedValue(METODOLOGIA_ATIVA);
  mockGetHistoricoNivelAluno.mockResolvedValue([]);
  mockGetMetodologiasAtivas.mockResolvedValue([
    { id: 'met-1', nome: 'Patinação artística', niveis: [{ id: 'nivel-1', nome: 'Bronze', ordem: 1 }, { id: 'nivel-2', nome: 'Prata', ordem: 2 }] },
  ]);
  mockGetRequisitosNivel.mockResolvedValue(REQUISITOS);
  mockGetStatusHabilidadesAluno.mockResolvedValue(STATUS_HABILIDADES);
  mockGetCriteriosHabilidades.mockResolvedValue([]);
}

describe('EvolucaoScreen', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockGetAluno.mockReset();
    mockGetContratoAtual.mockReset();
    mockGetFrequenciaAluno.mockReset();
    mockGetGradeSemanal.mockReset();
    mockGetMetodologiaAtualAluno.mockReset();
    mockGetHistoricoNivelAluno.mockReset();
    mockGetMetodologiasAtivas.mockReset();
    mockGetRequisitosNivel.mockReset();
    mockGetStatusHabilidadesAluno.mockReset();
    mockGetCriteriosHabilidades.mockReset();
    mockAtribuirMetodologiaAluno.mockReset();
    mockRegistrarAvaliacaoRapidaEvolucao.mockReset();
    mockRegistrarPromocaoNivel.mockReset();
  });

  it('shows a loading indicator while the initial fetch is in flight', async () => {
    mockGetAluno.mockImplementation(() => new Promise(() => {}));
    mockGetContratoAtual.mockResolvedValue(null);
    mockGetFrequenciaAluno.mockResolvedValue([]);
    mockGetGradeSemanal.mockResolvedValue([]);
    mockGetMetodologiaAtualAluno.mockResolvedValue(null);
    mockGetHistoricoNivelAluno.mockResolvedValue([]);

    render(<EvolucaoScreen alunoId="aluno-1" tituloPagina="Minha Evolução" nomeFallback="Aluno" />);

    // Enquanto a busca inicial não resolve, nenhum card de conteúdo (que só
    // aparece com `!loading`) deve estar na tela.
    expect(screen.queryByText('Progresso para o próximo nível')).toBeNull();
  });

  it('shows a friendly waiting message to a student when there is no methodology yet', async () => {
    mockGetAluno.mockResolvedValue(ALUNO_BASE);
    mockGetContratoAtual.mockResolvedValue(null);
    mockGetFrequenciaAluno.mockResolvedValue([]);
    mockGetGradeSemanal.mockResolvedValue([]);
    mockGetMetodologiaAtualAluno.mockResolvedValue(null);
    mockGetHistoricoNivelAluno.mockResolvedValue([]);

    render(<EvolucaoScreen alunoId="aluno-1" tituloPagina="Minha Evolução" nomeFallback="Aluno" podeEditar={false} />);

    expect(
      await screen.findByText(
        'Sua jornada está prestes a começar. Em breve você vai ver aqui tudo o que já domina e o que ainda vai conquistar.'
      )
    ).toBeTruthy();
    expect(screen.queryByTestId('evolucao-botao-atribuir-metodologia')).toBeNull();
  });

  it('lets staff assign a methodology and level when the student has none yet', async () => {
    mockGetAluno.mockResolvedValue(ALUNO_BASE);
    mockGetContratoAtual.mockResolvedValue(null);
    mockGetFrequenciaAluno.mockResolvedValue([]);
    mockGetGradeSemanal.mockResolvedValue([]);
    mockGetMetodologiaAtualAluno.mockResolvedValueOnce(null).mockResolvedValueOnce(METODOLOGIA_ATIVA);
    mockGetHistoricoNivelAluno.mockResolvedValue([]);
    mockGetMetodologiasAtivas.mockResolvedValue([
      { id: 'met-1', nome: 'Patinação artística', niveis: [{ id: 'nivel-1', nome: 'Bronze', ordem: 1 }] },
    ]);
    mockGetRequisitosNivel.mockResolvedValue([]);
    mockGetStatusHabilidadesAluno.mockResolvedValue([]);
    mockGetCriteriosHabilidades.mockResolvedValue([]);
    mockAtribuirMetodologiaAluno.mockResolvedValue('novo-vinculo-1');

    render(
      <EvolucaoScreen
        alunoId="aluno-1"
        tituloPagina="Evolução do aluno"
        nomeFallback="Aluno"
        podeEditar
        professorId="prof-1"
      />
    );

    await fireEvent.press(await screen.findByTestId('evolucao-nivel-nivel-1'));
    await fireEvent.press(screen.getByTestId('evolucao-botao-atribuir-metodologia'));

    await waitFor(() => {
      expect(mockAtribuirMetodologiaAluno).toHaveBeenCalledWith('aluno-1', 'met-1', 'nivel-1');
      // Reage à mudança de metodologia recarregando os dados, não só fechando o form.
      expect(mockGetMetodologiaAtualAluno).toHaveBeenCalledTimes(2);
    });
  });

  it('shows progress, frequency and the timeline for a student with an active level', async () => {
    configurarCargaFeliz();
    mockGetFrequenciaAluno.mockResolvedValue([
      { status: 'falta', data: '2026-09-01', hora: '18:00' },
    ]);
    mockGetHistoricoNivelAluno.mockResolvedValue([
      { id: 'hist-1', tipo: 'atribuicao_inicial', dataEvento: '2026-01-01', nivelId: 'nivel-1', nivelNome: 'Bronze', observacoes: null },
    ]);

    render(<EvolucaoScreen alunoId="aluno-1" tituloPagina="Minha Evolução" nomeFallback="Aluno" />);

    expect(await screen.findByText('Bronze')).toBeTruthy();
    // hab-1 (peso 1) atingido de um total de peso 4 (1 + 1 + 2) -> 25%.
    expect(await screen.findByText('25%')).toBeTruthy();
    expect(screen.getByText('1 de 3 habilidades atendidas.')).toBeTruthy();
    expect(screen.getByText('Início da jornada')).toBeTruthy();
  });

  it('lets staff record a quick skill evaluation and reloads afterwards', async () => {
    configurarCargaFeliz();
    mockRegistrarAvaliacaoRapidaEvolucao.mockResolvedValue('avaliacao-1');

    render(
      <EvolucaoScreen
        alunoId="aluno-1"
        tituloPagina="Evolução do aluno"
        nomeFallback="Aluno"
        podeEditar
        professorId="prof-1"
      />
    );

    await screen.findByText('Avaliação rápida');
    // requisitos[0] é hab-1 — cada requisito renderiza seu próprio grid com o
    // rótulo "Consolidado", então o primeiro elemento é o de hab-1.
    await fireEvent.press(screen.getAllByText('Consolidado')[0]);

    await waitFor(() => {
      expect(mockRegistrarAvaliacaoRapidaEvolucao).toHaveBeenCalledWith(
        expect.objectContaining({
          alunoId: 'aluno-1',
          habilidadeId: 'hab-1',
          metodologiaId: 'met-1',
          professorId: 'prof-1',
          status: 'consolidado',
        })
      );
      expect(mockGetAluno).toHaveBeenCalledTimes(2);
    });
  });

  it('lets staff record an achieved level promotion', async () => {
    configurarCargaFeliz();
    mockRegistrarPromocaoNivel.mockResolvedValue('promocao-1');

    render(
      <EvolucaoScreen
        alunoId="aluno-1"
        tituloPagina="Evolução do aluno"
        nomeFallback="Aluno"
        podeEditar
        professorId="prof-1"
      />
    );

    await fireEvent.press(await screen.findByTestId('evolucao-promocao-nivel-nivel-2'));
    await fireEvent.press(screen.getByTestId('evolucao-botao-registrar-promocao'));

    await waitFor(() => {
      expect(mockRegistrarPromocaoNivel).toHaveBeenCalledWith('aluno-1', 'nivel-2');
      expect(mockGetAluno).toHaveBeenCalledTimes(2);
    });
  });

  it('shows a role-appropriate message when loading fails', async () => {
    mockGetAluno.mockRejectedValue(new Error('network down'));
    mockGetContratoAtual.mockResolvedValue(null);
    mockGetFrequenciaAluno.mockResolvedValue([]);
    mockGetGradeSemanal.mockResolvedValue([]);
    mockGetMetodologiaAtualAluno.mockResolvedValue(null);
    mockGetHistoricoNivelAluno.mockResolvedValue([]);
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <EvolucaoScreen alunoId="aluno-1" tituloPagina="Evolução do aluno" nomeFallback="Aluno" podeEditar />
    );

    expect(
      await screen.findByText(
        'Não foi possível carregar a Evolução deste aluno. Confirme se a metodologia e o nível dele já foram configurados e tente novamente.'
      )
    ).toBeTruthy();
    consoleErrorSpy.mockRestore();
  });

  it('navigates to the full journey screen from the history card', async () => {
    configurarCargaFeliz();
    mockGetHistoricoNivelAluno.mockResolvedValue([
      { id: 'hist-1', tipo: 'atribuicao_inicial', dataEvento: '2026-01-01', nivelId: 'nivel-1', nivelNome: 'Bronze', observacoes: null },
    ]);

    render(<EvolucaoScreen alunoId="aluno-1" tituloPagina="Minha Evolução" nomeFallback="Aluno" />);

    await fireEvent.press(await screen.findByTestId('evolucao-link-jornada-completa'));

    expect(mockPush).toHaveBeenCalledWith('/alunos/aluno-1/desempenho');
  });
});
