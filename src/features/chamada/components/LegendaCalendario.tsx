import { StyleSheet, Text, View } from 'react-native';

import type { TipoEvento } from '../../eventos/api';
import { colors, radius, spacing, type } from '../../../constants/theme';
import { estilosCalendario } from './estiloCalendario';

type Props = {
  tiposEvento: TipoEvento[];
  mostrarAula: boolean;
  mostrarParticular: boolean;
  mostrarTeste: boolean;
};

export function LegendaCalendario({ tiposEvento, mostrarAula, mostrarParticular, mostrarTeste }: Props) {
  if (!mostrarAula && !mostrarParticular && !mostrarTeste && tiposEvento.length === 0) return null;

  return (
    <View style={styles.legendaEventos}>
      {mostrarAula ? (
        <View style={styles.legendaEventoItem}>
          <View style={[styles.legendaEventoDot, styles.legendaAulaDot]} />
          <Text style={[type.caption, styles.legendaPontoTexto]}>Dia com aula na grade</Text>
        </View>
      ) : null}
      {mostrarParticular ? (
        <View style={styles.legendaEventoItem}>
          <View style={[styles.legendaEventoDot, estilosCalendario.diaParticularDot]} />
          <Text style={[type.caption, styles.legendaPontoTexto]}>Aula particular agendada</Text>
        </View>
      ) : null}
      {mostrarTeste ? (
        <View style={styles.legendaEventoItem}>
          <View style={[styles.legendaEventoDot, estilosCalendario.diaTesteDot]} />
          <Text style={[type.caption, styles.legendaPontoTexto]}>Aula teste agendada</Text>
        </View>
      ) : null}
      {tiposEvento.map((tipoEvento) => (
        <View key={tipoEvento.id} style={styles.legendaEventoItem}>
          <View style={[styles.legendaEventoDot, { backgroundColor: tipoEvento.cor }]} />
          <Text style={[type.caption, styles.legendaPontoTexto]}>{tipoEvento.nome}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  legendaEventos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  legendaEventoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendaEventoDot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
  },
  legendaAulaDot: {
    backgroundColor: colors.onTrack,
  },
  legendaPontoTexto: {
    color: colors.textMuted,
  },
});
