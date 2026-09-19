import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
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

import { PageHeader } from '../../src/components/PageHeader';
import { PasswordInput } from '../../src/components/PasswordInput';
import { supabase } from '../../src/lib/supabase';
import { colors, fonts, radius, spacing, touchTarget, type } from '../../src/constants/theme';

const REGRAS_SENHA: { chave: string; label: string; cumprida: (senha: string) => boolean }[] = [
  { chave: 'tamanho', label: 'Minimo 8 caracteres', cumprida: (s) => s.length >= 8 },
  { chave: 'maiuscula', label: '1 letra maiuscula', cumprida: (s) => /[A-Z]/.test(s) },
  { chave: 'numero', label: '1 numero', cumprida: (s) => /\d/.test(s) },
  { chave: 'simbolo', label: '1 simbolo', cumprida: (s) => /[^A-Za-z0-9]/.test(s) },
];

function getTextoParam(valor: string | string[] | undefined) {
  if (!valor) return null;
  return Array.isArray(valor) ? valor[0] : valor;
}

// O Supabase (fluxo padrão, sem customizar o template de email) devolve os
// tokens de recuperação como fragmento da URL (#access_token=...), não como
// query string. O expo-router só expõe query string em useLocalSearchParams,
// então o fragmento precisa ser lido e parseado manualmente a partir da URL
// bruta que abriu o app.
function paramsDoFragmento(url: string | null | undefined): Record<string, string> {
  if (!url) return {};
  const [semFragmento, fragmento] = url.split('#');
  const queryString = semFragmento.split('?')[1];
  const params: Record<string, string> = {};
  for (const parte of [queryString, fragmento]) {
    if (!parte) continue;
    new URLSearchParams(parte).forEach((valor, chave) => {
      params[chave] = valor;
    });
  }
  return params;
}

export default function ResetPassword() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [senhaTocada, setSenhaTocada] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [tokenOk, setTokenOk] = useState(false);

  const senhaOk = REGRAS_SENHA.every((regra) => regra.cumprida(novaSenha));
  const senhasIguais = novaSenha.length > 0 && novaSenha === confirmarSenha;

  useEffect(() => {
    let ativo = true;

    async function validarLink() {
      setLoading(true);
      setErro(null);

      let tokenHash = getTextoParam(params.token_hash);
      let tipo = getTextoParam(params.type);
      let accessToken = getTextoParam(params.access_token);
      let refreshToken = getTextoParam(params.refresh_token);
      let erroDescricao =
        getTextoParam(params.error_description) ??
        getTextoParam(params.error_code) ??
        getTextoParam(params.error);

      if (!tokenHash && !accessToken && !erroDescricao) {
        const urlInicial =
          Platform.OS === 'web' && typeof window !== 'undefined'
            ? window.location.href
            : await Linking.getInitialURL();
        let paramsUrl = paramsDoFragmento(urlInicial);

        // Cold start (Linking.getInitialURL) só traz a URL quando o app foi
        // aberto do zero pelo link. Se o app já estava em segundo plano
        // (warm start), a URL chega só pelo evento 'url' — esperamos um
        // pouco por ele antes de desistir.
        if (!paramsUrl.token_hash && !paramsUrl.access_token && !paramsUrl.error && Platform.OS !== 'web') {
          const urlEvento = await new Promise<string | null>((resolve) => {
            const assinatura = Linking.addEventListener('url', ({ url }) => {
              assinatura.remove();
              resolve(url);
            });
            setTimeout(() => {
              assinatura.remove();
              resolve(null);
            }, 1500);
          });
          paramsUrl = paramsDoFragmento(urlEvento);
        }

        tokenHash = paramsUrl.token_hash ?? null;
        tipo = paramsUrl.type ?? null;
        accessToken = paramsUrl.access_token ?? null;
        refreshToken = paramsUrl.refresh_token ?? null;
        erroDescricao = paramsUrl.error_description ?? paramsUrl.error_code ?? paramsUrl.error ?? null;
      }

      try {
        if (tokenHash && tipo === 'recovery') {
          const { error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash });
          if (error) throw error;
          if (ativo) setTokenOk(true);
          return;
        }

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (error) throw error;
          if (ativo) setTokenOk(true);
          return;
        }

        if (erroDescricao) {
          console.error('Link de recuperacao rejeitado pelo Supabase:', erroDescricao);
        }

        if (ativo) {
          setErro(
            erroDescricao
              ? decodeURIComponent(erroDescricao).replace(/\+/g, ' ')
              : 'Link de recuperacao invalido ou expirado. Solicite um novo email.'
          );
        }
      } catch (err) {
        console.error(err);
        if (ativo) setErro('Nao foi possivel validar o link de recuperacao. Solicite um novo email.');
      } finally {
        if (ativo) setLoading(false);
      }
    }

    void validarLink();

    return () => {
      ativo = false;
    };
  }, [params.access_token, params.refresh_token, params.token_hash, params.type]);

  async function salvar() {
    setErro(null);
    setSucesso(null);

    if (!tokenOk) {
      setErro('Link invalido. Solicite um novo email de recuperacao.');
      return;
    }

    if (!senhaOk) {
      setErro('A nova senha nao atende aos criterios minimos.');
      return;
    }

    if (!senhasIguais) {
      setErro('A confirmacao de senha nao confere.');
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    setSubmitting(false);

    if (error) {
      setErro('Nao foi possivel redefinir a senha agora. Tente novamente.');
      return;
    }

    setSucesso('Senha redefinida com sucesso. Voce ja pode entrar com a nova senha.');
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <PageHeader titulo="Redefinir senha" mostrarVoltar={false} mostrarMenu={false} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {loading ? (
          <View style={styles.loadingArea}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[type.body, styles.subtitle]}>Validando link de recuperacao...</Text>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={[type.body, styles.subtitle]}>Digite sua nova senha.</Text>

            <PasswordInput
              testID="reset-input-senha"
              style={styles.input}
              placeholder="Nova senha"
              placeholderTextColor={colors.textMuted}
              value={novaSenha}
              onChangeText={(texto) => {
                setNovaSenha(texto);
                if (!senhaTocada) setSenhaTocada(true);
              }}
            />

            <View style={styles.regrasSenha}>
              {REGRAS_SENHA.map((regra) => {
                const cumprida = regra.cumprida(novaSenha);
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
              testID="reset-input-confirmar-senha"
              style={styles.input}
              placeholder="Confirmar nova senha"
              placeholderTextColor={colors.textMuted}
              value={confirmarSenha}
              onChangeText={setConfirmarSenha}
            />

            {erro ? (
              <Text testID="reset-mensagem-erro" style={styles.error}>
                {erro}
              </Text>
            ) : null}
            {sucesso ? (
              <Text testID="reset-mensagem-sucesso" style={styles.sucesso}>
                {sucesso}
              </Text>
            ) : null}

            <TouchableOpacity
              testID="reset-button-salvar"
              style={[styles.button, (submitting || !tokenOk) && styles.buttonDisabled]}
              onPress={salvar}
              disabled={submitting || !tokenOk}
            >
              {submitting ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.buttonText}>Salvar nova senha</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              testID="reset-button-voltar-login"
              style={styles.loginBotao}
              onPress={() => router.replace('/login')}
            >
              <Text style={[type.body, styles.loginTexto]}>Voltar para o login</Text>
            </TouchableOpacity>
          </View>
        )}
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
  loadingArea: {
    alignItems: 'center',
    gap: spacing.md,
  },
  subtitle: {
    color: colors.textMuted,
    textAlign: 'center',
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
  sucesso: {
    color: colors.present,
    fontFamily: type.label.fontFamily,
    fontSize: type.label.fontSize,
  },
  loginBotao: {
    minHeight: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginTexto: {
    color: colors.primary,
  },
});
