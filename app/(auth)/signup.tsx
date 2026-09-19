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

import { useAuth } from '../../src/features/auth/AuthProvider';
import { PageHeader } from '../../src/components/PageHeader';
import { PasswordInput } from '../../src/components/PasswordInput';
import { colors, fonts, radius, spacing, touchTarget, type } from '../../src/constants/theme';

type Titular = 'proprio' | 'responsavel';

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

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const nomeValido = nome.trim().length >= 3;
  const emailValido = EMAIL_REGEX.test(email.trim());
  const senhaOk = REGRAS_SENHA.every((regra) => regra.cumprida(senha));
  const senhasIguais = senha.length > 0 && senha === confirmarSenha;
  const podeEnviar = nomeValido && emailValido && senhaOk && senhasIguais && aceite && !submitting;

  async function handleSubmit() {
    setError(null);
    if (!podeEnviar) return;

    setSubmitting(true);
    const { error: signUpError } = await signUp(nome.trim(), email.trim(), senha);
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
            >
              <Text style={[styles.opcaoTexto, titular === 'proprio' && styles.opcaoTextoAtivo]}>
                Mim mesmo (maior de idade)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="signup-titular-responsavel"
              style={[styles.opcao, titular === 'responsavel' && styles.opcaoAtiva]}
              onPress={() => setTitular('responsavel')}
            >
              <Text style={[styles.opcaoTexto, titular === 'responsavel' && styles.opcaoTextoAtivo]}>
                Meu filho(a), menor de idade
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            testID="signup-consentimento-checkbox"
            style={styles.consentimento}
            onPress={() => setAceite((a) => !a)}
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
