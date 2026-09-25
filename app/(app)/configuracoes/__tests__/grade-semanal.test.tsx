import { render, screen } from '@testing-library/react-native';

import GradeSemanalAdmin from '../grade-semanal';
import { getGradeCompleta, getModulosAtivos } from '../../../../src/features/chamada/api';
import { useAsyncData } from '../../../../src/hooks/useAsyncData';

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => `redirect:${href}`,
  useRouter: () => ({
    canGoBack: () => false,
    back: jest.fn(),
    replace: jest.fn(),
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('../../../../src/features/auth/AuthProvider', () => ({
  useAuth: () => ({
    meuPapel: 'dono',
    meusAlunos: [],
    session: null,
    signOut: jest.fn(),
  }),
}));

jest.mock('../../../../src/hooks/useAsyncData', () => ({
  useAsyncData: jest.fn(),
}));

jest.mock('../../../../src/features/chamada/api', () => ({
  getGradeCompleta: jest.fn(),
  getModulosAtivos: jest.fn(),
  atualizarSlotGrade: jest.fn(),
  criarSlotGrade: jest.fn(),
  excluirSlotGrade: jest.fn(),
  getUsoSlotGrade: jest.fn(),
}));

const mockUseAsyncData = useAsyncData as jest.MockedFunction<typeof useAsyncData>;
const mockGetGradeCompleta = getGradeCompleta as jest.MockedFunction<typeof getGradeCompleta>;
const mockGetModulosAtivos = getModulosAtivos as jest.MockedFunction<typeof getModulosAtivos>;

describe('GradeSemanalAdmin', () => {
  beforeEach(() => {
    mockUseAsyncData.mockImplementation((fetcher) => {
      if (fetcher === mockGetModulosAtivos) {
        return {
          data: [
            { numero: 5, nome: 'Módulo 5', ativo: true },
            { numero: 7, nome: 'Módulo 7', ativo: true },
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

  it('usa os módulos ativos do catálogo em vez de um conjunto fixo 1-4', async () => {
    await render(<GradeSemanalAdmin />);

    expect(screen.getByTestId('grade-modulo-5')).toBeTruthy();
    expect(screen.getByTestId('grade-modulo-7')).toBeTruthy();
    expect(screen.queryByTestId('grade-modulo-3')).toBeNull();
  });
});
