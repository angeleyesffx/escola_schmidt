import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';

import NovoUsuario from '../novo';
import { convidarUsuario } from '../../../../src/features/usuarios/api';

const mockBack = jest.fn();
const mockUseAuth = jest.fn();

jest.mock('expo-router', () => {
  const { Text } = require('react-native') as typeof import('react-native');
  return {
    useRouter: () => ({ back: mockBack }),
    Redirect: ({ href }: { href: string }) => <Text>{`redirect:${href}`}</Text>,
  };
});

jest.mock('../../../../src/features/auth/AuthProvider', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('../../../../src/features/usuarios/api', () => ({
  convidarUsuario: jest.fn(),
}));

const mockConvidarUsuario = convidarUsuario as jest.MockedFunction<typeof convidarUsuario>;

describe('NovoUsuario', () => {
  beforeEach(() => {
    mockBack.mockReset();
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue({ meuPapel: 'dono', meusAlunos: [] });
    mockConvidarUsuario.mockReset();
    mockConvidarUsuario.mockResolvedValue({ ok: true, perfil_id: 'novo-id' });
  });

  it('redirects away when the signed-in user is a student', async () => {
    mockUseAuth.mockReturnValue({ meuPapel: 'aluno', meusAlunos: [] });

    await render(<NovoUsuario />);

    expect(screen.getByText('redirect:/')).toBeTruthy();
  });

  it('lets a teacher access the screen but hides the owner role option', async () => {
    mockUseAuth.mockReturnValue({ meuPapel: 'professor', meusAlunos: [] });

    await render(<NovoUsuario />);

    expect(screen.getByText('Aluno')).toBeTruthy();
    expect(screen.getByText('Professor(a)')).toBeTruthy();
    expect(screen.queryByText('Dono')).toBeNull();
  });

  it('defaults the role to aluno and validates required fields', async () => {
    await render(<NovoUsuario />);

    await fireEvent.press(screen.getByTestId('usuarios-botao-enviar-convite'));

    expect(await screen.findByTestId('usuarios-mensagem-erro')).toHaveTextContent(
      'Informe o nome do usuário.'
    );
    expect(mockConvidarUsuario).not.toHaveBeenCalled();
  });

  it('validates the email format', async () => {
    await render(<NovoUsuario />);

    await fireEvent.changeText(screen.getByTestId('usuarios-input-nome'), 'Prof Ana');
    await fireEvent.changeText(screen.getByTestId('usuarios-input-email'), 'email-invalido');
    await fireEvent.press(screen.getByTestId('usuarios-botao-enviar-convite'));

    expect(await screen.findByTestId('usuarios-mensagem-erro')).toHaveTextContent('Informe um email válido.');
    expect(mockConvidarUsuario).not.toHaveBeenCalled();
  });

  it('sends the invite with the selected role', async () => {
    await render(<NovoUsuario />);

    await fireEvent.changeText(screen.getByTestId('usuarios-input-nome'), 'Prof Ana');
    await fireEvent.changeText(screen.getByTestId('usuarios-input-email'), 'prof@escola.com');
    await fireEvent.press(screen.getByText('Professor(a)'));
    await fireEvent.press(screen.getByTestId('usuarios-botao-enviar-convite'));

    await waitFor(() => {
      expect(mockConvidarUsuario).toHaveBeenCalledWith('prof@escola.com', 'Prof Ana', 'professor');
    });
    expect(await screen.findByText('Convite enviado')).toBeTruthy();
  });

  it('shows the Edge Function error message when the invite fails', async () => {
    mockConvidarUsuario.mockRejectedValueOnce(new Error('Somente o dono pode convidar novos usuários.'));

    await render(<NovoUsuario />);

    await fireEvent.changeText(screen.getByTestId('usuarios-input-nome'), 'Prof Ana');
    await fireEvent.changeText(screen.getByTestId('usuarios-input-email'), 'prof@escola.com');
    await fireEvent.press(screen.getByTestId('usuarios-botao-enviar-convite'));

    expect(await screen.findByTestId('usuarios-mensagem-erro')).toHaveTextContent(
      'Somente o dono pode convidar novos usuários.'
    );
  });
});
