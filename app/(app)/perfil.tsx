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

import { useAuth } from '../../src/features/auth/AuthProvider';
import { atualizarMeuPerfil, getMeuPerfil } from '../../src/features/perfil/api';
import { atualizarDadosAluno } from '../../src/features/alunos/api';
import { useAsyncData } from '../../src/hooks/useAsyncData';
import { hojeBR, paraBR, paraISO } from '../../src/lib/dataBR';
import { PageHeader } from '../../src/components/PageHeader';
import { PersonIcon } from '../../src/components/PersonIcon';
import { PasswordInput } from '../../src/components/PasswordInput';
import { DateRangePicker } from '../../src/components/DateRangePicker';
import { Footer } from '../../src/components/Footer';
import { colors, fonts, radius, spacing, touchTarget, type } from '../../src/constants/theme';

const ROTULO_PAPEL: Record<string, string> = {
  dono: 'Dono',
  professor: 'Professor(a)',
  aluno: 'Aluno',
};

const REGRAS_SENHA: { chave: string; label: string; cumprida: (senha: string) => boolean }[] = [
  { chave: 'tamanho', label: 'Mínimo 8 caracteres', cumprida: (s) => s.length >= 8 },
  { chave: 'maiuscula', label: '1 letra maiúscula', cumprida: (s) => /[A-Z]/.test(s) },
  { chave: 'numero', label: '1 número', cumprida: (s) => /\d/.test(s) },
  { chave: 'simbolo', label: '1 símbolo', cumprida: (s) => /[^A-Za-z0-9]/.test(s) },
];

export default function Perfil() {
  const { session, meuPapel, meuAluno, changePassword } = useAuth();
  const router = useRouter();
  const souAluno = (meuPapel === 'aluno' || meuPapel === 'responsavel');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState('');
  const [novaSenhaTocada, setNovaSenhaTocada] = useState(false);
  const [erroSenha, setErroSenha] = useState<string | null>(null);
  const [sucessoSenha, setSucessoSenha] = useState<string | null>(null);
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [nomeAluno, setNomeAluno] = useState('');
  const [dataNascimentoAluno, setDataNascimentoAluno] = useState('');
  const [responsavelNomeAluno, setResponsavelNomeAluno] = useState('');
  const [responsavelTelefoneAluno, setResponsavelTelefoneAluno] = useState('');
  const [salvandoAluno, setSalvandoAluno] = useState(false);
  const [erroAluno, setErroAluno] = useState<string | null>(null);
  const [sucessoAluno, setSucessoAluno] = useState<string | null>(null);
  const [pickerNascimentoAberto, setPickerNascimentoAberto] = useState(false);

  const senhaOk = REGRAS_SENHA.every((regra) => regra.cumprida(novaSenha));

  const {
    data: meuPerfil,
    loading: carregando,
    error: erroCarregar,
  } = useAsyncData(() => getMeuPerfil(session!.user.id), [session?.user.id], {
    enabled: Boolean(session?.user.id),
    mensagemErro: 'Erro ao carregar seu perfil. Tente novamente.',
  });
  const erroExibido = erro ?? erroCarregar;

  useEffect(() => {
    if (!meuPerfil) return;
    setNome(meuPerfil.nome);
    setTelefone(meuPerfil.telefone ?? '');
  }, [meuPerfil]);

  useEffect(() => {
    if (!meuAluno) return;
    setNomeAluno(meuAluno.nome);
    setDataNascimentoAluno(meuAluno.data_nascimento ? paraBR(meuAluno.data_nascimento) : '');
    setResponsavelNomeAluno(meuAluno.responsavel_nome ?? '');
    setResponsavelTelefoneAluno(meuAluno.responsavel_telefone ?? '');
  }, [meuAluno]);

  function selecionarDataNascimentoAluno(iso: string) {
    setDataNascimentoAluno(paraBR(iso));
    if (sucessoAluno) setSucessoAluno(null);
    setPickerNascimentoAberto(false);
  }

  async function salvarDadosAluno() {
    if (!meuAluno) return;
    if (!nomeAluno.trim()) {
      setErroAluno('Informe o nome do aluno.');
      return;
    }
    const nascimentoISO = dataNascimentoAluno.trim() ? paraISO(dataNascimentoAluno) : null;
    if (dataNascimentoAluno.trim() && !nascimentoISO) {
      setErroAluno('Data de nascimento deve estar no formato DD/MM/AAAA.');
      return;
    }

    setErroAluno(null);
    setSucessoAluno(null);
    setSalvandoAluno(true);
    try {
      await atualizarDadosAluno(meuAluno.id, {
        nome: nomeAluno.trim(),
        data_nascimento: nascimentoISO,
        responsavel_nome: responsavelNomeAluno.trim() || null,
        responsavel_telefone: responsavelTelefoneAluno.trim() || null,
      });
      setSucessoAluno('Dados do aluno atualizados com sucesso.');
    } catch (err) {
      console.error(err);
      setErroAluno('Erro ao salvar dados do aluno. Tente novamente.');
    } finally {
      setSalvandoAluno(false);
    }
  }

  async function salvarPerfil() {
    if (!session?.user.id) return;
    if (!nome.trim()) {
      setErro('Informe seu nome.');
      return;
    }

    setErro(null);
    setSucesso(null);
    setSalvando(true);
    try {
      await atualizarMeuPerfil({
        nome: nome.trim(),
        telefone: telefone.trim() || null,
      });
      setSucesso('Dados atualizados com sucesso.');
    } catch (err) {
      console.error(err);
      setErro('Erro ao salvar perfil. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  async function salvarSenha() {
    setErroSenha(null);
    setSucessoSenha(null);

    if (!senhaAtual) {
      setErroSenha('Informe sua senha atual.');
      return;
    }
    if (!senhaOk) {
      setErroSenha('A nova senha não atende aos critérios mínimos.');
      return;
    }
    if (novaSenha !== confirmarNovaSenha) {
      setErroSenha('A confirmação da nova senha não confere.');
      return;
    }

    setSalvandoSenha(true);
    const { error } = await changePassword(senhaAtual, novaSenha);
    setSalvandoSenha(false);

    if (error) {
      setErroSenha(error);
      return;
    }

    setSenhaAtual('');
    setNovaSenha('');
    setConfirmarNovaSenha('');
    setNovaSenhaTocada(false);
    setSucessoSenha('Senha alterada com sucesso.');
  }

  if (carregando) {
    return (
      <>
        <PageHeader titulo="Meu perfil" />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </>
    );
  }

  return (
    <>
      <PageHeader titulo="Meu perfil" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.resumoTopo}>
              <View style={styles.resumoTextoWrap}>
                <Text style={type.title}>{nome || meuAluno?.nome || session?.user.email}</Text>
                <Text style={[type.body, styles.subtitle]}>{meuPapel ? ROTULO_PAPEL[meuPapel] ?? meuPapel : ''}</Text>
                {session?.user.email ? <Text style={[type.body, styles.subtitle]}>{session.user.email}</Text> : null}
              </View>
              <View style={styles.resumoImagem}>
                <PersonIcon size={38} color={colors.primary} />
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={type.subtitle}>Dados da conta</Text>

            <Text style={[type.label, styles.rotulo]}>Nome</Text>
            <TextInput
              style={styles.input}
              value={nome}
              onChangeText={(texto) => {
                setNome(texto);
                if (sucesso) setSucesso(null);
              }}
              placeholder="Seu nome"
              autoCapitalize="words"
            />

            <Text style={[type.label, styles.rotulo]}>Telefone (opcional)</Text>
            <TextInput
              style={styles.input}
              value={telefone}
              onChangeText={(texto) => {
                setTelefone(texto);
                if (sucesso) setSucesso(null);
              }}
              placeholder="(00) 00000-0000"
              keyboardType="phone-pad"
            />

            {erroExibido ? <Text style={[type.body, styles.error]}>{erroExibido}</Text> : null}
            {sucesso ? <Text style={[type.body, styles.sucesso]}>{sucesso}</Text> : null}

            <TouchableOpacity
              style={[styles.botaoPrimario, salvando && styles.botaoPrimarioDesabilitado]}
              onPress={salvarPerfil}
              disabled={salvando}
            >
              {salvando ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.botaoPrimarioTexto}>Salvar alterações</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={type.subtitle}>Alterar senha</Text>

            <Text style={[type.label, styles.rotulo]}>Senha atual</Text>
            <PasswordInput
              style={styles.input}
              value={senhaAtual}
              onChangeText={(texto) => {
                setSenhaAtual(texto);
                if (sucessoSenha) setSucessoSenha(null);
              }}
              placeholder="Digite sua senha atual"
            />

            <Text style={[type.label, styles.rotulo]}>Nova senha</Text>
            <PasswordInput
              style={styles.input}
              value={novaSenha}
              onChangeText={(texto) => {
                setNovaSenha(texto);
                if (!novaSenhaTocada) setNovaSenhaTocada(true);
                if (sucessoSenha) setSucessoSenha(null);
              }}
              placeholder="Digite a nova senha"
            />

            <View style={styles.regrasSenha}>
              {REGRAS_SENHA.map((regra) => {
                const cumprida = regra.cumprida(novaSenha);
                const cor = !novaSenhaTocada ? colors.textMuted : cumprida ? colors.present : colors.danger;
                return (
                  <Text key={regra.chave} style={[styles.regraSenha, { color: cor }]}> 
                    {novaSenhaTocada && cumprida ? '✓ ' : '• '}
                    {regra.label}
                  </Text>
                );
              })}
            </View>

            <Text style={[type.label, styles.rotulo]}>Confirmar nova senha</Text>
            <PasswordInput
              style={styles.input}
              value={confirmarNovaSenha}
              onChangeText={(texto) => {
                setConfirmarNovaSenha(texto);
                if (sucessoSenha) setSucessoSenha(null);
              }}
              placeholder="Repita a nova senha"
            />

            {erroSenha ? <Text style={[type.body, styles.error]}>{erroSenha}</Text> : null}
            {sucessoSenha ? <Text style={[type.body, styles.sucesso]}>{sucessoSenha}</Text> : null}

            <TouchableOpacity
              style={[styles.botaoPrimario, salvandoSenha && styles.botaoPrimarioDesabilitado]}
              onPress={salvarSenha}
              disabled={salvandoSenha}
            >
              {salvandoSenha ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.botaoPrimarioTexto}>Atualizar senha</Text>
              )}
            </TouchableOpacity>
          </View>

          {souAluno && meuAluno ? (
            <View style={styles.card}>
              <Text style={type.subtitle}>Dados do aluno</Text>

              <Text style={[type.label, styles.rotulo]}>Nome do aluno</Text>
              <TextInput
                style={styles.input}
                value={nomeAluno}
                onChangeText={(texto) => {
                  setNomeAluno(texto);
                  if (sucessoAluno) setSucessoAluno(null);
                }}
                placeholder="Nome completo"
                autoCapitalize="words"
              />

              <Text style={[type.label, styles.rotulo]}>Data de nascimento (opcional)</Text>
              <TouchableOpacity style={styles.dataBotao} onPress={() => setPickerNascimentoAberto((atual) => !atual)}>
                <Text style={dataNascimentoAluno ? styles.dataBotaoTexto : styles.dataBotaoPlaceholder}>
                  {dataNascimentoAluno || 'Selecionar data'}
                </Text>
              </TouchableOpacity>
              {pickerNascimentoAberto ? (
                <DateRangePicker
                  apenasUmDia
                  inicioISO={paraISO(dataNascimentoAluno) ?? paraISO(hojeBR())!}
                  fimISO={paraISO(dataNascimentoAluno) ?? paraISO(hojeBR())!}
                  onConfirmar={selecionarDataNascimentoAluno}
                  onFechar={() => setPickerNascimentoAberto(false)}
                />
              ) : null}

              <Text style={[type.label, styles.rotulo]}>Responsável (opcional)</Text>
              <TextInput
                style={styles.input}
                value={responsavelNomeAluno}
                onChangeText={(texto) => {
                  setResponsavelNomeAluno(texto);
                  if (sucessoAluno) setSucessoAluno(null);
                }}
                placeholder="Nome do responsável"
              />
              <TextInput
                style={[styles.input, styles.inputEspacado]}
                value={responsavelTelefoneAluno}
                onChangeText={(texto) => {
                  setResponsavelTelefoneAluno(texto);
                  if (sucessoAluno) setSucessoAluno(null);
                }}
                placeholder="Telefone do responsável"
                keyboardType="phone-pad"
              />

              {erroAluno ? <Text style={[type.body, styles.error]}>{erroAluno}</Text> : null}
              {sucessoAluno ? <Text style={[type.body, styles.sucesso]}>{sucessoAluno}</Text> : null}

              <TouchableOpacity
                style={[styles.botaoPrimario, salvandoAluno && styles.botaoPrimarioDesabilitado]}
                onPress={salvarDadosAluno}
                disabled={salvandoAluno}
              >
                {salvandoAluno ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <Text style={styles.botaoPrimarioTexto}>Salvar dados do aluno</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null}

          {souAluno ? (
            meuAluno ? (
              <View style={styles.card}>
                <Text style={type.subtitle}>Módulo {meuAluno.modulo}</Text>
                <View style={styles.botoes}>
                  <TouchableOpacity
                    style={styles.botao}
                    onPress={() => router.push(`/alunos/${meuAluno.id}/frequencia`)}
                  >
                    <Text style={styles.botaoTexto}>Frequência</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.botao}
                    onPress={() => router.push(`/alunos/${meuAluno.id}/evolucao`)}
                  >
                    <Text style={styles.botaoTexto}>Minha Evolução</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <Text style={[type.body, styles.subtitle, styles.aviso]}>
                Seu cadastro ainda não foi vinculado a um aluno. Fale com a escola.
              </Text>
            )
          ) : null}
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
    gap: spacing.md,
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
  resumoTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  resumoTextoWrap: {
    flex: 1,
  },
  resumoImagem: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: colors.surfaceTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rotulo: {
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
  regrasSenha: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  regraSenha: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
  },
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  botoes: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  botao: {
    minHeight: touchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoTexto: {
    color: colors.primary,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
  botaoPrimario: {
    minHeight: touchTarget,
    marginTop: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  botaoPrimarioDesabilitado: {
    opacity: 0.65,
  },
  botaoPrimarioTexto: {
    color: colors.onPrimary,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
  error: {
    color: colors.danger,
    marginTop: spacing.md,
  },
  sucesso: {
    color: colors.present,
    marginTop: spacing.md,
  },
  aviso: {
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
});
