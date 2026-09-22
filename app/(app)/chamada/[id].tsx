import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import {
  ConflitoPresencaError,
  aprovarPedido,
  getAulaRecorrente,
  getAlunosPorModulos,
  getCandidatosTesteDoDia,
  getMeuPedido,
  getOuCriaAula,
  getPedidosPendentes,
  getPresencas,
  getProfessoresDoModulo,
  marcarPresenca,
  pedirPresenca,
  recusarPedido,
  type Aluno,
  type CandidatoAulaTeste,
  type PedidoPendente,
  type PedidoPresenca,
  type ProfessorAula,
  type StatusPresenca,
} from '../../../src/features/chamada/api';
import { exportarChamada, type FormatoExportacao } from '../../../src/features/chamada/export';
import { presencasParaRegistro, type RegistroLocal } from '../../../src/features/chamada/selectors';
import { AutocheckinAluno } from '../../../src/features/chamada/components/AutocheckinAluno';
import { CandidatosTesteSecao } from '../../../src/features/chamada/components/CandidatosTesteSecao';
import { LegendaPresenca } from '../../../src/features/chamada/components/LegendaPresenca';
import { ListaAlunosChamada } from '../../../src/features/chamada/components/ListaAlunosChamada';
import { ModalExportacao } from '../../../src/features/chamada/components/ModalExportacao';
import { PedidosPendentesSecao } from '../../../src/features/chamada/components/PedidosPendentesSecao';
import { useAuth, type MeuAluno } from '../../../src/features/auth/AuthProvider';
import { PageHeader } from '../../../src/components/PageHeader';
import { Footer } from '../../../src/components/Footer';
import { colors, radius, spacing, touchTarget, type } from '../../../src/constants/theme';

function hojeISO() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

function dataValidaOuHoje(data?: string) {
  if (data && /^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return data;
  }
  return hojeISO();
}

export default function ChamadaDetalhe() {
  const { id, data } = useLocalSearchParams<{ id: string; data?: string }>();
  const router = useRouter();
  const { session, meuPapel, meusAlunos } = useAuth();
  const souAluno = (meuPapel === 'aluno' || meuPapel === 'responsavel');
  const dataSelecionada = dataValidaOuHoje(data);

  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [presencas, setPresencas] = useState<Record<string, RegistroLocal>>({});
  const [aulaId, setAulaId] = useState<string | null>(null);
  const [horario, setHorario] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Conflito e "salvando" são por aluno, não da chamada inteira — antes, um
  // toque duplo (corrigindo um erro de marcação) travava a lista toda até
  // recarregar a página, mesmo sem ninguém mais mexendo na chamada de verdade.
  const [conflitoAlunoId, setConflitoAlunoId] = useState<string | null>(null);
  const [alunosSalvando, setAlunosSalvando] = useState<Set<string>>(new Set());

  // Pedido de presença: só existe pra aluno, só no dia da própria aula, do
  // próprio módulo — e só vira presença de fato quando a equipe aprova. Mais
  // de um filho vinculado pode cair no módulo elegível pra essa aula (ex.:
  // gêmeos) — AutocheckinAluno só mostra o seletor quando isso acontece.
  const [alunosElegiveis, setAlunosElegiveis] = useState<MeuAluno[]>([]);
  const [alunoSelecionadoId, setAlunoSelecionadoId] = useState<string | null>(null);
  // Preferência lida de dentro de carregar() sem entrar nas deps do
  // useCallback — se fosse state, corrigir a seleção depois de um reload
  // recriava carregar() e disparava o useFocusEffect de novo, rodando a
  // carga inteira duas vezes a cada foco.
  const alunoPreferidoRef = useRef<string | null>(null);
  const [elegivelAutocheckin, setElegivelAutocheckin] = useState(false);
  const [minhaPresenca, setMinhaPresenca] = useState<RegistroLocal | null>(null);
  const [meuPedido, setMeuPedido] = useState<PedidoPresenca | null>(null);
  const [enviandoPedido, setEnviandoPedido] = useState(false);
  const [professoresDoModulo, setProfessoresDoModulo] = useState<ProfessorAula[]>([]);

  const [pedidosPendentes, setPedidosPendentes] = useState<PedidoPendente[]>([]);
  const [candidatosTeste, setCandidatosTeste] = useState<CandidatoAulaTeste[]>([]);
  const [processandoPedido, setProcessandoPedido] = useState<string | null>(null);

  const [menuExportacao, setMenuExportacao] = useState(false);
  const [exportando, setExportando] = useState<FormatoExportacao | null>(null);
  const [erroExportacao, setErroExportacao] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    setConflitoAlunoId(null);
    try {
      const recorrente = await getAulaRecorrente(id);
      setHorario(recorrente.hora.slice(0, 5));

      if (souAluno) {
        const elegiveis = meusAlunos.filter((a) => recorrente.modulos.includes(a.modulo));
        setAlunosElegiveis(elegiveis);
        const aluno =
          elegiveis.find((a) => a.id === alunoPreferidoRef.current) ?? elegiveis[0] ?? null;
        alunoPreferidoRef.current = aluno?.id ?? null;
        setAlunoSelecionadoId(aluno?.id ?? null);
        const elegivel = dataSelecionada === hojeISO() && aluno !== null;
        setElegivelAutocheckin(elegivel);
        if (!aluno) {
          setAulaId(null);
          setMinhaPresenca(null);
          setMeuPedido(null);
          setProfessoresDoModulo([]);
          return;
        }
        setProfessoresDoModulo(await getProfessoresDoModulo(recorrente.id, aluno.modulo));
        if (!elegivel) {
          setAulaId(null);
          setMinhaPresenca(null);
          setMeuPedido(null);
          return;
        }
        const aula = await getOuCriaAula(recorrente.id, dataSelecionada, recorrente.hora, session?.user.id ?? null);
        const [listaPresencas, pedido] = await Promise.all([getPresencas(aula), getMeuPedido(aula, aluno.id)]);
        setAulaId(aula);
        const minha = listaPresencas.find((p) => p.aluno_id === aluno.id);
        setMinhaPresenca(minha ? { status: minha.status, registradoEm: minha.registrado_em } : null);
        setMeuPedido(pedido);
        return;
      }

      const [aula, listaAlunos, listaCandidatos] = await Promise.all([
        getOuCriaAula(recorrente.id, dataSelecionada, recorrente.hora, session?.user.id ?? null),
        getAlunosPorModulos(recorrente.modulos),
        getCandidatosTesteDoDia(recorrente.id, dataSelecionada),
      ]);
      const [listaPresencas, pendentes] = await Promise.all([getPresencas(aula), getPedidosPendentes(aula)]);

      setAulaId(aula);
      setAlunos(listaAlunos);
      setCandidatosTeste(listaCandidatos);
      setPresencas(presencasParaRegistro(listaPresencas));
      setPedidosPendentes(pendentes);
    } catch (err) {
      console.error(err);
      setError('Erro ao carregar a chamada. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [dataSelecionada, id, session?.user.id, souAluno, meusAlunos]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  const marcar = useCallback(
    async (alunoId: string, status: StatusPresenca) => {
      // Ignora toque em cima de um salvamento ainda em voo pro mesmo aluno —
      // é exatamente essa sobreposição (corrigir rápido um clique errado) que
      // fazia o SELECT-then-UPSERT de marcarPresenca enxergar versão trocada
      // e disparar ConflitoPresencaError sem ninguém mais ter mexido na chamada.
      if (!aulaId || alunosSalvando.has(alunoId)) return;
      const anterior = presencas[alunoId];
      setAlunosSalvando((atual) => new Set(atual).add(alunoId));
      setPresencas((atual) => ({ ...atual, [alunoId]: { status, registradoEm: anterior?.registradoEm ?? null } }));
      try {
        const registradoEm = await marcarPresenca(
          aulaId,
          alunoId,
          status,
          session?.user.id ?? null,
          anterior?.registradoEm ?? null
        );
        setPresencas((atual) => ({ ...atual, [alunoId]: { status, registradoEm } }));
      } catch (err) {
        setPresencas((atual) => ({ ...atual, [alunoId]: anterior }));
        if (err instanceof ConflitoPresencaError) {
          setConflitoAlunoId(alunoId);
        } else {
          console.error(err);
          setError('Erro ao salvar presença. Tente novamente.');
        }
      } finally {
        setAlunosSalvando((atual) => {
          const novo = new Set(atual);
          novo.delete(alunoId);
          return novo;
        });
      }
    },
    [aulaId, presencas, alunosSalvando, session?.user.id]
  );

  const enviarPedido = useCallback(async () => {
    if (!aulaId || !alunoSelecionadoId) return;
    setEnviandoPedido(true);
    setError(null);
    try {
      const pedido = await pedirPresenca(aulaId, alunoSelecionadoId);
      setMeuPedido(pedido);
    } catch (err) {
      console.error(err);
      setError('Erro ao enviar pedido de presença. Tente novamente.');
    } finally {
      setEnviandoPedido(false);
    }
  }, [aulaId, alunoSelecionadoId]);

  const aprovar = useCallback(
    async (pedido: PedidoPendente) => {
      setProcessandoPedido(pedido.id);
      setError(null);
      try {
        await aprovarPedido(pedido, session?.user.id ?? null);
        setPresencas((atual) => ({
          ...atual,
          [pedido.aluno_id]: { status: 'presente', registradoEm: new Date().toISOString() },
        }));
        setPedidosPendentes((atual) => atual.filter((p) => p.id !== pedido.id));
      } catch (err) {
        console.error(err);
        setError('Erro ao aprovar pedido. Tente novamente.');
      } finally {
        setProcessandoPedido(null);
      }
    },
    [session?.user.id]
  );

  const exportar = useCallback(
    async (formato: FormatoExportacao) => {
      setMenuExportacao(false);
      setExportando(formato);
      setErroExportacao(null);
      try {
        await exportarChamada({ alunos, presencas, data: dataSelecionada, horario, formato });
      } catch (err) {
        console.error(err);
        setErroExportacao('Erro ao exportar a chamada. Tente novamente.');
      } finally {
        setExportando(null);
      }
    },
    [alunos, presencas, dataSelecionada, horario]
  );

  const recusar = useCallback(async (pedido: PedidoPendente) => {
    setProcessandoPedido(pedido.id);
    setError(null);
    try {
      await recusarPedido(pedido.id);
      setPedidosPendentes((atual) => atual.filter((p) => p.id !== pedido.id));
    } catch (err) {
      console.error(err);
      setError('Erro ao recusar pedido. Tente novamente.');
    } finally {
      setProcessandoPedido(null);
    }
  }, []);

  const abrirFrequencia = useCallback(
    (alunoId: string) => router.push(`/alunos/${alunoId}/frequencia`),
    [router]
  );

  const selecionarAluno = useCallback(
    (alunoId: string) => {
      alunoPreferidoRef.current = alunoId;
      setAlunoSelecionadoId(alunoId);
      carregar();
    },
    [carregar]
  );

  if (loading) {
    return (
      <>
        <PageHeader titulo="Chamada" />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </>
    );
  }

  if (souAluno) {
    return (
      <AutocheckinAluno
        horario={horario}
        dataSelecionada={dataSelecionada}
        professoresDoModulo={professoresDoModulo}
        error={error}
        elegivelAutocheckin={elegivelAutocheckin}
        minhaPresenca={minhaPresenca}
        meuPedido={meuPedido}
        enviandoPedido={enviandoPedido}
        onPedirPresenca={enviarPedido}
        alunosElegiveis={alunosElegiveis}
        alunoSelecionadoId={alunoSelecionadoId}
        onSelecionarAluno={selecionarAluno}
      />
    );
  }

  return (
    <>
      <PageHeader titulo={`Chamada ${horario ?? ''}`} />
      <View style={styles.container}>
      <View style={styles.topoRow}>
        <Text style={[type.body, styles.subtitle, styles.dataTexto]}>{dataSelecionada}</Text>
        <TouchableOpacity
          testID="chamada-detalhe-exportar-botao"
          style={[styles.exportarBotao, exportando !== null && styles.botaoDesabilitado]}
          onPress={() => setMenuExportacao(true)}
          disabled={exportando !== null}
        >
          {exportando ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Text style={styles.exportarBotaoTexto}>Exportar</Text>
          )}
        </TouchableOpacity>
      </View>

      {erroExportacao ? (
        <Text testID="chamada-detalhe-exportar-erro" style={[type.body, styles.error]}>
          {erroExportacao}
        </Text>
      ) : null}

      <ModalExportacao
        visivel={menuExportacao}
        onExportar={exportar}
        onFechar={() => setMenuExportacao(false)}
      />

      <LegendaPresenca />

      {error ? (
        <Text testID="chamada-detalhe-erro" style={[type.body, styles.error]}>
          {error}
        </Text>
      ) : null}

      {conflitoAlunoId ? (
        <View testID="chamada-detalhe-conflito-banner" style={styles.conflitoAviso}>
          <Text testID="chamada-detalhe-conflito-mensagem" style={[type.body, styles.conflitoTexto]}>
            Esta chamada foi atualizada por outra pessoa. Recarregue para continuar.
          </Text>
          <TouchableOpacity testID="chamada-detalhe-conflito-recarregar" style={styles.conflitoBotao} onPress={carregar}>
            <Text style={styles.conflitoBotaoTexto}>Recarregar</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <PedidosPendentesSecao
        pedidos={pedidosPendentes}
        processandoPedidoId={processandoPedido}
        onAprovar={aprovar}
        onRecusar={recusar}
      />

      <CandidatosTesteSecao candidatos={candidatosTeste} />

      <ListaAlunosChamada
        alunos={alunos}
        presencas={presencas}
        conflitoAlunoId={conflitoAlunoId}
        alunosSalvando={alunosSalvando}
        onAbrirFrequencia={abrirFrequencia}
        onMarcar={marcar}
      />
      </View>
      <Footer />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
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
  topoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  dataTexto: {
    flex: 1,
  },
  exportarBotao: {
    minHeight: touchTarget - 12,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportarBotaoTexto: {
    color: colors.primary,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
  error: {
    color: colors.danger,
    marginTop: spacing.xs,
  },
  conflitoAviso: {
    marginTop: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceTint,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: spacing.md,
    gap: spacing.sm,
  },
  conflitoTexto: {
    color: colors.danger,
  },
  conflitoBotao: {
    alignSelf: 'flex-start',
    minHeight: touchTarget,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conflitoBotaoTexto: {
    color: colors.onPrimary,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
  botaoDesabilitado: {
    opacity: 0.5,
  },
});
