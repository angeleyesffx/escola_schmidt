import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import ResetPassword from '../reset-password';

const mockReplace = jest.fn();
const mockSearchParams: Record<string, string> = {};
const mockGetInitialURL = jest.fn();
const mockLinkingAddEventListener = jest.fn(
  (_event: string, _handler: (payload: { url: string }) => void) => ({ remove: jest.fn() })
);
const mockVerifyOtp = jest.fn();
const mockSetSession = jest.fn();
const mockUpdateUser = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useLocalSearchParams: () => mockSearchParams,
}));

jest.mock('expo-linking', () => ({
  getInitialURL: () => mockGetInitialURL(),
  addEventListener: (event: string, handler: (payload: { url: string }) => void) =>
    mockLinkingAddEventListener(event, handler),
}));

jest.mock('../../../src/lib/supabase', () => ({
  supabase: {
    auth: {
      verifyOtp: (...args: unknown[]) => mockVerifyOtp(...args),
      setSession: (...args: unknown[]) => mockSetSession(...args),
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
    },
  },
}));

const SENHA_FORTE = 'Senha@123';

describe('ResetPassword', () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockGetInitialURL.mockReset();
    mockLinkingAddEventListener.mockClear();
    mockVerifyOtp.mockReset();
    mockSetSession.mockReset();
    mockUpdateUser.mockReset();
    for (const chave of Object.keys(mockSearchParams)) delete mockSearchParams[chave];

    mockGetInitialURL.mockResolvedValue(null);
    mockVerifyOtp.mockResolvedValue({ error: null });
    mockSetSession.mockResolvedValue({ error: null });
    mockUpdateUser.mockResolvedValue({ error: null });
  });

  async function preencherSenhasValidas() {
    await fireEvent.changeText(screen.getByTestId('reset-input-senha'), SENHA_FORTE);
    await fireEvent.changeText(screen.getByTestId('reset-input-confirmar-senha'), SENHA_FORTE);
  }

  it('validates the link via token_hash query param and enables saving', async () => {
    mockSearchParams.token_hash = 'token-abc';
    mockSearchParams.type = 'recovery';

    await render(<ResetPassword />);

    await waitFor(() => {
      expect(mockVerifyOtp).toHaveBeenCalledWith({ type: 'recovery', token_hash: 'token-abc' });
    });
    await preencherSenhasValidas();

    expect(screen.getByTestId('reset-button-salvar').props.accessibilityState.disabled).toBe(false);
  });

  // Fluxo padrao do Supabase (sem template de email customizado): os tokens
  // chegam como fragmento da URL de cold start, nao como query string.
  it('validates the link via the URL fragment on cold start when no query params are present', async () => {
    mockGetInitialURL.mockResolvedValue(
      'escolaschmidt://reset-password#access_token=tok-1&refresh_token=ref-1&type=recovery'
    );

    await render(<ResetPassword />);

    await waitFor(() => {
      expect(mockSetSession).toHaveBeenCalledWith({ access_token: 'tok-1', refresh_token: 'ref-1' });
    });
    await preencherSenhasValidas();

    expect(screen.getByTestId('reset-button-salvar').props.accessibilityState.disabled).toBe(false);
  });

  it('shows an error and keeps saving disabled when Supabase rejects the token', async () => {
    mockSearchParams.token_hash = 'token-expirado';
    mockSearchParams.type = 'recovery';
    mockVerifyOtp.mockResolvedValueOnce({ error: { message: 'token expired' } });

    await render(<ResetPassword />);

    expect(await screen.findByTestId('reset-mensagem-erro')).toHaveTextContent(
      'Nao foi possivel validar o link de recuperacao. Solicite um novo email.'
    );
    expect(screen.getByTestId('reset-button-salvar').props.accessibilityState.disabled).toBe(true);
  });

  it('shows the error reason forwarded by Supabase when the link itself is invalid', async () => {
    mockSearchParams.error_description = 'Link+expirado';

    await render(<ResetPassword />);

    expect(await screen.findByTestId('reset-mensagem-erro')).toHaveTextContent('Link expirado');
  });

  it('blocks saving with a mismatch message even when the token is valid', async () => {
    mockSearchParams.token_hash = 'token-abc';
    mockSearchParams.type = 'recovery';

    await render(<ResetPassword />);
    await waitFor(() => {
      expect(mockVerifyOtp).toHaveBeenCalled();
    });

    await fireEvent.changeText(screen.getByTestId('reset-input-senha'), SENHA_FORTE);
    await fireEvent.changeText(screen.getByTestId('reset-input-confirmar-senha'), 'outraSenha');
    // O botao so fica desabilitado por !tokenOk/submitting; a checagem de
    // senhas iguais acontece dentro de salvar(), entao o teste dispara o
    // press mesmo com o botao visualmente habilitado.
    await fireEvent.press(screen.getByTestId('reset-button-salvar'));

    expect(await screen.findByTestId('reset-mensagem-erro')).toHaveTextContent(
      'A confirmacao de senha nao confere.'
    );
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('updates the password and shows a success message when everything is valid', async () => {
    mockSearchParams.token_hash = 'token-abc';
    mockSearchParams.type = 'recovery';

    await render(<ResetPassword />);
    await waitFor(() => {
      expect(mockVerifyOtp).toHaveBeenCalled();
    });
    await preencherSenhasValidas();

    await fireEvent.press(screen.getByTestId('reset-button-salvar'));

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({ password: SENHA_FORTE });
    });
    expect(await screen.findByTestId('reset-mensagem-sucesso')).toHaveTextContent(
      'Senha redefinida com sucesso. Voce ja pode entrar com a nova senha.'
    );
  });

  it('shows a generic error when Supabase fails to update the password', async () => {
    mockSearchParams.token_hash = 'token-abc';
    mockSearchParams.type = 'recovery';
    mockUpdateUser.mockResolvedValueOnce({ error: { message: 'network down' } });

    await render(<ResetPassword />);
    await waitFor(() => {
      expect(mockVerifyOtp).toHaveBeenCalled();
    });
    await preencherSenhasValidas();

    await fireEvent.press(screen.getByTestId('reset-button-salvar'));

    expect(await screen.findByTestId('reset-mensagem-erro')).toHaveTextContent(
      'Nao foi possivel redefinir a senha agora. Tente novamente.'
    );
  });

  it('navigates back to login', async () => {
    mockSearchParams.error_description = 'expirado';

    await render(<ResetPassword />);
    await screen.findByTestId('reset-mensagem-erro');

    await fireEvent.press(screen.getByTestId('reset-button-voltar-login'));

    expect(mockReplace).toHaveBeenCalledWith('/login');
  });
});
