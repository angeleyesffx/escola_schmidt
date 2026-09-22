import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
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
  criarAulaTeste,
  diaSemanaPorDataISO,
  getGradeSemanal,
  getResponsabilidadesProfessor,
} from '../../../src/features/chamada/api';
import { formatDataISO } from '../../../src/features/chamada/calendar';
import { useAuth } from '../../../src/features/auth/AuthProvider';
import { useAsyncData } from '../../../src/hooks/useAsyncData';
import { PageHeader } from '../../../src/components/PageHeader';
import { DateRangePicker } from '../../../src/components/DateRangePicker';
import { Footer } from '../../../src/components/Footer';
import { Dropdown } from '../../../src/components/Dropdown';
import { colors, radius, spacing, touchTarget, type } from '../../../src/constants/theme';

const DIAS_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

function formatBR(dataISO: string): string {
  return dataISO.split('-').reverse().join('/');
}

function formatHora(hora: string) {
  return hora.slice(0, 5);
}

function formatModulos(modulos: number[]) {
  return modulos.length === 1 ? `Módulo ${modulos[0]}` : `Módulos ${modulos.join(', ')}`;
}

export default function NovaAulaTeste() {
  const router = useRouter();
  const { meuPapel, session } = useAuth();
  const souDono = meuPapel === 'dono';

  const [aulaRecorrenteId, setAulaRecorrenteId] = useState<string | null>(null);
  const [candidatos, setCandidatos] = useState<{ nome: string; telefone: string }[]>([]);
  const [nomeCandidato, setNomeCandidato] = useState('');
  const [telefoneCandidato, setTelefoneCandidato] = useState('');
  const [dataISO, setDataISO] = useState(formatDataISO(new Date()));
  const [dataAberta, setDataAberta] = useState(false);
  const [observacoes, setObservacoes] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  const {
    data: dadosIniciais,
    loading,
    error: erroCarregar,
  } = useAsyncData(
    async () => {
      const [grade, responsabilidades] = await Promise.all([
        getGradeSemanal(),
        souDono || !session?.user.id ? Promise.resolve([]) : getResponsabilidadesProfessor(session.user.id),
      ]);
      const idsResponsavel = new Set(responsabilidades.map((r) => r.aula_recorrente_id));
      const slots = souDono ? grade : grade.filter((slot) => idsResponsavel.has(slot.id));
      return { slots };
    },
    [souDono, session?.user.id],
    { mensagemErro: 'Erro ao carregar dados. Tente novamente.' }
  );
  const slots = dadosIniciais?.slots ?? [];
  const error = erroSalvar ?? erroCarregar;

  const slotSelecionado = slots.find((s) => s.id === aulaRecorrenteId) ?? null;
  const diaSemanaEsperado = slotSelecionado?.dia_semana ?? null;
  const dataForaDoDia = diaSemanaEsperado !== null && diaSemanaPorDataISO(dataISO) !== diaSemanaEsperado;

  const opcoesSlots = slots.map((s) => ({
    value: s.id,
    label: `${DIAS_SEMANA[s.dia_semana]} · ${formatHora(s.hora)}`,
    sublabel: formatModulos(s.modulos),
  }));

  // Candidato de aula teste ainda não é aluno matriculado — texto livre em
  // vez de escolher em cadastro existente (docs/product/chamada-agenda-
  // frequencia.md §7.2, decisão 4: continua aceitando vários por aula).
  function adicionarCandidato() {
    const nome = nomeCandidato.trim();
    if (!nome) {
      setErroSalvar('Informe o nome do candidato.');
      return;
    }
    setErroSalvar(null);
    setCandidatos((atual) => [...atual, { nome, telefone: telefoneCandidato.trim() }]);
    setNomeCandidato('');
    setTelefoneCandidato('');
  }

  function removerCandidato(indice: number) {
    setCandidatos((atual) => atual.filter((_, i) => i !== indice));
  }

  async function salvar() {
    setErroSalvar(null);

    if (!aulaRecorrenteId) {
      setErroSalvar('Escolha o horário da grade.');
      return;
    }
    if (candidatos.length === 0) {
      setErroSalvar('Adicione ao menos um candidato.');
      return;
    }
    if (dataForaDoDia) {
      setErroSalvar(`Aula teste só pode cair numa ${DIAS_SEMANA[diaSemanaEsperado!]}, o mesmo dia desse horário da grade.`);
      return;
    }

    setSalvando(true);
    try {
      await criarAulaTeste(
        aulaRecorrenteId,
        dataISO,
        candidatos.map((c) => ({ nome: c.nome, telefone: c.telefone || null })),
        observacoes.trim() || null
      );
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch (err) {
      console.error(err);
      setErroSalvar('Erro ao agendar aula teste. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  if (meuPapel === 'aluno' || meuPapel === 'responsavel') {
    return <Redirect href="/" />;
  }

  if (loading) {
    return (
      <>
        <PageHeader titulo="Aula teste" />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </>
    );
  }

  return (
    <>
      <PageHeader titulo="Aula teste" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={[type.label, styles.rotulo]}>Horário da grade</Text>
          {slots.length === 0 ? (
            <Text style={[type.body, styles.subtitle]}>
              Você ainda não é responsável por nenhum módulo em nenhum horário. Cadastre em{' '}
              <Text style={styles.linkTexto} onPress={() => router.push('/chamada/modulos')}>
                Meus módulos
              </Text>
              .
            </Text>
          ) : (
            <Dropdown
              testID="nova-teste-dropdown-slot"
              placeholder="Selecione o horário"
              options={opcoesSlots}
              value={aulaRecorrenteId}
              onChange={setAulaRecorrenteId}
            />
          )}

          <Text style={[type.label, styles.rotulo]}>Candidatos</Text>
          <Text style={[type.caption, styles.subtitle, styles.dica]}>
            Ainda não são alunos matriculados — só nome e telefone (opcional).
          </Text>
          <View style={styles.adicionarRow}>
            <TextInput
              style={[styles.input, styles.inputCandidato]}
              value={nomeCandidato}
              onChangeText={setNomeCandidato}
              placeholder="Nome"
              onSubmitEditing={adicionarCandidato}
            />
            <TextInput
              style={[styles.input, styles.inputCandidato]}
              value={telefoneCandidato}
              onChangeText={setTelefoneCandidato}
              placeholder="Telefone (opcional)"
              keyboardType="phone-pad"
              onSubmitEditing={adicionarCandidato}
            />
            <TouchableOpacity style={styles.adicionarBotao} onPress={adicionarCandidato}>
              <Text style={styles.adicionarBotaoTexto}>Adicionar</Text>
            </TouchableOpacity>
          </View>
          {candidatos.length > 0 ? (
            <View style={styles.chips}>
              {candidatos.map((c, indice) => (
                <View key={`${c.nome}-${indice}`} style={styles.candidatoChip}>
                  <Text style={styles.candidatoChipTexto}>
                    {c.nome}
                    {c.telefone ? ` · ${c.telefone}` : ''}
                  </Text>
                  <TouchableOpacity
                    testID={`nova-teste-candidato-${indice}`}
                    style={styles.candidatoChipRemover}
                    onPress={() => removerCandidato(indice)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remover candidato ${c.nome}`}
                    hitSlop={8}
                  >
                    <Text style={styles.candidatoChipRemoverTexto}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[type.caption, styles.subtitle]}>Nenhum candidato adicionado ainda.</Text>
          )}

          <Text style={[type.label, styles.rotulo]}>Data</Text>
          <Text style={[type.caption, styles.subtitle, styles.dica]}>
            {diaSemanaEsperado !== null
              ? `Esse horário acontece toda ${DIAS_SEMANA[diaSemanaEsperado]}.`
              : 'Escolha o horário da grade primeiro.'}
          </Text>
          <TouchableOpacity style={styles.input} onPress={() => setDataAberta((atual) => !atual)}>
            <Text style={styles.periodoTexto}>{formatBR(dataISO)}</Text>
          </TouchableOpacity>
          {dataAberta ? (
            <DateRangePicker
              apenasUmDia
              inicioISO={dataISO}
              fimISO={dataISO}
              onConfirmar={(inicio) => {
                setDataISO(inicio);
                setDataAberta(false);
              }}
              onFechar={() => setDataAberta(false)}
            />
          ) : null}
          {dataForaDoDia ? (
            <Text style={[type.caption, styles.error]}>
              Essa data não cai numa {DIAS_SEMANA[diaSemanaEsperado!]}.
            </Text>
          ) : null}

          <Text style={[type.label, styles.rotulo]}>Observações (opcional)</Text>
          <TextInput style={styles.input} value={observacoes} onChangeText={setObservacoes} placeholder="Detalhes" />

          {error ? <Text style={[type.body, styles.error]}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.salvarBotao, salvando && styles.botaoDesabilitado]}
            onPress={salvar}
            disabled={salvando}
          >
            {salvando ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.salvarBotaoTexto}>Agendar aula teste</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  rotulo: {
    color: colors.textMuted,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  dica: {
    marginBottom: spacing.xs,
  },
  adicionarRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  inputCandidato: {
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  // Estilo neutro (borda cinza, fundo branco), de propósito diferente do
  // Chip de seleção (borda primary + fundo tint) usado no resto do app —
  // aqui tocar não seleciona, remove; usar o mesmo visual do "ativo"
  // confundia as duas ações.
  candidatoChip: {
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
  candidatoChipTexto: {
    color: colors.text,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
  candidatoChipRemover: {
    width: touchTarget - 16,
    height: touchTarget - 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  candidatoChipRemoverTexto: {
    color: colors.danger,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
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
  subtitle: {
    color: colors.textMuted,
  },
  linkTexto: {
    color: colors.primary,
    fontFamily: type.subtitle.fontFamily,
  },
  error: {
    color: colors.danger,
    marginTop: spacing.sm,
  },
  salvarBotao: {
    height: touchTarget,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  botaoDesabilitado: {
    opacity: 0.6,
  },
  salvarBotaoTexto: {
    color: colors.onPrimary,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
});
