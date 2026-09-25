import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { formatDataExtenso, formatDataISO, formatMesAno } from '../../../src/features/chamada/calendar';
import { getEventosPorPeriodo, getTiposEvento } from '../../../src/features/eventos/api';
import { importarFeriados } from '../../../src/features/eventos/feriados';
import { LegendaCalendario } from '../../../src/features/chamada/components/LegendaCalendario';
import { useAuth } from '../../../src/features/auth/AuthProvider';
import { useAsyncData } from '../../../src/hooks/useAsyncData';
import { PageHeader } from '../../../src/components/PageHeader';
import { Footer } from '../../../src/components/Footer';
import { Dropdown } from '../../../src/components/Dropdown';
import { PickerMesInline } from '../../../src/features/chamada/components/PickerMesInline';
import { uiAssets } from '../../../src/constants/uiAssets';
import { colors, radius, spacing, touchTarget, type } from '../../../src/constants/theme';

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

function primeiroDiaDoMes(referencia: Date) {
  return new Date(referencia.getFullYear(), referencia.getMonth(), 1);
}

function ultimoDiaDoMes(referencia: Date) {
  return new Date(referencia.getFullYear(), referencia.getMonth() + 1, 0);
}

export default function EventosIndex() {
  const router = useRouter();
  const { meuPapel, session } = useAuth();
  const podeEditar = meuPapel === 'dono' || meuPapel === 'professor';

  const [mesReferencia, setMesReferencia] = useState(() => new Date());
  const [pickerAberto, setPickerAberto] = useState(false);
  const [importarAberto, setImportarAberto] = useState(false);
  const [ufImportar, setUfImportar] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);
  const [resultadoImportacao, setResultadoImportacao] = useState<string | null>(null);
  const [erroImportacao, setErroImportacao] = useState<string | null>(null);

  const inicioMesISO = formatDataISO(primeiroDiaDoMes(mesReferencia));
  const fimMesISO = formatDataISO(ultimoDiaDoMes(mesReferencia));
  const anoReferencia = mesReferencia.getFullYear();

  const {
    data: tiposEvento,
    reload: recarregarTipos,
  } = useAsyncData(getTiposEvento, [], { onFocus: true });
  const {
    data: eventos,
    loading,
    error,
    reload: recarregarEventos,
  } = useAsyncData(() => getEventosPorPeriodo(inicioMesISO, fimMesISO), [inicioMesISO, fimMesISO], {
    onFocus: true,
    mensagemErro: 'Erro ao carregar eventos. Tente novamente.',
  });

  const corPorTipo = new Map((tiposEvento ?? []).map((t) => [t.id, t.cor]));
  // Só os tipos com pelo menos 1 evento no mês visto — antes listava todos os
  // tipos cadastrados, a maioria irrelevante pra maior parte dos meses.
  const tiposEventoVisiveis = (tiposEvento ?? []).filter((tipo) =>
    (eventos ?? []).some((evento) => evento.tipo_id === tipo.id)
  );

  function navegarMes(direcao: -1 | 1) {
    setMesReferencia((atual) => new Date(atual.getFullYear(), atual.getMonth() + direcao, 1));
  }

  async function confirmarImportacao() {
    if (!ufImportar) {
      setErroImportacao('Escolha o estado.');
      return;
    }
    setImportando(true);
    setErroImportacao(null);
    setResultadoImportacao(null);
    try {
      const { total, importados } = await importarFeriados(ufImportar, anoReferencia, session?.user.id ?? null);
      setResultadoImportacao(
        importados === 0
          ? `Nenhum feriado novo — os ${total} feriados de ${anoReferencia} já estavam importados.`
          : `${importados} de ${total} feriados de ${anoReferencia} importados.`
      );
      await Promise.all([recarregarEventos(), recarregarTipos()]);
    } catch (err) {
      console.error(err);
      setErroImportacao('Erro ao importar feriados. Tente novamente.');
    } finally {
      setImportando(false);
    }
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
          <TouchableOpacity
            style={styles.importarBotao}
            onPress={() => {
              setImportarAberto((atual) => !atual);
              setResultadoImportacao(null);
              setErroImportacao(null);
            }}
          >
            <Text style={styles.importarBotaoTexto}>Importar feriados de {anoReferencia}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.eventoBotao} onPress={() => router.push('/chamada/novo-evento')}>
            <Text style={styles.eventoBotaoTexto}>
              <Text style={styles.plusPrefix}>+</Text> Evento
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {podeEditar && importarAberto ? (
        <View style={styles.importarCard}>
          <Text style={[type.label, styles.rotuloImportar]}>Estado</Text>
          <Dropdown
            testID="eventos-importar-uf"
            placeholder="Escolha o estado"
            options={UFS.map((uf) => ({ value: uf, label: uf }))}
            value={ufImportar}
            onChange={setUfImportar}
          />
          {erroImportacao ? <Text style={[type.body, styles.error]}>{erroImportacao}</Text> : null}
          {resultadoImportacao ? <Text style={[type.body, styles.sucessoImportacao]}>{resultadoImportacao}</Text> : null}
          <TouchableOpacity
            testID="eventos-importar-confirmar"
            style={[styles.importarConfirmarBotao, importando && styles.botaoDesabilitado]}
            onPress={confirmarImportacao}
            disabled={importando}
          >
            {importando ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.eventoBotaoTexto}>Importar</Text>
            )}
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
          <Ionicons name="chevron-back" size={18} color={colors.onPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          testID="eventos-periodo-abrir-picker"
          style={styles.periodoTituloBotao}
          onPress={() => setPickerAberto(true)}
          accessibilityRole="button"
          accessibilityLabel="Escolher data dos eventos"
        >
          <Text style={[type.title, styles.periodoTitulo]}>{formatMesAno(mesReferencia)}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navegarBotao}
          onPress={() => navegarMes(1)}
          accessibilityRole="button"
          accessibilityLabel="Próximo mês"
        >
          <Ionicons name="chevron-forward" size={18} color={colors.onPrimary} />
        </TouchableOpacity>
      </View>

      {pickerAberto ? (
        <PickerMesInline
          dataISO={formatDataISO(mesReferencia)}
          onSelecionarData={(data) => {
            setMesReferencia(primeiroDiaDoMes(data));
            setPickerAberto(false);
          }}
          onFechar={() => setPickerAberto(false)}
        />
      ) : null}

      <LegendaCalendario
        tiposEvento={tiposEventoVisiveis}
        mostrarAula={false}
        mostrarParticular={false}
        mostrarTeste={false}
      />

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
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
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
  plusPrefix: {
    fontWeight: '700',
  },
  importarBotao: {
    height: touchTarget,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importarBotaoTexto: {
    color: colors.primary,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
  importarCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rotuloImportar: {
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  sucessoImportacao: {
    color: colors.present,
    marginTop: spacing.sm,
  },
  importarConfirmarBotao: {
    height: touchTarget,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  botaoDesabilitado: {
    opacity: 0.6,
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
  periodoTituloBotao: {
    minHeight: touchTarget - 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  // Mesmo padrão das setas da Agenda: touchTarget cheio ficava
  // desproporcional ao lado do título do mês (achado de revisão de UX,
  // 2026-09-22).
  navegarBotao: {
    width: touchTarget - 12,
    height: touchTarget - 12,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
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
