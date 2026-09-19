import { StyleSheet, View } from 'react-native';

import { colors } from '../constants/theme';

type Props = {
  size?: number;
  color?: string;
};

// Não há ilustração de "pessoa" no acervo de assets (só o conjunto de cards
// com ícones temáticos) — desenhado com Views, no mesmo espírito do ícone de
// hambúrguer do QuickMenu, pra não depender de um novo pacote de ícones.
export function PersonIcon({ size = 42, color = colors.primary }: Props) {
  return (
    <View style={[styles.anel, { width: size, height: size, borderRadius: size / 2, borderColor: color }]}>
      <View
        style={[
          styles.cabeca,
          {
            width: size * 0.34,
            height: size * 0.34,
            borderRadius: size * 0.17,
            marginTop: size * 0.16,
            backgroundColor: color,
          },
        ]}
      />
      <View
        style={[
          styles.corpo,
          {
            width: size * 0.72,
            height: size * 0.5,
            borderRadius: size * 0.36,
            marginTop: size * 0.05,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  anel: {
    borderWidth: 2,
    alignItems: 'center',
    overflow: 'hidden',
  },
  cabeca: {},
  corpo: {},
});
