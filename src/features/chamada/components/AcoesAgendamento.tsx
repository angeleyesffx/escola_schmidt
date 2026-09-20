import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors, radius, spacing, touchTarget, type } from '../../../constants/theme';

type Props = {
  podeEditar: boolean;
  souAluno: boolean;
  onAgendarAula: () => void;
  onAgendarParticular: () => void;
};

export function AcoesAgendamento({ podeEditar, souAluno, onAgendarAula, onAgendarParticular }: Props) {
  return (
    <>
      {podeEditar ? (
        <View style={styles.tituloRow}>
          <TouchableOpacity testID="chamada-index-particular-novo" style={styles.particularBotao} onPress={onAgendarAula}>
            <Text style={styles.particularBotaoTexto}>Agendar aula</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {souAluno ? (
        <View style={styles.tituloRow}>
          <TouchableOpacity
            testID="chamada-index-particular-novo-aluno"
            style={styles.particularBotao}
            onPress={onAgendarParticular}
          >
            <Text style={styles.particularBotaoTexto}>Agendar aula particular</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  tituloRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: spacing.md,
  },
  particularBotao: {
    height: touchTarget,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  particularBotaoTexto: {
    color: colors.onPrimary,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
});
