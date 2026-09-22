import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';

import TiposEventoAdminScreen from '../tipos-evento';
import {
  atualizarTipoEvento,
  criarTipoEvento,
  excluirTipoEvento,
  getTiposEventoAdmin,
  getUsoTipoEvento,
} from '../../../../src/features/eventos/api';

const mockUseAuth = jest.fn();

jest.mock('expo-router', () => {
  const { Text } = require('react-native') as typeof import('react-native');
  return {
    useRouter: () => ({ back: jest.fn(), push: jest.fn(), canGoBack: () => false, replace: jest.fn() }),
    useFocusEffect: (callback: () => void | (() => void)) => {
      const React = require('react') as typeof import('react');
      React.useEffect(() => callback(), [callback]);
    },
    Redirect: ({ href }: { href: string }) => <Text>{`redirect:${href}`}</Text>,
  };
});

jest.mock('../../../../src/features/auth/AuthProvider', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('../../../../src/features/eventos/api', () => ({
  getTiposEventoAdmin: jest.fn(),
  criarTipoEvento: jest.fn(),
  atualizarTipoEvento: jest.fn(),
  getUsoTipoEvento: jest.fn(),
  excluirTipoEvento: jest.fn(),
}));

// Mesma convenção de usuarios/__tests__/[id].test.tsx: confirma direto, sem
// depender do Alert nativo — os dois helpers novos (confirmDelete/confirmSave)
// só embrulham confirmar(), então o mock cobre os dois.
jest.mock('../../../../src/lib/confirmar', () => ({
  confirmDelete: (_nome: string, onConfirm: () => void) => onConfirm(),
  confirmSave: (onConfirm: () => void) => onConfirm(),
}));

const mockGetTipos = getTiposEventoAdmin as jest.MockedFunction<typeof getTiposEventoAdmin>;
const mockCriar = criarTipoEvento as jest.MockedFunction<typeof criarTipoEvento>;
const mockAtualizar = atualizarTipoEvento as jest.MockedFunction<typeof atualizarTipoEvento>;
const mockGetUso = getUsoTipoEvento as jest.MockedFunction<typeof getUsoTipoEvento>;
const mockExcluir = excluirTipoEvento as jest.MockedFunction<typeof excluirTipoEvento>;

const TIPO_BASE = { id: 'tipo-1', nome: 'Recesso', cor: '#8B5CF6', ordem: 1, ativo: true };

describe('TiposEventoAdminScreen', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue({ meuPapel: 'dono', meusAlunos: [] });
    mockGetTipos.mockReset();
    mockGetTipos.mockResolvedValue([TIPO_BASE]);
    mockCriar.mockReset();
    mockCriar.mockResolvedValue(undefined);
    mockAtualizar.mockReset();
    mockAtualizar.mockResolvedValue(undefined);
    mockGetUso.mockReset();
    mockGetUso.mockResolvedValue(0);
    mockExcluir.mockReset();
    mockExcluir.mockResolvedValue(undefined);
  });

  it('redirects away when the signed-in user is not staff', async () => {
    mockUseAuth.mockReturnValue({ meuPapel: 'aluno' });

    await render(<TiposEventoAdminScreen />);

    expect(screen.getByText('redirect:/')).toBeTruthy();
  });

  it('lists existing types', async () => {
    await render(<TiposEventoAdminScreen />);

    expect(await screen.findByText('Recesso')).toBeTruthy();
  });

  it('opens the create modal, submits the form and reloads the list', async () => {
    await render(<TiposEventoAdminScreen />);
    await screen.findByText('Recesso');

    expect(screen.queryByTestId('tipo-evento-nome')).toBeNull();

    await fireEvent.press(screen.getByTestId('tipo-evento-abrir-novo'));
    expect(screen.getByTestId('tipo-evento-nome')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('tipo-evento-nome'), 'Competição');
    await fireEvent.press(screen.getByTestId('tipo-evento-cor-#F97316'));
    await fireEvent.press(screen.getByTestId('tipo-evento-salvar'));

    await waitFor(() => {
      expect(mockCriar).toHaveBeenCalledWith('Competição', '#F97316', 2);
    });
    // Modal fecha e recarrega depois de salvar.
    await waitFor(() => expect(screen.queryByTestId('tipo-evento-nome')).toBeNull());
    expect(mockGetTipos).toHaveBeenCalledTimes(2);
  });

  it('opens the edit modal pre-filled and confirms before saving', async () => {
    await render(<TiposEventoAdminScreen />);
    await screen.findByText('Recesso');

    await fireEvent.press(screen.getByTestId('tipo-evento-tipo-1-edit'));

    expect(screen.getByTestId('tipo-evento-nome').props.value).toBe('Recesso');

    await fireEvent.changeText(screen.getByTestId('tipo-evento-nome'), 'Recesso de julho');
    await fireEvent.press(screen.getByTestId('tipo-evento-salvar'));

    await waitFor(() => {
      expect(mockAtualizar).toHaveBeenCalledWith('tipo-1', { nome: 'Recesso de julho', cor: '#8B5CF6' });
    });
  });

  it('checks usage before deleting and deletes when unused', async () => {
    mockGetUso.mockResolvedValueOnce(0);

    await render(<TiposEventoAdminScreen />);
    await screen.findByText('Recesso');

    await fireEvent.press(screen.getByTestId('tipo-evento-tipo-1-delete'));

    await waitFor(() => {
      expect(mockGetUso).toHaveBeenCalledWith('tipo-1');
      expect(mockExcluir).toHaveBeenCalledWith('tipo-1');
    });
  });

  it('blocks deletion and shows a message when the type is in use', async () => {
    mockGetUso.mockResolvedValueOnce(3);

    await render(<TiposEventoAdminScreen />);
    await screen.findByText('Recesso');

    await fireEvent.press(screen.getByTestId('tipo-evento-tipo-1-delete'));

    expect(await screen.findByText(/em uso por 3 evento\(s\)/)).toBeTruthy();
    expect(mockExcluir).not.toHaveBeenCalled();
  });

  it('toggles active state', async () => {
    await render(<TiposEventoAdminScreen />);
    await screen.findByText('Recesso');

    const linhaAtiva = screen.getByRole('switch');
    await fireEvent(linhaAtiva, 'valueChange', false);

    await waitFor(() => {
      expect(mockAtualizar).toHaveBeenCalledWith('tipo-1', { ativo: false });
    });
  });
});
