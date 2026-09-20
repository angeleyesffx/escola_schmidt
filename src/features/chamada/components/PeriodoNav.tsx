import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors, radius, spacing, touchTarget, type } from '../../../constants/theme';
import { formatIntervaloSemana, formatMesAno, type DiaCalendario, type ModoCalendario } from '../calendar';

type Props = {
  modo: ModoCalendario;
  diasSemana: DiaCalendario[];
  dataSelecionada: Date;
  onNavegar: (direcao: -1 | 1) => void;
  onAbrirPicker: () => void;
};

export function PeriodoNav({ modo, diasSemana, dataSelecionada, onNavegar, onAbrirPicker }: Props) {
  return (
    <View style={styles.periodoRow}>
      <TouchableOpacity
        testID="chamada-index-nav-anterior"
        style={styles.navegarBotao}
        onPress={() => onNavegar(-1)}
        accessibilityRole="button"
        accessibilityLabel="Período anterior"
      >
        <Ionicons name="chevron-back" size={22} color={colors.onPrimary} />
      </TouchableOpacity>
      <TouchableOpacity testID="chamada-index-periodo-abrir" style={styles.periodoCentro} onPress={onAbrirPicker}>
        <View style={styles.periodoIconeBadge}>
          <View style={styles.periodoIconeCorpo}>
            <View style={styles.periodoIconeTopo} />
          </View>
        </View>
        <Text style={[type.title, styles.periodoTitulo]}>
          {modo === 'semana' ? formatIntervaloSemana(diasSemana) : formatMesAno(dataSelecionada)}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        testID="chamada-index-nav-proximo"
        style={styles.navegarBotao}
        onPress={() => onNavegar(1)}
        accessibilityRole="button"
        accessibilityLabel="Próximo período"
      >
        <Ionicons name="chevron-forward" size={22} color={colors.onPrimary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  periodoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  periodoCentro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  periodoTitulo: {
    textTransform: 'capitalize',
  },
  periodoIconeBadge: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodoIconeCorpo: {
    width: 16,
    height: 14,
    borderRadius: 3,
    backgroundColor: colors.onPrimary,
    overflow: 'hidden',
  },
  periodoIconeTopo: {
    height: 4,
    backgroundColor: colors.primary,
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
});
