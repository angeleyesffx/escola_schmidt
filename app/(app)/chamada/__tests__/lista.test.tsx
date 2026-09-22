import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import ListaChamada from '../lista';
import { getAulasRecorrentesHoje, getResponsabilidadesProfessor } from '../../../../src/features/chamada/api';

const mockPush = jest.fn();
const mockUseAuth = jest.fn();

jest.mock('expo-router', () => {
  const { Text } = require('react-native') as typeof import('react-native');
  return {
    useRouter: () => ({ push: mockPush }),
    Redirect: ({ href }: { href: string }) => <Text>{`redirect:${href}`}</Text>,
    useFocusEffect: (callback: () => void | (() => void)) => {
      const React = require('react') as typeof import('react');
      React.useEffect(() => callback(), [callback]);
    },
  };
});

jest.mock('../../../../src/features/auth/AuthProvider', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('../../../../src/features/chamada/api', () => ({
  getAulasRecorrentesHoje: jest.fn(),
  getResponsabilidadesProfessor: jest.fn(),
}));

const mockGetAulasRecorrentesHoje = getAulasRecorrentesHoje as jest.MockedFunction<typeof getAulasRecorrentesHoje>;
const mockGetResponsabilidadesProfessor = getResponsabilidadesProfessor as jest.MockedFunction<
  typeof getResponsabilidadesProfessor
>;

const TURMA_TERCA_18H = { id: 'rec-1', dia_semana: 2, hora: '18:00:00', modulos: [1, 2] };
const TURMA_TERCA_19H = { id: 'rec-2', dia_semana: 2, hora: '19:00:00', modulos: [3, 4] };

describe('ListaChamada', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockGetAulasRecorrentesHoje.mockReset();
    mockGetAulasRecorrentesHoje.mockResolvedValue([TURMA_TERCA_18H, TURMA_TERCA_19H]);
    mockGetResponsabilidadesProfessor.mockReset();
    mockGetResponsabilidadesProfessor.mockResolvedValue([]);
  });

  it('dono vê todas as turmas do dia, mesmo sem nenhum vínculo em professores_aula', async () => {
    mockUseAuth.mockReturnValue({ session: { user: { id: 'dono-1' } }, meuPapel: 'dono', meusAlunos: [] });

    render(<ListaChamada />);

    await waitFor(() => expect(screen.getByText('18:00')).toBeTruthy());
    expect(screen.getByText('19:00')).toBeTruthy();
    expect(mockGetResponsabilidadesProfessor).not.toHaveBeenCalled();
  });

  it('professor só vê as turmas que assumiu em "Meus módulos"', async () => {
    mockUseAuth.mockReturnValue({ session: { user: { id: 'prof-1' } }, meuPapel: 'professor', meusAlunos: [] });
    mockGetResponsabilidadesProfessor.mockResolvedValue([
      { id: 'resp-1', aula_recorrente_id: 'rec-1', modulo: 1 },
    ]);

    render(<ListaChamada />);

    await waitFor(() => expect(screen.getByText('18:00')).toBeTruthy());
    expect(screen.queryByText('19:00')).toBeNull();
    expect(mockGetResponsabilidadesProfessor).toHaveBeenCalledWith('prof-1');
  });

  it('professor sem nenhum módulo assumido vê a lista vazia, não a grade inteira', async () => {
    mockUseAuth.mockReturnValue({ session: { user: { id: 'prof-2' } }, meuPapel: 'professor', meusAlunos: [] });
    mockGetResponsabilidadesProfessor.mockResolvedValue([]);

    render(<ListaChamada />);

    await waitFor(() => expect(screen.getByText('Não há turmas agendadas na grade para hoje.')).toBeTruthy());
    expect(screen.queryByText('18:00')).toBeNull();
    expect(screen.queryByText('19:00')).toBeNull();
  });

  it('toca numa turma permitida e navega pra chamada dela', async () => {
    mockUseAuth.mockReturnValue({ session: { user: { id: 'prof-1' } }, meuPapel: 'professor', meusAlunos: [] });
    mockGetResponsabilidadesProfessor.mockResolvedValue([
      { id: 'resp-1', aula_recorrente_id: 'rec-1', modulo: 1 },
    ]);

    render(<ListaChamada />);

    await waitFor(() => expect(screen.getByText('18:00')).toBeTruthy());
    fireEvent.press(screen.getByText('18:00'));
    expect(mockPush).toHaveBeenCalledWith('/chamada/rec-1');
  });

  it('aluno é redirecionado, nunca vê a lista', async () => {
    mockUseAuth.mockReturnValue({ session: { user: { id: 'aluno-1' } }, meuPapel: 'aluno', meusAlunos: [] });

    render(<ListaChamada />);

    await waitFor(() => expect(screen.getByText('redirect:/')).toBeTruthy());
  });
});
