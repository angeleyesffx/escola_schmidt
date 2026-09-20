import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import {
  excluirAulaParticular,
  excluirAulaTeste,
  getAulasParticularesPorPeriodo,
  getAulasRecorrentesPorData,
  getAulasTestePorPeriodo,
  getGradeSemanal,
  getResponsabilidadesProfessor,
  type AulaParticular,
  type AulaTeste,
} from '../../../src/features/chamada/api';
import {
  addDias,
  formatDataISO,
  formatHora,
  formatModulos,
  getDiasDaSemana,
  getGradeMes,
  paraDataSemHorario,
  type ModoCalendario,
} from '../../../src/features/chamada/calendar';
import {
  agruparAulasPorDiaSemana,
  filtrarAulasDoProfessor,
  filtrarEventosNoDia,
  filtrarParticularesNoDia,
  filtrarTestesNoDia,
  montarCorPorTipo,
  montarMeusSlots,
} from '../../../src/features/chamada/selectors';
import { getEventosPorPeriodo, getTiposEvento } from '../../../src/features/eventos/api';
import { AcoesAgendamento } from '../../../src/features/chamada/components/AcoesAgendamento';
import { BannerAgenda } from '../../../src/features/chamada/components/BannerAgenda';
import { CalendarioMes } from '../../../src/features/chamada/components/CalendarioMes';
import { CalendarioSemana } from '../../../src/features/chamada/components/CalendarioSemana';
import { LegendaCalendario } from '../../../src/features/chamada/components/LegendaCalendario';
import { ListaEventos } from '../../../src/features/chamada/components/ListaEventos';
import { ListaParticulares } from '../../../src/features/chamada/components/ListaParticulares';
import { ListaTestes } from '../../../src/features/chamada/components/ListaTestes';
import { ModoToggle } from '../../../src/features/chamada/components/ModoToggle';
import { PeriodoNav } from '../../../src/features/chamada/components/PeriodoNav';
import { PickerMesInline } from '../../../src/features/chamada/components/PickerMesInline';
import { useAuth } from '../../../src/features/auth/AuthProvider';
import { useAsyncData } from '../../../src/hooks/useAsyncData';
import { confirmar } from '../../../src/lib/confirmar';
import { PageHeader } from '../../../src/components/PageHeader';
import { Footer } from '../../../src/components/Footer';
import { colors, radius, spacing, touchTarget, type } from '../../../src/constants/theme';

export default function ChamadaIndex() {
  const router = useRouter();
  const { meuPapel, session } = useAuth();
  const podeEditar = meuPapel === 'dono' || meuPapel === 'professor';
  const souProfessor = meuPapel === 'professor';
  const souAluno = (meuPapel === 'aluno' || meuPapel === 'responsavel');
  // A RLS de aula_leitura (0026) já escopa a lista: professor só vê as
  // próprias particulares, aluno só as suas — quem aparece aqui já é quem
  // pode editar/cancelar (mesma condição de aula_atualizacao/aula_exclusao).
  const podeGerenciarParticular = podeEditar || souAluno;
  const [modo, setModo] = useState<ModoCalendario>('semana');
  const [dataSelecionada, setDataSelecionada] = useState(paraDataSemHorario(new Date()));
  const [pickerAberto, setPickerAberto] = useState(false);
  const [pickerData, setPickerData] = useState(dataSelecionada);
  const [filtroEventosDataISO, setFiltroEventosDataISO] = useState<string | null>(null);

  const dataISO = useMemo(() => formatDataISO(dataSelecionada), [dataSelecionada]);
  const diasSemana = useMemo(() => getDiasDaSemana(dataSelecionada), [dataSelecionada]);
  const gradeMes = useMemo(() => getGradeMes(dataSelecionada), [dataSelecionada]);
  const mesAtual = dataSelecionada.getMonth();

  const pickerGrade = useMemo(() => getGradeMes(pickerData), [pickerData]);
  const pickerMesAtual = pickerData.getMonth();

  const inicioVisivel = modo === 'semana' ? diasSemana[0].iso : gradeMes[0].iso;
  const fimVisivel = modo === 'semana' ? diasSemana[6].iso : gradeMes[gradeMes.length - 1].iso;

  // Grade fixa é pequena e quase nunca muda — busca uma vez só, não a cada
  // troca de dia/semana/mês, pra pintar horário/módulo direto no calendário.
  const { data: dadosGradeSemanal } = useAsyncData(getGradeSemanal, []);
  const gradeSemanal = dadosGradeSemanal ?? [];

  const aulasPorDiaSemana = useMemo(() => agruparAulasPorDiaSemana(gradeSemanal), [gradeSemanal]);

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

  const corPorTipo = useMemo(() => montarCorPorTipo(tiposEvento), [tiposEvento]);

  const eventosFiltrados = useMemo(
    () => (filtroEventosDataISO ? filtrarEventosNoDia(eventos, filtroEventosDataISO) : eventos),
    [eventos, filtroEventosDataISO]
  );
  const particularesFiltradas = useMemo(
    () => (filtroEventosDataISO ? filtrarParticularesNoDia(particulares, filtroEventosDataISO) : particulares),
    [particulares, filtroEventosDataISO]
  );
  const testesFiltrados = useMemo(
    () => (filtroEventosDataISO ? filtrarTestesNoDia(aulasTeste, filtroEventosDataISO) : aulasTeste),
    [aulasTeste, filtroEventosDataISO]
  );

  const confirmarExclusaoParticular = useCallback(
    (aula: AulaParticular) => {
      confirmar(
        'Cancelar aula particular',
        `Cancelar a aula de ${aula.aluno_nome} com ${aula.professor_nome} em ${aula.data.split('-').reverse().join('/')} às ${formatHora(aula.hora)}?`,
        'Cancelar aula',
        () => {
          excluirAulaParticular(aula.id)
            .then(() => setParticulares((atual) => (atual ?? []).filter((p) => p.id !== aula.id)))
            .catch((err) => console.error(err));
        }
      );
    },
    [setParticulares]
  );

  const confirmarExclusaoTeste = useCallback(
    (aula: AulaTeste) => {
      const nomes = aula.candidatos.map((c) => c.nome).join(', ') || 'sem candidatos';
      confirmar(
        'Cancelar aula teste',
        `Cancelar a aula teste de ${nomes} em ${aula.data.split('-').reverse().join('/')} às ${formatHora(aula.hora)}?`,
        'Cancelar aula',
        () => {
          excluirAulaTeste(aula.id)
            .then(() => setAulasTeste((atual) => (atual ?? []).filter((t) => t.id !== aula.id)))
            .catch((err) => console.error(err));
        }
      );
    },
    [setAulasTeste]
  );

  const {
    data: dadosAulas,
    loading,
    error,
  } = useAsyncData(() => getAulasRecorrentesPorData(dataISO), [dataISO], {
    onFocus: true,
    mensagemErro: 'Erro ao carregar a grade. Tente novamente.',
  });
  // Mesmo filtro de "Meus módulos" aplicado em chamada/lista.tsx: professor
  // só vê, como atalho pra abrir chamada, as turmas que assumiu — o calendário
  // (gradeSemanal, acima) continua mostrando a grade inteira pra contexto.
  const { data: responsabilidades } = useAsyncData(
    () => getResponsabilidadesProfessor(session!.user.id),
    [session?.user.id],
    { onFocus: true, enabled: souProfessor && Boolean(session?.user.id) }
  );
  const meusSlots = useMemo(() => montarMeusSlots(responsabilidades ?? []), [responsabilidades]);
  const aulas = useMemo(
    () => filtrarAulasDoProfessor(dadosAulas ?? [], souProfessor, meusSlots),
    [dadosAulas, souProfessor, meusSlots]
  );

  const navegarPeriodo = useCallback(
    (direcao: -1 | 1) => {
      if (modo === 'semana') {
        setDataSelecionada((anterior) => addDias(anterior, direcao * 7));
        return;
      }
      setDataSelecionada((anterior) => new Date(anterior.getFullYear(), anterior.getMonth() + direcao, 1));
    },
    [modo]
  );

  const abrirPicker = useCallback(() => {
    if (pickerAberto) {
      setPickerAberto(false);
      return;
    }
    setPickerData(dataSelecionada);
    setPickerAberto(true);
  }, [pickerAberto, dataSelecionada]);

  const navegarPickerMes = useCallback((direcao: -1 | 1) => {
    setPickerData((anterior) => new Date(anterior.getFullYear(), anterior.getMonth() + direcao, 1));
  }, []);

  const selecionarDataPicker = useCallback((data: Date) => {
    const dataNormalizada = paraDataSemHorario(data);
    setDataSelecionada(dataNormalizada);
    setFiltroEventosDataISO(formatDataISO(dataNormalizada));
    setPickerAberto(false);
  }, []);

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
      <BannerAgenda />

      <AcoesAgendamento
        podeEditar={podeEditar}
        souAluno={souAluno}
        onAgendarAula={() => router.push('/chamada/agendar')}
        onAgendarParticular={() => router.push('/chamada/nova-particular')}
      />

      <ModoToggle modo={modo} onSelecionarModo={setModo} />

      <PeriodoNav
        modo={modo}
        diasSemana={diasSemana}
        dataSelecionada={dataSelecionada}
        onNavegar={navegarPeriodo}
        onAbrirPicker={abrirPicker}
      />

      {pickerAberto ? (
        <PickerMesInline
          pickerData={pickerData}
          pickerGrade={pickerGrade}
          pickerMesAtual={pickerMesAtual}
          dataISO={dataISO}
          onNavegarMes={navegarPickerMes}
          onSelecionarData={selecionarDataPicker}
          onFechar={() => setPickerAberto(false)}
        />
      ) : null}

      {modo === 'semana' ? (
        <CalendarioSemana
          diasSemana={diasSemana}
          dataISO={dataISO}
          aulasPorDiaSemana={aulasPorDiaSemana}
          eventos={eventos}
          particulares={particulares}
          aulasTeste={aulasTeste}
          corPorTipo={corPorTipo}
          onSelecionarDia={(dia) => {
            setDataSelecionada(dia.data);
            setFiltroEventosDataISO(dia.iso);
          }}
        />
      ) : (
        <CalendarioMes
          gradeMes={gradeMes}
          dataISO={dataISO}
          mesAtual={mesAtual}
          aulasPorDiaSemana={aulasPorDiaSemana}
          eventos={eventos}
          particulares={particulares}
          aulasTeste={aulasTeste}
          corPorTipo={corPorTipo}
          onSelecionarDia={(dia) => {
            setDataSelecionada(dia.data);
            setFiltroEventosDataISO(dia.iso);
          }}
        />
      )}

      <LegendaCalendario tiposEvento={tiposEvento} />

      <ListaParticulares
        particulares={particularesFiltradas}
        filtroAtivo={Boolean(filtroEventosDataISO)}
        podeGerenciarParticular={podeGerenciarParticular}
        onAbrirParticular={(p) => router.push(`/chamada/remarcar-particular?id=${p.id}&professorId=${p.professor_id}`)}
        onExcluirParticular={confirmarExclusaoParticular}
      />

      <ListaTestes
        aulasTeste={testesFiltrados}
        filtroAtivo={Boolean(filtroEventosDataISO)}
        podeEditar={podeEditar}
        onExcluirTeste={confirmarExclusaoTeste}
      />

      <ListaEventos
        eventos={eventosFiltrados}
        filtroAtivo={Boolean(filtroEventosDataISO)}
        corPorTipo={corPorTipo}
        onAbrirEvento={(e) => router.push(`/eventos/${e.id}`)}
        onLimparFiltro={() => setFiltroEventosDataISO(null)}
      />

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
