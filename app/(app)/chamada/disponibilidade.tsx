import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  criarDisponibilidade,
  excluirDisponibilidade,
  getDisponibilidadeProfessor,
  getProfessores,
  type DisponibilidadeParticular,
  type TipoRecorrencia,
} from '../../../src/features/chamada/api';
import { formatDataISO } from '../../../src/features/chamada/calendar';
import { useAuth } from '../../../src/features/auth/AuthProvider';
import { useAsyncData } from '../../../src/hooks/useAsyncData';
import { confirmar } from '../../../src/lib/confirmar';
import { PageHeader } from '../../../src/components/PageHeader';
import { Footer } from '../../../src/components/Footer';
import { Chip } from '../../../src/components/Chip';
import { Dropdown } from '../../../src/components/Dropdown';
import { DateRangePicker } from '../../../src/components/DateRangePicker';
import { FormModal } from '../../../src/components/FormModal';
import { RowActions } from '../../../src/components/RowActions';
import { colors, radius, spacing, touchTarget, type } from '../../../src/constants/theme';

const OPCOES_RECORRENCIA: { valor: TipoRecorrencia; label: string }[] = [
  { valor: 'unica', label: 'Não repete' },
  { valor: 'diaria', label: 'Diariamente' },
  { valor: 'semanal', label: 'Semanalmente' },
  { valor: 'mensal', label: 'Mensalmente' },
  { valor: 'anual', label: 'Anualmente' },
];

const ROTULO_RECORRENCIA: Record<TipoRecorrencia, string> = {
  unica: 'Não repete',
  diaria: 'Diariamente',
  semanal: 'Semanalmente',
  mensal: 'Mensalmente',
  anual: 'Anualmente',
};

function formatBR(dataISO: string): string {
  return dataISO.split('-').reverse().join('/');
}

function formatHora(hora: string) {
  return hora.slice(0, 5);
}

function formatPeriodo(item: DisponibilidadeParticular) {
  if (item.tipo_recorrencia === 'unica') {
    return formatBR(item.data_inicio);
  }
  return `${formatBR(item.data_inicio)} → ${formatBR(item.data_fim!)}`;
}

// Início = fim (ou sem fim, que é como 'unica' já é salva) faz qualquer
// recorrência ocorrer só naquele 1 dia — na prática o mesmo padrão que
// 'unica', só com outro rótulo. Sem essa normalização, dava pra cadastrar
// "Diariamente 20/09→20/09" e depois "Mensalmente 20/09→20/09" como se
// fossem janelas diferentes, quando cobrem exatamente o mesmo dia/hora.
function chaveJanela(dataInicio: string, dataFim: string | null, tipo: TipoRecorrencia) {
  const efetivamenteUnica = tipo === 'unica' || !dataFim || dataFim === dataInicio;
  return efetivamenteUnica ? `unica|${dataInicio}` : `${tipo}|${dataInicio}|${dataFim}`;
}

export default function DisponibilidadeParticularScreen() {
  const { meuPapel, session } = useAuth();
  const souDono = meuPapel === 'dono';

  const [professorSelecionadoId, setProfessorSelecionadoId] = useState<string | null>(null);
  const professorId = souDono ? professorSelecionadoId : (session?.user.id ?? null);

  const { data: dadosProfessores } = useAsyncData(getProfessores, [], { enabled: souDono });
  const professores = dadosProfessores ?? [];
  const opcoesProfessores = professores.map((p) => ({ value: p.id, label: p.nome }));

  const [modalAberto, setModalAberto] = useState(false);
  const [dataInicio, setDataInicio] = useState(formatDataISO(new Date()));
  const [dataInicioAberta, setDataInicioAberta] = useState(false);
  const [tipoRecorrencia, setTipoRecorrencia] = useState<TipoRecorrencia>('unica');
  const [dataFim, setDataFim] = useState(formatDataISO(new Date()));
  const [dataFimAberta, setDataFimAberta] = useState(false);
  const [horaInput, setHoraInput] = useState('');
  const [horasEmEdicao, setHorasEmEdicao] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  const {
    data: disponibilidade,
    setData: setDisponibilidade,
    loading,
    error: erroCarregar,
    reload: recarregar,
  } = useAsyncData(() => getDisponibilidadeProfessor(professorId!), [professorId], {
    onFocus: true,
    enabled: Boolean(professorId),
    mensagemErro: 'Erro ao carregar horários livres. Tente novamente.',
  });

  // Trocar de professor (dono) começa o formulário do zero — evita salvar
  // sem querer uma disponibilidade montada pra outra pessoa.
  useEffect(() => {
    setHorasEmEdicao([]);
    setHoraInput('');
    setErroSalvar(null);
    setModalAberto(false);
  }, [professorId]);

  function abrirNovo() {
    setDataInicio(formatDataISO(new Date()));
    setTipoRecorrencia('unica');
    setDataFim(formatDataISO(new Date()));
    setHorasEmEdicao([]);
    setHoraInput('');
    setErroSalvar(null);
    setModalAberto(true);
  }

  function fecharModal() {
    if (salvando) return;
    setModalAberto(false);
  }

  function adicionarHora() {
    const valor = horaInput.trim();
    if (!/^\d{2}:\d{2}$/.test(valor)) {
      setErroSalvar('Hora deve estar no formato HH:MM.');
      return;
    }
    setErroSalvar(null);
    setHoraInput('');
    if (horasEmEdicao.includes(valor)) return;
    setHorasEmEdicao((atual) => [...atual, valor].sort());
  }

  function removerHoraEmEdicao(hora: string) {
    setHorasEmEdicao((atual) => atual.filter((h) => h !== hora));
  }

  async function salvar() {
    if (!professorId) {
      setErroSalvar('Escolha o professor.');
      return;
    }
    if (horasEmEdicao.length === 0) {
      setErroSalvar('Adicione ao menos um horário.');
      return;
    }
    // Início = fim quando repete é ambíguo (colapsa pro mesmo único dia que
    // 'unica' já representa, só com outro rótulo — era assim que a mesma
    // janela dava pra ser cadastrada duas vezes). Só 'unica' representa 1 dia.
    if (tipoRecorrencia !== 'unica' && dataFim <= dataInicio) {
      setErroSalvar('Repetição precisa de um período de mais de 1 dia. Pra um dia só, use "Não repete".');
      return;
    }

    const dataFimEfetiva = tipoRecorrencia === 'unica' ? null : dataFim;
    const chaveNova = chaveJanela(dataInicio, dataFimEfetiva, tipoRecorrencia);
    const existenteConflitante = (disponibilidade ?? []).find((item) => {
      if (chaveJanela(item.data_inicio, item.data_fim, item.tipo_recorrencia) !== chaveNova) return false;
      return item.horas.some((h) => horasEmEdicao.includes(formatHora(h)));
    });
    if (existenteConflitante) {
      const horasRepetidas = existenteConflitante.horas.map(formatHora).filter((h) => horasEmEdicao.includes(h));
      setErroSalvar(
        `${horasRepetidas.join(', ')} já ${horasRepetidas.length === 1 ? 'está cadastrado' : 'estão cadastrados'} nesse mesmo padrão de data (${ROTULO_RECORRENCIA[existenteConflitante.tipo_recorrencia]} · ${formatPeriodo(existenteConflitante)}).`
      );
      return;
    }

    setSalvando(true);
    setErroSalvar(null);
    try {
      await criarDisponibilidade(
        professorId,
        dataInicio,
        tipoRecorrencia === 'unica' ? null : dataFim,
        tipoRecorrencia,
        horasEmEdicao
      );
      recarregar();
      setHorasEmEdicao([]);
      setModalAberto(false);
    } catch (err: unknown) {
      console.error(err);
      setErroSalvar('Erro ao adicionar horário. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  function confirmarRemocao(item: DisponibilidadeParticular) {
    confirmar(
      'Remover horário livre',
      `Remover ${ROTULO_RECORRENCIA[item.tipo_recorrencia]} · ${formatPeriodo(item)} (${item.horas.map(formatHora).join(', ')})? Ninguém mais poderá marcar aula particular nesse horário.`,
      'Remover',
      () => remover(item)
    );
  }

  async function remover(item: DisponibilidadeParticular) {
    setErroSalvar(null);
    try {
      await excluirDisponibilidade(item.id);
      setDisponibilidade((atual) => (atual ?? []).filter((d) => d.id !== item.id));
    } catch (err) {
      console.error(err);
      setErroSalvar('Erro ao remover horário. Tente novamente.');
    }
  }

  if (meuPapel === 'aluno' || meuPapel === 'responsavel') {
    return <Redirect href="/" />;
  }

  return (
    <>
      <PageHeader titulo="Horários livres" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {souDono ? (
            <>
              <Text style={[type.label, styles.rotulo]}>Professor</Text>
              <Dropdown
                testID="disponibilidade-dropdown-professor"
                placeholder="Selecione o professor"
                options={opcoesProfessores}
                value={professorSelecionadoId}
                onChange={setProfessorSelecionadoId}
                vazio="Nenhum professor disponível."
              />
            </>
          ) : (
            <Text style={[type.body, styles.subtitle]}>
              Cadastre os horários em que você está disponível pra dar aula particular. Só aparecem pra marcar os
              horários sem conflito com sua grade regular.
            </Text>
          )}

          {!professorId ? (
            souDono ? (
              <Text style={[type.body, styles.subtitle, styles.aviso]}>Selecione um professor para ver e editar os horários dele.</Text>
            ) : null
          ) : loading ? (
            <ActivityIndicator color={colors.primary} style={styles.loading} />
          ) : (
            <>
              <View style={styles.topoRow}>
                <Text style={styles.explicacao}>Horários livres pra aula particular, por padrão de data.</Text>
                <TouchableOpacity testID="disponibilidade-abrir-novo" style={styles.novoBotao} onPress={abrirNovo}>
                  <Text style={styles.novoBotaoTexto}>+ Horário</Text>
                </TouchableOpacity>
              </View>

              {erroCarregar ? <Text style={[type.body, styles.error]}>{erroCarregar}</Text> : null}

              {!disponibilidade || disponibilidade.length === 0 ? (
                <Text style={[type.body, styles.subtitle]}>Nenhum horário cadastrado ainda.</Text>
              ) : (
                <View style={styles.lista}>
                  {disponibilidade.map((item) => (
                    <View key={item.id} style={styles.item}>
                      <View style={styles.itemTextos}>
                        <Text style={type.body}>
                          {ROTULO_RECORRENCIA[item.tipo_recorrencia]} · {formatPeriodo(item)}
                        </Text>
                        <Text style={[type.caption, styles.subtitle]}>{item.horas.map(formatHora).join(', ')}</Text>
                      </View>
                      <RowActions testIdBase={`disponibilidade-${item.id}`} onDelete={() => confirmarRemocao(item)} />
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <FormModal visible={modalAberto} title="Novo horário" onClose={fecharModal}>
        <Text style={[type.label, styles.campoRotulo]}>Início</Text>
        <TouchableOpacity style={styles.input} onPress={() => setDataInicioAberta((atual) => !atual)}>
          <Text style={styles.periodoTexto}>{formatBR(dataInicio)}</Text>
        </TouchableOpacity>
        {dataInicioAberta ? (
          <DateRangePicker
            apenasUmDia
            inicioISO={dataInicio}
            fimISO={dataInicio}
            onConfirmar={(inicio) => {
              setDataInicio(inicio);
              setDataInicioAberta(false);
            }}
            onFechar={() => setDataInicioAberta(false)}
          />
        ) : null}

        <Text style={[type.label, styles.campoRotulo]}>Repetição</Text>
        <View style={styles.chips}>
          {OPCOES_RECORRENCIA.map((opcao) => (
            <Chip
              key={opcao.valor}
              label={opcao.label}
              active={tipoRecorrencia === opcao.valor}
              onPress={() => setTipoRecorrencia(opcao.valor)}
            />
          ))}
        </View>

        {tipoRecorrencia !== 'unica' ? (
          <>
            <Text style={[type.label, styles.campoRotulo]}>Repetir até</Text>
            <TouchableOpacity style={styles.input} onPress={() => setDataFimAberta((atual) => !atual)}>
              <Text style={styles.periodoTexto}>{formatBR(dataFim)}</Text>
            </TouchableOpacity>
            {dataFimAberta ? (
              <DateRangePicker
                apenasUmDia
                inicioISO={dataFim}
                fimISO={dataFim}
                onConfirmar={(inicio) => {
                  setDataFim(inicio);
                  setDataFimAberta(false);
                }}
                onFechar={() => setDataFimAberta(false)}
              />
            ) : null}
          </>
        ) : null}

        <Text style={[type.label, styles.campoRotulo]}>Horas</Text>
        <View style={styles.adicionarRow}>
          <TextInput
            style={[styles.input, styles.inputHora]}
            value={horaInput}
            onChangeText={setHoraInput}
            placeholder="HH:MM"
            keyboardType="numbers-and-punctuation"
            onSubmitEditing={adicionarHora}
          />
          <TouchableOpacity style={styles.adicionarBotao} onPress={adicionarHora}>
            <Text style={styles.adicionarBotaoTexto}>Adicionar</Text>
          </TouchableOpacity>
        </View>
        {horasEmEdicao.length > 0 ? (
          <View style={styles.chips}>
            {horasEmEdicao.map((hora) => (
              <View key={hora} style={styles.horaChip}>
                <Text style={styles.horaChipTexto}>{formatHora(hora)}</Text>
                <TouchableOpacity
                  style={styles.horaChipRemover}
                  onPress={() => removerHoraEmEdicao(hora)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remover horário ${formatHora(hora)}`}
                  hitSlop={8}
                >
                  <Text style={styles.horaChipRemoverTexto}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : (
          <Text style={[type.caption, styles.subtitle]}>Adicione um ou mais horários pra esse padrão de data.</Text>
        )}

        {erroSalvar ? <Text style={[type.body, styles.error]}>{erroSalvar}</Text> : null}

        <TouchableOpacity
          testID="disponibilidade-salvar"
          style={[styles.salvarBotao, salvando && styles.botaoDesabilitado]}
          onPress={salvar}
          disabled={salvando}
        >
          {salvando ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.salvarBotaoTexto}>Adicionar horário</Text>
          )}
        </TouchableOpacity>
      </FormModal>

      <Footer />
    </>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  subtitle: {
    color: colors.textMuted,
  },
  aviso: {
    marginTop: spacing.lg,
  },
  loading: {
    marginTop: spacing.xl,
  },
  rotulo: {
    color: colors.textMuted,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  topoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  explicacao: {
    ...type.caption,
    color: colors.textMuted,
    flex: 1,
  },
  novoBotao: {
    height: touchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  novoBotaoTexto: {
    color: colors.onPrimary,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
  campoRotulo: {
    color: colors.textMuted,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  input: {
    height: touchTarget,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
    color: colors.text,
  },
  periodoTexto: {
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
    color: colors.text,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  adicionarRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  inputHora: {
    flex: 1,
  },
  adicionarBotao: {
    height: touchTarget,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adicionarBotaoTexto: {
    color: colors.onPrimary,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
  // Neutro, não o par borda-primary/fundo-tint do Chip de seleção — aqui
  // tocar remove na hora, não seleciona (mesmo raciocínio de nova-teste.tsx).
  horaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: touchTarget,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  horaChipTexto: {
    color: colors.text,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
  horaChipRemover: {
    width: touchTarget - 16,
    height: touchTarget - 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  horaChipRemoverTexto: {
    color: colors.danger,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
  botaoDesabilitado: {
    opacity: 0.6,
  },
  salvarBotao: {
    height: touchTarget,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  salvarBotaoTexto: {
    color: colors.onPrimary,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
  error: {
    color: colors.danger,
    marginTop: spacing.md,
  },
  lista: {
    gap: spacing.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: touchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  itemTextos: {
    flex: 1,
  },
});
