import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import * as Linking from 'expo-linking';
import { AppState, Platform, View } from 'react-native';

import { supabase } from '../../lib/supabase';
import { definirLembrarLogin } from '../../lib/rememberMeStorage';

// Tablet na recepção fica logado o dia inteiro sem ninguém tocar — 30 min
// parado desloga sozinho, tanto com o app aberto (sem toque na tela) quanto
// voltando de segundo plano depois de tempo demais fora.
const TEMPO_INATIVIDADE_MS = 30 * 60 * 1000;

export type Papel = 'dono' | 'professor' | 'aluno';

export type Titular = 'proprio' | 'responsavel';

export type MeuAluno = {
  id: string;
  nome: string;
  modulo: number;
  data_nascimento: string | null;
  responsavel_nome: string | null;
  responsavel_telefone: string | null;
};

type AuthContextValue = {
  session: Session | null;
  meuPapel: Papel | null;
  meuAluno: MeuAluno | null;
  loading: boolean;
  signIn: (email: string, password: string, lembrar?: boolean) => Promise<{ error: string | null }>;
  signUp: (
    nome: string,
    email: string,
    password: string,
    titular: Titular,
    consentimentoVersao: string
  ) => Promise<{ error: string | null }>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const ERRO_GENERICO_CADASTRO = 'Não foi possível concluir o cadastro agora. Tente novamente em instantes.';

function getResetRedirectUrl() {
  const appDeepLink = Linking.createURL('/reset-password');

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const host = window.location.hostname;
    const ehOrigemLocal = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';

    // Link de recuperação aberto no celular não consegue resolver localhost
    // do computador. Em dev local web, preferimos deep link do app.
    if (!ehOrigemLocal) {
      return `${window.location.origin}/reset-password`;
    }
  }

  return appDeepLink;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [meuPapel, setMeuPapel] = useState<Papel | null>(null);
  const [meuAluno, setMeuAluno] = useState<MeuAluno | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Recomendação oficial do Supabase para React Native: sem isso, o timer
  // interno de renovação do access token (setInterval) fica pausado o tempo
  // todo em segundo plano — igual qualquer timer de JS em RN — e não
  // necessariamente retoma sozinho ao voltar pro primeiro plano. Resultado
  // sem essa chamada: o app volta com um token já expirado e a sessão trava
  // em erro em vez de renovar ou redirecionar pro login.
  useEffect(() => {
    const assinatura = AppState.addEventListener('change', (proximoEstado) => {
      if (proximoEstado === 'active') {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });
    return () => assinatura.remove();
  }, []);

  // Só pra UI (esconder controles de quem não pode usá-los) — a barreira de
  // verdade continua sendo a RLS, que já bloqueia escrita por papel.
  useEffect(() => {
    if (!session?.user.id) {
      setMeuPapel(null);
      return;
    }
    let vigente = true;
    supabase
      .from('perfis')
      .select('papel, ativo')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        if (!vigente) return;
        if (error) {
          console.error(error);
          setMeuPapel(null);
          return;
        }
        // Perfil desativado pelo dono (supabase/migrations/0017): desloga em
        // vez de deixar entrar com papel válido.
        if (!data.ativo) {
          setMeuPapel(null);
          signOut();
          return;
        }
        setMeuPapel(data.papel as Papel);
      });
    return () => {
      vigente = false;
    };
  }, [session?.user.id]);

  // Alimenta a tela "Meu perfil" e as travas de autocheckin (data/módulo da
  // própria aula) — só existe pra quem é aluno e já foi vinculado a um registro.
  useEffect(() => {
    if (meuPapel !== 'aluno' || !session?.user.id) {
      setMeuAluno(null);
      return;
    }
    let ativo = true;
    supabase
      .from('alunos')
      .select('id, nome, modulo, data_nascimento, responsavel_nome, responsavel_telefone')
      .eq('perfil_id', session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!ativo) return;
        if (error) {
          console.error(error);
          setMeuAluno(null);
          return;
        }
        setMeuAluno(data as MeuAluno | null);
      });
    return () => {
      ativo = false;
    };
  }, [meuPapel, session?.user.id]);

  async function signIn(email: string, password: string, lembrar = true) {
    // Precisa ser setado antes do signInWithPassword: é a gravação da sessão
    // que decide, na hora, se vai pro AsyncStorage ou só pra memória.
    definirLembrarLogin(lembrar);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { error: error.message };
    }

    // Credenciais corretas não bastam: se o dono desativou essa conta
    // (supabase/migrations/0017), barra aqui em vez de deixar entrar e só
    // derrubar depois no próximo tick do polling de inatividade.
    const usuarioId = data?.user?.id;
    if (usuarioId) {
      const { data: perfil, error: perfilError } = await supabase
        .from('perfis')
        .select('ativo')
        .eq('id', usuarioId)
        .single();
      if (!perfilError && perfil && !perfil.ativo) {
        await signOut();
        return { error: 'Sua conta foi desativada. Fale com a administração da escola.' };
      }
    }

    return { error: null };
  }

  // Mensagem sempre genérica, mesmo em caso de erro: o Supabase já evita
  // confirmar se um email está cadastrado, e não queremos reabrir essa
  // brecha aqui devolvendo o motivo real do erro pra tela.
  async function signUp(
    nome: string,
    email: string,
    password: string,
    titular: Titular,
    consentimentoVersao: string
  ) {
    try {
      // titular e consentimento_versao viram raw_user_meta_data e são lidos
      // por cria_perfil_novo_usuario() (0023) na mesma transação que cria a
      // linha em perfis — não existe um segundo passo de "salvar depois".
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { nome, titular, consentimento_versao: consentimentoVersao } },
      });
      if (error) {
        return { error: ERRO_GENERICO_CADASTRO };
      }
      return { error: null };
    } catch {
      return { error: ERRO_GENERICO_CADASTRO };
    }
  }

  async function requestPasswordReset(email: string) {
    const redirectTo = getResetRedirectUrl();

    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    return { error: error?.message ?? null };
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    const email = session?.user.email;
    if (!email) {
      return { error: 'Sessão inválida. Faça login novamente.' };
    }

    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });
    if (reauthError) {
      return { error: 'Senha atual inválida.' };
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error?.message ?? null };
  }

  // scope: 'global' explícito — revoga o refresh token no servidor (não só
  // limpa o storage local), então a sessão não pode ser reaproveitada depois
  // do logout em nenhum dispositivo.
  async function signOut() {
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch (error) {
      // Se a chamada ao servidor falhar de vez (ex.: tablet sem internet no
      // momento do timeout por inatividade), o Supabase não dispara o evento
      // SIGNED_OUT e a sessão local nunca é limpa — o usuário ficava preso na
      // tela atual em vez de voltar pro login. Limpamos localmente aqui como
      // rede de segurança; o guard em app/(app)/_layout.tsx reage à sessão
      // virando null e redireciona para /login.
      console.error(error);
      setSession(null);
    }
  }

  const ultimaAtividadeRef = useRef(Date.now());

  const registrarAtividade = useCallback(() => {
    ultimaAtividadeRef.current = Date.now();
  }, []);

  // Zera o relógio da inatividade a cada novo login — sem isso, o timestamp
  // inicial (quando o módulo carregou, possivelmente muito antes de logar)
  // podia já contar como "parado" desde o primeiro render.
  useEffect(() => {
    if (session) registrarAtividade();
  }, [session, registrarAtividade]);

  useEffect(() => {
    if (!session) return;
    const intervalo = setInterval(() => {
      if (Date.now() - ultimaAtividadeRef.current > TEMPO_INATIVIDADE_MS) {
        signOut();
        return;
      }
      // Reaproveita esse polling de 60s pra também pegar uma desativação
      // (supabase/migrations/0017) feita pelo dono enquanto a sessão já
      // estava aberta — sem isso, só cairia no próximo login.
      supabase
        .from('perfis')
        .select('ativo')
        .eq('id', session.user.id)
        .single()
        .then(({ data, error }) => {
          if (!error && data && !data.ativo) {
            signOut();
          }
        });
    }, 60_000);
    return () => clearInterval(intervalo);
  }, [session]);

  // Cobre o caso de o app ficar minimizado (ou o celular bloqueado) tempo
  // demais — sem isso, um app em segundo plano nunca dispara o intervalo
  // acima (timers de JS pausam em background).
  useEffect(() => {
    if (!session) return;
    const assinatura = AppState.addEventListener('change', (proximoEstado) => {
      if (proximoEstado !== 'active') return;
      if (Date.now() - ultimaAtividadeRef.current > TEMPO_INATIVIDADE_MS) {
        signOut();
      } else {
        registrarAtividade();
      }
    });
    return () => assinatura.remove();
  }, [session, registrarAtividade]);

  return (
    <AuthContext.Provider
      value={{ session, meuPapel, meuAluno, loading, signIn, signUp, requestPasswordReset, changePassword, signOut }}
    >
      <View
        style={{ flex: 1 }}
        onStartShouldSetResponderCapture={() => {
          registrarAtividade();
          return false;
        }}
      >
        {children}
      </View>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth precisa ser usado dentro de <AuthProvider>.');
  }
  return ctx;
}
