import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuth, type Titular } from '../../src/features/auth/AuthProvider';
import { hojeBR, paraBR, paraISO, temIdadeMinima } from '../../src/lib/dataBR';
import { PageHeader } from '../../src/components/PageHeader';
import { PasswordInput } from '../../src/components/PasswordInput';
import { DateRangePicker } from '../../src/components/DateRangePicker';
import { colors, fonts, radius, spacing, touchTarget, type } from '../../src/constants/theme';

type FilhoForm = { nome: string; dataNascimento: string };

// Versão do texto abaixo — muda só quando o texto muda de verdade, não a
// cada deploy. Vai pra perfis.consentimento_versao (0023) pra saber depois
// qual redação exata a pessoa aceitou, se o texto for revisado no futuro.
const CONSENTIMENTO_VERSAO = '2026-09-20';

const CONSENTIMENTO: Record<Titular, string> = {
  proprio:
    'Confirmo que sou maior de idade e concordo com o uso dos meus dados para acesso ao aplicativo da Escola Schmidt.',
  responsavel:
    'Confirmo que sou responsável legal por um aluno menor de idade e autorizo o uso dos dados dele para acesso ao aplicativo da Escola Schmidt.',
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const REGRAS_SENHA: { chave: string; label: string; cumprida: (senha: string) => boolean }[] = [
  { chave: 'tamanho', label: 'Mínimo 8 caracteres', cumprida: (s) => s.length >= 8 },
  { chave: 'maiuscula', label: '1 letra maiúscula', cumprida: (s) => /[A-Z]/.test(s) },
  { chave: 'numero', label: '1 número', cumprida: (s) => /\d/.test(s) },
  { chave: 'simbolo', label: '1 símbolo', cumprida: (s) => /[^A-Za-z0-9]/.test(s) },
];

export default function Signup() {
  const { signUp } = useAuth();
  const router = useRouter();

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [titular, setTitular] = useState<Titular>('proprio');
  const [aceite, setAceite] = useState(false);
  const [senhaTocada, setSenhaTocada] = useState(false);
  // Opcional: quem escolhe "responsavel" pode listar os filhos aqui mesmo, ou
  // deixar em branco e adicionar depois em Meu perfil — por isso não entra
  // em `podeEnviar`. Sempre 1 campo pronto pra digitar; "+" adiciona mais.
  // Nome e data andam juntos: se um for preenchido, o outro passa a ser
  // exigido no submit (data de nascimento é obrigatória — faixa etária
  // decide categoria de competição).
  const [filhos, setFilhos] = useState<FilhoForm[]>([{ nome: '', dataNascimento: '' }]);
  // Qual campo de data está aberto no momento — índice do filho, 'propria'
  // (a pessoa também é aluno), ou null. Um só picker por vez, mesmo padrão
  // de alunos/novo.tsx.
  const [campoDataAberto, setCampoDataAberto] = useState<number | 'propria' | null>(null);
  // "Aluno-responsavel" (docs/product/alunos-e-responsaveis.md §5.1, caso 2):
  // quem é responsável por filho(s) e também treina na escola precisa marcar
  // isso aqui — sem essa pergunta, o cadastro só criava o(s) filho(s) e
  // nunca um `alunos` pra própria pessoa.
  const [souTambemAluno, setSouTambemAluno] = useState(false);
  const [dataNascimentoPropria, setDataNascimentoPropria] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const nomeValido = nome.trim().length >= 3;
  const emailValido = EMAIL_REGEX.test(email.trim());
  const senhaOk = REGRAS_SENHA.every((regra) => regra.cumprida(senha));
  const senhasIguais = senha.length > 0 && senha === confirmarSenha;
  const podeEnviar = nomeValido && emailValido && senhaOk && senhasIguais && aceite && !submitting;

  function atualizarFilhoNome(indice: number, texto: string) {
    setFilhos((atual) => atual.map((f, i) => (i === indice ? { ...f, nome: texto } : f)));
  }

  function atualizarFilhoData(indice: number, texto: string) {
    setFilhos((atual) => atual.map((f, i) => (i === indice ? { ...f, dataNascimento: texto } : f)));
  }

  function adicionarCampoFilho() {
    setFilhos((atual) => [...atual, { nome: '', dataNascimento: '' }]);
  }

  function removerCampoFilho(indice: number) {
    setFilhos((atual) =>
      atual.length > 1 ? atual.filter((_, i) => i !== indice) : [{ nome: '', dataNascimento: '' }]
    );
  }

  async function handleSubmit() {
    setError(null);
    if (!podeEnviar) return;

    // Linha em branco (nem nome nem data) é ignorada — a lista de filhos
    // continua opcional como um todo. Mas quem preenche nome ou data precisa
    // preencher os dois: data de nascimento é obrigatória (faixa etária
    // decide categoria de competição), não dá pra cadastrar um filho sem ela.
    const filhosPreenchidos =
      titular === 'responsavel' ? filhos.filter((f) => f.nome.trim() || f.dataNascimento.trim()) : [];

    for (const f of filhosPreenchidos) {
      if (!f.nome.trim()) {
        setError('Informe o nome de cada filho preenchido.');
        return;
      }
      if (!paraISO(f.dataNascimento)) {
        setError('Informe a data de nascimento de cada filho preenchido.');
        return;
      }
      if (!temIdadeMinima(paraISO(f.dataNascimento)!)) {
        setError('Cada aluno precisa ter pelo menos 3 anos completos para ser matriculado.');
        return;
      }
    }

    if (titular === 'responsavel' && souTambemAluno && !paraISO(dataNascimentoPropria)) {
      setError('Informe sua data de nascimento.');
      return;
    }
    if (titular === 'responsavel' && souTambemAluno && !temIdadeMinima(paraISO(dataNascimentoPropria)!)) {
      setError('O aluno precisa ter pelo menos 3 anos completos para ser matriculado.');
      return;
    }

    const filhosValidos = filhosPreenchidos.map((f) => ({
      nome: f.nome.trim(),
      dataNascimento: paraISO(f.dataNascimento)!,
    }));

    // Marcar "eu também sou aluno" cria um `alunos` pra própria pessoa do
    // mesmo jeito que um filho — mesma trigger (0038/0039), sem tratamento
    // especial: um item nessa lista é só "mais um aluno pra vincular a essa
    // conta", não importa se é a própria pessoa ou um filho dela.
    const alunosParaEnviar =
      titular === 'responsavel' && souTambemAluno
        ? [{ nome: nome.trim(), dataNascimento: paraISO(dataNascimentoPropria)! }, ...filhosValidos]
        : filhosValidos;

    setSubmitting(true);
    const { error: signUpError } = await signUp(
      nome.trim(),
      email.trim(),
      senha,
      titular,
      CONSENTIMENTO_VERSAO,
      alunosParaEnviar
    );
    setSubmitting(false);

    if (signUpError) {
      setError(signUpError);
      return;
    }
    setEnviado(true);
  }

  if (enviado) {
    return (
      <>
        <PageHeader titulo="Escola Schmidt" mostrarVoltar={false} mostrarMenu={false} />
        <View style={styles.container}>
          <Text style={type.title}>Cadastro enviado</Text>
          <Text style={[type.body, styles.subtitle]}>
            Confira seu email para confirmar a conta. Depois disso, é só entrar normalmente.
          </Text>
          <TouchableOpacity
            testID="signup-sucesso-voltar-login"
            style={styles.button}
            onPress={() => router.replace('/login')}
          >
            <Text style={styles.buttonText}>Voltar para o login</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <PageHeader titulo="Escola Schmidt" mostrarMenu={false} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={[type.body, styles.subtitle]}>Criar conta</Text>

        <View style={styles.form}>
          <TextInput
            testID="signup-input-nome"
            style={styles.input}
            placeholder="Nome completo"
            placeholderTextColor={colors.textMuted}
            value={nome}
            onChangeText={setNome}
          />
          <TextInput
            testID="signup-input-email"
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <PasswordInput
            testID="signup-input-senha"
            style={styles.input}
            placeholder="Senha"
            placeholderTextColor={colors.textMuted}
            value={senha}
            onChangeText={(texto) => {
              setSenha(texto);
              if (!senhaTocada) setSenhaTocada(true);
            }}
          />
          <View style={styles.regrasSenha}>
            {REGRAS_SENHA.map((regra) => {
              const cumprida = regra.cumprida(senha);
              const cor = !senhaTocada ? colors.textMuted : cumprida ? colors.present : colors.danger;
              return (
                <Text key={regra.chave} style={[styles.regraSenha, { color: cor }]}>
                  {senhaTocada && cumprida ? '✓ ' : '• '}
                  {regra.label}
                </Text>
              );
            })}
          </View>
          <PasswordInput
            testID="signup-input-confirmar-senha"
            style={styles.input}
            placeholder="Confirmar senha"
            placeholderTextColor={colors.textMuted}
            value={confirmarSenha}
            onChangeText={setConfirmarSenha}
          />
          {confirmarSenha.length > 0 && !senhasIguais ? (
            <Text testID="signup-erro-senhas-diferentes" style={[type.caption, styles.erroCampo]}>
              As senhas não coincidem.
            </Text>
          ) : null}

          <Text style={[type.label, styles.rotulo]}>Este cadastro é para</Text>
          <View style={styles.opcoes}>
            <TouchableOpacity
              testID="signup-titular-proprio"
              style={[styles.opcao, titular === 'proprio' && styles.opcaoAtiva]}
              onPress={() => setTitular('proprio')}
              accessibilityRole="button"
              accessibilityState={{ selected: titular === 'proprio' }}
            >
              <Text style={[styles.opcaoTexto, titular === 'proprio' && styles.opcaoTextoAtivo]}>
                Mim mesmo (maior de idade)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="signup-titular-responsavel"
              style={[styles.opcao, titular === 'responsavel' && styles.opcaoAtiva]}
              onPress={() => setTitular('responsavel')}
              accessibilityRole="button"
              accessibilityState={{ selected: titular === 'responsavel' }}
            >
              <Text style={[styles.opcaoTexto, titular === 'responsavel' && styles.opcaoTextoAtivo]}>
                Meu filho(a), menor de idade
              </Text>
            </TouchableOpacity>
          </View>

          {titular === 'responsavel' ? (
            <TouchableOpacity
              testID="signup-sou-tambem-aluno"
              style={styles.consentimento}
              onPress={() => setSouTambemAluno((atual) => !atual)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: souTambemAluno }}
            >
              <View style={[styles.checkbox, souTambemAluno && styles.checkboxMarcado]}>
                {souTambemAluno ? <Text style={styles.checkboxMarca}>✓</Text> : null}
              </View>
              <Text style={[type.caption, styles.consentimentoTexto]}>
                Eu também sou aluno(a) matriculado(a) na escola, além de responsável pelo(s) filho(s) abaixo.
              </Text>
            </TouchableOpacity>
          ) : null}

          {titular === 'responsavel' && souTambemAluno ? (
            <View style={styles.filhosWrap}>
              <Text style={[type.label, styles.rotulo]}>Sua data de nascimento</Text>
              <TouchableOpacity
                testID="signup-data-propria"
                style={styles.dataBotao}
                onPress={() => setCampoDataAberto((atual) => (atual === 'propria' ? null : 'propria'))}
              >
                <Text style={dataNascimentoPropria ? styles.dataBotaoTexto : styles.dataBotaoPlaceholder}>
                  {dataNascimentoPropria || 'Selecionar data'}
                </Text>
              </TouchableOpacity>
              {campoDataAberto === 'propria' ? (
                <DateRangePicker
                  apenasUmDia
                  inicioISO={paraISO(dataNascimentoPropria) ?? paraISO(hojeBR())!}
                  fimISO={paraISO(dataNascimentoPropria) ?? paraISO(hojeBR())!}
                  onConfirmar={(iso) => {
                    setDataNascimentoPropria(paraBR(iso));
                    setCampoDataAberto(null);
                  }}
                  onFechar={() => setCampoDataAberto(null)}
                />
              ) : null}
            </View>
          ) : null}

          {titular === 'responsavel' ? (
            <View style={styles.filhosWrap}>
              <Text style={[type.label, styles.rotulo]}>Filho(s) (opcional)</Text>
              <Text style={[type.caption, styles.filhosAjuda]}>
                Pode preencher agora ou deixar em branco e adicionar depois em Meu perfil. Quem preencher o nome
                precisa preencher a data de nascimento também.
              </Text>
              {filhos.map((filho, indice) => (
                <View key={indice} style={styles.filhoLinha}>
                  <View style={styles.filhoCampos}>
                    <TextInput
                      testID={`signup-filho-nome-${indice}`}
                      style={[styles.input, styles.filhoInput]}
                      placeholder="Nome do filho(a)"
                      placeholderTextColor={colors.textMuted}
                      value={filho.nome}
                      onChangeText={(texto) => atualizarFilhoNome(indice, texto)}
                      autoCapitalize="words"
                    />
                    <TouchableOpacity
                      testID={`signup-filho-data-${indice}`}
                      style={styles.dataBotao}
                      onPress={() => setCampoDataAberto((atual) => (atual === indice ? null : indice))}
                    >
                      <Text style={filho.dataNascimento ? styles.dataBotaoTexto : styles.dataBotaoPlaceholder}>
                        {filho.dataNascimento || 'Data de nascimento'}
                      </Text>
                    </TouchableOpacity>
                    {campoDataAberto === indice ? (
                      <DateRangePicker
                        apenasUmDia
                        inicioISO={paraISO(filho.dataNascimento) ?? paraISO(hojeBR())!}
                        fimISO={paraISO(filho.dataNascimento) ?? paraISO(hojeBR())!}
                        onConfirmar={(iso) => {
                          atualizarFilhoData(indice, paraBR(iso));
                          setCampoDataAberto(null);
                        }}
                        onFechar={() => setCampoDataAberto(null)}
                      />
                    ) : null}
                  </View>
                  <TouchableOpacity
                    testID={`signup-filho-remover-${indice}`}
                    style={styles.filhoRemover}
                    onPress={() => removerCampoFilho(indice)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.filhoRemoverTexto}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                testID="signup-filho-adicionar"
                style={styles.filhoAdicionar}
                onPress={adicionarCampoFilho}
              >
                <Text style={styles.filhoAdicionarTexto}>+ Adicionar outro filho</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <TouchableOpacity
            testID="signup-consentimento-checkbox"
            style={styles.consentimento}
            onPress={() => setAceite((a) => !a)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: aceite }}
          >
            <View style={[styles.checkbox, aceite && styles.checkboxMarcado]}>
              {aceite ? <Text style={styles.checkboxMarca}>✓</Text> : null}
            </View>
            <Text style={[type.caption, styles.consentimentoTexto]}>{CONSENTIMENTO[titular]}</Text>
          </TouchableOpacity>

          {error ? (
            <Text testID="signup-mensagem-erro" style={[type.body, styles.error]}>
              {error}
            </Text>
          ) : null}

          <TouchableOpacity
            testID="signup-button-criar-conta"
            style={[styles.button, !podeEnviar && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={!podeEnviar}
          >
            {submitting ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.buttonText}>Criar conta</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            testID="signup-button-ja-tenho-conta"
            style={styles.voltarBotao}
            onPress={() => router.replace('/login')}
          >
            <Text style={[type.body, styles.voltarTexto]}>Já tenho conta — entrar</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    backgroundColor: colors.background,
  },
  subtitle: {
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  form: {
    gap: spacing.md,
  },
  input: {
    height: touchTarget,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
    color: colors.text,
  },
  regrasSenha: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.xs,
  },
  regraSenha: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    lineHeight: 20,
  },
  erroCampo: {
    color: colors.danger,
    marginTop: -spacing.xs,
  },
  rotulo: {
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  opcoes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  opcao: {
    minHeight: touchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  opcaoAtiva: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  opcaoTexto: {
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
    color: colors.text,
  },
  opcaoTextoAtivo: {
    color: colors.onPrimary,
  },
  filhosWrap: {
    gap: spacing.xs,
  },
  filhosAjuda: {
    color: colors.textMuted,
  },
  filhoLinha: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  filhoCampos: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  filhoInput: {
    width: '100%',
  },
  filhoRemover: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dataBotao: {
    height: touchTarget,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
  },
  dataBotaoTexto: {
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
    color: colors.text,
  },
  dataBotaoPlaceholder: {
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
    color: colors.textMuted,
  },
  filhoRemoverTexto: {
    fontSize: 22,
    color: colors.textMuted,
  },
  filhoAdicionar: {
    minHeight: touchTarget,
    justifyContent: 'center',
  },
  filhoAdicionarTexto: {
    color: colors.primary,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
  consentimento: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxMarcado: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxMarca: {
    color: colors.onPrimary,
    fontSize: 14,
  },
  consentimentoTexto: {
    flex: 1,
    color: colors.textMuted,
  },
  error: {
    color: colors.danger,
  },
  button: {
    height: touchTarget,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.onPrimary,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
  voltarBotao: {
    minHeight: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voltarTexto: {
    color: colors.primary,
  },
});
