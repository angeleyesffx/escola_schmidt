import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';

import UsuariosIndex from '../index';
import { getUsuariosPagina } from '../../../../src/features/usuarios/api';

const mockPush = jest.fn();
const mockUseAuth = jest.fn();

jest.mock('expo-router', () => {
  const { Text } = require('react-native') as typeof import('react-native');
  return {
    useRouter: () => ({ push: mockPush }),
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
  getUsuariosPagina: jest.fn(),
}));

const mockGetUsuarios = getUsuariosPagina as jest.MockedFunction<typeof getUsuariosPagina>;

describe('UsuariosIndex', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue({ meuPapel: 'dono', meusAlunos: [] });
    mockGetUsuarios.mockReset();
    mockGetUsuarios.mockResolvedValue({ usuarios: [], total: 0, temMais: false });
  });

  it('redirects away when the signed-in user is not the owner', async () => {
    mockUseAuth.mockReturnValue({ meuPapel: 'professor', meusAlunos: [] });

    await render(<UsuariosIndex />);

    expect(screen.getByText('redirect:/')).toBeTruthy();
  });

  it('lists users with role and status', async () => {
    mockGetUsuarios.mockResolvedValueOnce({ usuarios: [
      { id: 'user-1', nome: 'Ana', papel: 'dono', telefone: null, ativo: true, criado_em: '2026-01-01T00:00:00Z' },
      {
        id: 'user-2',
        nome: 'Bruno',
        papel: 'professor',
        telefone: null,
        ativo: false,
        criado_em: '2026-01-02T00:00:00Z',
      },
    ], total: 2, temMais: false });

    await render(<UsuariosIndex />);

    expect(await screen.findByText('Ana')).toBeTruthy();
    expect(screen.getByText('Dono')).toBeTruthy();
    expect(screen.getByText('Bruno')).toBeTruthy();
    expect(screen.getByText('Professor(a) · Inativo')).toBeTruthy();
  });

  it('navigates to invite screen and to a user detail screen', async () => {
    mockGetUsuarios.mockResolvedValueOnce({ usuarios: [
      { id: 'user-1', nome: 'Ana', papel: 'dono', telefone: null, ativo: true, criado_em: '2026-01-01T00:00:00Z' },
    ], total: 1, temMais: false });

    await render(<UsuariosIndex />);

    await fireEvent.press(screen.getByTestId('usuarios-botao-convidar'));
    expect(mockPush).toHaveBeenCalledWith('/usuarios/novo');

    await fireEvent.press(await screen.findByTestId('usuarios-linha-user-1'));
    expect(mockPush).toHaveBeenCalledWith('/usuarios/user-1');
  });

  it('shows an error message when loading fails', async () => {
    mockGetUsuarios.mockRejectedValueOnce(new Error('falhou'));

    await render(<UsuariosIndex />);

    await waitFor(() => {
      expect(screen.getByText('Erro ao carregar usuários. Tente novamente.')).toBeTruthy();
    });
  });
});
