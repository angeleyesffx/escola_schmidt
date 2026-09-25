import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import { useAuth } from '../../src/features/auth/AuthProvider';
import { lerUltimoEmailLembrado } from '../../src/lib/rememberMeStorage';
import { PageHeader } from '../../src/components/PageHeader';
import { Footer } from '../../src/components/Footer';
import { PasswordInput } from '../../src/components/PasswordInput';
import { colors, radius, spacing, touchTarget, type } from '../../src/constants/theme';

export default function Login() {
  const { signIn, requestPasswordReset } = useAuth();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const larguraFormulario = Math.min(Math.max(width - spacing.xl * 2, 280), 620);
  const emTelaPequena = width < 480;
  const emPaisagemCelular = width > height && width < 980;
  const emTelaBaixa = height < 760;
  const modoCompacto = emTelaPequena || emPaisagemCelular || emTelaBaixa;
  const tamanhoLogo = modoCompacto ? 220 : 320;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [lembrar, setLembrar] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  // Pré-preenche com o e-mail do último login com "lembrar de mim" marcado —
  // sem isso, o checkbox só mantinha a sessão, não a conveniência de digitar
  // o e-mail de novo.
  useEffect(() => {
    let ativo = true;
    lerUltimoEmailLembrado().then((ultimoEmail) => {
      if (ativo && ultimoEmail) setEmail(ultimoEmail);
    });
    return () => {
      ativo = false;
    };
  }, []);

  async function handleSubmit() {
    setError(null);
    setResetMessage(null);
    setSubmitting(true);
    const { error: signInError } = await signIn(email.trim(), password, lembrar);
    setSubmitting(false);
    if (signInError) {
      setError('Email ou senha incorretos.');
    }
  }

  async function handleForgotPassword() {
    setError(null);
    setResetMessage(null);

    if (!emailValido) {
      setError('Informe um email válido para recuperar a senha.');
      return;
    }

    setResetSubmitting(true);
    const { error: resetError } = await requestPasswordReset(email.trim());
    setResetSubmitting(false);

    if (resetError) {
      setError('Não foi possível iniciar a recuperação de senha agora. Tente novamente.');
      return;
    }

    setResetMessage('Se o email estiver cadastrado, você receberá as instruções de recuperação.');
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <PageHeader titulo="Escola Schmidt" mostrarVoltar={false} mostrarMenu={false} />
      <ScrollView
        contentContainerStyle={[styles.container, modoCompacto && styles.containerCompacto]}
        keyboardShouldPersistTaps="handled"
      >
        <Image source={require('../../assets/logo.png')} style={[styles.logo, { height: tamanhoLogo }]} />
        <View style={[styles.form, { width: larguraFormulario }] }>
          <TextInput
            testID="login-input-email"
            style={styles.input}
            placeholder="Entre com sua conta"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <PasswordInput
            testID="login-input-senha"
            style={styles.input}
            placeholder="Senha"
            placeholderTextColor={colors.textMuted}
            autoComplete="password"
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity
            testID="login-checkbox-lembrar"
            style={styles.lembrarLinha}
            onPress={() => setLembrar((atual) => !atual)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: lembrar }}
          >
            <View style={[styles.checkbox, lembrar && styles.checkboxMarcado]}>
              {lembrar ? <Text style={styles.checkboxMarca}>✓</Text> : null}
            </View>
            <Text style={[type.body, styles.lembrarTexto]}>Lembrar de mim</Text>
          </TouchableOpacity>

          {error ? (
            <Text testID="login-mensagem-erro" style={styles.error}>
              {error}
            </Text>
          ) : null}
          {resetMessage ? (
            <Text testID="login-mensagem-sucesso" style={styles.sucesso}>
              {resetMessage}
            </Text>
          ) : null}

          <TouchableOpacity
            testID="login-button-entrar"
            style={[styles.button, (submitting || !email || !password) && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={submitting || !email || !password}
          >
            {submitting ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.buttonText}>Entrar</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            testID="login-button-esqueci-senha"
            style={styles.recuperarBotao}
            onPress={handleForgotPassword}
            disabled={resetSubmitting}
          >
            {resetSubmitting ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={[type.body, styles.recuperarTexto]}>Esqueci minha senha</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            testID="login-button-cadastro"
            style={styles.cadastroBotao}
            onPress={() => router.push('/signup')}
          >
            <Text style={[type.body, styles.cadastroTexto]}>Ainda não tem conta? Cadastre-se</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <Footer />
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
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    backgroundColor: colors.background,
  },
  containerCompacto: {
    justifyContent: 'flex-start',
    paddingTop: spacing.md,
  },
  logo: {
    resizeMode: 'contain',
    alignSelf: 'center',
    aspectRatio: 84 / 136,
    marginTop: spacing.sm,
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
  lembrarLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: touchTarget,
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
  },
  checkboxMarcado: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxMarca: {
    color: colors.onPrimary,
    fontSize: 14,
  },
  lembrarTexto: {
    color: colors.text,
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
  error: {
    color: colors.danger,
    fontFamily: type.label.fontFamily,
    fontSize: type.label.fontSize,
  },
  cadastroBotao: {
    minHeight: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recuperarBotao: {
    minHeight: touchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: colors.surfaceTint,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  recuperarTexto: {
    color: colors.primary,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.label.fontSize,
  },
  cadastroTexto: {
    color: colors.primary,
  },
  sucesso: {
    color: colors.present,
    fontFamily: type.label.fontFamily,
    fontSize: type.label.fontSize,
  },
});
