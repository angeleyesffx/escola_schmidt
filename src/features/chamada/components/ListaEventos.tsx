import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { EventoCalendario } from '../../eventos/api';
import { formatDataExtenso } from '../calendar';
import { colors, radius, spacing, touchTarget, type } from '../../../constants/theme';
import { uiAssets } from '../../../constants/uiAssets';

type Props = {
  eventos: EventoCalendario[];
  filtroAtivo: boolean;
  podeEditar: boolean;
  corPorTipo: Map<string, string>;
  onAbrirEvento: (evento: EventoCalendario) => void;
  onEditarEvento: (evento: EventoCalendario) => void;
  onExcluirEvento: (evento: EventoCalendario) => void;
  onLimparFiltro: () => void;
};

export function ListaEventos({
  eventos,
  filtroAtivo,
  podeEditar,
  corPorTipo,
  onAbrirEvento,
  onEditarEvento,
  onExcluirEvento,
  onLimparFiltro,
}: Props) {
  if (eventos.length === 0) return null;

  return (
    <View style={styles.eventosLista}>
      <View style={styles.eventosSecaoTopo}>
        <Text style={[type.label, styles.secao]}>
          {filtroAtivo ? 'Eventos da data selecionada' : 'Eventos deste período'}
        </Text>
        {filtroAtivo ? (
          <TouchableOpacity testID="chamada-index-filtro-limpar" style={styles.limparFiltroBotao} onPress={onLimparFiltro}>
            <Text style={styles.limparFiltroTexto}>Mostrar todos</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {eventos.map((e) => (
        <View key={e.id} testID={`chamada-index-evento-item-${e.id}`} style={styles.eventoItem}>
          <TouchableOpacity
            style={styles.eventoItemPrincipal}
            onPress={() => onAbrirEvento(e)}
            accessibilityRole="button"
            accessibilityLabel={`Detalhes do evento ${e.titulo}`}
          >
            <View style={[styles.eventoItemCor, { backgroundColor: corPorTipo.get(e.tipo_id) }]} />
            <View style={styles.eventoItemTexto}>
              <Text style={type.body}>{e.titulo}</Text>
              <Text style={[type.caption, styles.subtitle]}>
                {e.data_inicio === e.data_fim
                  ? formatDataExtenso(new Date(`${e.data_inicio}T00:00:00`))
                  : `${e.data_inicio.split('-').reverse().join('/')} a ${e.data_fim.split('-').reverse().join('/')}`}
              </Text>
            </View>
          </TouchableOpacity>
          {podeEditar ? <View style={styles.acoes}>
            <TouchableOpacity
              testID={`chamada-index-evento-editar-${e.id}`}
              style={styles.acao}
              onPress={() => onEditarEvento(e)}
              accessibilityRole="button"
              accessibilityLabel={`Editar evento ${e.titulo}`}
              hitSlop={8}
            >
              <Image source={uiAssets.icon.edit} style={styles.icone} />
              <Text style={[type.label, styles.textoEditar]}>Editar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID={`chamada-index-evento-excluir-${e.id}`}
              style={styles.acao}
              onPress={() => onExcluirEvento(e)}
              accessibilityRole="button"
              accessibilityLabel={`Excluir evento ${e.titulo}`}
              hitSlop={8}
            >
              <Image source={uiAssets.icon.trash} style={styles.icone} />
              <Text style={[type.label, styles.textoExcluir]}>Excluir</Text>
            </TouchableOpacity>
          </View> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  eventosLista: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  eventosSecaoTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  secao: {
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  limparFiltroBotao: {
    minHeight: touchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  limparFiltroTexto: {
    color: colors.primary,
    fontFamily: type.label.fontFamily,
    fontSize: type.label.fontSize,
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
  eventoItemPrincipal: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  acoes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  acao: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  icone: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
  },
  textoEditar: {
    color: colors.primary,
  },
  textoExcluir: {
    color: colors.danger,
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
