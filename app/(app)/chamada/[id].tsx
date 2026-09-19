import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import {
  ConflitoPresencaError,
  aprovarPedido,
  getAulaRecorrente,
  getAlunosPorModulos,
  getMeuPedido,
  getOuCriaAula,
  getPedidosPendentes,
  getPresencas,
  getProfessoresDoModulo,
  marcarPresenca,
  pedirPresenca,
  recusarPedido,
  type Aluno,
  type PedidoPendente,
  type PedidoPresenca,
  type ProfessorAula,
  type StatusPresenca,
} from '../../../src/features/chamada/api';
import { exportarChamada, type FormatoExportacao } from '../../../src/features/chamada/export';
import { useAuth } from '../../../src/features/auth/AuthProvider';
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

const ESTADOS: {
  status: StatusPresenca;
  label: string;
  legenda: string;
  cor: 'present' | 'justified' | 'absent';
}[] = [
  { status: 'presente', label: '✓', legenda: 'Presente', cor: 'present' },
  { status: 'falta_justificada', label: 'J', legenda: 'Falta justificada', cor: 'justified' },
  { status: 'falta', label: '✕', legenda: 'Falta', cor: 'absent' },
];

export default function ChamadaDetalhe() {
  const { id, data } = useLocalSearchParams<{ id: string; data?: string }>();
  const router = useRouter();
  const { session, meuPapel, meuAluno } = useAuth();
  const souAluno = meuPapel === 'aluno';
  const dataSelecionada = dataValidaOuHoje(data);

  type RegistroLocal = { status: StatusPresenca; registradoEm: string | null };

  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [presencas, setPresencas] = useState<Record<string, RegistroLocal>>({});
  const [aulaId, setAulaId] = useState<string | null>(null);
  const [horario, setHorario] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conflito, setConflito] = useState(false);

  // Pedido de presença: só existe pra aluno, só no dia da própria aula, do
  // próprio módulo — e só vira presença de fato quando a equipe aprova.
  const [elegivelAutocheckin, setElegivelAutocheckin] = useState(false);
  const [minhaPresenca, setMinhaPresenca] = useState<RegistroLocal | null>(null);
  const [meuPedido, setMeuPedido] = useState<PedidoPresenca | null>(null);
  const [enviandoPedido, setEnviandoPedido] = useState(false);
  const [professoresDoModulo, setProfessoresDoModulo] = useState<ProfessorAula[]>([]);

  const [pedidosPendentes, setPedidosPendentes] = useState<PedidoPendente[]>([]);
  const [processandoPedido, setProcessandoPedido] = useState<string | null>(null);

  const [menuExportacao, setMenuExportacao] = useState(false);
  const [exportando, setExportando] = useState<FormatoExportacao | null>(null);
  const [erroExportacao, setErroExportacao] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    setConflito(false);
    try {
      const recorrente = await getAulaRecorrente(id);
      setHorario(recorrente.hora.slice(0, 5));

      if (souAluno) {
        const elegivel = dataSelecionada === hojeISO() && recorrente.modulos.includes(meuAluno?.modulo ?? -1);
        setElegivelAutocheckin(elegivel);
        if (!meuAluno) {
          setAulaId(null);
          setMinhaPresenca(null);
          setMeuPedido(null);
          setProfessoresDoModulo([]);
          return;
        }
        setProfessoresDoModulo(await getProfessoresDoModulo(recorrente.id, meuAluno.modulo));
        if (!elegivel) {
          setAulaId(null);
          setMinhaPresenca(null);
          setMeuPedido(null);
          return;
        }
        const aula = await getOuCriaAula(recorrente.id, dataSelecionada, recorrente.hora, session?.user.id ?? null);
        const [listaPresencas, pedido] = await Promise.all([getPresencas(aula), getMeuPedido(aula, meuAluno.id)]);
        setAulaId(aula);
        const minha = listaPresencas.find((p) => p.aluno_id === meuAluno.id);
        setMinhaPresenca(minha ? { status: minha.status, registradoEm: minha.registrado_em } : null);
        setMeuPedido(pedido);
        return;
      }

      const [aula, listaAlunos] = await Promise.all([
        getOuCriaAula(recorrente.id, dataSelecionada, recorrente.hora, session?.user.id ?? null),
        getAlunosPorModulos(recorrente.modulos),
      ]);
      const [listaPresencas, pendentes] = await Promise.all([getPresencas(aula), getPedidosPendentes(aula)]);

      setAulaId(aula);
      setAlunos(listaAlunos);
      setPresencas(
        Object.fromEntries(
          listaPresencas.map((p) => [p.aluno_id, { status: p.status, registradoEm: p.registrado_em }])
        )
      );
      setPedidosPendentes(pendentes);
    } catch (err) {
      console.error(err);
      setError('Erro ao carregar a chamada. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [dataSelecionada, id, session?.user.id, souAluno, meuAluno]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  async function marcar(alunoId: string, status: StatusPresenca) {
    if (!aulaId) return;
    const anterior = presencas[alunoId];
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
        setConflito(true);
      } else {
        console.error(err);
        setError('Erro ao salvar presença. Tente novamente.');
      }
    }
  }

  async function enviarPedido() {
    if (!aulaId || !meuAluno) return;
    setEnviandoPedido(true);
    setError(null);
    try {
      const pedido = await pedirPresenca(aulaId, meuAluno.id);
      setMeuPedido(pedido);
    } catch (err) {
      console.error(err);
      setError('Erro ao enviar pedido de presença. Tente novamente.');
    } finally {
      setEnviandoPedido(false);
    }
  }

  async function aprovar(pedido: PedidoPendente) {
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
  }

  async function exportar(formato: FormatoExportacao) {
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
  }

  async function recusar(pedido: PedidoPendente) {
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
  }

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
      <>
        <PageHeader titulo={`Chamada ${horario ?? ''}`} />
        <View style={styles.container}>
          <Text style={[type.body, styles.subtitle]}>{dataSelecionada}</Text>
          {professoresDoModulo.length > 0 ? (
            <Text style={[type.body, styles.subtitle]}>
              {professoresDoModulo.length === 1 ? 'Professor(a): ' : 'Professores: '}
              {professoresDoModulo.map((p) => p.nome).join(', ')}
            </Text>
          ) : null}

          {error ? (
            <Text testID="chamada-detalhe-erro" style={[type.body, styles.error]}>
              {error}
            </Text>
          ) : null}

          {!elegivelAutocheckin ? (
            <Text style={[type.body, styles.subtitle, styles.autocheckinAviso]}>
              Você só pode pedir presença no dia e no horário da sua própria aula.
            </Text>
          ) : minhaPresenca ? (
            <View style={styles.autocheckinCard}>
              <Text style={[type.subtitle, { color: colors.present }]}>✓ Presença confirmada</Text>
              {minhaPresenca.registradoEm ? (
                <Text style={[type.caption, styles.subtitle]}>
                  Registrada às {new Date(minhaPresenca.registradoEm).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              ) : null}
            </View>
          ) : meuPedido?.status === 'pendente' ? (
            <View style={styles.autocheckinCardPendente}>
              <Text style={[type.subtitle, { color: colors.justified }]}>⏳ Pedido enviado</Text>
              <Text style={[type.caption, styles.subtitle]}>Aguardando aprovação do professor.</Text>
            </View>
          ) : (
            <TouchableOpacity
              testID="chamada-detalhe-autocheckin-pedir"
              style={[styles.confirmarBotao, enviandoPedido && styles.botaoDesabilitado]}
              onPress={enviarPedido}
              disabled={enviandoPedido}
            >
              {enviandoPedido ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.confirmarBotaoTexto}>Pedir presença</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </>
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

      <Modal
        visible={menuExportacao}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuExportacao(false)}
      >
        <View style={styles.exportarOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setMenuExportacao(false)}
          />
          <View style={styles.exportarCard}>
            <Text style={[type.label, styles.secao]}>Exportar chamada</Text>
            <TouchableOpacity
              testID="chamada-detalhe-exportar-xlsx"
              style={styles.exportarOpcao}
              onPress={() => exportar('xlsx')}
            >
              <Text style={styles.exportarOpcaoTexto}>Excel (.xlsx)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="chamada-detalhe-exportar-csv"
              style={styles.exportarOpcao}
              onPress={() => exportar('csv')}
            >
              <Text style={styles.exportarOpcaoTexto}>CSV (Planilhas Google)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="chamada-detalhe-exportar-cancelar"
              style={styles.exportarCancelar}
              onPress={() => setMenuExportacao(false)}
            >
              <Text style={styles.exportarCancelarTexto}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={styles.legenda}>
        {ESTADOS.map((estado) => (
          <View key={estado.status} style={styles.legendaItem}>
            <View style={[styles.legendaCor, { backgroundColor: colors[estado.cor] }]} />
            <Text style={[type.caption, styles.legendaTexto]}>{estado.legenda}</Text>
          </View>
        ))}
      </View>

      {error ? (
        <Text testID="chamada-detalhe-erro" style={[type.body, styles.error]}>
          {error}
        </Text>
      ) : null}

      {conflito ? (
        <View testID="chamada-detalhe-conflito-banner" style={styles.conflitoAviso}>
          <Text testID="chamada-detalhe-conflito-mensagem" style={[type.body, styles.conflitoTexto]}>
            Esta chamada foi atualizada por outra pessoa. Recarregue para continuar.
          </Text>
          <TouchableOpacity testID="chamada-detalhe-conflito-recarregar" style={styles.conflitoBotao} onPress={carregar}>
            <Text style={styles.conflitoBotaoTexto}>Recarregar</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {pedidosPendentes.length > 0 ? (
        <View style={styles.pedidosSecao}>
          <Text style={[type.label, styles.secao]}>Pedidos de presença</Text>
          {pedidosPendentes.map((pedido) => {
            const processando = processandoPedido === pedido.id;
            return (
              <View key={pedido.id} style={styles.pedidoRow}>
                <Text style={[type.body, styles.pedidoNome]} numberOfLines={1}>
                  {pedido.aluno_nome}
                </Text>
                <View style={styles.pedidoBotoes}>
                  <TouchableOpacity
                    testID={`chamada-detalhe-pedido-recusar-${pedido.id}`}
                    style={[styles.pedidoBotaoRecusar, processando && styles.botaoDesabilitado]}
                    onPress={() => recusar(pedido)}
                    disabled={processando}
                  >
                    <Text style={styles.pedidoBotaoRecusarTexto}>Recusar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID={`chamada-detalhe-pedido-aprovar-${pedido.id}`}
                    style={[styles.pedidoBotaoAprovar, processando && styles.botaoDesabilitado]}
                    onPress={() => aprovar(pedido)}
                    disabled={processando}
                  >
                    {processando ? (
                      <ActivityIndicator color={colors.onPrimary} />
                    ) : (
                      <Text style={styles.pedidoBotaoAprovarTexto}>Aprovar</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      <FlatList
        data={alunos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={[type.body, styles.subtitle]}>Nenhum aluno ativo nesse módulo.</Text>
        }
        renderItem={({ item }) => {
          const status = presencas[item.id]?.status;
          return (
            <View testID={`chamada-detalhe-aluno-row-${item.id}`} style={styles.row}>
              <TouchableOpacity
                testID={`chamada-detalhe-aluno-nome-${item.id}`}
                style={styles.nomeArea}
                onPress={() => router.push(`/alunos/${item.id}/frequencia`)}
              >
                <Text style={[type.body, styles.nome]} numberOfLines={1}>
                  {item.nome}
                </Text>
                <Text style={[type.caption, styles.moduloTexto]}>Módulo {item.modulo}</Text>
              </TouchableOpacity>
              <View style={styles.botoes}>
                {ESTADOS.map((estado) => {
                  const ativo = status === estado.status;
                  return (
                    <TouchableOpacity
                      key={estado.status}
                      testID={`chamada-detalhe-status-button-${item.id}-${estado.status}`}
                      style={[
                        styles.botao,
                        { backgroundColor: ativo ? colors[estado.cor] : colors.pending },
                        conflito && styles.botaoDesabilitado,
                      ]}
                      onPress={() => marcar(item.id, estado.status)}
                      disabled={conflito}
                    >
                      <Text style={styles.botaoTexto}>{estado.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        }}
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
  exportarOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  exportarCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  exportarOpcao: {
    minHeight: touchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  exportarOpcaoTexto: {
    color: colors.primary,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
  exportarCancelar: {
    minHeight: touchTarget - 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  exportarCancelarTexto: {
    color: colors.textMuted,
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
  },
  legenda: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  legendaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendaCor: {
    width: 12,
    height: 12,
    borderRadius: radius.sm,
  },
  legendaTexto: {
    color: colors.textMuted,
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
  autocheckinAviso: {
    marginTop: spacing.xl,
  },
  autocheckinCard: {
    marginTop: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.present,
    padding: spacing.lg,
  },
  autocheckinCardPendente: {
    marginTop: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.justified,
    padding: spacing.lg,
  },
  pedidosSecao: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  secao: {
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  pedidoRow: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceTint,
    borderWidth: 1,
    borderColor: colors.justified,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pedidoNome: {
    flex: 1,
    marginRight: spacing.sm,
  },
  pedidoBotoes: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pedidoBotaoRecusar: {
    minHeight: touchTarget - 12,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pedidoBotaoRecusarTexto: {
    color: colors.danger,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
  pedidoBotaoAprovar: {
    minWidth: touchTarget,
    minHeight: touchTarget - 12,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.present,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pedidoBotaoAprovarTexto: {
    color: colors.onPrimary,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
  confirmarBotao: {
    height: touchTarget,
    marginTop: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmarBotaoTexto: {
    color: colors.onPrimary,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
  list: {
    marginTop: spacing.lg,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  row: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
  },
  nomeArea: {
    flex: 1,
    minHeight: touchTarget,
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  nome: {
    color: colors.primary,
  },
  moduloTexto: {
    color: colors.textMuted,
    marginTop: 2,
  },
  botoes: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  botao: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoTexto: {
    color: colors.onPrimary,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
});
