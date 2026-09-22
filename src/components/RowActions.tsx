import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { uiAssets } from '../constants/uiAssets';
import { colors, radius, spacing, touchTarget, type } from '../constants/theme';

type Props = {
  // Base pro testID de cada botão (ex.: `catalogo-habilidade-${id}`) — sem
  // isso, todo RowActions da mesma tela geraria o mesmo testID, impossível
  // de mirar numa linha específica em teste.
  testIdBase: string;
  onEdit?: () => void;
  onDelete?: () => void;
};

// Ícone + nome da ação (editar/excluir) pro fim de cada linha de lista —
// só o ícone (20px, sem texto) era pequeno demais pra reconhecer de relance
// e não dizia a função de cada botão (achado de revisão de UX, 2026-09-22).
// Editar abre um FormModal; excluir dispara a confirmação direto, sem modal.
export function RowActions({ testIdBase, onEdit, onDelete }: Props) {
  return (
    <View style={styles.row}>
      {onEdit ? (
        <TouchableOpacity
          testID={`${testIdBase}-edit`}
          style={styles.button}
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel="Editar"
          hitSlop={8}
        >
          <Image source={uiAssets.icon.edit} style={styles.icon} />
          <Text style={[type.label, styles.textoEditar]}>Editar</Text>
        </TouchableOpacity>
      ) : null}
      {onDelete ? (
        <TouchableOpacity
          testID={`${testIdBase}-delete`}
          style={styles.button}
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel="Excluir"
          hitSlop={8}
        >
          <Image source={uiAssets.icon.trash} style={styles.icon} />
          <Text style={[type.label, styles.textoExcluir]}>Excluir</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  button: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  icon: {
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
});
