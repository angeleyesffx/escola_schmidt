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
import { SeletorAluno } from '../../src/components/SeletorAluno';
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
  const { session, meuPapel, meusAlunos, changePassword, adicionarFilho } = useAuth();
  const router = useRouter();
  const souAluno = (meuPapel === 'aluno' || meuPapel === 'responsavel');
  // Papel e vínculo são independentes (docs/product/professor-como-aluno.md):
  // um dono/professor que também tem filho matriculado vê as mesmas seções
  // de aluno que qualquer outra conta com vínculo, sem perder as de equipe.
  const podeVerSecaoAluno = souAluno || meusAlunos.length > 0;
  // Uma conta pode ter vários alunos vinculados (responsável por mais de um
  // filho, ou aluno adulto que também é responsável por outro) — as seções
  // abaixo sempre editam/mostram só 1 de cada vez; este é o escolhido.
  const [alunoSelecionadoId, setAlunoSelecionadoId] = useState<string | null>(null);
  const [nomeNovoFilho, setNomeNovoFilho] = useState('');
  const [dataNascimentoNovoFilho, setDataNascimentoNovoFilho] = useState('');
  const [pickerNovoFilhoAberto, setPickerNovoFilhoAberto] = useState(false);
  const [adicionandoFilho, setAdicionandoFilho] = useState(false);
  const [erroNovoFilho, setErroNovoFilho] = useState<string | null>(null);
  const [sucessoNovoFilho, setSucessoNovoFilho] = useState<string | null>(null);
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

  // Mantém a seleção se o aluno escolhido continuar na lista; senão cai pro
  // primeiro (cobre o load inicial e o caso comum de 0 ou 1 aluno vinculado).
  useEffect(() => {
    setAlunoSelecionadoId((atual) =>
      atual && meusAlunos.some((a) => a.id === atual) ? atual : (meusAlunos[0]?.id ?? null)
    );
  }, [meusAlunos]);

  const alunoSelecionado = meusAlunos.find((a) => a.id === alunoSelecionadoId) ?? null;

  useEffect(() => {
    if (!alunoSelecionado) return;
    setNomeAluno(alunoSelecionado.nome);
    setDataNascimentoAluno(alunoSelecionado.data_nascimento ? paraBR(alunoSelecionado.data_nascimento) : '');
    setResponsavelNomeAluno(alunoSelecionado.responsavel_nome ?? '');
    setResponsavelTelefoneAluno(alunoSelecionado.responsavel_telefone ?? '');
  }, [alunoSelecionado]);

  function selecionarDataNascimentoAluno(iso: string) {
    setDataNascimentoAluno(paraBR(iso));
    if (sucessoAluno) setSucessoAluno(null);
    setPickerNascimentoAberto(false);
  }

  async function salvarDadosAluno() {
    if (!alunoSelecionado) return;
    if (!nomeAluno.trim()) {
      setErroAluno('Informe o nome do aluno.');
      return;
    }
    const nascimentoISO = paraISO(dataNascimentoAluno);
    if (!nascimentoISO) {
      setErroAluno('Informe a data de nascimento.');
      return;
    }

    setErroAluno(null);
    setSucessoAluno(null);
    setSalvandoAluno(true);
    try {
      await atualizarDadosAluno(alunoSelecionado.id, {
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

  async function adicionarNovoFilho() {
    if (!nomeNovoFilho.trim()) {
      setErroNovoFilho('Informe o nome do filho.');
      return;
    }
    const nascimentoISO = paraISO(dataNascimentoNovoFilho);
    if (!nascimentoISO) {
      setErroNovoFilho('Informe a data de nascimento.');
      return;
    }

    setErroNovoFilho(null);
    setSucessoNovoFilho(null);
    setAdicionandoFilho(true);
    const { error } = await adicionarFilho(nomeNovoFilho.trim(), nascimentoISO);
    setAdicionandoFilho(false);

    if (error) {
      setErroNovoFilho('Erro ao adicionar filho. Tente novamente.');
      return;
    }
    setNomeNovoFilho('');
    setDataNascimentoNovoFilho('');
    setSucessoNovoFilho('Filho(a) adicionado(a) com sucesso.');
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
                <Text style={type.title}>{nome || meusAlunos[0]?.nome || session?.user.email}</Text>
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

          <View style={styles.card}>
            <Text style={type.subtitle}>Adicionar filho(a)</Text>
            <Text style={[type.body, styles.subtitle]}>
              Cadastre aqui cada filho matriculado na escola — o vínculo é imediato, sem precisar da equipe.
            </Text>

            <Text style={[type.label, styles.rotulo]}>Nome do filho(a)</Text>
            <TextInput
              testID="perfil-novo-filho-nome"
              style={styles.input}
              value={nomeNovoFilho}
              onChangeText={(texto) => {
                setNomeNovoFilho(texto);
                if (sucessoNovoFilho) setSucessoNovoFilho(null);
              }}
              placeholder="Nome completo"
              autoCapitalize="words"
            />

            <Text style={[type.label, styles.rotulo]}>Data de nascimento</Text>
            <TouchableOpacity
              testID="perfil-novo-filho-data"
              style={styles.dataBotao}
              onPress={() => setPickerNovoFilhoAberto((atual) => !atual)}
            >
              <Text style={dataNascimentoNovoFilho ? styles.dataBotaoTexto : styles.dataBotaoPlaceholder}>
                {dataNascimentoNovoFilho || 'Selecionar data'}
              </Text>
            </TouchableOpacity>
            {pickerNovoFilhoAberto ? (
              <DateRangePicker
                apenasUmDia
                inicioISO={paraISO(dataNascimentoNovoFilho) ?? paraISO(hojeBR())!}
                fimISO={paraISO(dataNascimentoNovoFilho) ?? paraISO(hojeBR())!}
                onConfirmar={(iso) => {
                  setDataNascimentoNovoFilho(paraBR(iso));
                  if (sucessoNovoFilho) setSucessoNovoFilho(null);
                  setPickerNovoFilhoAberto(false);
                }}
                onFechar={() => setPickerNovoFilhoAberto(false)}
              />
            ) : null}

            {erroNovoFilho ? <Text style={[type.body, styles.error]}>{erroNovoFilho}</Text> : null}
            {sucessoNovoFilho ? <Text style={[type.body, styles.sucesso]}>{sucessoNovoFilho}</Text> : null}

            <TouchableOpacity
              testID="perfil-novo-filho-adicionar"
              style={[styles.botaoPrimario, adicionandoFilho && styles.botaoPrimarioDesabilitado]}
              onPress={adicionarNovoFilho}
              disabled={adicionandoFilho}
            >
              {adicionandoFilho ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.botaoPrimarioTexto}>Adicionar filho(a)</Text>
              )}
            </TouchableOpacity>
          </View>

          {podeVerSecaoAluno && alunoSelecionado ? (
            <View style={styles.card}>
              <Text style={type.subtitle}>Dados do aluno</Text>

              <SeletorAluno
                alunos={meusAlunos}
                selecionadoId={alunoSelecionadoId}
                onSelecionar={setAlunoSelecionadoId}
                rotulo="Qual aluno"
              />

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

              <Text style={[type.label, styles.rotulo]}>Data de nascimento</Text>
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

          {podeVerSecaoAluno ? (
            alunoSelecionado ? (
              <View style={styles.card}>
                <Text style={type.subtitle}>Módulo {alunoSelecionado.modulo}</Text>
                <View style={styles.botoes}>
                  <TouchableOpacity
                    style={styles.botao}
                    onPress={() => router.push(`/alunos/${alunoSelecionado.id}/frequencia`)}
                  >
                    <Text style={styles.botaoTexto}>Frequência</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.botao}
                    onPress={() => router.push(`/alunos/${alunoSelecionado.id}/evolucao`)}
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
