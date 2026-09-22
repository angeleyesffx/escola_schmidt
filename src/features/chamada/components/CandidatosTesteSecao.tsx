import { StyleSheet, Text, View } from 'react-native';

import type { CandidatoAulaTeste } from '../api';
import { colors, radius, spacing, touchTarget, type } from '../../../constants/theme';

type Props = {
  candidatos: CandidatoAulaTeste[];
};

export function CandidatosTesteSecao({ candidatos }: Props) {
  if (candidatos.length === 0) return null;

  return (
    <View style={styles.pedidosSecao}>
      <Text style={[type.label, styles.secao]}>Aula Experimental</Text>
      <Text style={[type.caption, styles.subtitle]}>
        Candidatos ainda não matriculados — só informativo, sem controle de presença.
      </Text>
      {candidatos.map((candidato) => (
        <View key={candidato.id} testID={`chamada-detalhe-candidato-${candidato.id}`} style={styles.row}>
          <View style={styles.nomeArea}>
            <Text style={[type.body, styles.nome]} numberOfLines={1}>
              {candidato.nome}
            </Text>
            <Text style={[type.caption, styles.moduloTexto]}>
              Aula Experimental{candidato.telefone ? ` · ${candidato.telefone}` : ''}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pedidosSecao: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  secao: {
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  row: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
  },
  nomeArea: {
    flex: 1,
    minHeight: touchTarget,
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  nome: {
    color: colors.primary,
  },
  moduloTexto: {
    color: colors.textMuted,
    marginTop: 2,
  },
});
