import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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

import { getAlunos } from '../../../src/features/alunos/api';
import { criarAulaParticular, getHorariosLivresProfessor, getProfessores } from '../../../src/features/chamada/api';
import { formatDataISO } from '../../../src/features/chamada/calendar';
import { useAuth } from '../../../src/features/auth/AuthProvider';
import { useAsyncData } from '../../../src/hooks/useAsyncData';
import { PageHeader } from '../../../src/components/PageHeader';
import { DateRangePicker } from '../../../src/components/DateRangePicker';
import { Footer } from '../../../src/components/Footer';
import { Chip } from '../../../src/components/Chip';
import { Dropdown } from '../../../src/components/Dropdown';
import { colors, radius, spacing, touchTarget, type } from '../../../src/constants/theme';

function formatBR(dataISO: string): string {
  return dataISO.split('-').reverse().join('/');
}

function formatHora(hora: string) {
  return hora.slice(0, 5);
}

export default function NovaAulaParticular() {
  const router = useRouter();
  const { meuPapel, session, meuAluno } = useAuth();
  const souAluno = meuPapel === 'aluno';

  const [alunoId, setAlunoId] = useState<string | null>(null);
  const [professorId, setProfessorId] = useState<string | null>(null);
  const [dataISO, setDataISO] = useState(formatDataISO(new Date()));
  const [dataAberta, setDataAberta] = useState(false);
  const [horariosLivres, setHorariosLivres] = useState<string[]>([]);
  const [carregandoHorarios, setCarregandoHorarios] = useState(false);
  const [horaAula, setHoraAula] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  const {
    data: dadosIniciais,
    loading,
    error: erroCarregar,
  } = useAsyncData(
    async () => {
      // Aluno reserva só pra si mesmo — não precisa (nem consegue, pela RLS
      // de `alunos`) ver a lista inteira de matriculados.
      const [dadosAlunos, dadosProfessores] = await Promise.all([
        souAluno ? Promise.resolve([]) : getAlunos(),
        getProfessores(),
      ]);
      return { alunos: dadosAlunos.filter((a) => a.ativo), professores: dadosProfessores };
    },
    [souAluno],
    { mensagemErro: 'Erro ao carregar alunos e professores. Tente novamente.' }
  );
  const alunos = dadosIniciais?.alunos ?? [];
  const professores = dadosIniciais?.professores ?? [];
  const error = erroSalvar ?? erroCarregar;

  useEffect(() => {
    if (souAluno && meuAluno) {
      setAlunoId(meuAluno.id);
    }
  }, [souAluno, meuAluno]);

  // A equipe só enxerga o próprio perfil na lista de professores (a não ser
  // que seja dono) — se veio 1 só, já pré-seleciona.
  useEffect(() => {
    if (!dadosIniciais) return;
    if (dadosIniciais.professores.length === 1) {
      setProfessorId(dadosIniciais.professores[0].id);
    } else if (session?.user.id && dadosIniciais.professores.some((p) => p.id === session.user.id)) {
      setProfessorId(session.user.id);
    }
  }, [dadosIniciais, session?.user.id]);

  // Só mostra (e só deixa escolher) horas que o professor abriu pra
  // particular e que ainda estão livres nessa data específica — sem
  // conflito com a grade regular dele nem com outra particular já marcada.
  useEffect(() => {
    if (!professorId) {
      setHorariosLivres([]);
      setHoraAula('');
      return;
    }
    let ativo = true;
    setCarregandoHorarios(true);
    setHoraAula('');
    getHorariosLivresProfessor(professorId, dataISO)
      .then((horas) => {
        if (ativo) setHorariosLivres(horas);
      })
      .catch((err) => {
        console.error(err);
        if (ativo) setErroSalvar('Erro ao carregar horários livres do professor. Tente novamente.');
      })
      .finally(() => {
        if (ativo) setCarregandoHorarios(false);
      });
    return () => {
      ativo = false;
    };
  }, [professorId, dataISO]);

  const opcoesAlunos = alunos.map((a) => ({ value: a.id, label: a.nome, sublabel: `Módulo ${a.modulo}` }));
  const opcoesProfessores = professores.map((p) => ({ value: p.id, label: p.nome }));

  async function salvar() {
    setErroSalvar(null);

    if (!alunoId) {
      setErroSalvar('Escolha o aluno.');
      return;
    }
    if (!professorId) {
      setErroSalvar('Escolha o professor.');
      return;
    }
    if (!horaAula) {
      setErroSalvar('Escolha um horário livre do professor.');
      return;
    }

    setSalvando(true);
    try {
      await criarAulaParticular(alunoId, professorId, dataISO, horaAula, observacoes.trim() || null);
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch (err: unknown) {
      console.error(err);
      const jaExiste =
        typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === '23505';
      setErroSalvar(
        jaExiste
          ? 'Esse professor já tem uma aula particular marcada nesse mesmo horário.'
          : 'Erro ao agendar aula particular. Tente novamente.'
      );
    } finally {
      setSalvando(false);
    }
  }

  if (souAluno && !meuAluno) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (loading) {
    return (
      <>
        <PageHeader titulo="Aula particular" />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </>
    );
  }

  return (
    <>
      <PageHeader titulo="Aula particular" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={[type.label, styles.rotulo]}>Aluno</Text>
          {souAluno ? (
            <View style={styles.input}>
              <Text style={styles.periodoTexto}>{meuAluno?.nome}</Text>
            </View>
          ) : (
            <Dropdown
              testID="nova-particular-dropdown-aluno"
              placeholder="Selecione o aluno"
              searchable
              options={opcoesAlunos}
              value={alunoId}
              onChange={setAlunoId}
              vazio="Nenhum aluno encontrado."
            />
          )}

          <Text style={[type.label, styles.rotulo]}>Professor</Text>
          <Dropdown
            testID="nova-particular-dropdown-professor"
            placeholder="Selecione o professor"
            options={opcoesProfessores}
            value={professorId}
            onChange={setProfessorId}
            vazio="Nenhum professor disponível."
          />

          <Text style={[type.label, styles.rotulo]}>Data</Text>
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

          <Text style={[type.label, styles.rotulo]}>Hora</Text>
          {!professorId ? (
            <Text style={[type.body, styles.subtitle]}>Escolha o professor pra ver os horários livres dele.</Text>
          ) : carregandoHorarios ? (
            <ActivityIndicator color={colors.primary} style={styles.horariosLoading} />
          ) : horariosLivres.length === 0 ? (
            <Text style={[type.body, styles.subtitle]}>
              Esse professor não tem horário livre pra particular nessa data. Ele pode cadastrar horários em{' '}
              <Text style={styles.linkTexto} onPress={() => router.push('/chamada/disponibilidade')}>
                Meus horários livres
              </Text>
              .
            </Text>
          ) : (
            <View style={styles.chips}>
              {horariosLivres.map((hora) => (
                <Chip key={hora} label={formatHora(hora)} active={horaAula === hora} onPress={() => setHoraAula(hora)} />
              ))}
            </View>
          )}

          <TouchableOpacity style={styles.gerenciarBotao} onPress={() => router.push('/chamada/disponibilidade')}>
            <Text style={styles.linkTexto}>Gerenciar horários livres</Text>
          </TouchableOpacity>

          <Text style={[type.label, styles.rotulo]}>Observações (opcional)</Text>
          <TextInput style={styles.input} value={observacoes} onChangeText={setObservacoes} placeholder="Detalhes" />

          {error ? <Text style={[type.body, styles.error]}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.salvarBotao, salvando && styles.botaoDesabilitado]}
            onPress={salvar}
            disabled={salvando}
          >
            {salvando ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.salvarBotaoTexto}>Agendar aula</Text>}
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
  input: {
    height: touchTarget,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    justifyContent: 'center',
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
  gerenciarBotao: {
    minHeight: touchTarget,
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  horariosLoading: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  error: {
    color: colors.danger,
    marginTop: spacing.lg,
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
