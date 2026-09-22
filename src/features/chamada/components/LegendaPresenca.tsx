import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, type } from '../../../constants/theme';
import { ESTADOS } from '../selectors';

export function LegendaPresenca() {
  return (
    <View style={styles.legenda}>
      {ESTADOS.map((estado) => (
        <View key={estado.status} style={styles.legendaItem}>
          <View style={[styles.legendaCor, { backgroundColor: colors[estado.cor] }]} />
          <Text style={[type.caption, styles.legendaTexto]}>{estado.legenda}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  legenda: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  legendaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendaCor: {
    width: 12,
    height: 12,
    borderRadius: radius.sm,
  },
  legendaTexto: {
    color: colors.textMuted,
  },
});
