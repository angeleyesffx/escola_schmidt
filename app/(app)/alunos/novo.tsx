import { Redirect, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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

import { convidarAluno, criarAluno, type Plano } from '../../../src/features/alunos/api';
import { getGradeSemanal, getModulosAtivos, type AulaRecorrente, type Modulo } from '../../../src/features/chamada/api';
import { useAuth } from '../../../src/features/auth/AuthProvider';
import { useAsyncData } from '../../../src/hooks/useAsyncData';
import { PageHeader } from '../../../src/components/PageHeader';
import { Footer } from '../../../src/components/Footer';
import { WebModal } from '../../../src/components/WebModal';
import { Chip } from '../../../src/components/Chip';
import { Dropdown } from '../../../src/components/Dropdown';
import { DateRangePicker } from '../../../src/components/DateRangePicker';
import { hojeBR, paraBR, paraISO, temIdadeMinima } from '../../../src/lib/dataBR';
import { colors, radius, spacing, touchTarget, type } from '../../../src/constants/theme';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PLANOS: { valor: Plano; label: string; meses: number }[] = [
  { valor: 'mensal', label: 'Mensal', meses: 1 },
  { valor: 'trimestral', label: 'Trimestral', meses: 3 },
  { valor: 'semestral', label: 'Semestral', meses: 6 },
  { valor: 'anual', label: 'Anual', meses: 12 },
];

function somaMeses(dataBR: string, meses: number): string {
  const m = dataBR.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return '';
  const [, dia, mes1, ano] = m;
  const d = new Date(Number(ano), Number(mes1) - 1 + meses, Number(dia));
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function menorDeIdade(dataNascimentoISO: string): boolean {
  const nascimento = new Date(`${dataNascimentoISO}T00:00:00`);
  const hoje = new Date();
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const aindaNaoCompletou =
    hoje.getMonth() < nascimento.getMonth() ||
    (hoje.getMonth() === nascimento.getMonth() && hoje.getDate() < nascimento.getDate());
  if (aindaNaoCompletou) idade -= 1;
  return idade < 18;
}

export default function NovoAluno() {
  const router = useRouter();
  const { meuPapel } = useAuth();

  const { data: dadosModulos } = useAsyncData<Modulo[]>(getModulosAtivos, []);
  const { data: dadosGrade } = useAsyncData<AulaRecorrente[]>(getGradeSemanal, []);
  const modulos = dadosModulos ?? [];
  const grade = dadosGrade ?? [];

  const [nome, setNome] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [modulo, setModulo] = useState<number | null>(null);
  const [aulaRecorrenteId, setAulaRecorrenteId] = useState<string | null>(null);

  // Assim que os módulos carregam, seleciona o primeiro por padrão — sem
  // isso o formulário abriria sem nenhum módulo marcado.
  useEffect(() => {
    if (modulo === null && modulos.length > 0) {
      setModulo(modulos[0].numero);
    }
  }, [modulo, modulos]);
  const [responsavelNome, setResponsavelNome] = useState('');
  const [responsavelTelefone, setResponsavelTelefone] = useState('');
  const [emailAcesso, setEmailAcesso] = useState('');
  const [plano, setPlano] = useState<Plano>('mensal');
  const [dataInicio, setDataInicio] = useState(hojeBR());
  const [dataFim, setDataFim] = useState(somaMeses(hojeBR(), 1));
  const [error, setError] = useState<string | null>(null);
  const [avisoConvite, setAvisoConvite] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Escolha de data por calendário, não digitação — cadastro é feito em pé,
  // na beira da pista, mesmo contexto de luva que definiu o touchTarget do
  // tema. Só um desses três pode estar aberto por vez.
  const [campoDataAberto, setCampoDataAberto] = useState<'nascimento' | 'inicio' | 'fim' | null>(null);
  // Formulário longo: sem isso, um erro no campo de email fica fora da tela
  // quando o erro só aparece perto do botão "Salvar aluno", lá embaixo.
  const scrollRef = useRef<ScrollView>(null);
  const emailYRef = useRef(0);

  const horariosDoModulo = grade.filter((slot) => modulo !== null && slot.modulos.includes(modulo));
  const opcoesHorarios = horariosDoModulo.map((slot) => ({
    value: slot.id,
    label: `${['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][slot.dia_semana]} · ${slot.hora.slice(0, 5)}`,
  }));

  useEffect(() => {
    if (aulaRecorrenteId && !horariosDoModulo.some((slot) => slot.id === aulaRecorrenteId)) {
      setAulaRecorrenteId(null);
    }
  }, [aulaRecorrenteId, horariosDoModulo]);

  function escolherPlano(novoPlano: Plano) {
    setPlano(novoPlano);
    const meses = PLANOS.find((p) => p.valor === novoPlano)?.meses ?? 1;
    setDataFim(somaMeses(dataInicio, meses));
  }

  function selecionarDataNascimento(iso: string) {
    setDataNascimento(paraBR(iso));
    setCampoDataAberto(null);
  }

  function selecionarDataInicio(iso: string) {
    const dataBR = paraBR(iso);
    setDataInicio(dataBR);
    const meses = PLANOS.find((p) => p.valor === plano)?.meses ?? 1;
    setDataFim(somaMeses(dataBR, meses));
    setCampoDataAberto(null);
  }

  function selecionarDataFim(iso: string) {
    setDataFim(paraBR(iso));
    setCampoDataAberto(null);
  }

  async function salvar() {
    setError(null);
    setAvisoConvite(null);

    if (!nome.trim()) {
      setError('Informe o nome do aluno.');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    const inicioISO = paraISO(dataInicio);
    const fimISO = paraISO(dataFim);
    if (!inicioISO || !fimISO) {
      setError('Datas devem estar no formato DD/MM/AAAA.');
      return;
    }

    const nascimentoISO = paraISO(dataNascimento);
    if (!nascimentoISO) {
      setError('Informe a data de nascimento.');
      return;
    }

    if (!temIdadeMinima(nascimentoISO)) {
      setError('O aluno precisa ter pelo menos 3 anos completos para ser matriculado.');
      return;
    }

    const ehMenorDeIdade = menorDeIdade(nascimentoISO);
    if (ehMenorDeIdade && !responsavelNome.trim()) {
      setError('Informe o nome do responsável legal para alunos menores de idade.');
      return;
    }

    if (modulo === null) {
      setError('Escolha o módulo.');
      return;
    }

    if (!aulaRecorrenteId) {
      setError('Escolha o horário da grade para o aluno.');
      return;
    }

    const emailValido = !emailAcesso.trim() || EMAIL_REGEX.test(emailAcesso.trim());
    if (ehMenorDeIdade && !emailAcesso.trim()) {
      setError('Informe o email do responsável legal para enviar o convite de acesso.');
      scrollRef.current?.scrollTo({ y: emailYRef.current, animated: true });
      return;
    }
    if (!emailValido) {
      setError('Informe um email válido para enviar o convite de acesso.');
      scrollRef.current?.scrollTo({ y: emailYRef.current, animated: true });
      return;
    }

    setSubmitting(true);
    try {
      const alunoId = await criarAluno(
        {
          nome: nome.trim(),
          data_nascimento: nascimentoISO,
          modulo,
          aula_recorrente_id: aulaRecorrenteId,
          responsavel_nome: responsavelNome.trim() || null,
          responsavel_telefone: responsavelTelefone.trim() || null,
          // Guardado mesmo quando o convite abaixo não é enviado agora: é
          // contra esse e-mail que o cadastro público se vincula sozinho
          // depois, sem precisar de convite nem de vínculo manual.
          responsavel_email: emailAcesso.trim() || null,
        },
        { plano, data_inicio: inicioISO, data_fim: fimISO }
      );

      if (emailAcesso.trim()) {
        try {
          await convidarAluno(alunoId, emailAcesso.trim());
        } catch (erroConvite) {
          console.error(erroConvite);
          setSubmitting(false);
          setAvisoConvite(
            `Aluno salvo, mas o convite de acesso não foi enviado: ${
              erroConvite instanceof Error ? erroConvite.message : 'erro desconhecido'
            }. Você pode tentar novamente depois, na tela do aluno.`
          );
          return;
        }
      }

      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Erro ao salvar aluno. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  if (meuPapel === 'aluno' || meuPapel === 'responsavel') {
    return <Redirect href="/" />;
  }

  return (
    <WebModal>
    <PageHeader titulo="Novo aluno" />
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.secaoTitulo}>Dados do aluno</Text>
        <Text style={[type.label, styles.rotulo]}>Nome</Text>
        <TextInput style={styles.input} value={nome} onChangeText={setNome} placeholder="Nome completo" />

        <Text style={[type.label, styles.rotulo]}>Data de nascimento</Text>
        <TouchableOpacity
          style={styles.dataBotao}
          onPress={() => setCampoDataAberto(campoDataAberto === 'nascimento' ? null : 'nascimento')}
        >
          <Text style={dataNascimento ? styles.dataBotaoTexto : styles.dataBotaoPlaceholder}>
            {dataNascimento || 'Selecionar data'}
          </Text>
        </TouchableOpacity>
        {campoDataAberto === 'nascimento' ? (
          <DateRangePicker
            apenasUmDia
            inicioISO={paraISO(dataNascimento) ?? paraISO(hojeBR())!}
            fimISO={paraISO(dataNascimento) ?? paraISO(hojeBR())!}
            onConfirmar={selecionarDataNascimento}
            onFechar={() => setCampoDataAberto(null)}
          />
        ) : null}

        <Text style={styles.secaoTitulo}>Matrícula</Text>
        <Text style={[type.label, styles.rotulo]}>Módulo</Text>
        <View style={styles.chips}>
          {modulos.map((m) => (
            <Chip key={m.numero} label={m.nome} active={modulo === m.numero} onPress={() => setModulo(m.numero)} square />
          ))}
        </View>

        <Text style={[type.label, styles.rotulo]}>Horário da grade</Text>
        <Dropdown
          testID="novo-aluno-dropdown-horario"
          placeholder="Selecione o horário do aluno"
          options={opcoesHorarios}
          value={aulaRecorrenteId}
          onChange={setAulaRecorrenteId}
          vazio={modulo === null ? 'Escolha o módulo primeiro.' : 'Nenhum horário para este módulo.'}
        />

        <Text style={styles.secaoTitulo}>Responsável e acesso</Text>
        <Text style={[type.caption, styles.secaoAjuda]}>
          Para menores de idade, o responsável legal e o email para convite são obrigatórios. Para maiores, o acesso é opcional.
        </Text>
        <Text style={[type.label, styles.rotulo]}>
          Responsável {dataNascimento && menorDeIdade(paraISO(dataNascimento) ?? '') ? '(obrigatório)' : '(opcional)'}
        </Text>
        <TextInput
          style={styles.input}
          value={responsavelNome}
          onChangeText={setResponsavelNome}
          placeholder="Nome do responsável"
        />
        <TextInput
          style={[styles.input, styles.inputEspacado]}
          value={responsavelTelefone}
          onChangeText={setResponsavelTelefone}
          placeholder="Telefone do responsável"
          keyboardType="phone-pad"
        />

        <View onLayout={(e) => { emailYRef.current = e.nativeEvent.layout.y; }}>
          <Text style={[type.label, styles.rotulo]}>
            {dataNascimento && menorDeIdade(paraISO(dataNascimento) ?? '')
              ? 'Email do responsável (obrigatório)'
              : 'Email de acesso (opcional)'}
          </Text>
          <TextInput
            style={styles.input}
            value={emailAcesso}
            onChangeText={setEmailAcesso}
            placeholder="email@exemplo.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
          />
          <Text style={[type.caption, styles.dicaEmail]}>
            {dataNascimento && menorDeIdade(paraISO(dataNascimento) ?? '')
              ? 'Obrigatório para alunos menores de idade: o responsável receberá o convite para acessar o app.'
              : 'Preenchendo, o aluno ou responsável recebe um convite por email para criar a própria senha.'}
          </Text>
        </View>

        <Text style={styles.secaoTitulo}>Contrato</Text>
        <Text style={[type.label, styles.rotulo]}>Plano</Text>
        <View style={styles.chips}>
          {PLANOS.map((p) => (
            <Chip key={p.valor} label={p.label} active={plano === p.valor} onPress={() => escolherPlano(p.valor)} />
          ))}
        </View>

        <Text style={[type.label, styles.rotulo]}>Início do contrato</Text>
        <TouchableOpacity
          style={styles.dataBotao}
          onPress={() => setCampoDataAberto(campoDataAberto === 'inicio' ? null : 'inicio')}
        >
          <Text style={styles.dataBotaoTexto}>{dataInicio}</Text>
        </TouchableOpacity>
        {campoDataAberto === 'inicio' ? (
          <DateRangePicker
            apenasUmDia
            inicioISO={paraISO(dataInicio) ?? paraISO(hojeBR())!}
            fimISO={paraISO(dataInicio) ?? paraISO(hojeBR())!}
            onConfirmar={selecionarDataInicio}
            onFechar={() => setCampoDataAberto(null)}
          />
        ) : null}

        <Text style={[type.label, styles.rotulo]}>Fim do contrato</Text>
        <TouchableOpacity
          style={styles.dataBotao}
          onPress={() => setCampoDataAberto(campoDataAberto === 'fim' ? null : 'fim')}
        >
          <Text style={styles.dataBotaoTexto}>{dataFim}</Text>
        </TouchableOpacity>
        {campoDataAberto === 'fim' ? (
          <DateRangePicker
            apenasUmDia
            inicioISO={paraISO(dataFim) ?? paraISO(hojeBR())!}
            fimISO={paraISO(dataFim) ?? paraISO(hojeBR())!}
            onConfirmar={selecionarDataFim}
            onFechar={() => setCampoDataAberto(null)}
          />
        ) : null}

        {error ? <Text style={[type.body, styles.error]}>{error}</Text> : null}
        {avisoConvite ? <Text style={[type.body, styles.aviso]}>{avisoConvite}</Text> : null}

        <TouchableOpacity
          style={[styles.salvarBotao, submitting && styles.salvarBotaoDesabilitado]}
          onPress={avisoConvite ? () => (router.canGoBack() ? router.back() : router.replace('/')) : salvar}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.salvarBotaoTexto}>{avisoConvite ? 'Entendi, voltar' : 'Salvar aluno'}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
    <Footer />
    </WebModal>
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
  rotulo: {
    color: colors.textMuted,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  secaoTitulo: {
    color: colors.text,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
    marginTop: spacing.xl,
    marginBottom: spacing.xs,
  },
  secaoAjuda: {
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  input: {
    height: touchTarget,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
    color: colors.text,
  },
  inputEspacado: {
    marginTop: spacing.sm,
  },
  dataBotao: {
    height: touchTarget,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
  },
  dataBotaoTexto: {
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
    color: colors.text,
  },
  dataBotaoPlaceholder: {
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
    color: colors.textMuted,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  dicaEmail: {
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  error: {
    color: colors.danger,
    marginTop: spacing.lg,
  },
  // Amber (mesmo tom usado em "Pedido enviado" na chamada), não danger: o
  // aluno foi salvo com sucesso, só o convite falhou — pintar de vermelho
  // fazia parecer que nada tinha sido salvo.
  aviso: {
    color: colors.justified,
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
  salvarBotaoDesabilitado: {
    opacity: 0.6,
  },
  salvarBotaoTexto: {
    color: colors.onPrimary,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
});
