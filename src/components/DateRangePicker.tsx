import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { formatMesAno, getGradeMes, paraDataSemHorario, parseDataISO } from '../features/chamada/calendar';
import { colors, radius, spacing, touchTarget, type } from '../constants/theme';

const DIAS_SEMANA_ROTULO = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const ALTURA_ITEM_RODA = 44;
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

function dataISOValida(dataISO: string) {
  const data = parseDataISO(dataISO);
  return Boolean(data && dataISO === `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`);
}

type RodaProps = {
  valores: string[];
  indiceSelecionado: number;
  onSelecionar: (indice: number) => void;
  testID: string;
};

function RodaData({ valores, indiceSelecionado, onSelecionar, testID }: RodaProps) {
  const rodaRef = useRef<ScrollView>(null);

  function atualizarIndicePeloOffset(offsetY: number) {
    const indice = Math.max(0, Math.min(valores.length - 1, Math.round(offsetY / ALTURA_ITEM_RODA)));
    if (indice !== indiceSelecionado) onSelecionar(indice);
  }

  function selecionarIndice(indice: number) {
    rodaRef.current?.scrollTo({ y: indice * ALTURA_ITEM_RODA, animated: true });
    onSelecionar(indice);
  }

  useEffect(() => {
    rodaRef.current?.scrollTo({ y: indiceSelecionado * ALTURA_ITEM_RODA, animated: false });
  }, [indiceSelecionado]);

  return (
    <View style={styles.rodaColuna}>
      <ScrollView
        ref={rodaRef}
        testID={testID}
        showsVerticalScrollIndicator={false}
        snapToInterval={ALTURA_ITEM_RODA}
        decelerationRate="fast"
        scrollEventThrottle={16}
        contentOffset={{ x: 0, y: indiceSelecionado * ALTURA_ITEM_RODA }}
        contentContainerStyle={styles.rodaConteudo}
        onScroll={(evento) => atualizarIndicePeloOffset(evento.nativeEvent.contentOffset.y)}
        onMomentumScrollEnd={(evento) => {
          atualizarIndicePeloOffset(evento.nativeEvent.contentOffset.y);
        }}
      >
        {valores.map((valor, indice) => (
          <TouchableOpacity
            key={`${valor}-${indice}`}
            style={[styles.rodaItem, indice === indiceSelecionado && styles.rodaItemAtivo]}
            onPress={() => selecionarIndice(indice)}
          >
            <Text style={[styles.rodaTexto, indice === indiceSelecionado && styles.rodaTextoAtivo]}>{valor}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View pointerEvents="none" style={styles.rodaLente}>
        <Text style={styles.rodaLenteTexto}>{valores[indiceSelecionado]}</Text>
      </View>
      <View pointerEvents="none" style={[styles.rodaFade, styles.rodaFadeTopo]} />
      <View pointerEvents="none" style={[styles.rodaFade, styles.rodaFadeBase]} />
    </View>
  );
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
  const [seletorMesAnoAberto, setSeletorMesAnoAberto] = useState(false);
  const [anoDigitado, setAnoDigitado] = useState(String(mesReferencia.getFullYear()));

  const grade = getGradeMes(mesReferencia);
  const mesAtual = mesReferencia.getMonth();
  const dataUnica = parseDataISO(rascunhoInicio) ?? paraDataSemHorario(new Date());
  const anoAtual = dataUnica.getFullYear();
  const mesDataUnica = dataUnica.getMonth();
  const diaDataUnica = dataUnica.getDate();
  const diasNoMes = new Date(anoAtual, mesDataUnica + 1, 0).getDate();
  const anosDisponiveis = Array.from({ length: new Date().getFullYear() - 1899 }, (_, indice) => String(1900 + indice));
  const diasDisponiveis = Array.from({ length: diasNoMes }, (_, indice) => String(indice + 1).padStart(2, '0'));

  function navegarMes(direcao: -1 | 1) {
    setMesReferencia((atual) => {
      const proximo = new Date(atual.getFullYear(), atual.getMonth() + direcao, 1);
      setAnoDigitado(String(proximo.getFullYear()));
      return proximo;
    });
  }

  function selecionarMes(mes: number) {
    const ano = Number(anoDigitado);
    if (!Number.isInteger(ano) || ano < 1900 || ano > 2200) return;
    setMesReferencia(new Date(ano, mes, 1));
    setSeletorMesAnoAberto(false);
  }

  function alterarAno(texto: string) {
    const somenteNumeros = texto.replace(/\D/g, '').slice(0, 4);
    setAnoDigitado(somenteNumeros);
    if (somenteNumeros.length === 4) {
      const ano = Number(somenteNumeros);
      if (ano >= 1900 && ano <= 2200) {
        setMesReferencia((atual) => new Date(ano, atual.getMonth(), 1));
      }
    }
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

  function selecionarParteData(parte: 'mes' | 'dia' | 'ano', indice: number) {
    const mes = parte === 'mes' ? indice : mesDataUnica;
    const ano = parte === 'ano' ? Number(anosDisponiveis[indice]) : anoAtual;
    const limiteDia = new Date(ano, mes + 1, 0).getDate();
    const dia = parte === 'dia' ? indice + 1 : Math.min(diaDataUnica, limiteDia);
    const novaData = new Date(ano, mes, dia);
    const iso = `${novaData.getFullYear()}-${String(novaData.getMonth() + 1).padStart(2, '0')}-${String(novaData.getDate()).padStart(2, '0')}`;
    setRascunhoInicio(iso);
    setRascunhoFim(null);
  }

  function confirmar() {
    const fim = rascunhoFim ?? rascunhoInicio;
    if (!dataISOValida(rascunhoInicio) || !dataISOValida(fim) || fim < rascunhoInicio) return;
    onConfirmar(rascunhoInicio, fim);
  }

  return (
    <View style={styles.container}>
      <Text style={[type.body, styles.resumo]}>
        {rascunhoFim ? `${formatBR(rascunhoInicio)} → ${formatBR(rascunhoFim)}` : formatBR(rascunhoInicio)}
      </Text>

      {apenasUmDia ? (
        <View style={styles.rodasData}>
          <RodaData
            valores={MESES}
            indiceSelecionado={mesDataUnica}
            onSelecionar={(indice) => selecionarParteData('mes', indice)}
            testID="date-picker-roda-mes"
          />
          <RodaData
            valores={diasDisponiveis}
            indiceSelecionado={diaDataUnica - 1}
            onSelecionar={(indice) => selecionarParteData('dia', indice)}
            testID="date-picker-roda-dia"
          />
          <RodaData
            valores={anosDisponiveis}
            indiceSelecionado={anosDisponiveis.indexOf(String(anoAtual))}
            onSelecionar={(indice) => selecionarParteData('ano', indice)}
            testID="date-picker-roda-ano"
          />
        </View>
      ) : null}

      {!apenasUmDia ? <View style={styles.navRow}>
        <TouchableOpacity
          style={styles.navBotao}
          onPress={() => navegarMes(-1)}
          accessibilityRole="button"
          accessibilityLabel="Mês anterior"
        >
          <Ionicons name="chevron-back" size={22} color={colors.onPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.mesTituloBotao}
          onPress={() => {
            setAnoDigitado(String(mesReferencia.getFullYear()));
            setSeletorMesAnoAberto((aberto) => !aberto);
          }}
          accessibilityRole="button"
          accessibilityLabel="Escolher mês e ano"
        >
          <Text style={[type.subtitle, styles.mesTitulo]}>{formatMesAno(mesReferencia)}</Text>
          <Ionicons
            name={seletorMesAnoAberto ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.primary}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navBotao}
          onPress={() => navegarMes(1)}
          accessibilityRole="button"
          accessibilityLabel="Próximo mês"
        >
          <Ionicons name="chevron-forward" size={22} color={colors.onPrimary} />
        </TouchableOpacity>
      </View> : null}

      {!apenasUmDia && seletorMesAnoAberto ? (
        <View style={styles.seletorMesAno}>
          <Text style={[type.label, styles.seletorRotulo]}>Escolha o ano</Text>
          <TextInput
            testID="date-picker-ano"
            style={styles.anoInput}
            value={anoDigitado}
            onChangeText={alterarAno}
            keyboardType="number-pad"
            maxLength={4}
            selectTextOnFocus
          />
          <Text style={[type.label, styles.seletorRotulo]}>Escolha o mês</Text>
          <View style={styles.mesesGrid}>
            {MESES.map((mes, indice) => (
              <TouchableOpacity
                key={mes}
                testID={`date-picker-mes-${indice}`}
                style={[styles.mesOpcao, indice === mesAtual && styles.mesOpcaoAtiva]}
                onPress={() => selecionarMes(indice)}
              >
                <Text style={[styles.mesOpcaoTexto, indice === mesAtual && styles.mesOpcaoTextoAtivo]}>{mes}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

      {!apenasUmDia ? <View style={styles.cabecalho}>
        {DIAS_SEMANA_ROTULO.map((rotulo, indice) => (
          <Text key={`${rotulo}-${indice}`} style={[type.caption, styles.cabecalhoTexto]}>
            {rotulo}
          </Text>
        ))}
      </View> : null}

      {!apenasUmDia ? <View style={styles.grid}>
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
      </View> : null}

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
          onPress={confirmar}
          disabled={!dataISOValida(rascunhoInicio)}
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
  rodasData: {
    flexDirection: 'row',
    height: ALTURA_ITEM_RODA * 3,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    marginVertical: spacing.md,
    overflow: 'hidden',
  },
  rodaColuna: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  rodaLente: {
    position: 'absolute',
    top: ALTURA_ITEM_RODA,
    left: spacing.xs,
    right: spacing.xs,
    height: ALTURA_ITEM_RODA,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.surfaceTint,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rodaLenteTexto: {
    color: colors.text,
    fontFamily: type.subtitle.fontFamily,
    fontSize: 20,
    transform: [{ scale: 1.08 }],
  },
  rodaFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ALTURA_ITEM_RODA,
    backgroundColor: 'rgba(255, 255, 255, 0.62)',
  },
  rodaFadeTopo: {
    top: 0,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  rodaFadeBase: {
    bottom: 0,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  rodaConteudo: {
    paddingVertical: ALTURA_ITEM_RODA,
  },
  rodaItem: {
    height: ALTURA_ITEM_RODA,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rodaItemAtivo: {
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    borderBottomWidth: 0,
  },
  rodaTexto: {
    color: colors.textMuted,
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
  },
  rodaTextoAtivo: {
    color: colors.text,
    fontFamily: type.subtitle.fontFamily,
    fontSize: 20,
    transform: [{ scale: 1.08 }],
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
  mesTituloBotao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    minHeight: touchTarget,
  },
  seletorMesAno: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
  },
  seletorRotulo: {
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  anoInput: {
    width: 96,
    height: touchTarget,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
    marginBottom: spacing.md,
  },
  mesesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  mesOpcao: {
    width: '23%',
    minHeight: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mesOpcaoAtiva: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  mesOpcaoTexto: {
    color: colors.text,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
  mesOpcaoTextoAtivo: {
    color: colors.onPrimary,
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
  // Mesma altura do touchTarget do tema — esse calendário agora também é
  // usado no cadastro de aluno, em pé na beira da pista.
  dia: {
    width: LARGURA_COLUNA,
    height: touchTarget,
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
