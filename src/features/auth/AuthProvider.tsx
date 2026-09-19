import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import * as Linking from 'expo-linking';
import { AppState, Platform, View } from 'react-native';

import { supabase } from '../../lib/supabase';

// Tablet na recepção fica logado o dia inteiro sem ninguém tocar — 30 min
// parado desloga sozinho, tanto com o app aberto (sem toque na tela) quanto
// voltando de segundo plano depois de tempo demais fora.
const TEMPO_INATIVIDADE_MS = 30 * 60 * 1000;

export type Papel = 'dono' | 'professor' | 'aluno';

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
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (nome: string, email: string, password: string) => Promise<{ error: string | null }>;
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

  // Só pra UI (esconder controles de quem não pode usá-los) — a barreira de
  // verdade continua sendo a RLS, que já bloqueia escrita por papel.
  useEffect(() => {
    if (!session?.user.id) {
      setMeuPapel(null);
      return;
    }
    let ativo = true;
    supabase
      .from('perfis')
      .select('papel')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        if (!ativo) return;
        if (error) {
          console.error(error);
          setMeuPapel(null);
          return;
        }
        setMeuPapel(data.papel as Papel);
      });
    return () => {
      ativo = false;
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

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  // Mensagem sempre genérica, mesmo em caso de erro: o Supabase já evita
  // confirmar se um email está cadastrado, e não queremos reabrir essa
  // brecha aqui devolvendo o motivo real do erro pra tela.
  async function signUp(nome: string, email: string, password: string) {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { nome } },
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
    await supabase.auth.signOut({ scope: 'global' });
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
      }
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
