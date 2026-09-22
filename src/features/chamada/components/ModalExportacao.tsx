import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { FormatoExportacao } from '../export';
import { colors, radius, spacing, touchTarget, type } from '../../../constants/theme';

type Props = {
  visivel: boolean;
  onExportar: (formato: FormatoExportacao) => void;
  onFechar: () => void;
};

export function ModalExportacao({ visivel, onExportar, onFechar }: Props) {
  return (
    <Modal visible={visivel} transparent animationType="fade" onRequestClose={onFechar}>
      <View style={styles.exportarOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onFechar} />
        <View style={styles.exportarCard}>
          <Text style={[type.label, styles.secao]}>Exportar chamada</Text>
          <TouchableOpacity
            testID="chamada-detalhe-exportar-xlsx"
            style={styles.exportarOpcao}
            onPress={() => onExportar('xlsx')}
          >
            <Text style={styles.exportarOpcaoTexto}>Excel (.xlsx)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="chamada-detalhe-exportar-csv"
            style={styles.exportarOpcao}
            onPress={() => onExportar('csv')}
          >
            <Text style={styles.exportarOpcaoTexto}>CSV (Planilhas Google)</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="chamada-detalhe-exportar-cancelar" style={styles.exportarCancelar} onPress={onFechar}>
            <Text style={styles.exportarCancelarTexto}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  exportarOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  exportarCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  secao: {
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  exportarOpcao: {
    minHeight: touchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  exportarOpcaoTexto: {
    color: colors.primary,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
  exportarCancelar: {
    minHeight: touchTarget - 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  exportarCancelarTexto: {
    color: colors.textMuted,
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
  },
});
