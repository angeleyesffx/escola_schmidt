import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import { colors, radius, spacing, touchTarget, type } from '../constants/theme';

type Props = {
  label: string | number;
  active: boolean;
  onPress: () => void;
  /** true: largura mínima igual à altura, pra rótulos curtos (ex.: número de módulo) não ficarem estreitos. */
  square?: boolean;
  /** Fundo quando inativo — 'surface' (padrão, cartão branco) ou 'background' (mesmo tom do fundo da tela). */
  variant?: 'surface' | 'background';
};

/** Chip de seleção única (grade de módulo, plano, dia da semana, etc.) — não confundir com o chip de filtro (pill, menor) usado na lista de alunos. */
export function Chip({ label, active, onPress, square = false, variant = 'surface' }: Props) {
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        { backgroundColor: variant === 'background' ? colors.background : colors.surface },
        square && styles.quadrado,
        active && styles.ativo,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.texto, active && styles.textoAtivo]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: touchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quadrado: {
    minWidth: touchTarget,
  },
  ativo: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  texto: {
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
    color: colors.text,
  },
  textoAtivo: {
    color: colors.onPrimary,
  },
});
