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

import { convidarAluno, criarAluno, type Plano } from '../../../src/features/alunos/api';
import { useAuth } from '../../../src/features/auth/AuthProvider';
import { PageHeader } from '../../../src/components/PageHeader';
import { Footer } from '../../../src/components/Footer';
import { colors, radius, spacing, touchTarget, type } from '../../../src/constants/theme';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MODULOS = [1, 2, 3, 4] as const;
const PLANOS: { valor: Plano; label: string; meses: number }[] = [
  { valor: 'mensal', label: 'Mensal', meses: 1 },
  { valor: 'trimestral', label: 'Trimestral', meses: 3 },
  { valor: 'semestral', label: 'Semestral', meses: 6 },
  { valor: 'anual', label: 'Anual', meses: 12 },
];

// Entrada sempre em DD/MM/AAAA (mais natural pra digitar); convertido pra
// AAAA-MM-DD só na hora de gravar, que é o formato que o Postgres espera.
function paraISO(dataBR: string): string | null {
  const m = dataBR.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dia, mes, ano] = m;
  return `${ano}-${mes}-${dia}`;
}

function hojeBR(): string {
  const d = new Date();
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}/${d.getFullYear()}`;
}

function somaMeses(dataBR: string, meses: number): string {
  const m = dataBR.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return '';
  const [, dia, mes1, ano] = m;
  const d = new Date(Number(ano), Number(mes1) - 1 + meses, Number(dia));
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export default function NovoAluno() {
  const router = useRouter();
  const { meuPapel } = useAuth();

  const [nome, setNome] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [modulo, setModulo] = useState<number>(1);
  const [responsavelNome, setResponsavelNome] = useState('');
  const [responsavelTelefone, setResponsavelTelefone] = useState('');
  const [emailAcesso, setEmailAcesso] = useState('');
  const [plano, setPlano] = useState<Plano>('mensal');
  const [dataInicio, setDataInicio] = useState(hojeBR());
  const [dataFim, setDataFim] = useState(somaMeses(hojeBR(), 1));
  const [error, setError] = useState<string | null>(null);
  const [avisoConvite, setAvisoConvite] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function escolherPlano(novoPlano: Plano) {
    setPlano(novoPlano);
    const meses = PLANOS.find((p) => p.valor === novoPlano)?.meses ?? 1;
    setDataFim(somaMeses(dataInicio, meses));
  }

  async function salvar() {
    setError(null);
    setAvisoConvite(null);

    if (!nome.trim()) {
      setError('Informe o nome do aluno.');
      return;
    }

    const inicioISO = paraISO(dataInicio);
    const fimISO = paraISO(dataFim);
    if (!inicioISO || !fimISO) {
      setError('Datas devem estar no formato DD/MM/AAAA.');
      return;
    }

    const nascimentoISO = dataNascimento.trim() ? paraISO(dataNascimento) : null;
    if (dataNascimento.trim() && !nascimentoISO) {
      setError('Data de nascimento deve estar no formato DD/MM/AAAA.');
      return;
    }

    const emailValido = !emailAcesso.trim() || EMAIL_REGEX.test(emailAcesso.trim());
    if (!emailValido) {
      setError('Informe um email válido para dar acesso ao aplicativo, ou deixe em branco.');
      return;
    }

    setSubmitting(true);
    try {
      const alunoId = await criarAluno(
        {
          nome: nome.trim(),
          data_nascimento: nascimentoISO,
          modulo,
          responsavel_nome: responsavelNome.trim() || null,
          responsavel_telefone: responsavelTelefone.trim() || null,
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

      router.back();
    } catch (err) {
      console.error(err);
      setError('Erro ao salvar aluno. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  if (meuPapel === 'aluno') {
    return <Redirect href="/" />;
  }

  return (
    <>
    <PageHeader titulo="Novo aluno" />
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={[type.label, styles.rotulo]}>Nome</Text>
        <TextInput style={styles.input} value={nome} onChangeText={setNome} placeholder="Nome completo" />

        <Text style={[type.label, styles.rotulo]}>Data de nascimento (opcional)</Text>
        <TextInput
          style={styles.input}
          value={dataNascimento}
          onChangeText={setDataNascimento}
          placeholder="DD/MM/AAAA"
          keyboardType="numbers-and-punctuation"
        />

        <Text style={[type.label, styles.rotulo]}>Módulo</Text>
        <View style={styles.chips}>
          {MODULOS.map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.chip, modulo === m && styles.chipAtivo]}
              onPress={() => setModulo(m)}
            >
              <Text style={[styles.chipTexto, modulo === m && styles.chipTextoAtivo]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[type.label, styles.rotulo]}>Responsável (opcional)</Text>
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

        <Text style={[type.label, styles.rotulo]}>Email de acesso ao aplicativo (opcional)</Text>
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
          Se preenchido, o aluno (ou responsável) recebe um convite por email pra criar a própria senha e acessar o
          app.
        </Text>

        <Text style={[type.label, styles.rotulo]}>Plano</Text>
        <View style={styles.chips}>
          {PLANOS.map((p) => (
            <TouchableOpacity
              key={p.valor}
              style={[styles.chip, plano === p.valor && styles.chipAtivo]}
              onPress={() => escolherPlano(p.valor)}
            >
              <Text style={[styles.chipTexto, plano === p.valor && styles.chipTextoAtivo]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[type.label, styles.rotulo]}>Início do contrato</Text>
        <TextInput
          style={styles.input}
          value={dataInicio}
          onChangeText={(texto) => {
            setDataInicio(texto);
            const meses = PLANOS.find((p) => p.valor === plano)?.meses ?? 1;
            setDataFim(somaMeses(texto, meses));
          }}
          placeholder="DD/MM/AAAA"
          keyboardType="numbers-and-punctuation"
        />

        <Text style={[type.label, styles.rotulo]}>Fim do contrato</Text>
        <TextInput
          style={styles.input}
          value={dataFim}
          onChangeText={setDataFim}
          placeholder="DD/MM/AAAA"
          keyboardType="numbers-and-punctuation"
        />

        {error ? <Text style={[type.body, styles.error]}>{error}</Text> : null}
        {avisoConvite ? <Text style={[type.body, styles.aviso]}>{avisoConvite}</Text> : null}

        <TouchableOpacity
          style={[styles.salvarBotao, submitting && styles.salvarBotaoDesabilitado]}
          onPress={avisoConvite ? () => router.back() : salvar}
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
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
    color: colors.text,
  },
  inputEspacado: {
    marginTop: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    minHeight: touchTarget,
    minWidth: touchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipAtivo: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipTexto: {
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
    color: colors.text,
  },
  chipTextoAtivo: {
    color: colors.onPrimary,
  },
  dicaEmail: {
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  error: {
    color: colors.danger,
    marginTop: spacing.lg,
  },
  aviso: {
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
  salvarBotaoDesabilitado: {
    opacity: 0.6,
  },
  salvarBotaoTexto: {
    color: colors.onPrimary,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
});
