import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import Login from '../login';

const mockSignIn = jest.fn();
const mockRequestPasswordReset = jest.fn();
const mockUseAuth = jest.fn();

jest.mock('../../../src/features/auth/AuthProvider', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('Login', () => {
  beforeEach(() => {
    mockSignIn.mockReset();
    mockRequestPasswordReset.mockReset();
    mockSignIn.mockResolvedValue({ error: null });
    mockRequestPasswordReset.mockResolvedValue({ error: null });
    mockUseAuth.mockReturnValue({ signIn: mockSignIn, requestPasswordReset: mockRequestPasswordReset });
  });

  it('renders the login form with the submit button disabled initially', async () => {
    await render(<Login />);

    expect(screen.getByText('Escola Schmidt')).toBeTruthy();
    expect(screen.getByText('Entre com sua conta.')).toBeTruthy();
    expect(screen.getByTestId('login-input-email')).toBeTruthy();
    expect(screen.getByTestId('login-input-senha')).toBeTruthy();
    expect(screen.getByTestId('login-button-entrar').props.accessibilityState.disabled).toBe(true);
  });

  // Cobre as partições "só email preenchido" e "só senha preenchida" da
  // condição `submitting || !email || !password` (login.tsx) — faltavam
  // além de "ambos vazios" (teste acima) e "ambos preenchidos" (teste de
  // submissão abaixo).
  it('keeps the submit button disabled when only email is filled', async () => {
    await render(<Login />);

    await fireEvent.changeText(screen.getByTestId('login-input-email'), 'pessoa@escola.com');

    expect(screen.getByTestId('login-button-entrar').props.accessibilityState.disabled).toBe(true);
  });

  it('keeps the submit button disabled when only password is filled', async () => {
    await render(<Login />);

    await fireEvent.changeText(screen.getByTestId('login-input-senha'), 'segredo');

    expect(screen.getByTestId('login-button-entrar').props.accessibilityState.disabled).toBe(true);
  });

  it('submits trimmed credentials when the form is valid', async () => {
    await render(<Login />);

    await fireEvent.changeText(screen.getByTestId('login-input-email'), '  pessoa@escola.com  ');
    await fireEvent.changeText(screen.getByTestId('login-input-senha'), 'segredo');

    expect(screen.getByTestId('login-button-entrar').props.accessibilityState.disabled).toBe(false);

    await fireEvent.press(screen.getByTestId('login-button-entrar'));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('pessoa@escola.com', 'segredo');
    });
  });

  it('shows a user-facing error when sign in fails', async () => {
    mockSignIn.mockResolvedValueOnce({ error: 'invalid credentials' });

    await render(<Login />);

    await fireEvent.changeText(screen.getByTestId('login-input-email'), 'pessoa@escola.com');
    await fireEvent.changeText(screen.getByTestId('login-input-senha'), 'errada');
    await fireEvent.press(screen.getByTestId('login-button-entrar'));

    expect(await screen.findByTestId('login-mensagem-erro')).toHaveTextContent('Email ou senha incorretos.');
  });

  it('requests password recovery when email is valid', async () => {
    await render(<Login />);

    await fireEvent.changeText(screen.getByTestId('login-input-email'), '  pessoa@escola.com  ');
    await fireEvent.press(screen.getByTestId('login-button-esqueci-senha'));

    await waitFor(() => {
      expect(mockRequestPasswordReset).toHaveBeenCalledWith('pessoa@escola.com');
    });
    expect(await screen.findByTestId('login-mensagem-sucesso')).toHaveTextContent(
      'Se o email estiver cadastrado, você receberá as instruções de recuperação.'
    );
  });

  it('validates email before requesting password recovery', async () => {
    await render(<Login />);

    await fireEvent.changeText(screen.getByTestId('login-input-email'), 'email-invalido');
    await fireEvent.press(screen.getByTestId('login-button-esqueci-senha'));

    expect(mockRequestPasswordReset).not.toHaveBeenCalled();
    expect(await screen.findByTestId('login-mensagem-erro')).toHaveTextContent(
      'Informe um email válido para recuperar a senha.'
    );
  });

  // Ramo de erro do backend em handleForgotPassword (login.tsx) — só o
  // caminho de sucesso e o de email inválido no client estavam cobertos.
  it('shows a generic error when password recovery request fails on the backend', async () => {
    mockRequestPasswordReset.mockResolvedValueOnce({ error: 'smtp down' });

    await render(<Login />);

    await fireEvent.changeText(screen.getByTestId('login-input-email'), 'pessoa@escola.com');
    await fireEvent.press(screen.getByTestId('login-button-esqueci-senha'));

    expect(await screen.findByTestId('login-mensagem-erro')).toHaveTextContent(
      'Não foi possível iniciar a recuperação de senha agora. Tente novamente.'
    );
  });

  // Toggle de mostrar/ocultar senha (PasswordInput), sem nenhuma cobertura
  // antes desta revisão.
  it('toggles password visibility', async () => {
    await render(<Login />);

    expect(screen.getByTestId('login-input-senha').props.secureTextEntry).toBe(true);

    await fireEvent.press(screen.getByTestId('login-input-senha-toggle'));

    expect(screen.getByTestId('login-input-senha').props.secureTextEntry).toBe(false);
  });
});
