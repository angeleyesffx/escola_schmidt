import { Image, StyleSheet, View } from 'react-native';

import { uiAssets } from '../constants/uiAssets';

// Barra fixa no rodapé, no mesmo espírito do PageHeader (fixo no topo): fica
// fora da área rolável, ocupa a largura toda e a imagem é esticada para
// preencher a faixa de ponta a ponta.
const ALTURA_RODAPE = 110;

export function Footer() {
  return (
    <View style={styles.container}>
      <Image source={uiAssets.banner.rodape} style={styles.imagem} resizeMode="stretch" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: ALTURA_RODAPE,
  },
  imagem: {
    width: '100%',
    height: '100%',
  },
});
