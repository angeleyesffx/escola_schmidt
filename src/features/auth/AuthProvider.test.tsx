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
const mockStartAutoRefresh = jest.fn();
const mockStopAutoRefresh = jest.fn();
const mockUnsubscribe = jest.fn();
const mockPapelSingle = jest.fn();
const mockAlunosQuery = jest.fn();
const mockRpc = jest.fn();
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
      startAutoRefresh: () => mockStartAutoRefresh(),
      stopAutoRefresh: () => mockStopAutoRefresh(),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => mockPapelSingle(),
          order: () => mockAlunosQuery(),
        }),
      }),
    }),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

function Consumer() {
  const {
    loading,
    session,
    meuPapel,
    meusAlunos,
    meusAlunosCarregado,
    signIn,
    signOut,
    signUp,
    requestPasswordReset,
    changePassword,
    adicionarFilho,
  } = useAuth();
  const [signupResult, setSignupResult] = useState('');
  const [signupComFilhosResult, setSignupComFilhosResult] = useState('');
  const [resetResult, setResetResult] = useState('');
  const [passwordResult, setPasswordResult] = useState('');
  const [signInResult, setSignInResult] = useState('');
  const [adicionarFilhoResult, setAdicionarFilhoResult] = useState('');

  return (
    <>
      <Text>{loading ? 'loading' : 'ready'}</Text>
      <Text>{session?.user?.email ?? 'sem-sessao'}</Text>
      <Text>{meuPapel ?? 'sem-papel'}</Text>
      <Text>{meusAlunos.map((a) => a.nome).join(', ') || 'sem-aluno'}</Text>
      <Text>{meusAlunosCarregado ? 'aluno-carregado' : 'aluno-carregando'}</Text>
      <Pressable
        onPress={async () => {
          const result = await signIn('professor@escola.com', 'segredo');
          setSignInResult(result.error ?? 'login-ok');
        }}
      >
        <Text>sign-in</Text>
      </Pressable>
      <Text>{signInResult}</Text>
      <Pressable onPress={() => void signOut()}>
        <Text>sign-out</Text>
      </Pressable>
      <Pressable
        onPress={async () => {
          const result = await signUp('Prof Ana', 'prof@escola.com', 'Senha@123', 'proprio', '2026-09-20');
          setSignupResult(result.error ?? 'ok');
        }}
      >
        <Text>sign-up</Text>
      </Pressable>
      <Text>{signupResult}</Text>
      <Pressable
        onPress={async () => {
          const result = await signUp(
            'Mae Ana',
            'mae@escola.com',
            'Senha@123',
            'responsavel',
            '2026-09-20',
            [
              { nome: 'Filho A', dataNascimento: '2015-01-01' },
              { nome: ' ', dataNascimento: '2015-01-01' },
              { nome: 'Filho B', dataNascimento: '2016-02-02' },
            ]
          );
          setSignupComFilhosResult(result.error ?? 'ok');
        }}
      >
        <Text>sign-up-com-filhos</Text>
      </Pressable>
      <Text>{signupComFilhosResult}</Text>
      <Pressable
        onPress={async () => {
          const result = await adicionarFilho('Outro Filho', '2015-05-05');
          setAdicionarFilhoResult(result.error ?? 'filho-adicionado');
        }}
      >
        <Text>adicionar-filho</Text>
      </Pressable>
      <Text>{adicionarFilhoResult}</Text>
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
    mockStartAutoRefresh.mockReset();
    mockStopAutoRefresh.mockReset();
    mockUnsubscribe.mockReset();
    mockPapelSingle.mockReset();
    mockAlunosQuery.mockReset();
    mockRpc.mockReset();
    mockAppStateAddEventListener.mockClear();

    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: mockUnsubscribe } },
    });
    mockSignInWithPassword.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mockSignUp.mockResolvedValue({ error: null });
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
    mockUpdateUser.mockResolvedValue({ error: null });
    mockSignOut.mockResolvedValue(undefined);
    mockPapelSingle.mockResolvedValue({ data: { papel: 'aluno', ativo: true }, error: null });
    mockAlunosQuery.mockResolvedValue({ data: [], error: null });
    // Default genérico pra qualquer RPC (meus_vinculos_pendentes disparado
    // sozinho ao logar, entre outras) — testes que exercitam uma RPC
    // específica (adicionar_meu_filho etc.) sobrescrevem com mockImplementation.
    mockRpc.mockResolvedValue({ data: [], error: null });
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

  // Sem esse fallback local, uma falha de rede na chamada ao servidor (ex.:
  // tablet sem internet no exato momento do logout por inatividade) deixava
  // a sessão presa no contexto — o usuário nunca via o redirect pro login.
  it('clears the local session even when the server sign-out call fails', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: { user: { id: 'user-1', email: 'aluna@escola.com' } } },
    });
    mockSignOut.mockRejectedValueOnce(new Error('Network request failed'));

    await render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('aluna@escola.com')).toBeTruthy();
    });

    await fireEvent.press(screen.getByText('sign-out'));

    await waitFor(() => {
      expect(screen.getByText('sem-sessao')).toBeTruthy();
    });
  });

  // Credenciais corretas não bastam pra entrar (supabase/migrations/0017):
  // se o dono já desativou essa conta, barra no login em vez de deixar
  // entrar e só derrubar depois no próximo tick do polling de inatividade.
  it('blocks sign-in when the account has been deactivated', async () => {
    mockPapelSingle.mockResolvedValueOnce({ data: { ativo: false }, error: null });

    await render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await fireEvent.press(screen.getByText('sign-in'));

    await waitFor(() => {
      expect(screen.getByText('Sua conta foi desativada. Fale com a administração da escola.')).toBeTruthy();
    });
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  // Falha fechado: se a consulta que confirma "ativo" der erro (ex.: rede
  // instável logo após autenticar), não deixamos entrar só porque não deu
  // pra confirmar — uma instabilidade transitória não pode virar bypass do
  // bloqueio de conta desativada.
  it('blocks sign-in when the active-account check fails instead of letting it through', async () => {
    mockPapelSingle.mockResolvedValueOnce({ data: null, error: new Error('network error') });

    await render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await fireEvent.press(screen.getByText('sign-in'));

    await waitFor(() => {
      expect(screen.getByText('Não foi possível confirmar sua conta agora. Tente novamente em instantes.')).toBeTruthy();
    });
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  // Reaproveita o polling de 60s da inatividade (AuthProvider.tsx) pra
  // também pegar uma desativação feita pelo dono enquanto a sessão de um
  // usuário já estava aberta — sem isso, só cairia no próximo login.
  it('signs the user out via the 60s polling when deactivated mid-session', async () => {
    jest.useFakeTimers();
    mockGetSession.mockResolvedValueOnce({
      data: { session: { user: { id: 'user-1', email: 'aluna@escola.com' } } },
    });
    mockPapelSingle.mockResolvedValueOnce({ data: { papel: 'aluno', ativo: true }, error: null });
    mockPapelSingle.mockResolvedValueOnce({ data: { ativo: false }, error: null });

    await render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('aluna@escola.com')).toBeTruthy();
    });
    expect(mockSignOut).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(60_000);

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('pauses and resumes Supabase token auto-refresh with app foreground state', async () => {
    await render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(mockAppStateAddEventListener).toHaveBeenCalled();
    });

    const listener = mockAppStateAddEventListener.mock.calls[0][1] as (proximoEstado: string) => void;

    await act(async () => {
      listener('background');
    });
    expect(mockStopAutoRefresh).toHaveBeenCalledTimes(1);

    await act(async () => {
      listener('active');
    });
    expect(mockStartAutoRefresh).toHaveBeenCalledTimes(1);
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
      options: { data: { nome: 'Prof Ana', titular: 'proprio', consentimento_versao: '2026-09-20' } },
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

  it('sends trimmed, non-empty children names as metadata on sign up', async () => {
    await render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await fireEvent.press(screen.getByText('sign-up-com-filhos'));

    expect(await screen.findByText('ok')).toBeTruthy();
    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'mae@escola.com',
      password: 'Senha@123',
      options: {
        data: {
          nome: 'Mae Ana',
          titular: 'responsavel',
          consentimento_versao: '2026-09-20',
          filhos: [
            { nome: 'Filho A', data_nascimento: '2015-01-01' },
            { nome: ' ', data_nascimento: '2015-01-01' },
            { nome: 'Filho B', data_nascimento: '2016-02-02' },
          ],
        },
      },
    });
  });

  it('adds a child to the account and refreshes the linked-students list', async () => {
    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === 'adicionar_meu_filho') return Promise.resolve({ data: 'novo-aluno-id', error: null });
      return Promise.resolve({ data: [], error: null });
    });
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1', email: 'mae@escola.com' } } } });
    mockAlunosQuery.mockResolvedValueOnce({ data: [], error: null }).mockResolvedValueOnce({
      data: [{ id: 'novo-aluno-id', nome: 'Filho A', modulo: 1, data_nascimento: null, responsavel_nome: null, responsavel_telefone: null }],
      error: null,
    });

    await render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await fireEvent.press(screen.getByText('adicionar-filho'));

    expect(await screen.findByText('filho-adicionado')).toBeTruthy();
    expect(mockRpc).toHaveBeenCalledWith('adicionar_meu_filho', {
      p_nome: 'Outro Filho',
      p_data_nascimento: '2015-05-05',
    });
    expect(await screen.findByText('Filho A')).toBeTruthy();
  });

  it('surfaces the RPC error message when adding a child fails', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1', email: 'mae@escola.com' } } } });
    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === 'adicionar_meu_filho') {
        return Promise.resolve({ data: null, error: { message: 'Informe o nome do filho.' } });
      }
      return Promise.resolve({ data: [], error: null });
    });

    await render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await fireEvent.press(screen.getByText('adicionar-filho'));

    expect(await screen.findByText('Informe o nome do filho.')).toBeTruthy();
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

    // Duas assinaturas de AppState existem agora (startAutoRefresh/stopAutoRefresh
    // do Supabase, registrada incondicionalmente no mount, e a verificação de
    // inatividade abaixo, registrada só quando há sessão) — pegamos a última,
    // que é a de inatividade.
    const listener = mockAppStateAddEventListener.mock.calls.at(-1)?.[1] as (proximoEstado: string) => void;

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

    const listener = mockAppStateAddEventListener.mock.calls.at(-1)?.[1] as (proximoEstado: string) => void;

    jest.setSystemTime(new Date(Date.now() + 31 * 60 * 1000));

    await act(async () => {
      listener('active');
    });

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  // meuPapel/meusAlunos são configurados via mockPapelSingle/mockAlunosQuery
  // em todos os testes acima, mas nunca tinham sido verificados — são
  // exatamente os valores que decidem qual ramo de UI ([id].tsx, por
  // exemplo) o app mostra pra cada usuário.
  it('derives the profile role from Supabase once a session exists', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: { user: { id: 'user-1', email: 'aluna@escola.com' } } },
    });
    mockPapelSingle.mockResolvedValueOnce({ data: { papel: 'aluno', ativo: true }, error: null });

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

  it('loads the linked student record when the role is aluno', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: { user: { id: 'user-1', email: 'aluna@escola.com' } } },
    });
    mockPapelSingle.mockResolvedValueOnce({ data: { papel: 'aluno', ativo: true }, error: null });
    mockAlunosQuery.mockResolvedValueOnce({
      data: [
        {
          id: 'aluno-1',
          nome: 'Ana',
          modulo: 1,
          data_nascimento: null,
          responsavel_nome: null,
          responsavel_telefone: null,
        },
      ],
      error: null,
    });

    await render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    expect(await screen.findByText('Ana')).toBeTruthy();
  });

  // Regressão: telas como minha-evolucao.tsx faziam `if (meusAlunos.length
  // === 0) <spinner>` pra cobrir "ainda buscando" — mas pra quem se
  // cadastrou sozinho e nunca foi vinculado a um aluno, a busca sempre
  // resolve pra lista vazia, então o spinner nunca saía da tela (loading
  // infinito). meusAlunosCarregado precisa virar true mesmo sem nenhum
  // vínculo, pra essas telas saberem que já é hora de mostrar uma mensagem
  // em vez de continuar girando.
  it('marks the student record as loaded even when no student is linked yet', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: { user: { id: 'user-1', email: 'recem-cadastrado@escola.com' } } },
    });
    mockPapelSingle.mockResolvedValueOnce({ data: { papel: 'aluno', ativo: true }, error: null });
    mockAlunosQuery.mockResolvedValueOnce({ data: [], error: null });

    await render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    expect(await screen.findByText('aluno-carregado')).toBeTruthy();
    expect(screen.getByText('sem-aluno')).toBeTruthy();
  });

  // responsavel (supabase/migrations/0029-0030): conta que o vínculo por
  // e-mail (0020) liga a um registro de aluno em nome do responsável, não
  // do próprio atleta. Acesso precisa ser idêntico ao de aluno — inclusive
  // carregar o mesmo `meusAlunos`, já que nenhuma RLS distingue os dois papéis.
  it('loads the linked student record when the role is responsavel', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: { user: { id: 'user-1', email: 'responsavel@escola.com' } } },
    });
    mockPapelSingle.mockResolvedValueOnce({ data: { papel: 'responsavel', ativo: true }, error: null });
    mockAlunosQuery.mockResolvedValueOnce({
      data: [
        {
          id: 'aluno-1',
          nome: 'Ana',
          modulo: 1,
          data_nascimento: null,
          responsavel_nome: null,
          responsavel_telefone: null,
        },
      ],
      error: null,
    });

    await render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    expect(await screen.findByText('Ana')).toBeTruthy();
  });

  // Regressão (supabase/migrations/0033 + docs/product/professor-como-aluno.md):
  // uma conta pode ter mais de um aluno vinculado — responsável por vários
  // filhos, ou aluno adulto que também é responsável por outro. A busca não
  // filtra mais por papel, então mesmo um professor é consultado (e um
  // responsável com 2 filhos recebe os 2).
  it('loads every linked student, regardless of role or how many are linked', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: { user: { id: 'user-1', email: 'responsavel@escola.com' } } },
    });
    mockPapelSingle.mockResolvedValueOnce({ data: { papel: 'responsavel', ativo: true }, error: null });
    mockAlunosQuery.mockResolvedValueOnce({
      data: [
        { id: 'aluno-1', nome: 'Ana', modulo: 1, data_nascimento: null, responsavel_nome: null, responsavel_telefone: null },
        { id: 'aluno-2', nome: 'Beto', modulo: 2, data_nascimento: null, responsavel_nome: null, responsavel_telefone: null },
      ],
      error: null,
    });

    await render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    expect(await screen.findByText('Ana, Beto')).toBeTruthy();
  });

  it('also looks up a linked student record for dono/professor roles (professor-como-aluno)', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: { user: { id: 'user-1', email: 'prof@escola.com' } } },
    });
    mockPapelSingle.mockResolvedValueOnce({ data: { papel: 'professor', ativo: true }, error: null });
    mockAlunosQuery.mockResolvedValueOnce({
      data: [
        { id: 'aluno-3', nome: 'Prof Ana', modulo: 3, data_nascimento: null, responsavel_nome: null, responsavel_telefone: null },
      ],
      error: null,
    });

    await render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    expect(await screen.findByText('professor')).toBeTruthy();
    expect(await screen.findByText('Prof Ana')).toBeTruthy();
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