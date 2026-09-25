import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';

import UsuarioDetalhe from '../[id]';
import { getAlunos, vincularPerfil } from '../../../../src/features/alunos/api';
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

jest.mock('../../../../src/features/alunos/api', () => ({
  getAlunos: jest.fn(),
  vincularPerfil: jest.fn(),
  desvincularPerfil: jest.fn(),
}));

// Troca de papel/status agora passa por confirmação (evita mudança de
// acesso com um toque só) — o teste simula a pessoa confirmando.
jest.mock('../../../../src/lib/confirmar', () => ({
  confirmar: (_titulo: string, _mensagem: string, _texto: string, onConfirmar: () => void) => onConfirmar(),
}));

const mockGetUsuario = getUsuario as jest.MockedFunction<typeof getUsuario>;
const mockAtualizarPapel = atualizarPapel as jest.MockedFunction<typeof atualizarPapel>;
const mockAtualizarAtivo = atualizarAtivo as jest.MockedFunction<typeof atualizarAtivo>;
const mockGetAlunos = getAlunos as jest.MockedFunction<typeof getAlunos>;
const mockVincularPerfil = vincularPerfil as jest.MockedFunction<typeof vincularPerfil>;

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
    mockUseAuth.mockReturnValue({ meuPapel: 'dono', session: { user: { id: 'dono-1' } }, meusAlunos: [] });
    mockGetUsuario.mockReset();
    mockGetUsuario.mockResolvedValue(USUARIO_BASE);
    mockAtualizarPapel.mockReset();
    mockAtualizarPapel.mockResolvedValue(undefined);
    mockAtualizarAtivo.mockReset();
    mockAtualizarAtivo.mockResolvedValue(undefined);
    mockGetAlunos.mockReset();
    mockGetAlunos.mockResolvedValue([]);
    mockVincularPerfil.mockReset();
    mockVincularPerfil.mockResolvedValue(undefined);
  });

  it('redirects away when the signed-in user is not the owner', async () => {
    mockUseAuth.mockReturnValue({ meuPapel: 'professor', session: { user: { id: 'dono-1' } }, meusAlunos: [] });

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

  it('allows a professor account to be registered as an aluno', async () => {
    mockGetUsuario.mockResolvedValue({ ...USUARIO_BASE, papel: 'professor' });
    mockGetAlunos.mockResolvedValue([
      {
        id: 'aluno-1',
        nome: 'Professora Atleta',
        data_nascimento: '1990-01-01',
        modulo: 4,
        responsavel_nome: null,
        responsavel_telefone: null,
        responsavel_email: null,
        ativo: true,
        perfil_id: null,
      },
    ]);

    await render(<UsuarioDetalhe />);

    await fireEvent.press(await screen.findByText('Registrar como aluno'));
    await fireEvent.press(screen.getByText('+ Professora Atleta'));

    await waitFor(() => {
      expect(mockVincularPerfil).toHaveBeenCalledWith('aluno-1', 'user-2');
    });
  });

  // Guarda contra lockout: dono editando a própria linha não deve conseguir
  // mudar o próprio papel/status por essa tela.
  it('disables role and status changes when the owner is viewing their own profile', async () => {
    mockUseAuth.mockReturnValue({ meuPapel: 'dono', session: { user: { id: 'user-2' } }, meusAlunos: [] });

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
