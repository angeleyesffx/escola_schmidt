import { Redirect, useRouter } from 'expo-router';
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

import { convidarUsuario } from '../../../src/features/usuarios/api';
import { useAuth, type Papel } from '../../../src/features/auth/AuthProvider';
import { PageHeader } from '../../../src/components/PageHeader';
import { Footer } from '../../../src/components/Footer';
import { Chip } from '../../../src/components/Chip';
import { colors, radius, spacing, touchTarget, type } from '../../../src/constants/theme';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PAPEIS: { valor: Papel; label: string }[] = [
  { valor: 'aluno', label: 'Aluno' },
  { valor: 'professor', label: 'Professor(a)' },
  { valor: 'dono', label: 'Dono' },
];

export default function NovoUsuario() {
  const router = useRouter();
  const { meuPapel } = useAuth();

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [papel, setPapel] = useState<Papel>('aluno');
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Professor convida equipe e alunos, mas nunca um dono — mesma trava
  // aplicada de novo na Edge Function (supabase/functions/convidar-usuario).
  const papeisDisponiveis = meuPapel === 'professor' ? PAPEIS.filter((p) => p.valor !== 'dono') : PAPEIS;

  async function enviarConvite() {
    setError(null);

    if (!nome.trim()) {
      setError('Informe o nome do usuário.');
      return;
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      setError('Informe um email válido.');
      return;
    }

    setSubmitting(true);
    try {
      await convidarUsuario(email.trim(), nome.trim(), papel);
      setEnviado(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar o convite.');
    } finally {
      setSubmitting(false);
    }
  }

  if (meuPapel !== 'dono' && meuPapel !== 'professor') {
    return <Redirect href="/" />;
  }

  if (enviado) {
    return (
      <>
        <PageHeader titulo="Convidar usuário" />
        <View style={styles.container}>
          <Text style={type.title}>Convite enviado</Text>
          <Text style={[type.body, styles.subtitle]}>
            {nome.trim()} vai receber um email para criar a própria senha e acessar o app como{' '}
            {PAPEIS.find((p) => p.valor === papel)?.label.toLowerCase()}.
          </Text>
          <TouchableOpacity
            testID="usuarios-convite-voltar"
            style={styles.salvarBotao}
            onPress={() => router.back()}
          >
            <Text style={styles.salvarBotaoTexto}>Voltar</Text>
          </TouchableOpacity>
        </View>
        <Footer />
      </>
    );
  }

  return (
    <>
      <PageHeader titulo="Convidar usuário" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={[type.label, styles.rotulo]}>Nome</Text>
          <TextInput
            testID="usuarios-input-nome"
            style={styles.input}
            value={nome}
            onChangeText={setNome}
            placeholder="Nome completo"
          />

          <Text style={[type.label, styles.rotulo]}>Email</Text>
          <TextInput
            testID="usuarios-input-email"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="email@exemplo.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
          />

          <Text style={[type.label, styles.rotulo]}>Papel</Text>
          <View style={styles.chips}>
            {papeisDisponiveis.map((p) => (
              <Chip key={p.valor} label={p.label} active={papel === p.valor} onPress={() => setPapel(p.valor)} />
            ))}
          </View>

          {error ? (
            <Text testID="usuarios-mensagem-erro" style={[type.body, styles.error]}>
              {error}
            </Text>
          ) : null}

          <TouchableOpacity
            testID="usuarios-botao-enviar-convite"
            style={[styles.salvarBotao, submitting && styles.salvarBotaoDesabilitado]}
            onPress={enviarConvite}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.salvarBotaoTexto}>Enviar convite</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
      <Footer />
    </>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  subtitle: {
    color: colors.textMuted,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  rotulo: {
    color: colors.textMuted,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  error: {
    color: colors.danger,
    marginTop: spacing.lg,
  },
  salvarBotao: {
    height: touchTarget,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  salvarBotaoDesabilitado: {
    opacity: 0.6,
  },
  salvarBotaoTexto: {
    color: colors.onPrimary,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
});
