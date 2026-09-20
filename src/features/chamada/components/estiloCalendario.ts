import { StyleSheet } from 'react-native';

import { colors, radius, spacing, touchTarget } from '../../../constants/theme';

export const LARGURA_COLUNA_CALENDARIO = '14.2857%';

// Compartilhado entre PickerMesInline, CalendarioSemana, CalendarioMes,
// ListaParticulares, ListaTestes e LegendaCalendario — mesma grade de dias e
// mesmos pontos de cor pra identificar particular/teste em todas as vistas.
export const estilosCalendario = StyleSheet.create({
  mesCabecalho: {
    flexDirection: 'row',
    marginTop: spacing.md,
  },
  mesCabecalhoTexto: {
    textAlign: 'center',
    color: colors.primary,
    textTransform: 'uppercase',
  },
  mesCabecalhoColuna: {
    width: LARGURA_COLUNA_CALENDARIO,
    minHeight: 30,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: colors.surfaceTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mesGrid: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  mesDia: {
    width: LARGURA_COLUNA_CALENDARIO,
    height: touchTarget,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mesDiaAtivo: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceTint,
  },
  mesDiaFora: {
    opacity: 0.45,
  },
  mesDiaTexto: {
    color: colors.text,
  },
  mesDiaTextoAtivo: {
    color: colors.primary,
  },
  diaParticularDot: {
    backgroundColor: colors.primary,
  },
  diaTesteDot: {
    backgroundColor: colors.present,
  },
});
