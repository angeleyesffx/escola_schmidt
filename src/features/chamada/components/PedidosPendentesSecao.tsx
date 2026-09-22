import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { PedidoPendente } from '../api';
import { colors, radius, spacing, touchTarget, type } from '../../../constants/theme';

type Props = {
  pedidos: PedidoPendente[];
  processandoPedidoId: string | null;
  onAprovar: (pedido: PedidoPendente) => void;
  onRecusar: (pedido: PedidoPendente) => void;
};

export function PedidosPendentesSecao({ pedidos, processandoPedidoId, onAprovar, onRecusar }: Props) {
  if (pedidos.length === 0) return null;

  return (
    <View style={styles.pedidosSecao}>
      <Text style={[type.label, styles.secao]}>Pedidos de presença</Text>
      {pedidos.map((pedido) => {
        const processando = processandoPedidoId === pedido.id;
        return (
          <View key={pedido.id} style={styles.pedidoRow}>
            <Text style={[type.body, styles.pedidoNome]} numberOfLines={1}>
              {pedido.aluno_nome}
            </Text>
            <View style={styles.pedidoBotoes}>
              <TouchableOpacity
                testID={`chamada-detalhe-pedido-recusar-${pedido.id}`}
                style={[styles.pedidoBotaoRecusar, processando && styles.botaoDesabilitado]}
                onPress={() => onRecusar(pedido)}
                disabled={processando}
              >
                <Text style={styles.pedidoBotaoRecusarTexto}>Recusar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID={`chamada-detalhe-pedido-aprovar-${pedido.id}`}
                style={[styles.pedidoBotaoAprovar, processando && styles.botaoDesabilitado]}
                onPress={() => onAprovar(pedido)}
                disabled={processando}
              >
                {processando ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <Text style={styles.pedidoBotaoAprovarTexto}>Aprovar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pedidosSecao: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  secao: {
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  pedidoRow: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceTint,
    borderWidth: 1,
    borderColor: colors.justified,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pedidoNome: {
    flex: 1,
    marginRight: spacing.sm,
  },
  pedidoBotoes: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pedidoBotaoRecusar: {
    minHeight: touchTarget - 12,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pedidoBotaoRecusarTexto: {
    color: colors.danger,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
  pedidoBotaoAprovar: {
    minWidth: touchTarget,
    minHeight: touchTarget - 12,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.present,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pedidoBotaoAprovarTexto: {
    color: colors.onPrimary,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
  botaoDesabilitado: {
    opacity: 0.5,
  },
});
