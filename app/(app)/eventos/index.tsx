import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { formatDataExtenso, formatDataISO, formatMesAno } from '../../../src/features/chamada/calendar';
import { getEventosPorPeriodo, getTiposEvento } from '../../../src/features/eventos/api';
import { useAuth } from '../../../src/features/auth/AuthProvider';
import { useAsyncData } from '../../../src/hooks/useAsyncData';
import { PageHeader } from '../../../src/components/PageHeader';
import { Footer } from '../../../src/components/Footer';
import { uiAssets } from '../../../src/constants/uiAssets';
import { colors, radius, spacing, touchTarget, type } from '../../../src/constants/theme';

function primeiroDiaDoMes(referencia: Date) {
  return new Date(referencia.getFullYear(), referencia.getMonth(), 1);
}

function ultimoDiaDoMes(referencia: Date) {
  return new Date(referencia.getFullYear(), referencia.getMonth() + 1, 0);
}

export default function EventosIndex() {
  const router = useRouter();
  const { meuPapel } = useAuth();
  const podeEditar = meuPapel === 'dono' || meuPapel === 'professor';

  const [mesReferencia, setMesReferencia] = useState(() => new Date());

  const inicioMesISO = formatDataISO(primeiroDiaDoMes(mesReferencia));
  const fimMesISO = formatDataISO(ultimoDiaDoMes(mesReferencia));

  const { data: tiposEvento } = useAsyncData(getTiposEvento, [], { onFocus: true });
  const {
    data: eventos,
    loading,
    error,
  } = useAsyncData(() => getEventosPorPeriodo(inicioMesISO, fimMesISO), [inicioMesISO, fimMesISO], {
    onFocus: true,
    mensagemErro: 'Erro ao carregar eventos. Tente novamente.',
  });

  const corPorTipo = new Map((tiposEvento ?? []).map((t) => [t.id, t.cor]));

  function navegarMes(direcao: -1 | 1) {
    setMesReferencia((atual) => new Date(atual.getFullYear(), atual.getMonth() + direcao, 1));
  }

  const cabecalho = (
    <View>
      <View style={styles.bannerTopo}>
        <View style={styles.bannerTopoTexto}>
          <Text style={[type.label, styles.bannerTopoTag]}>Eventos</Text>
          <Text style={type.subtitle}>Eventos do mês</Text>
          <Text style={[type.caption, styles.subtitle]}>Recessos, competições, reuniões e mais.</Text>
        </View>
        <Image source={uiAssets.card.eventos} style={styles.bannerTopoImagem} />
      </View>

      {podeEditar ? (
        <View style={styles.tituloRow}>
          <TouchableOpacity style={styles.eventoBotao} onPress={() => router.push('/chamada/novo-evento')}>
            <Text style={styles.eventoBotaoTexto}>+ Evento</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.periodoRow}>
        <TouchableOpacity
          style={styles.navegarBotao}
          onPress={() => navegarMes(-1)}
          accessibilityRole="button"
          accessibilityLabel="Mês anterior"
        >
          <Ionicons name="chevron-back" size={22} color={colors.onPrimary} />
        </TouchableOpacity>
        <Text style={[type.title, styles.periodoTitulo]}>{formatMesAno(mesReferencia)}</Text>
        <TouchableOpacity
          style={styles.navegarBotao}
          onPress={() => navegarMes(1)}
          accessibilityRole="button"
          accessibilityLabel="Próximo mês"
        >
          <Ionicons name="chevron-forward" size={22} color={colors.onPrimary} />
        </TouchableOpacity>
      </View>

      {tiposEvento && tiposEvento.length > 0 ? (
        <View style={styles.legendaEventos}>
          {tiposEvento.map((tipoEvento) => (
            <View key={tipoEvento.id} style={styles.legendaEventoItem}>
              <View style={[styles.legendaEventoDot, { backgroundColor: tipoEvento.cor }]} />
              <Text style={[type.caption, styles.legendaPontoTexto]}>{tipoEvento.nome}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {error ? <Text style={[type.body, styles.error]}>{error}</Text> : null}
    </View>
  );

  if (loading) {
    return (
      <>
        <PageHeader titulo="Eventos" />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </>
    );
  }

  return (
    <>
      <PageHeader titulo="Eventos" />
      <FlatList
        style={styles.container}
        data={eventos}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={cabecalho}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !error ? <Text style={[type.body, styles.subtitle]}>Nenhum evento neste mês.</Text> : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.eventoItem} onPress={() => router.push(`/eventos/${item.id}`)}>
            <View style={[styles.eventoItemCor, { backgroundColor: corPorTipo.get(item.tipo_id) }]} />
            <View style={styles.eventoItemTexto}>
              <Text style={type.body}>{item.titulo}</Text>
              <Text style={[type.caption, styles.subtitle]}>
                {item.data_inicio === item.data_fim
                  ? formatDataExtenso(new Date(`${item.data_inicio}T00:00:00`))
                  : `${item.data_inicio.split('-').reverse().join('/')} a ${item.data_fim.split('-').reverse().join('/')}`}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
      <Footer />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  bannerTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: colors.surfaceTint,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  bannerTopoTexto: {
    flex: 1,
  },
  bannerTopoTag: {
    color: colors.primary,
    textTransform: 'uppercase',
  },
  bannerTopoImagem: {
    width: 62,
    height: 62,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    resizeMode: 'contain',
  },
  tituloRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: spacing.md,
  },
  eventoBotao: {
    height: touchTarget,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventoBotaoTexto: {
    color: colors.onPrimary,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
  periodoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  periodoTitulo: {
    textTransform: 'capitalize',
  },
  // Mesmo padrão do botão de voltar do cabeçalho: círculo preenchido e cor
  // sólida, não contorno fino — pra quem tem baixa visão enxergar de longe.
  navegarBotao: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  legendaEventos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  legendaEventoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendaEventoDot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
  },
  legendaPontoTexto: {
    color: colors.textMuted,
  },
  error: {
    color: colors.danger,
    marginTop: spacing.sm,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  eventoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: touchTarget,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  eventoItemCor: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
  },
  eventoItemTexto: {
    flex: 1,
  },
});
