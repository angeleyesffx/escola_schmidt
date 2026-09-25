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
        style={[styles.modoChip, modo === 'semana' ? styles.modoChipAtivo : styles.modoChipInativo]}
        onPress={() => onSelecionarModo('semana')}
        accessibilityRole="button"
        accessibilityState={{ selected: modo === 'semana' }}
      >
        <Text style={[styles.modoChipTexto, modo === 'semana' ? styles.modoChipTextoAtivo : styles.modoChipTextoInativo]}>
          Semana
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        testID="chamada-index-toggle-mes"
        style={[styles.modoChip, modo === 'mes' ? styles.modoChipAtivo : styles.modoChipInativo]}
        onPress={() => onSelecionarModo('mes')}
        accessibilityRole="button"
        accessibilityState={{ selected: modo === 'mes' }}
      >
        <Text style={[styles.modoChipTexto, modo === 'mes' ? styles.modoChipTextoAtivo : styles.modoChipTextoInativo]}>
          Mês
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  modoRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modoChip: {
    minHeight: touchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 110,
  },
  modoChipInativo: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  modoChipAtivo: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  modoChipTexto: {
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
  modoChipTextoInativo: {
    color: colors.text,
  },
  modoChipTextoAtivo: {
    color: colors.onPrimary,
    fontWeight: '700',
  },
});
