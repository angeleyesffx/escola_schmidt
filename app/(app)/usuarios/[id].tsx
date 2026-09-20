import { Redirect, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { atualizarAtivo, atualizarPapel, getUsuario, type Usuario } from '../../../src/features/usuarios/api';
import { useAuth, type Papel } from '../../../src/features/auth/AuthProvider';
import { paraBR } from '../../../src/lib/dataBR';
import { PageHeader } from '../../../src/components/PageHeader';
import { Footer } from '../../../src/components/Footer';
import { Chip } from '../../../src/components/Chip';
import { colors, spacing, type } from '../../../src/constants/theme';

const PAPEIS: { valor: Papel; label: string }[] = [
  { valor: 'aluno', label: 'Aluno' },
  { valor: 'responsavel', label: 'Responsável' },
  { valor: 'professor', label: 'Professor(a)' },
  { valor: 'dono', label: 'Dono' },
];

export default function UsuarioDetalhe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, meuPapel } = useAuth();

  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setUsuario(await getUsuario(id));
    } catch (err) {
      console.error(err);
      setError('Erro ao carregar usuário. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  // Dono não pode se autorrebaixar nem se autodesativar por essa tela — sem
  // isso um clique errado tira o único acesso de gestão do próprio app.
  const editandoSiMesmo = usuario?.id === session?.user.id;

  async function mudarPapel(novoPapel: Papel) {
    if (!usuario || editandoSiMesmo || novoPapel === usuario.papel) return;
    setSalvando(true);
    setError(null);
    try {
      await atualizarPapel(usuario.id, novoPapel);
      setUsuario({ ...usuario, papel: novoPapel });
    } catch (err) {
      console.error(err);
      setError('Erro ao atualizar papel. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo() {
    if (!usuario || editandoSiMesmo) return;
    const novoValor = !usuario.ativo;
    setSalvando(true);
    setError(null);
    try {
      await atualizarAtivo(usuario.id, novoValor);
      setUsuario({ ...usuario, ativo: novoValor });
    } catch (err) {
      console.error(err);
      setError('Erro ao atualizar status. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  if (meuPapel !== 'dono') {
    return <Redirect href="/" />;
  }

  if (loading) {
    return (
      <>
        <PageHeader titulo="Usuário" />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </>
    );
  }

  return (
    <>
      <PageHeader titulo={usuario?.nome ?? 'Usuário'} />
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {error ? <Text style={[type.body, styles.error]}>{error}</Text> : null}

          {usuario ? (
            <>
              <Text style={[type.label, styles.rotulo]}>Telefone</Text>
              <Text style={type.body}>{usuario.telefone ?? 'Não informado'}</Text>

              <Text style={[type.label, styles.rotulo]}>Cadastrado em</Text>
              <Text style={type.body}>{paraBR(usuario.criado_em.slice(0, 10))}</Text>

              <Text style={[type.label, styles.rotulo]}>Papel</Text>
              <View style={styles.chips}>
                {PAPEIS.map((p) => (
                  <Chip
                    key={p.valor}
                    label={p.label}
                    active={usuario.papel === p.valor}
                    onPress={() => mudarPapel(p.valor)}
                  />
                ))}
              </View>

              <Text style={[type.label, styles.rotulo]}>Status</Text>
              <View style={styles.chips}>
                <Chip label="Ativo" active={usuario.ativo} onPress={alternarAtivo} />
                <Chip label="Inativo" active={!usuario.ativo} onPress={alternarAtivo} />
              </View>

              {editandoSiMesmo ? (
                <Text style={[type.body, styles.aviso]}>
                  Você não pode alterar seu próprio papel ou status por aqui.
                </Text>
              ) : null}

              {salvando ? <ActivityIndicator color={colors.primary} style={styles.spinner} /> : null}
            </>
          ) : null}
        </ScrollView>
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
  scroll: {
    paddingBottom: spacing.xl,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  rotulo: {
    color: colors.textMuted,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  error: {
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  aviso: {
    color: colors.textMuted,
    marginTop: spacing.lg,
  },
  spinner: {
    marginTop: spacing.lg,
  },
});
