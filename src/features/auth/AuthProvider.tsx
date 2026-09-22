import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import * as Linking from 'expo-linking';
import { AppState, Platform, View } from 'react-native';

import { supabase } from '../../lib/supabase';
import { definirLembrarLogin, salvarUltimoEmailLembrado } from '../../lib/rememberMeStorage';

// Tablet na recepção fica logado o dia inteiro sem ninguém tocar — 30 min
// parado desloga sozinho, tanto com o app aberto (sem toque na tela) quanto
// voltando de segundo plano depois de tempo demais fora.
const TEMPO_INATIVIDADE_MS = 30 * 60 * 1000;

export type Papel = 'dono' | 'professor' | 'aluno' | 'responsavel';

export type Titular = 'proprio' | 'responsavel';

export type MeuAluno = {
  id: string;
  nome: string;
  modulo: number;
  data_nascimento: string | null;
  responsavel_nome: string | null;
  responsavel_telefone: string | null;
};

// Vínculo criado por e-mail (0020/0033) mas ainda não confirmado por quem
// recebeu (0037) — só id/nome, o mínimo pra perguntar "você é responsável
// por [nome]?" sem expor o resto da ficha antes da confirmação.
export type VinculoPendente = {
  id: string;
  nome: string;
};

type AuthContextValue = {
  session: Session | null;
  meuPapel: Papel | null;
  // Lista, não objeto único: uma conta pode estar vinculada a mais de um
  // aluno (responsável por vários filhos, ou aluno adulto que também é
  // responsável por outro filho — supabase/migrations/0033). A maioria das
  // telas trata o caso comum (0 ou 1) sem UI extra e só mostra um seletor
  // quando `meusAlunos.length > 1`.
  meusAlunos: MeuAluno[];
  // Distingue "ainda buscando" de "buscou e não achou vínculo nenhum" — sem
  // isso, uma tela que faz `if (meusAlunos.length === 0) <spinner>` nunca sai
  // do carregando pra quem se cadastrou mas ainda não foi vinculado a um
  // aluno (loading infinito).
  meusAlunosCarregado: boolean;
  // Vínculos por e-mail que ainda esperam confirmação (0037) — app/(app)/
  // _layout.tsx redireciona pra tela de confirmação enquanto essa lista não
  // estiver vazia.
  vinculosPendentes: VinculoPendente[];
  vinculosPendentesCarregado: boolean;
  confirmarVinculo: (alunoId: string) => Promise<{ error: string | null }>;
  recusarVinculo: (alunoId: string) => Promise<{ error: string | null }>;
  // Adiciona um filho à própria conta a qualquer momento (não só no
  // cadastro) — supabase/migrations/0038/0039. Vínculo nasce confirmado (é a
  // própria conta se auto-vinculando ao nome que ela mesma digitou).
  // dataNascimento em formato ISO (AAAA-MM-DD) — obrigatória (0039): faixa
  // etária decide categoria de competição, não só módulo.
  adicionarFilho: (nome: string, dataNascimento: string) => Promise<{ error: string | null }>;
  loading: boolean;
  signIn: (email: string, password: string, lembrar?: boolean) => Promise<{ error: string | null }>;
  signUp: (
    nome: string,
    email: string,
    password: string,
    titular: Titular,
    consentimentoVersao: string,
    // Só relevante quando titular === 'responsavel'; nome e dataNascimento já
    // devem chegar validados (sem espaço nas pontas, sem entradas vazias,
    // data ISO) — signup.tsx filtra antes de chamar (mesma convenção de
    // `nome.trim()` já usada aqui). Opcional: quem preferir cadastra os
    // filhos depois, via adicionarFilho.
    filhos?: { nome: string; dataNascimento: string }[]
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
  const [meusAlunos, setMeusAlunos] = useState<MeuAluno[]>([]);
  const [meusAlunosCarregado, setMeusAlunosCarregado] = useState(false);
  const [vinculosPendentes, setVinculosPendentes] = useState<VinculoPendente[]>([]);
  const [vinculosPendentesCarregado, setVinculosPendentesCarregado] = useState(false);
  const [loading, setLoading] = useState(true);

  const buscarVinculosPendentes = useCallback(async () => {
    if (!session?.user.id) {
      setVinculosPendentes([]);
      setVinculosPendentesCarregado(true);
      return;
    }
    const { data, error } = await supabase.rpc('meus_vinculos_pendentes');
    if (error) {
      console.error(error);
      setVinculosPendentes([]);
    } else {
      setVinculosPendentes((data ?? []) as VinculoPendente[]);
    }
    setVinculosPendentesCarregado(true);
  }, [session?.user.id]);

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

  // Alimenta a tela "Meu perfil", as travas de autocheckin e o card de
  // evolução na Home — busca por vínculo (`perfil_id`), não por papel: desde
  // 0033, uma conta de qualquer papel pode ter 0, 1 ou vários alunos
  // vinculados (o próprio treino da pessoa, e/ou os filhos dela). Desde
  // 0037, a RLS só devolve os já confirmados — um vínculo pendente não
  // aparece aqui até passar por confirmarVinculo.
  const buscarMeusAlunos = useCallback(async () => {
    if (!session?.user.id) {
      setMeusAlunos([]);
      setMeusAlunosCarregado(true);
      return;
    }
    setMeusAlunosCarregado(false);
    const { data, error } = await supabase
      .from('alunos')
      .select('id, nome, modulo, data_nascimento, responsavel_nome, responsavel_telefone')
      .eq('perfil_id', session.user.id)
      .order('nome');
    if (error) {
      console.error(error);
      setMeusAlunos([]);
    } else {
      setMeusAlunos((data ?? []) as MeuAluno[]);
    }
    setMeusAlunosCarregado(true);
  }, [session?.user.id]);

  useEffect(() => {
    void buscarMeusAlunos();
  }, [buscarMeusAlunos]);

  useEffect(() => {
    void buscarVinculosPendentes();
  }, [buscarVinculosPendentes]);

  // Chamadas pela tela de confirmação de vínculo (0037): depois de
  // confirmar/recusar, atualiza as duas listas — o aluno sai de
  // vinculosPendentes e, se confirmado, passa a aparecer em meusAlunos.
  async function confirmarVinculo(alunoId: string) {
    const { error } = await supabase.rpc('confirmar_meu_vinculo', { p_aluno_id: alunoId });
    if (error) {
      return { error: error.message };
    }
    await Promise.all([buscarVinculosPendentes(), buscarMeusAlunos()]);
    return { error: null };
  }

  async function recusarVinculo(alunoId: string) {
    const { error } = await supabase.rpc('recusar_meu_vinculo', { p_aluno_id: alunoId });
    if (error) {
      return { error: error.message };
    }
    await buscarVinculosPendentes();
    return { error: null };
  }

  async function adicionarFilho(nome: string, dataNascimento: string) {
    const { error } = await supabase.rpc('adicionar_meu_filho', {
      p_nome: nome,
      p_data_nascimento: dataNascimento,
    });
    if (error) {
      return { error: error.message };
    }
    await buscarMeusAlunos();
    return { error: null };
  }

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
    // derrubar depois no próximo tick do polling de inatividade. Falha
    // fechado: se essa checagem não puder ser confirmada (erro de rede logo
    // após autenticar), não deixamos passar só porque a query falhou — uma
    // instabilidade transitória não pode virar bypass do bloqueio.
    const usuarioId = data?.user?.id;
    if (usuarioId) {
      const { data: perfil, error: perfilError } = await supabase
        .from('perfis')
        .select('ativo')
        .eq('id', usuarioId)
        .single();
      if (perfilError) {
        await signOut();
        return { error: 'Não foi possível confirmar sua conta agora. Tente novamente em instantes.' };
      }
      if (perfil && !perfil.ativo) {
        await signOut();
        return { error: 'Sua conta foi desativada. Fale com a administração da escola.' };
      }
    }

    // Só grava o "lembrar-me" depois de confirmar que a conta está ativa —
    // senão, numa conta desativada, o e-mail dela fica pré-preenchido no
    // próximo login de outra pessoa no mesmo tablet compartilhado.
    await salvarUltimoEmailLembrado(email, lembrar);

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
    consentimentoVersao: string,
    filhos: { nome: string; dataNascimento: string }[] = []
  ) {
    try {
      // titular, consentimento_versao e filhos viram raw_user_meta_data e são
      // lidos por cria_perfil_novo_usuario() (0038/0039) na mesma transação
      // que cria a linha em perfis — não existe um segundo passo de "salvar
      // depois". `filhos` só entra no payload quando não vazio, pra não mudar
      // o formato de metadata de quem não usa esse caminho. Chave em
      // snake_case (data_nascimento) porque é isso que a trigger em SQL lê.
      const data: Record<string, unknown> = { nome, titular, consentimento_versao: consentimentoVersao };
      if (filhos.length > 0) {
        data.filhos = filhos.map((f) => ({ nome: f.nome, data_nascimento: f.dataNascimento }));
      }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data },
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
      value={{
        session,
        meuPapel,
        meusAlunos,
        meusAlunosCarregado,
        vinculosPendentes,
        vinculosPendentesCarregado,
        confirmarVinculo,
        recusarVinculo,
        adicionarFilho,
        loading,
        signIn,
        signUp,
        requestPasswordReset,
        changePassword,
        signOut,
      }}
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
