import { fireEvent, render, screen } from '@testing-library/react-native';

import CatalogoEvolucao from '../catalogo-evolucao';
import { useAsyncData } from '../../../src/hooks/useAsyncData';
import { getMetodologiasAtivas } from '../../../src/features/evolucao/api';

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => `redirect:${href}`,
}));

jest.mock('../../../src/features/auth/AuthProvider', () => ({
  useAuth: () => ({
    meuPapel: 'dono',
    session: null,
    meusAlunos: [],
  }),
}));

jest.mock('../../../src/hooks/useAsyncData', () => ({
  useAsyncData: jest.fn(),
}));

jest.mock('../../../src/features/evolucao/api', () => ({
  adicionarRequisitoNivel: jest.fn(),
  atualizarCategoria: jest.fn(),
  atualizarHabilidade: jest.fn(),
  atualizarModalidade: jest.fn(),
  atualizarRequisitoNivel: jest.fn(),
  criarCategoria: jest.fn(),
  criarHabilidade: jest.fn(),
  criarModalidade: jest.fn(),
  excluirCategoria: jest.fn(),
  excluirHabilidade: jest.fn(),
  excluirModalidade: jest.fn(),
  getCategoriasCatalogo: jest.fn(),
  getHabilidadesCatalogo: jest.fn(),
  getMetodologiasAtivas: jest.fn(),
  getMetodologiasCatalogo: jest.fn(),
  getModalidadesEvolucao: jest.fn(),
  getRequisitosNivelAdmin: jest.fn(),
  getUsoCategoria: jest.fn(),
  getUsoHabilidade: jest.fn(),
  getUsoModalidade: jest.fn(),
  removerRequisitoNivel: jest.fn(),
  criarMetodologia: jest.fn(),
  atualizarMetodologia: jest.fn(),
  excluirMetodologia: jest.fn(),
  getUsoMetodologia: jest.fn(),
}));

const mockUseAsyncData = useAsyncData as jest.MockedFunction<typeof useAsyncData>;
const mockGetMetodologiasAtivas = getMetodologiasAtivas as jest.MockedFunction<typeof getMetodologiasAtivas>;

describe('CatalogoEvolucao', () => {
  beforeEach(() => {
    mockUseAsyncData.mockImplementation((fetcher) => {
      if (fetcher === mockGetMetodologiasAtivas) {
        return {
          data: [
            {
              id: 'met-1',
              nome: 'Schmidt Base',
              niveis: [{ id: 'nivel-1', nome: 'Iniciante', ordem: 1 }],
            },
          ],
          loading: false,
          error: null,
          setData: jest.fn(),
          setError: jest.fn(),
          reload: jest.fn(),
        } as ReturnType<typeof useAsyncData>;
      }

      return {
        data: [],
        loading: false,
        error: null,
        setData: jest.fn(),
        setError: jest.fn(),
        reload: jest.fn(),
      } as ReturnType<typeof useAsyncData>;
    });
  });

  it('permite criar e remover metodologias pelo catálogo', async () => {
    render(<CatalogoEvolucao />);

    fireEvent.press(screen.getByText('Metodologias'));

    expect(screen.getByTestId('catalogo-metodologia-abrir-novo')).toBeTruthy();
    expect(screen.getByText('Schmidt Base')).toBeTruthy();
  });
});
