import { StyleSheet, Switch, Text, View } from 'react-native';

import { colors, spacing, type } from '../constants/theme';

type Props = {
  ativo: boolean;
  onToggle: () => void;
  testID?: string;
};

// Rótulo visível ao lado do Switch — sozinho, um interruptor sem texto não
// diz o que "ligado"/"desligado" significa nem por que ele está ali (achado
// de revisão de UX, 2026-09-22, telas de configurações/catálogo).
export function ToggleAtivo({ ativo, onToggle, testID }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={[type.label, ativo ? styles.rotuloAtivo : styles.rotuloInativo]}>
        {ativo ? 'Ativo' : 'Inativo'}
      </Text>
      <Switch
        testID={testID}
        value={ativo}
        onValueChange={onToggle}
        trackColor={{ false: colors.border, true: colors.primarySoft }}
        thumbColor={ativo ? colors.primary : colors.surface}
        accessibilityRole="switch"
        accessibilityLabel={ativo ? 'Desativar' : 'Ativar'}
        accessibilityState={{ checked: ativo }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  rotuloAtivo: {
    color: colors.present,
  },
  rotuloInativo: {
    color: colors.textMuted,
  },
});
