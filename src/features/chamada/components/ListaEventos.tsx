import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { EventoCalendario } from '../../eventos/api';
import { formatDataExtenso } from '../calendar';
import { colors, radius, spacing, touchTarget, type } from '../../../constants/theme';

type Props = {
  eventos: EventoCalendario[];
  filtroAtivo: boolean;
  corPorTipo: Map<string, string>;
  onAbrirEvento: (evento: EventoCalendario) => void;
  onLimparFiltro: () => void;
};

export function ListaEventos({ eventos, filtroAtivo, corPorTipo, onAbrirEvento, onLimparFiltro }: Props) {
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
        <TouchableOpacity
          key={e.id}
          testID={`chamada-index-evento-item-${e.id}`}
          style={styles.eventoItem}
          onPress={() => onAbrirEvento(e)}
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
  eventoItemCor: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
  },
  eventoItemTexto: {
    flex: 1,
  },
});
