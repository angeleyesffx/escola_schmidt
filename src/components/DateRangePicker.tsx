import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { formatMesAno, getGradeMes, paraDataSemHorario, parseDataISO } from '../features/chamada/calendar';
import { colors, radius, spacing, touchTarget, type } from '../constants/theme';

const DIAS_SEMANA_ROTULO = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const LARGURA_COLUNA = '14.2857%';

type Props = {
  inicioISO: string;
  fimISO: string;
  onConfirmar: (inicioISO: string, fimISO: string) => void;
  onFechar: () => void;
  // Aula particular é um dia só — sem isso, o segundo toque vira "fim do
  // período" igual no evento, o que não faz sentido pra um agendamento
  // pontual.
  apenasUmDia?: boolean;
};

function formatBR(dataISO: string): string {
  return dataISO.split('-').reverse().join('/');
}

// Igual reserva de hotel: primeiro toque marca o início, segundo toque marca
// o fim, e o período inteiro entre os dois fica destacado — mas nada é salvo
// até tocar em "Confirmar". Fechar o calendário sem confirmar (ou tocar de
// novo depois de um período já fechado) não muda o que já estava escolhido.
export function DateRangePicker({ inicioISO, fimISO, onConfirmar, onFechar, apenasUmDia = false }: Props) {
  const [mesReferencia, setMesReferencia] = useState(() => parseDataISO(inicioISO) ?? paraDataSemHorario(new Date()));
  const [rascunhoInicio, setRascunhoInicio] = useState(inicioISO);
  const [rascunhoFim, setRascunhoFim] = useState<string | null>(
    !apenasUmDia && fimISO !== inicioISO ? fimISO : null
  );

  const grade = getGradeMes(mesReferencia);
  const mesAtual = mesReferencia.getMonth();

  function navegarMes(direcao: -1 | 1) {
    setMesReferencia((atual) => new Date(atual.getFullYear(), atual.getMonth() + direcao, 1));
  }

  function tocarDia(iso: string) {
    if (apenasUmDia) {
      setRascunhoInicio(iso);
      return;
    }
    if (rascunhoFim || !rascunhoInicio) {
      setRascunhoInicio(iso);
      setRascunhoFim(null);
      return;
    }
    if (iso <= rascunhoInicio) {
      setRascunhoInicio(iso);
      return;
    }
    setRascunhoFim(iso);
  }

  return (
    <View style={styles.container}>
      <Text style={[type.body, styles.resumo]}>
        {rascunhoFim ? `${formatBR(rascunhoInicio)} → ${formatBR(rascunhoFim)}` : formatBR(rascunhoInicio)}
      </Text>

      <View style={styles.navRow}>
        <TouchableOpacity
          style={styles.navBotao}
          onPress={() => navegarMes(-1)}
          accessibilityRole="button"
          accessibilityLabel="Mês anterior"
        >
          <Ionicons name="chevron-back" size={22} color={colors.onPrimary} />
        </TouchableOpacity>
        <Text style={[type.subtitle, styles.mesTitulo]}>{formatMesAno(mesReferencia)}</Text>
        <TouchableOpacity
          style={styles.navBotao}
          onPress={() => navegarMes(1)}
          accessibilityRole="button"
          accessibilityLabel="Próximo mês"
        >
          <Ionicons name="chevron-forward" size={22} color={colors.onPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.cabecalho}>
        {DIAS_SEMANA_ROTULO.map((rotulo, indice) => (
          <Text key={`${rotulo}-${indice}`} style={[type.caption, styles.cabecalhoTexto]}>
            {rotulo}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {grade.map((dia) => {
          const foraDoMes = dia.data.getMonth() !== mesAtual;
          const fimComparavel = rascunhoFim ?? rascunhoInicio;
          const dentroDoRange = dia.iso >= rascunhoInicio && dia.iso <= fimComparavel;
          const eBorda = dia.iso === rascunhoInicio || dia.iso === rascunhoFim;
          return (
            <TouchableOpacity
              key={dia.iso}
              style={[
                styles.dia,
                dentroDoRange && styles.diaNoRange,
                eBorda && styles.diaBorda,
                foraDoMes && styles.diaForaDoMes,
              ]}
              onPress={() => tocarDia(dia.iso)}
            >
              <Text
                style={[
                  type.caption,
                  styles.diaTexto,
                  dentroDoRange && styles.diaTextoNoRange,
                  eBorda && styles.diaTextoBorda,
                ]}
              >
                {dia.diaMes}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[type.caption, styles.dica]}>
        {apenasUmDia
          ? 'Toque numa data e confirme.'
          : rascunhoFim
            ? 'Toque em outra data pra recomeçar.'
            : 'Toque numa segunda data para um período — ou confirme só esse dia.'}
      </Text>

      <View style={styles.acoes}>
        <TouchableOpacity style={styles.fecharBotao} onPress={onFechar}>
          <Text style={styles.fecharTexto}>Fechar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.confirmarBotao}
          onPress={() => onConfirmar(rascunhoInicio, rascunhoFim ?? rascunhoInicio)}
        >
          <Text style={styles.confirmarTexto}>Confirmar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  resumo: {
    textAlign: 'center',
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // Mesmo padrão do botão de voltar do cabeçalho: círculo preenchido e cor
  // sólida, não contorno fino — pra quem tem baixa visão enxergar de longe.
  navBotao: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  mesTitulo: {
    textTransform: 'capitalize',
  },
  cabecalho: {
    flexDirection: 'row',
    marginTop: spacing.md,
  },
  cabecalhoTexto: {
    width: LARGURA_COLUNA,
    textAlign: 'center',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.xs,
  },
  dia: {
    width: LARGURA_COLUNA,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diaNoRange: {
    backgroundColor: colors.surfaceTint,
  },
  diaBorda: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
  },
  diaForaDoMes: {
    opacity: 0.35,
  },
  diaTexto: {
    color: colors.text,
  },
  diaTextoNoRange: {
    color: colors.primary,
  },
  diaTextoBorda: {
    color: colors.onPrimary,
  },
  dica: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  acoes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  fecharBotao: {
    minHeight: touchTarget,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  fecharTexto: {
    color: colors.textMuted,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
  confirmarBotao: {
    minHeight: touchTarget,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmarTexto: {
    color: colors.onPrimary,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
});
