import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { excluirEvento, getEvento, getTiposEvento } from '../../../src/features/eventos/api';
import { formatDataExtenso } from '../../../src/features/chamada/calendar';
import { useAuth } from '../../../src/features/auth/AuthProvider';
import { useAsyncData } from '../../../src/hooks/useAsyncData';
import { PageHeader } from '../../../src/components/PageHeader';
import { Footer } from '../../../src/components/Footer';
import { colors, radius, spacing, touchTarget, type } from '../../../src/constants/theme';

export default function DetalheEvento() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { meuPapel } = useAuth();
  const podeEditar = meuPapel === 'dono' || meuPapel === 'professor';

  const [excluindo, setExcluindo] = useState(false);
  const [erroExcluir, setErroExcluir] = useState<string | null>(null);

  const {
    data,
    loading,
    error: erroCarregar,
  } = useAsyncData(
    async () => {
      const [dadosEvento, tipos] = await Promise.all([getEvento(id), getTiposEvento()]);
      return { evento: dadosEvento, tipo: tipos.find((t) => t.id === dadosEvento.tipo_id) ?? null };
    },
    [id],
    { onFocus: true, mensagemErro: 'Erro ao carregar o evento. Tente novamente.' }
  );
  const evento = data?.evento ?? null;
  const tipo = data?.tipo ?? null;
  const error = erroExcluir ?? erroCarregar;

  function confirmarExclusao() {
    Alert.alert('Excluir evento', 'Tem certeza que quer excluir esse evento?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: excluir },
    ]);
  }

  async function excluir() {
    setExcluindo(true);
    setErroExcluir(null);
    try {
      await excluirEvento(id);
      router.back();
    } catch (err) {
      console.error(err);
      setErroExcluir('Erro ao excluir evento. Tente novamente.');
      setExcluindo(false);
    }
  }

  if (loading) {
    return (
      <>
        <PageHeader titulo="Evento" />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </>
    );
  }

  if (!evento) {
    return (
      <>
        <PageHeader titulo="Evento" />
        <View style={styles.center}>
          <Text style={[type.body, styles.subtitle]}>{error ?? 'Evento não encontrado.'}</Text>
        </View>
      </>
    );
  }

  const periodo =
    evento.data_inicio === evento.data_fim
      ? formatDataExtenso(new Date(`${evento.data_inicio}T00:00:00`))
      : `${evento.data_inicio.split('-').reverse().join('/')} a ${evento.data_fim.split('-').reverse().join('/')}`;

  return (
    <>
      <PageHeader titulo="Evento" />
      <View style={styles.container}>
        <View style={styles.card}>
          {tipo ? (
            <View style={styles.tipoRow}>
              <View style={[styles.tipoCor, { backgroundColor: tipo.cor }]} />
              <Text style={[type.label, styles.tipoTexto]}>{tipo.nome}</Text>
            </View>
          ) : null}

          <Text style={type.title}>{evento.titulo}</Text>
          <Text style={[type.body, styles.subtitle]}>{periodo}</Text>

          {evento.descricao ? (
            <>
              <Text style={[type.label, styles.rotulo]}>Descrição</Text>
              <Text style={type.body}>{evento.descricao}</Text>
            </>
          ) : null}
        </View>

        {error ? <Text style={[type.body, styles.error]}>{error}</Text> : null}

        {podeEditar ? (
          <View style={styles.acoes}>
            <TouchableOpacity
              style={styles.editarBotao}
              onPress={() => router.push(`/chamada/novo-evento?id=${evento.id}`)}
              disabled={excluindo}
            >
              <Text style={styles.editarBotaoTexto}>Editar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.excluirBotao} onPress={confirmarExclusao} disabled={excluindo}>
              {excluindo ? (
                <ActivityIndicator color={colors.danger} />
              ) : (
                <Text style={styles.excluirBotaoTexto}>Excluir</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}
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
  subtitle: {
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  tipoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  tipoCor: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
  },
  tipoTexto: {
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  rotulo: {
    color: colors.textMuted,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  error: {
    color: colors.danger,
    marginTop: spacing.md,
  },
  acoes: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  editarBotao: {
    flex: 1,
    height: touchTarget,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editarBotaoTexto: {
    color: colors.onPrimary,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
  excluirBotao: {
    flex: 1,
    height: touchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  excluirBotaoTexto: {
    color: colors.danger,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
});
