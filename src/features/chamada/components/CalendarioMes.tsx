import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { AulaParticular, AulaRecorrente, AulaTeste } from '../api';
import { formatHora, type DiaCalendario } from '../calendar';
import type { EventoCalendario } from '../../eventos/api';
import { filtrarEventosNoDia, filtrarParticularesNoDia, filtrarTestesNoDia } from '../selectors';
import { colors, radius, type } from '../../../constants/theme';
import { estilosCalendario } from './estiloCalendario';

const DIAS_SEMANA_ROTULO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

type Props = {
  gradeMes: DiaCalendario[];
  dataISO: string;
  mesAtual: number;
  aulasPorDiaSemana: Map<number, AulaRecorrente[]>;
  eventos: EventoCalendario[];
  particulares: AulaParticular[];
  aulasTeste: AulaTeste[];
  corPorTipo: Map<string, string>;
  onSelecionarDia: (dia: DiaCalendario) => void;
};

export function CalendarioMes({
  gradeMes,
  dataISO,
  mesAtual,
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
      <View style={estilosCalendario.mesGrid}>
        {gradeMes.map((dia) => {
          const selecionado = dia.iso === dataISO;
          const foraDoMes = dia.data.getMonth() !== mesAtual;
          const aulasDoDia = aulasPorDiaSemana.get(dia.diaSemana) ?? [];
          const eventosDoDia = filtrarEventosNoDia(eventos, dia.iso);
          const particularesDoDia = filtrarParticularesNoDia(particulares, dia.iso);
          const testesDoDia = filtrarTestesNoDia(aulasTeste, dia.iso);
          return (
            <TouchableOpacity
              key={dia.iso}
              testID={`chamada-index-mes-dia-${dia.iso}`}
              style={[
                estilosCalendario.mesDia,
                styles.mesDia,
                selecionado && estilosCalendario.mesDiaAtivo,
                foraDoMes && estilosCalendario.mesDiaFora,
              ]}
              onPress={() => onSelecionarDia(dia)}
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
              {aulasDoDia.length > 0 ? (
                <Text style={styles.mesDiaHorarios} numberOfLines={2}>
                  {aulasDoDia.map((aula) => formatHora(aula.hora)).join('\n')}
                </Text>
              ) : null}
              {eventosDoDia.length > 0 || particularesDoDia.length > 0 || testesDoDia.length > 0 ? (
                <View style={styles.mesDiaEventosRow}>
                  {eventosDoDia.slice(0, 2).map((e) => (
                    <View key={e.id} style={[styles.mesDiaEventoDot, { backgroundColor: corPorTipo.get(e.tipo_id) }]} />
                  ))}
                  {particularesDoDia.length > 0 ? (
                    <View style={[styles.mesDiaEventoDot, estilosCalendario.diaParticularDot]} />
                  ) : null}
                  {testesDoDia.length > 0 ? (
                    <View style={[styles.mesDiaEventoDot, estilosCalendario.diaTesteDot]} />
                  ) : null}
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
  mesDia: {
    height: 88,
    paddingTop: 8,
    paddingBottom: 16,
  },
  mesDiaHorarios: {
    color: colors.primary,
    fontFamily: type.caption.fontFamily,
    fontSize: type.caption.fontSize,
    lineHeight: 15,
    marginTop: 2,
    textAlign: 'center',
  },
  mesDiaPonto: {
    width: 5,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.onTrack,
    marginTop: 3,
  },
  mesDiaEventosRow: {
    position: 'absolute',
    bottom: 3,
    flexDirection: 'row',
    gap: 2,
  },
  mesDiaEventoDot: {
    width: 4,
    height: 4,
    borderRadius: radius.pill,
  },
});
