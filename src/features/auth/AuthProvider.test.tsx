import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { AuthProvider, useAuth } from './AuthProvider';

const mockGetSession = jest.fn();
const mockOnAuthStateChange = jest.fn();
const mockSignInWithPassword = jest.fn();
const mockSignUp = jest.fn();
const mockResetPasswordForEmail = jest.fn();
const mockUpdateUser = jest.fn();
const mockSignOut = jest.fn();
const mockUnsubscribe = jest.fn();
const mockPapelSingle = jest.fn();
const mockAlunoMaybeSingle = jest.fn();
const mockAppStateAddEventListener = jest.fn((_event: string, _handler: (proximoEstado: string) => void) => ({
  remove: jest.fn(),
}));

jest.mock('expo-linking', () => ({
  createURL: (path: string) => `escolaschmidt:/${path.replace(/^\//, '')}`,
}));

// Mock direto no arquivo-fonte do AppState real (em vez de spyOn na
// instância singleton): AppState é um NativeEventEmitter de verdade, e
// espionar/restaurar seu addEventListener corrompia o estado do emissor
// pros testes seguintes do arquivo (todos passavam a receber `undefined`
// de volta). Mockar o módulo evita tocar nesse singleton.
jest.mock('react-native/Libraries/AppState/AppState', () => ({
  __esModule: true,
  default: {
    addEventListener: (event: string, handler: (proximoEstado: string) => void) =>
      mockAppStateAddEventListener(event, handler),
    currentState: 'active',
  },
}));

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signUp: (...args: unknown[]) => mockSignUp(...args),
      resetPasswordForEmail: (...args: unknown[]) => mockResetPasswordForEmail(...args),
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
      signOut: (options?: { scope?: string }) => mockSignOut(options),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => mockPapelSingle(),
          maybeSingle: () => mockAlunoMaybeSingle(),
        }),
      }),
    }),
  },
}));

function Consumer() {
  const { loading, session, meuPapel, meuAluno, signIn, signOut, signUp, requestPasswordReset, changePassword } =
    useAuth();
  const [signupResult, setSignupResult] = useState('');
  const [resetResult, setResetResult] = useState('');
  const [passwordResult, setPasswordResult] = useState('');

  return (
    <>
      <Text>{loading ? 'loading' : 'ready'}</Text>
      <Text>{session?.user?.email ?? 'sem-sessao'}</Text>
      <Text>{meuPapel ?? 'sem-papel'}</Text>
      <Text>{meuAluno?.nome ?? 'sem-aluno'}</Text>
      <Pressable onPress={() => void signIn('professor@escola.com', 'segredo')}>
        <Text>sign-in</Text>
      </Pressable>
      <Pressable onPress={() => void signOut()}>
        <Text>sign-out</Text>
      </Pressable>
      <Pressable
        onPress={async () => {
          const result = await signUp('Prof Ana', 'prof@escola.com', 'Senha@123');
          setSignupResult(result.error ?? 'ok');
        }}
      >
        <Text>sign-up</Text>
      </Pressable>
      <Text>{signupResult}</Text>
      <Pressable
        onPress={async () => {
          const result = await requestPasswordReset('prof@escola.com');
          setResetResult(result.error ?? 'reset-ok');
        }}
      >
        <Text>request-password-reset</Text>
      </Pressable>
      <Text>{resetResult}</Text>
      <Pressable
        onPress={async () => {
          const result = await changePassword('SenhaAntiga@1', 'NovaSenha@1');
          setPasswordResult(result.error ?? 'senha-ok');
        }}
      >
        <Text>change-password</Text>
      </Pressable>
      <Text>{passwordResult}</Text>
    </>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockOnAuthStateChange.mockReset();
    mockSignInWithPassword.mockReset();
    mockSignUp.mockReset();
    mockResetPasswordForEmail.mockReset();
    mockUpdateUser.mockReset();
    mockSignOut.mockReset();
    mockUnsubscribe.mockReset();
    mockPapelSingle.mockReset();
    mockAlunoMaybeSingle.mockReset();
    mockAppStateAddEventListener.mockClear();

    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: mockUnsubscribe } },
    });
    mockSignInWithPassword.mockResolvedValue({ error: null });
    mockSignUp.mockResolvedValue({ error: null });
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
    mockUpdateUser.mockResolvedValue({ error: null });
    mockSignOut.mockResolvedValue(undefined);
    mockPapelSingle.mockResolvedValue({ data: { papel: 'aluno' }, error: null });
    mockAlunoMaybeSingle.mockResolvedValue({ data: null, error: null });
  });

  it('loads the current session and exposes ready state', async () => {
    await render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('ready')).toBeTruthy();
    });

    expect(screen.getByText('sem-sessao')).toBeTruthy();
    expect(mockGetSession).toHaveBeenCalledTimes(1);
    expect(mockOnAuthStateChange).toHaveBeenCalledTimes(1);
  });

  it('updates session state when the auth listener emits a new session', async () => {
    await render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(mockOnAuthStateChange).toHaveBeenCalledTimes(1);
    });

    const listener = mockOnAuthStateChange.mock.calls[0][0] as (
      event: string,
      session: { user: { email: string } }
    ) => void;

    await act(async () => {
      listener('SIGNED_IN', { user: { email: 'aluna@escola.com' } });
    });

    await waitFor(() => {
      expect(screen.getByText('aluna@escola.com')).toBeTruthy();
    });
  });

  it('proxies sign-in and sign-out actions to Supabase', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({ error: { message: 'credenciais invalidas' } });

    await render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await fireEvent.press(screen.getByText('sign-in'));
    await fireEvent.press(screen.getByText('sign-out'));

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'professor@escola.com',
        password: 'segredo',
      });
    });
    // scope: 'global' é intencional (comentado no código-fonte): revoga o
    // refresh token no servidor, não só limpa o storage local.
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'global' });
  });

  it('returns success on sign up and sends profile name in metadata', async () => {
    await render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await fireEvent.press(screen.getByText('sign-up'));

    expect(await screen.findByText('ok')).toBeTruthy();
    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'prof@escola.com',
      password: 'Senha@123',
      options: { data: { nome: 'Prof Ana' } },
    });
  });

  it('returns a generic message on sign up failure', async () => {
    mockSignUp.mockResolvedValueOnce({ error: { message: 'duplicate user' } });

    await render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await fireEvent.press(screen.getByText('sign-up'));

    expect(
      await screen.findByText('Não foi possível concluir o cadastro agora. Tente novamente em instantes.')
    ).toBeTruthy();
  });

  it('requests password reset email', async () => {
    await render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await fireEvent.press(screen.getByText('request-password-reset'));

    expect(await screen.findByText('reset-ok')).toBeTruthy();
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
      'prof@escola.com',
      expect.objectContaining({ redirectTo: expect.any(String) })
    );
  });

  it('changes password after validating current password', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: { user: { id: 'user-1', email: 'aluna@escola.com' } } },
    });

    await render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await fireEvent.press(screen.getByText('change-password'));

    expect(await screen.findByText('senha-ok')).toBeTruthy();
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'aluna@escola.com',
      password: 'SenhaAntiga@1',
    });
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'NovaSenha@1' });
  });

  it('signs out automatically after 30 minutes without activity', async () => {
    jest.useFakeTimers();
    mockGetSession.mockResolvedValueOnce({
      data: { session: { user: { id: 'user-1', email: 'aluna@escola.com' } } },
    });

    await render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('aluna@escola.com')).toBeTruthy();
    });
    expect(mockSignOut).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(31 * 60 * 1000);
    });

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  // O comentário em AuthProvider.tsx explica por quê: em segundo plano os
  // timers de JS (o setInterval acima) ficam pausados de verdade, então o
  // app só reavalia a inatividade quando volta a ficar ativo. Simulamos isso
  // com jest.setSystemTime (avança o relógio sem disparar timers) em vez de
  // advanceTimersByTime (que dispararia o setInterval como se estivesse em
  // primeiro plano o tempo todo).
  it('does not sign out when returning to foreground before the inactivity timeout elapses in background', async () => {
    jest.useFakeTimers();
    mockGetSession.mockResolvedValueOnce({
      data: { session: { user: { id: 'user-1', email: 'aluna@escola.com' } } },
    });

    await render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('aluna@escola.com')).toBeTruthy();
    });

    const listener = mockAppStateAddEventListener.mock.calls[0][1] as (proximoEstado: string) => void;

    jest.setSystemTime(new Date(Date.now() + 20 * 60 * 1000));

    await act(async () => {
      listener('active');
    });

    expect(mockSignOut).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('signs out when returning to foreground after the inactivity timeout elapsed in background', async () => {
    jest.useFakeTimers();
    mockGetSession.mockResolvedValueOnce({
      data: { session: { user: { id: 'user-1', email: 'aluna@escola.com' } } },
    });

    await render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('aluna@escola.com')).toBeTruthy();
    });

    const listener = mockAppStateAddEventListener.mock.calls[0][1] as (proximoEstado: string) => void;

    jest.setSystemTime(new Date(Date.now() + 31 * 60 * 1000));

    await act(async () => {
      listener('active');
    });

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  // meuPapel/meuAluno são configurados via mockPapelSingle/mockAlunoMaybeSingle
  // em todos os testes acima, mas nunca tinham sido verificados — são
  // exatamente os valores que decidem qual ramo de UI ([id].tsx, por
  // exemplo) o app mostra pra cada usuário.
  it('derives the profile role from Supabase once a session exists', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: { user: { id: 'user-1', email: 'aluna@escola.com' } } },
    });
    mockPapelSingle.mockResolvedValueOnce({ data: { papel: 'aluno' }, error: null });

    await render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    expect(await screen.findByText('aluno')).toBeTruthy();
  });

  it('does not query a role when there is no session', async () => {
    await render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('ready')).toBeTruthy();
    });

    expect(screen.getByText('sem-papel')).toBeTruthy();
    expect(mockPapelSingle).not.toHaveBeenCalled();
  });

  it('loads the linked student record only when the role is aluno', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: { user: { id: 'user-1', email: 'aluna@escola.com' } } },
    });
    mockPapelSingle.mockResolvedValueOnce({ data: { papel: 'aluno' }, error: null });
    mockAlunoMaybeSingle.mockResolvedValueOnce({
      data: {
        id: 'aluno-1',
        nome: 'Ana',
        modulo: 1,
        data_nascimento: null,
        responsavel_nome: null,
        responsavel_telefone: null,
      },
      error: null,
    });

    await render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    expect(await screen.findByText('Ana')).toBeTruthy();
  });

  it('does not look up a student record for non-aluno roles', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: { user: { id: 'user-1', email: 'prof@escola.com' } } },
    });
    mockPapelSingle.mockResolvedValueOnce({ data: { papel: 'professor' }, error: null });

    await render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    expect(await screen.findByText('professor')).toBeTruthy();
    expect(mockAlunoMaybeSingle).not.toHaveBeenCalled();
    expect(screen.getByText('sem-aluno')).toBeTruthy();
  });

  it('returns invalid current password error on reauth failure', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: { user: { id: 'user-1', email: 'aluna@escola.com' } } },
    });
    mockSignInWithPassword.mockResolvedValueOnce({ error: { message: 'bad credentials' } });

    await render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await fireEvent.press(screen.getByText('change-password'));

    expect(await screen.findByText('Senha atual inválida.')).toBeTruthy();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });
});