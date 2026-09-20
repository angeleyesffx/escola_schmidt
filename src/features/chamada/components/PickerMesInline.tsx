import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors, radius, spacing, touchTarget, type } from '../../../constants/theme';
import { formatMesAno, type DiaCalendario } from '../calendar';
import { estilosCalendario } from './estiloCalendario';

const DIAS_SEMANA_ROTULO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

type Props = {
  pickerData: Date;
  pickerGrade: DiaCalendario[];
  pickerMesAtual: number;
  dataISO: string;
  onNavegarMes: (direcao: -1 | 1) => void;
  onSelecionarData: (data: Date) => void;
  onFechar: () => void;
};

export function PickerMesInline({
  pickerData,
  pickerGrade,
  pickerMesAtual,
  dataISO,
  onNavegarMes,
  onSelecionarData,
  onFechar,
}: Props) {
  return (
    <View style={styles.pickerInline}>
      <View style={styles.periodoRow}>
        <TouchableOpacity
          testID="chamada-index-picker-nav-anterior"
          style={styles.navegarBotao}
          onPress={() => onNavegarMes(-1)}
          accessibilityRole="button"
          accessibilityLabel="Mês anterior"
        >
          <Ionicons name="chevron-back" size={22} color={colors.onPrimary} />
        </TouchableOpacity>
        <Text style={[type.subtitle, styles.periodoTitulo, styles.pickerMesTitulo]}>{formatMesAno(pickerData)}</Text>
        <TouchableOpacity
          testID="chamada-index-picker-nav-proximo"
          style={styles.navegarBotao}
          onPress={() => onNavegarMes(1)}
          accessibilityRole="button"
          accessibilityLabel="Próximo mês"
        >
          <Ionicons name="chevron-forward" size={22} color={colors.onPrimary} />
        </TouchableOpacity>
      </View>

      <View style={estilosCalendario.mesCabecalho}>
        {DIAS_SEMANA_ROTULO.map((rotulo, indice) => (
          <Text key={`${rotulo}-${indice}`} style={[type.caption, estilosCalendario.mesCabecalhoTexto]}>
            {rotulo}
          </Text>
        ))}
      </View>
      <View style={estilosCalendario.mesGrid}>
        {pickerGrade.map((dia) => {
          const selecionado = dia.iso === dataISO;
          const foraDoMes = dia.data.getMonth() !== pickerMesAtual;
          return (
            <TouchableOpacity
              key={dia.iso}
              testID={`chamada-index-picker-dia-${dia.iso}`}
              style={[
                estilosCalendario.mesDia,
                selecionado && estilosCalendario.mesDiaAtivo,
                foraDoMes && estilosCalendario.mesDiaFora,
              ]}
              onPress={() => onSelecionarData(dia.data)}
            >
              <Text
                style={[
                  type.caption,
                  estilosCalendario.mesDiaTexto,
                  selecionado && estilosCalendario.mesDiaTextoAtivo,
                ]}
              >
                {dia.diaMes}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.pickerAcoes}>
        <TouchableOpacity testID="chamada-index-picker-hoje" style={styles.pickerHojeBotao} onPress={() => onSelecionarData(new Date())}>
          <Text style={styles.pickerHojeTexto}>Hoje</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="chamada-index-picker-fechar" style={styles.pickerFecharBotao} onPress={onFechar}>
          <Text style={styles.pickerFecharTexto}>Fechar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pickerInline: {
    marginTop: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  periodoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  periodoTitulo: {
    textTransform: 'capitalize',
  },
  // Mesmo padrão do botão de voltar do cabeçalho: círculo preenchido e cor
  // sólida, não contorno fino — pra quem tem baixa visão enxergar de longe.
  navegarBotao: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  pickerMesTitulo: {
    textAlign: 'center',
  },
  pickerAcoes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  pickerHojeBotao: {
    minHeight: touchTarget,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  pickerHojeTexto: {
    color: colors.primary,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
  pickerFecharBotao: {
    minHeight: touchTarget,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  pickerFecharTexto: {
    color: colors.textMuted,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
});
