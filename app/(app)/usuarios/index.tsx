import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { getUsuariosPagina, type Usuario } from '../../../src/features/usuarios/api';
import { useAuth } from '../../../src/features/auth/AuthProvider';
import { PageHeader } from '../../../src/components/PageHeader';
import { Footer } from '../../../src/components/Footer';
import { WebModal } from '../../../src/components/WebModal';
import { colors, radius, spacing, touchTarget, type } from '../../../src/constants/theme';

const ROTULO_PAPEL: Record<string, string> = {
  dono: 'Dono',
  professor: 'Professor(a)',
  aluno: 'Aluno',
  responsavel: 'Responsável',
};

export default function UsuariosIndex() {
  const router = useRouter();
  const { meuPapel } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(0);
  const [temMais, setTemMais] = useState(false);
  const [loading, setLoading] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async (proximaPagina: number, substituir: boolean) => {
    if (proximaPagina === 0) setLoading(true);
    else setCarregandoMais(true);
    setError(null);
    try {
      const resultado = await getUsuariosPagina(proximaPagina);
      setUsuarios((atuais) => substituir ? resultado.usuarios : [...atuais, ...resultado.usuarios]);
      setTotal(resultado.total);
      setTemMais(resultado.temMais);
      setPagina(proximaPagina);
    } catch (err) {
      console.error(err);
      setError('Erro ao carregar usuários. Tente novamente.');
    } finally {
      setLoading(false);
      setCarregandoMais(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void carregar(0, true);
    }, [carregar])
  );

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
    <WebModal>
      <PageHeader titulo="Usuários" />
      <View style={styles.container}>
        <FlatList
          style={styles.scroll}
          data={usuarios}
          keyExtractor={(usuario) => usuario.id}
          ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              <View style={styles.header}>
                <Text style={[type.body, styles.subtitle]}>{total} cadastrados</Text>
                <TouchableOpacity
                  testID="usuarios-botao-convidar"
                  style={styles.novoBotao}
                  onPress={() => router.push('/usuarios/novo')}
                >
                  <Text style={styles.novoBotaoTexto}>+ Convidar</Text>
                </TouchableOpacity>
              </View>
              {error ? <Text style={[type.body, styles.error]}>{error}</Text> : null}
            </>
          }
          ListEmptyComponent={
            !error ? <Text style={[type.body, styles.subtitle, styles.vazio]}>Nenhum usuário cadastrado ainda.</Text> : null
          }
          renderItem={({ item: usuario }) => (
            <TouchableOpacity
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
          )}
          ListFooterComponent={
            temMais ? (
              <TouchableOpacity
                style={[styles.carregarMaisBotao, carregandoMais && styles.botaoDesabilitado]}
                onPress={() => void carregar(pagina + 1, false)}
                disabled={carregandoMais}
              >
                <Text style={styles.carregarMaisTexto}>{carregandoMais ? 'Carregando...' : 'Carregar mais'}</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      </View>
      <Footer />
    </WebModal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
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
    marginBottom: spacing.md,
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
  carregarMaisBotao: {
    minHeight: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  carregarMaisTexto: {
    color: colors.primary,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
  botaoDesabilitado: {
    opacity: 0.6,
  },
  itemSeparator: {
    height: spacing.sm,
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
