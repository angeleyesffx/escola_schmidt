import { Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { uiAssets } from '../constants/uiAssets';
import { colors, spacing, type } from '../constants/theme';

// Barra fixa no rodapé, no mesmo espírito do PageHeader (fixo no topo): fica
// fora da área rolável, ocupa a largura toda. A imagem usa "cover" (não
// "stretch") pra preencher a faixa sem distorcer — a arte é bem mais larga
// que alta (2170x314), então "stretch" esticava/achatava fora de proporção
// em qualquer largura de tela que não fosse exatamente essa.
const ALTURA_BANNER = 110;
const ANO_ATUAL = new Date().getFullYear();

export function Footer() {
  // Em landscape (iPhone com notch/Android com gestos), a área segura desloca
  // pra esquerda/direita, não só embaixo — sem isso o texto de copyright
  // ficava colado (ou cortado) na borda arredondada/entalhe da tela deitada.
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom, paddingHorizontal: Math.max(insets.left, insets.right) }]}>
      <Image source={uiAssets.banner.rodape} style={styles.imagem} resizeMode="cover" />
      <Text style={styles.copyright}>© {ANO_ATUAL} V&P SOLUTIONS LTDA. Todos os direitos reservados.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: colors.background,
  },
  imagem: {
    width: '100%',
    height: ALTURA_BANNER,
  },
  copyright: {
    ...type.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.xs,
  },
});
