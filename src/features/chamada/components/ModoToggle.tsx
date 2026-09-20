import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors, radius, spacing, touchTarget, type } from '../../../constants/theme';
import type { ModoCalendario } from '../calendar';

type Props = {
  modo: ModoCalendario;
  onSelecionarModo: (modo: ModoCalendario) => void;
};

export function ModoToggle({ modo, onSelecionarModo }: Props) {
  return (
    <View style={styles.modoRow}>
      <TouchableOpacity
        testID="chamada-index-toggle-semana"
        style={[styles.modoChip, modo === 'semana' && styles.modoChipAtivo]}
        onPress={() => onSelecionarModo('semana')}
        accessibilityRole="button"
        accessibilityState={{ selected: modo === 'semana' }}
      >
        <Text style={[styles.modoChipTexto, modo === 'semana' && styles.modoChipTextoAtivo]}>Semana</Text>
      </TouchableOpacity>
      <TouchableOpacity
        testID="chamada-index-toggle-mes"
        style={[styles.modoChip, modo === 'mes' && styles.modoChipAtivo]}
        onPress={() => onSelecionarModo('mes')}
        accessibilityRole="button"
        accessibilityState={{ selected: modo === 'mes' }}
      >
        <Text style={[styles.modoChipTexto, modo === 'mes' && styles.modoChipTextoAtivo]}>Mês</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  modoRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  modoChip: {
    minHeight: touchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modoChipAtivo: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modoChipTexto: {
    color: colors.text,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
  modoChipTextoAtivo: {
    color: colors.onPrimary,
  },
});
