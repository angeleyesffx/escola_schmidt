import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Alert, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import {
  excluirAulaParticular,
  excluirAulaTeste,
  getAulasParticularesPorPeriodo,
  getAulasRecorrentesPorData,
  getAulasTestePorPeriodo,
  getGradeSemanal,
  type AulaParticular,
  type AulaTeste,
} from '../../../src/features/chamada/api';
import {
  addDias,
  formatDataExtenso,
  formatDataISO,
  formatIntervaloSemana,
  formatMesAno,
  getDiasDaSemana,
  getGradeMes,
  paraDataSemHorario,
} from '../../../src/features/chamada/calendar';
import { getEventosPorPeriodo, getTiposEvento } from '../../../src/features/eventos/api';
import { useAuth } from '../../../src/features/auth/AuthProvider';
import { useAsyncData } from '../../../src/hooks/useAsyncData';
import { PageHeader } from '../../../src/components/PageHeader';
import { Footer } from '../../../src/components/Footer';
import { colors, radius, spacing, touchTarget, type } from '../../../src/constants/theme';

type ModoCalendario = 'semana' | 'mes';

const DIAS_SEMANA_ROTULO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const LARGURA_COLUNA_CALENDARIO = '14.2857%';

function formatHora(hora: string) {
  return hora.slice(0, 5);
}

function formatModulos(modulos: number[]) {
  return modulos.length === 1 ? `Módulo ${modulos[0]}` : `Módulos ${modulos.join(', ')}`;
}

export default function ChamadaIndex() {
  const router = useRouter();
  const { meuPapel } = useAuth();
  const podeEditar = meuPapel === 'dono' || meuPapel === 'professor';
  const [modo, setModo] = useState<ModoCalendario>('semana');
  const [dataSelecionada, setDataSelecionada] = useState(paraDataSemHorario(new Date()));
  const [pickerAberto, setPickerAberto] = useState(false);
  const [pickerData, setPickerData] = useState(dataSelecionada);
  const [filtroEventosDataISO, setFiltroEventosDataISO] = useState<string | null>(null);

  const dataISO = formatDataISO(dataSelecionada);
  const diasSemana = getDiasDaSemana(dataSelecionada);
  const gradeMes = getGradeMes(dataSelecionada);
  const mesAtual = dataSelecionada.getMonth();

  const pickerGrade = getGradeMes(pickerData);
  const pickerMesAtual = pickerData.getMonth();

  const inicioVisivel = modo === 'semana' ? diasSemana[0].iso : gradeMes[0].iso;
  const fimVisivel = modo === 'semana' ? diasSemana[6].iso : gradeMes[gradeMes.length - 1].iso;

  // Grade fixa é pequena e quase nunca muda — busca uma vez só, não a cada
  // troca de dia/semana/mês, pra pintar horário/módulo direto no calendário.
  const { data: dadosGradeSemanal } = useAsyncData(getGradeSemanal, []);
  const gradeSemanal = dadosGradeSemanal ?? [];

  const aulasPorDiaSemana = new Map<number, typeof gradeSemanal>();
  for (const aula of gradeSemanal) {
    const lista = aulasPorDiaSemana.get(aula.dia_semana) ?? [];
    lista.push(aula);
    aulasPorDiaSemana.set(aula.dia_semana, lista);
  }

  const { data: dadosTiposEvento } = useAsyncData(getTiposEvento, []);
  const tiposEvento = dadosTiposEvento ?? [];

  const { data: dadosEventos } = useAsyncData(
    () => getEventosPorPeriodo(inicioVisivel, fimVisivel),
    [inicioVisivel, fimVisivel]
  );
  const eventos = dadosEventos ?? [];

  // onFocus (não mount simples) pra já mostrar uma particular recém agendada
  // quando volta da tela de agendamento.
  const { data: dadosParticulares, setData: setParticulares } = useAsyncData(
    () => getAulasParticularesPorPeriodo(inicioVisivel, fimVisivel),
    [inicioVisivel, fimVisivel],
    { onFocus: true }
  );
  const particulares = dadosParticulares ?? [];

  // Mesmo padrão de particulares: onFocus pra refletir uma teste recém
  // agendada ao voltar da tela de agendamento.
  const { data: dadosAulasTeste, setData: setAulasTeste } = useAsyncData(
    () => getAulasTestePorPeriodo(inicioVisivel, fimVisivel),
    [inicioVisivel, fimVisivel],
    { onFocus: true }
  );
  const aulasTeste = dadosAulasTeste ?? [];

  const corPorTipo = new Map(tiposEvento.map((t) => [t.id, t.cor]));

  function eventosNoDia(iso: string) {
    return eventos.filter((e) => iso >= e.data_inicio && iso <= e.data_fim);
  }

  function particularesNoDia(iso: string) {
    return particulares.filter((p) => p.data === iso);
  }

  function testesNoDia(iso: string) {
    return aulasTeste.filter((t) => t.data === iso);
  }

  const eventosFiltrados = filtroEventosDataISO ? eventosNoDia(filtroEventosDataISO) : eventos;
  const particularesFiltradas = filtroEventosDataISO ? particularesNoDia(filtroEventosDataISO) : particulares;
  const testesFiltrados = filtroEventosDataISO ? testesNoDia(filtroEventosDataISO) : aulasTeste;

  function confirmarExclusaoParticular(aula: AulaParticular) {
    Alert.alert(
      'Cancelar aula particular',
      `Cancelar a aula de ${aula.aluno_nome} com ${aula.professor_nome} em ${aula.data.split('-').reverse().join('/')} às ${formatHora(aula.hora)}?`,
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Cancelar aula',
          style: 'destructive',
          onPress: () => {
            excluirAulaParticular(aula.id)
              .then(() => setParticulares((atual) => (atual ?? []).filter((p) => p.id !== aula.id)))
              .catch((err) => console.error(err));
          },
        },
      ]
    );
  }

  function confirmarExclusaoTeste(aula: AulaTeste) {
    const nomes = aula.alunos.map((a) => a.nome).join(', ') || 'sem alunos';
    Alert.alert(
      'Cancelar aula teste',
      `Cancelar a aula teste de ${nomes} em ${aula.data.split('-').reverse().join('/')} às ${formatHora(aula.hora)}?`,
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Cancelar aula',
          style: 'destructive',
          onPress: () => {
            excluirAulaTeste(aula.id)
              .then(() => setAulasTeste((atual) => (atual ?? []).filter((t) => t.id !== aula.id)))
              .catch((err) => console.error(err));
          },
        },
      ]
    );
  }

  const {
    data: dadosAulas,
    loading,
    error,
  } = useAsyncData(() => getAulasRecorrentesPorData(dataISO), [dataISO], {
    onFocus: true,
    mensagemErro: 'Erro ao carregar a grade. Tente novamente.',
  });
  const aulas = dadosAulas ?? [];

  function navegarPeriodo(direcao: -1 | 1) {
    if (modo === 'semana') {
      setDataSelecionada((anterior) => addDias(anterior, direcao * 7));
      return;
    }
    setDataSelecionada((anterior) => new Date(anterior.getFullYear(), anterior.getMonth() + direcao, 1));
  }

  function abrirPicker() {
    if (pickerAberto) {
      setPickerAberto(false);
      return;
    }
    setPickerData(dataSelecionada);
    setPickerAberto(true);
  }

  function navegarPickerMes(direcao: -1 | 1) {
    setPickerData((anterior) => new Date(anterior.getFullYear(), anterior.getMonth() + direcao, 1));
  }

  function selecionarDataPicker(data: Date) {
    const dataNormalizada = paraDataSemHorario(data);
    setDataSelecionada(dataNormalizada);
    setFiltroEventosDataISO(formatDataISO(dataNormalizada));
    setPickerAberto(false);
  }

  if (loading) {
    return (
      <>
        <PageHeader titulo="Agenda" />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </>
    );
  }

  const cabecalho = (
    <View>
      <View style={styles.bannerTopo}>
        <View style={styles.bannerTopoTexto}>
          <Text style={[type.label, styles.bannerTopoTag]}>Agenda</Text>
          <Text style={type.subtitle}>Planejamento da semana</Text>
          <Text style={[type.caption, styles.subtitle]}>Acompanhe aulas, particulares e eventos do período.</Text>
        </View>
        <Image source={require('../../../assets/cards/card-eventos.png')} style={styles.bannerTopoImagem} />
      </View>

      {podeEditar ? (
        <View style={styles.tituloRow}>
          <TouchableOpacity
            testID="chamada-index-particular-novo"
            style={styles.particularBotao}
            onPress={() => router.push('/chamada/agendar')}
          >
            <Text style={styles.particularBotaoTexto}>Agendar aula</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.modoRow}>
        <TouchableOpacity
          testID="chamada-index-toggle-semana"
          style={[styles.modoChip, modo === 'semana' && styles.modoChipAtivo]}
          onPress={() => setModo('semana')}
        >
          <Text style={[styles.modoChipTexto, modo === 'semana' && styles.modoChipTextoAtivo]}>Semana</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="chamada-index-toggle-mes"
          style={[styles.modoChip, modo === 'mes' && styles.modoChipAtivo]}
          onPress={() => setModo('mes')}
        >
          <Text style={[styles.modoChipTexto, modo === 'mes' && styles.modoChipTextoAtivo]}>Mês</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.periodoRow}>
        <TouchableOpacity
          testID="chamada-index-nav-anterior"
          style={styles.navegarBotao}
          onPress={() => navegarPeriodo(-1)}
          accessibilityRole="button"
          accessibilityLabel="Período anterior"
        >
          <Ionicons name="chevron-back" size={22} color={colors.onPrimary} />
        </TouchableOpacity>
        <TouchableOpacity testID="chamada-index-periodo-abrir" style={styles.periodoCentro} onPress={abrirPicker}>
          <View style={styles.periodoIconeBadge}>
            <View style={styles.periodoIconeCorpo}>
              <View style={styles.periodoIconeTopo} />
            </View>
          </View>
          <Text style={[type.title, styles.periodoTitulo]}>
            {modo === 'semana' ? formatIntervaloSemana(diasSemana) : formatMesAno(dataSelecionada)}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="chamada-index-nav-proximo"
          style={styles.navegarBotao}
          onPress={() => navegarPeriodo(1)}
          accessibilityRole="button"
          accessibilityLabel="Próximo período"
        >
          <Ionicons name="chevron-forward" size={22} color={colors.onPrimary} />
        </TouchableOpacity>
      </View>

      {pickerAberto ? (
        <View style={styles.pickerInline}>
          <View style={styles.periodoRow}>
            <TouchableOpacity
              testID="chamada-index-picker-nav-anterior"
              style={styles.navegarBotao}
              onPress={() => navegarPickerMes(-1)}
              accessibilityRole="button"
              accessibilityLabel="Mês anterior"
            >
              <Ionicons name="chevron-back" size={22} color={colors.onPrimary} />
            </TouchableOpacity>
            <Text style={[type.subtitle, styles.periodoTitulo, styles.pickerMesTitulo]}>
              {formatMesAno(pickerData)}
            </Text>
            <TouchableOpacity
              testID="chamada-index-picker-nav-proximo"
              style={styles.navegarBotao}
              onPress={() => navegarPickerMes(1)}
              accessibilityRole="button"
              accessibilityLabel="Próximo mês"
            >
              <Ionicons name="chevron-forward" size={22} color={colors.onPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.mesCabecalho}>
            {DIAS_SEMANA_ROTULO.map((rotulo, indice) => (
              <Text key={`${rotulo}-${indice}`} style={[type.caption, styles.mesCabecalhoTexto]}>
                {rotulo}
              </Text>
            ))}
          </View>
          <View style={styles.mesGrid}>
            {pickerGrade.map((dia) => {
              const selecionado = dia.iso === dataISO;
              const foraDoMes = dia.data.getMonth() !== pickerMesAtual;
              return (
                <TouchableOpacity
                  key={dia.iso}
                  testID={`chamada-index-picker-dia-${dia.iso}`}
                  style={[styles.mesDia, selecionado && styles.mesDiaAtivo, foraDoMes && styles.mesDiaFora]}
                  onPress={() => selecionarDataPicker(dia.data)}
                >
                  <Text style={[type.caption, styles.mesDiaTexto, selecionado && styles.mesDiaTextoAtivo]}>
                    {dia.diaMes}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.pickerAcoes}>
            <TouchableOpacity testID="chamada-index-picker-hoje" style={styles.pickerHojeBotao} onPress={() => selecionarDataPicker(new Date())}>
              <Text style={styles.pickerHojeTexto}>Hoje</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="chamada-index-picker-fechar" style={styles.pickerFecharBotao} onPress={() => setPickerAberto(false)}>
              <Text style={styles.pickerFecharTexto}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {modo === 'semana' ? (
        <View>
          <View style={styles.mesCabecalho}>
            {DIAS_SEMANA_ROTULO.map((rotulo, indice) => (
              <View key={`${rotulo}-${indice}`} style={styles.mesCabecalhoColuna}>
                <Text style={[type.caption, styles.mesCabecalhoTexto]}>{rotulo}</Text>
              </View>
            ))}
          </View>
          <View style={styles.semanaGrid}>
            {diasSemana.map((dia) => {
              const selecionado = dia.iso === dataISO;
              const aulasDoDia = aulasPorDiaSemana.get(dia.diaSemana) ?? [];
              const eventosDoDia = eventosNoDia(dia.iso);
              const particularesDoDia = particularesNoDia(dia.iso);
              const testesDoDia = testesNoDia(dia.iso);
              return (
                <TouchableOpacity
                  key={dia.iso}
                  testID={`chamada-index-semana-dia-${dia.iso}`}
                  style={[styles.diaCard, selecionado && styles.diaCardAtivo]}
                  onPress={() => {
                    setDataSelecionada(dia.data);
                    setFiltroEventosDataISO(dia.iso);
                  }}
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
                      {particularesDoDia.length > 0 ? <View style={[styles.diaEventoDot, styles.diaParticularDot]} /> : null}
                      {testesDoDia.length > 0 ? <View style={[styles.diaEventoDot, styles.diaTesteDot]} /> : null}
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : (
        <View>
          <View style={styles.mesCabecalho}>
            {DIAS_SEMANA_ROTULO.map((rotulo, indice) => (
              <View key={`${rotulo}-${indice}`} style={styles.mesCabecalhoColuna}>
                <Text style={[type.caption, styles.mesCabecalhoTexto]}>{rotulo}</Text>
              </View>
            ))}
          </View>
          <View style={styles.mesGrid}>
            {gradeMes.map((dia) => {
              const selecionado = dia.iso === dataISO;
              const foraDoMes = dia.data.getMonth() !== mesAtual;
              const temAula = aulasPorDiaSemana.has(dia.diaSemana);
              const eventosDoDia = eventosNoDia(dia.iso);
              const particularesDoDia = particularesNoDia(dia.iso);
              const testesDoDia = testesNoDia(dia.iso);
              return (
                <TouchableOpacity
                  key={dia.iso}
                  testID={`chamada-index-mes-dia-${dia.iso}`}
                  style={[styles.mesDia, selecionado && styles.mesDiaAtivo, foraDoMes && styles.mesDiaFora]}
                  onPress={() => {
                    setDataSelecionada(dia.data);
                    setFiltroEventosDataISO(dia.iso);
                  }}
                >
                  <Text style={[type.caption, styles.mesDiaTexto, selecionado && styles.mesDiaTextoAtivo]}>
                    {dia.diaMes}
                  </Text>
                  {temAula ? <View style={styles.mesDiaPonto} /> : null}
                  {eventosDoDia.length > 0 || particularesDoDia.length > 0 || testesDoDia.length > 0 ? (
                    <View style={styles.mesDiaEventosRow}>
                      {eventosDoDia.slice(0, 2).map((e) => (
                        <View
                          key={e.id}
                          style={[styles.mesDiaEventoDot, { backgroundColor: corPorTipo.get(e.tipo_id) }]}
                        />
                      ))}
                      {particularesDoDia.length > 0 ? (
                        <View style={[styles.mesDiaEventoDot, styles.diaParticularDot]} />
                      ) : null}
                      {testesDoDia.length > 0 ? <View style={[styles.mesDiaEventoDot, styles.diaTesteDot]} /> : null}
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      <View style={styles.legendaEventos}>
        <View style={styles.legendaEventoItem}>
          <View style={[styles.legendaEventoDot, styles.legendaAulaDot]} />
          <Text style={[type.caption, styles.legendaPontoTexto]}>Dia com aula na grade</Text>
        </View>
        <View style={styles.legendaEventoItem}>
          <View style={[styles.legendaEventoDot, styles.diaParticularDot]} />
          <Text style={[type.caption, styles.legendaPontoTexto]}>Aula particular agendada</Text>
        </View>
        <View style={styles.legendaEventoItem}>
          <View style={[styles.legendaEventoDot, styles.diaTesteDot]} />
          <Text style={[type.caption, styles.legendaPontoTexto]}>Aula teste agendada</Text>
        </View>
        {tiposEvento.map((tipoEvento) => (
          <View key={tipoEvento.id} style={styles.legendaEventoItem}>
            <View style={[styles.legendaEventoDot, { backgroundColor: tipoEvento.cor }]} />
            <Text style={[type.caption, styles.legendaPontoTexto]}>{tipoEvento.nome}</Text>
          </View>
        ))}
      </View>

      {particularesFiltradas.length > 0 ? (
        <View style={styles.eventosLista}>
          <View style={styles.eventosSecaoTopo}>
            <Text style={[type.label, styles.secao]}>
              {filtroEventosDataISO ? 'Particulares da data selecionada' : 'Aulas particulares deste período'}
            </Text>
          </View>
          {particularesFiltradas.map((p) => (
            <TouchableOpacity
              key={p.id}
              testID={`chamada-index-particular-item-${p.id}`}
              style={styles.eventoItem}
              disabled={!podeEditar}
              onLongPress={() => podeEditar && confirmarExclusaoParticular(p)}
            >
              <View style={[styles.eventoItemCor, styles.diaParticularDot]} />
              <View style={styles.eventoItemTexto}>
                <Text style={type.body}>
                  {p.aluno_nome} · {p.professor_nome}
                </Text>
                <Text style={[type.caption, styles.subtitle]}>
                  {p.data.split('-').reverse().join('/')} às {formatHora(p.hora)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {testesFiltrados.length > 0 ? (
        <View style={styles.eventosLista}>
          <View style={styles.eventosSecaoTopo}>
            <Text style={[type.label, styles.secao]}>
              {filtroEventosDataISO ? 'Testes da data selecionada' : 'Aulas teste deste período'}
            </Text>
          </View>
          {testesFiltrados.map((t) => (
            <TouchableOpacity
              key={t.id}
              testID={`chamada-index-teste-item-${t.id}`}
              style={styles.eventoItem}
              disabled={!podeEditar}
              onLongPress={() => podeEditar && confirmarExclusaoTeste(t)}
            >
              <View style={[styles.eventoItemCor, styles.diaTesteDot]} />
              <View style={styles.eventoItemTexto}>
                <Text style={type.body}>{t.alunos.map((a) => a.nome).join(', ') || 'Sem alunos'}</Text>
                <Text style={[type.caption, styles.subtitle]}>
                  {t.data.split('-').reverse().join('/')} às {formatHora(t.hora)} · {formatModulos(t.modulos)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {eventosFiltrados.length > 0 ? (
        <View style={styles.eventosLista}>
          <View style={styles.eventosSecaoTopo}>
            <Text style={[type.label, styles.secao]}>
              {filtroEventosDataISO ? 'Eventos da data selecionada' : 'Eventos deste período'}
            </Text>
            {filtroEventosDataISO ? (
              <TouchableOpacity testID="chamada-index-filtro-limpar" style={styles.limparFiltroBotao} onPress={() => setFiltroEventosDataISO(null)}>
                <Text style={styles.limparFiltroTexto}>Mostrar todos</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {eventosFiltrados.map((e) => (
            <TouchableOpacity
              key={e.id}
              testID={`chamada-index-evento-item-${e.id}`}
              style={styles.eventoItem}
              onPress={() => router.push(`/eventos/${e.id}`)}
            >
              <View style={[styles.eventoItemCor, { backgroundColor: corPorTipo.get(e.tipo_id) }]} />
              <View style={styles.eventoItemTexto}>
                <Text style={type.body}>{e.titulo}</Text>
                <Text style={[type.caption, styles.subtitle]}>
                  {e.data_inicio === e.data_fim
                    ? formatDataExtenso(new Date(`${e.data_inicio}T00:00:00`))
                    : `${e.data_inicio.split('-').reverse().join('/')} a ${e.data_fim.split('-').reverse().join('/')}`}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {error ? (
        <Text testID="chamada-index-erro" style={[type.body, styles.error]}>
          {error}
        </Text>
      ) : null}
    </View>
  );

  return (
    <>
      <PageHeader titulo="Agenda" />
      <FlatList
        style={styles.container}
        data={aulas}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={cabecalho}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !error ? (
            <Text style={[type.body, styles.subtitle]}>Não há turmas para a data selecionada.</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            testID={`chamada-index-turma-item-${item.id}`}
            style={styles.card}
            onPress={() => router.push(`/chamada/${item.id}?data=${dataISO}`)}
          >
            <Text style={type.subtitle}>{formatHora(item.hora)}</Text>
            <Text style={[type.body, styles.cardSubtitle]}>{formatModulos(item.modulos)}</Text>
          </TouchableOpacity>
        )}
      />
      <Footer />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  subtitle: {
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
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
  bannerTopoImagem: {
    width: 62,
    height: 62,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    resizeMode: 'contain',
  },
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
  modoRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  modoChip: {
    minHeight: touchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modoChipAtivo: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modoChipTexto: {
    color: colors.text,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
  modoChipTextoAtivo: {
    color: colors.onPrimary,
  },
  periodoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  periodoCentro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  periodoTitulo: {
    textTransform: 'capitalize',
  },
  periodoIconeBadge: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodoIconeCorpo: {
    width: 16,
    height: 14,
    borderRadius: 3,
    backgroundColor: colors.onPrimary,
    overflow: 'hidden',
  },
  periodoIconeTopo: {
    height: 4,
    backgroundColor: colors.primary,
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
  pickerInline: {
    marginTop: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
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
  diaParticularDot: {
    backgroundColor: colors.primary,
  },
  diaTesteDot: {
    backgroundColor: colors.present,
  },
  mesCabecalho: {
    flexDirection: 'row',
    marginTop: spacing.md,
  },
  eventosSecaoTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  limparFiltroBotao: {
    minHeight: touchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  limparFiltroTexto: {
    color: colors.primary,
    fontFamily: type.label.fontFamily,
    fontSize: type.label.fontSize,
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
    height: 44,
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
  legendaPontoTexto: {
    color: colors.textMuted,
  },
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
  eventosLista: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  secao: {
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  eventoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: touchTarget,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  eventoItemCor: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
  },
  eventoItemTexto: {
    flex: 1,
  },
  error: {
    color: colors.danger,
    marginTop: spacing.sm,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  card: {
    minHeight: touchTarget,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    justifyContent: 'center',
  },
  cardSubtitle: {
    color: colors.textMuted,
    marginTop: 2,
  },
});
