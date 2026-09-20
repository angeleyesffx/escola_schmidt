import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';

import UsuarioDetalhe from '../[id]';
import { atualizarAtivo, atualizarPapel, getUsuario } from '../../../../src/features/usuarios/api';

const mockUseAuth = jest.fn();

jest.mock('expo-router', () => {
  const { Text } = require('react-native') as typeof import('react-native');
  return {
    useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
    useLocalSearchParams: () => ({ id: 'user-2' }),
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

jest.mock('../../../../src/features/usuarios/api', () => ({
  getUsuario: jest.fn(),
  atualizarPapel: jest.fn(),
  atualizarAtivo: jest.fn(),
}));

const mockGetUsuario = getUsuario as jest.MockedFunction<typeof getUsuario>;
const mockAtualizarPapel = atualizarPapel as jest.MockedFunction<typeof atualizarPapel>;
const mockAtualizarAtivo = atualizarAtivo as jest.MockedFunction<typeof atualizarAtivo>;

const USUARIO_BASE = {
  id: 'user-2',
  nome: 'Bruno',
  papel: 'aluno' as const,
  telefone: '(11) 99999-9999',
  ativo: true,
  criado_em: '2026-01-05T00:00:00Z',
};

describe('UsuarioDetalhe', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue({ meuPapel: 'dono', session: { user: { id: 'dono-1' } } });
    mockGetUsuario.mockReset();
    mockGetUsuario.mockResolvedValue(USUARIO_BASE);
    mockAtualizarPapel.mockReset();
    mockAtualizarPapel.mockResolvedValue(undefined);
    mockAtualizarAtivo.mockReset();
    mockAtualizarAtivo.mockResolvedValue(undefined);
  });

  it('redirects away when the signed-in user is not the owner', async () => {
    mockUseAuth.mockReturnValue({ meuPapel: 'professor', session: { user: { id: 'dono-1' } } });

    await render(<UsuarioDetalhe />);

    expect(screen.getByText('redirect:/')).toBeTruthy();
  });

  it('shows the user data and lets the owner change the role', async () => {
    await render(<UsuarioDetalhe />);

    expect(await screen.findByText('(11) 99999-9999')).toBeTruthy();

    await fireEvent.press(screen.getByText('Professor(a)'));

    await waitFor(() => {
      expect(mockAtualizarPapel).toHaveBeenCalledWith('user-2', 'professor');
    });
  });

  it('lets the owner deactivate the user', async () => {
    await render(<UsuarioDetalhe />);

    await fireEvent.press(await screen.findByText('Inativo'));

    await waitFor(() => {
      expect(mockAtualizarAtivo).toHaveBeenCalledWith('user-2', false);
    });
  });

  // Guarda contra lockout: dono editando a própria linha não deve conseguir
  // mudar o próprio papel/status por essa tela.
  it('disables role and status changes when the owner is viewing their own profile', async () => {
    mockUseAuth.mockReturnValue({ meuPapel: 'dono', session: { user: { id: 'user-2' } } });

    await render(<UsuarioDetalhe />);

    expect(
      await screen.findByText('Você não pode alterar seu próprio papel ou status por aqui.')
    ).toBeTruthy();

    await fireEvent.press(screen.getByText('Professor(a)'));
    await fireEvent.press(screen.getByText('Inativo'));

    expect(mockAtualizarPapel).not.toHaveBeenCalled();
    expect(mockAtualizarAtivo).not.toHaveBeenCalled();
  });

  it('shows an error message when loading fails', async () => {
    mockGetUsuario.mockRejectedValueOnce(new Error('falhou'));

    await render(<UsuarioDetalhe />);

    await waitFor(() => {
      expect(screen.getByText('Erro ao carregar usuário. Tente novamente.')).toBeTruthy();
    });
  });
});
