import { Image, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, type } from '../../../constants/theme';

export function BannerAgenda() {
  return (
    <View style={styles.bannerTopo}>
      <View style={styles.bannerTopoTexto}>
        <Text style={[type.label, styles.bannerTopoTag]}>Agenda</Text>
        <Text style={type.subtitle}>Planejamento da semana</Text>
        <Text style={[type.caption, styles.subtitle]}>Acompanhe aulas, particulares e eventos do período.</Text>
      </View>
      <Image source={require('../../../../assets/cards/card-eventos.png')} style={styles.bannerTopoImagem} />
    </View>
  );
}

const styles = StyleSheet.create({
  bannerTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: colors.surfaceTint,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  bannerTopoTexto: {
    flex: 1,
  },
  bannerTopoTag: {
    color: colors.primary,
    textTransform: 'uppercase',
  },
  subtitle: {
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  bannerTopoImagem: {
    width: 62,
    height: 62,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    resizeMode: 'contain',
  },
});
