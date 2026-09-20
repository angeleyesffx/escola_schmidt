import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { AulaParticular, AulaRecorrente, AulaTeste } from '../api';
import { formatHora, type DiaCalendario } from '../calendar';
import type { EventoCalendario } from '../../eventos/api';
import { filtrarEventosNoDia, filtrarParticularesNoDia, filtrarTestesNoDia } from '../selectors';
import { colors, radius, spacing, type } from '../../../constants/theme';
import { estilosCalendario, LARGURA_COLUNA_CALENDARIO } from './estiloCalendario';

const DIAS_SEMANA_ROTULO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

type Props = {
  diasSemana: DiaCalendario[];
  dataISO: string;
  aulasPorDiaSemana: Map<number, AulaRecorrente[]>;
  eventos: EventoCalendario[];
  particulares: AulaParticular[];
  aulasTeste: AulaTeste[];
  corPorTipo: Map<string, string>;
  onSelecionarDia: (dia: DiaCalendario) => void;
};

export function CalendarioSemana({
  diasSemana,
  dataISO,
  aulasPorDiaSemana,
  eventos,
  particulares,
  aulasTeste,
  corPorTipo,
  onSelecionarDia,
}: Props) {
  return (
    <View>
      <View style={estilosCalendario.mesCabecalho}>
        {DIAS_SEMANA_ROTULO.map((rotulo, indice) => (
          <View key={`${rotulo}-${indice}`} style={estilosCalendario.mesCabecalhoColuna}>
            <Text style={[type.caption, estilosCalendario.mesCabecalhoTexto]}>{rotulo}</Text>
          </View>
        ))}
      </View>
      <View style={styles.semanaGrid}>
        {diasSemana.map((dia) => {
          const selecionado = dia.iso === dataISO;
          const aulasDoDia = aulasPorDiaSemana.get(dia.diaSemana) ?? [];
          const eventosDoDia = filtrarEventosNoDia(eventos, dia.iso);
          const particularesDoDia = filtrarParticularesNoDia(particulares, dia.iso);
          const testesDoDia = filtrarTestesNoDia(aulasTeste, dia.iso);
          return (
            <TouchableOpacity
              key={dia.iso}
              testID={`chamada-index-semana-dia-${dia.iso}`}
              style={[styles.diaCard, selecionado && styles.diaCardAtivo]}
              onPress={() => onSelecionarDia(dia)}
            >
              <Text style={[type.subtitle, styles.diaNumero, selecionado && styles.diaNumeroAtivo]}>{dia.diaMes}</Text>
              {aulasDoDia.length > 0 ? (
                <Text style={[type.caption, styles.diaHorarios]} numberOfLines={2}>
                  {aulasDoDia.map((a) => formatHora(a.hora)).join('\n')}
                </Text>
              ) : (
                <Text style={[type.caption, styles.diaSemAula]}>—</Text>
              )}
              {eventosDoDia.length > 0 || particularesDoDia.length > 0 || testesDoDia.length > 0 ? (
                <View style={styles.diaEventosRow}>
                  {eventosDoDia.slice(0, 3).map((e) => (
                    <View key={e.id} style={[styles.diaEventoDot, { backgroundColor: corPorTipo.get(e.tipo_id) }]} />
                  ))}
                  {particularesDoDia.length > 0 ? (
                    <View style={[styles.diaEventoDot, estilosCalendario.diaParticularDot]} />
                  ) : null}
                  {testesDoDia.length > 0 ? <View style={[styles.diaEventoDot, estilosCalendario.diaTesteDot]} /> : null}
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  semanaGrid: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  diaCard: {
    width: LARGURA_COLUNA_CALENDARIO,
    minHeight: 88,
    borderRadius: radius.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  diaCardAtivo: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceTint,
  },
  diaNumero: {
    color: colors.text,
    marginTop: 1,
  },
  diaNumeroAtivo: {
    color: colors.primary,
  },
  diaHorarios: {
    color: colors.primary,
    marginTop: 2,
    textAlign: 'center',
  },
  diaSemAula: {
    color: colors.pending,
    marginTop: 2,
  },
  diaEventosRow: {
    position: 'absolute',
    bottom: spacing.xs,
    flexDirection: 'row',
    gap: 3,
  },
  diaEventoDot: {
    width: 5,
    height: 5,
    borderRadius: radius.pill,
  },
});
