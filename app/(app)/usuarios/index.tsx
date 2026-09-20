import { Redirect, useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { getUsuarios } from '../../../src/features/usuarios/api';
import { useAuth } from '../../../src/features/auth/AuthProvider';
import { useAsyncData } from '../../../src/hooks/useAsyncData';
import { PageHeader } from '../../../src/components/PageHeader';
import { Footer } from '../../../src/components/Footer';
import { colors, radius, spacing, touchTarget, type } from '../../../src/constants/theme';

const ROTULO_PAPEL: Record<string, string> = {
  dono: 'Dono',
  professor: 'Professor(a)',
  aluno: 'Aluno',
};

export default function UsuariosIndex() {
  const router = useRouter();
  const { meuPapel } = useAuth();

  const { data, loading, error } = useAsyncData(getUsuarios, [], {
    onFocus: true,
    mensagemErro: 'Erro ao carregar usuários. Tente novamente.',
  });
  const usuarios = data ?? [];

  // Igual às outras telas de gestão (alunos/index.tsx): a barreira de
  // verdade é a RLS (perfil_dono_gerencia, supabase/migrations/0017) — isto
  // aqui só evita mostrar a tela pra quem não pode usá-la.
  if (meuPapel !== 'dono') {
    return <Redirect href="/" />;
  }

  if (loading) {
    return (
      <>
        <PageHeader titulo="Usuários" />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </>
    );
  }

  return (
    <>
      <PageHeader titulo="Usuários" />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={[type.body, styles.subtitle]}>{usuarios.length} cadastrados</Text>
          <TouchableOpacity
            testID="usuarios-botao-convidar"
            style={styles.novoBotao}
            onPress={() => router.push('/usuarios/novo')}
          >
            <Text style={styles.novoBotaoTexto}>+ Convidar</Text>
          </TouchableOpacity>
        </View>

        {error ? <Text style={[type.body, styles.error]}>{error}</Text> : null}

        {usuarios.length === 0 ? (
          <Text style={[type.body, styles.subtitle, styles.vazio]}>Nenhum usuário cadastrado ainda.</Text>
        ) : (
          <View style={styles.list}>
            {usuarios.map((usuario) => (
              <TouchableOpacity
                key={usuario.id}
                testID={`usuarios-linha-${usuario.id}`}
                style={styles.card}
                onPress={() => router.push(`/usuarios/${usuario.id}`)}
              >
                <Text style={type.subtitle} numberOfLines={1}>
                  {usuario.nome}
                </Text>
                <Text style={[type.body, styles.cardSubtitle]}>
                  {ROTULO_PAPEL[usuario.papel] ?? usuario.papel}
                  {!usuario.ativo ? ' · Inativo' : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
      <Footer />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subtitle: {
    color: colors.textMuted,
  },
  error: {
    color: colors.danger,
    marginTop: spacing.sm,
  },
  vazio: {
    marginTop: spacing.lg,
  },
  novoBotao: {
    height: touchTarget,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  novoBotaoTexto: {
    color: colors.onPrimary,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
  list: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  card: {
    minHeight: touchTarget,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    justifyContent: 'center',
  },
  cardSubtitle: {
    color: colors.textMuted,
    marginTop: 2,
  },
});
