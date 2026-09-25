import { Redirect, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { desvincularPerfil, getAlunos, vincularPerfil, type Aluno } from '../../../src/features/alunos/api';
import { atualizarAtivo, atualizarPapel, getUsuario, type Usuario } from '../../../src/features/usuarios/api';
import { useAuth, type Papel } from '../../../src/features/auth/AuthProvider';
import { paraBR } from '../../../src/lib/dataBR';
import { confirmar } from '../../../src/lib/confirmar';
import { PageHeader } from '../../../src/components/PageHeader';
import { Footer } from '../../../src/components/Footer';
import { WebModal } from '../../../src/components/WebModal';
import { Chip } from '../../../src/components/Chip';
import { colors, spacing, touchTarget, type } from '../../../src/constants/theme';

const PAPEIS: { valor: Papel; label: string }[] = [
  { valor: 'aluno', label: 'Aluno' },
  { valor: 'responsavel', label: 'Responsável' },
  { valor: 'professor', label: 'Professor(a)' },
  { valor: 'dono', label: 'Dono' },
];

export default function UsuarioDetalhe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, meuPapel } = useAuth();

  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dadosUsuario = await getUsuario(id);
      setUsuario(dadosUsuario);
      if (dadosUsuario.papel === 'aluno' || dadosUsuario.papel === 'responsavel' || dadosUsuario.papel === 'professor') {
        setAlunos(await getAlunos());
      } else {
        setAlunos([]);
      }
    } catch (err) {
      console.error(err);
      setError('Erro ao carregar usuário. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  // Dono não pode se autorrebaixar nem se autodesativar por essa tela — sem
  // isso um clique errado tira o único acesso de gestão do próprio app.
  const editandoSiMesmo = usuario?.id === session?.user.id;

  // Trocar papel/status é a ação de maior alcance do app (pode dar ou tirar
  // acesso de Dono) — o resto do app já confirma ações bem menos sensíveis
  // que essa, então essa não podia continuar sendo um único toque.
  function confirmarMudarPapel(novoPapel: Papel) {
    if (!usuario || editandoSiMesmo || novoPapel === usuario.papel) return;
    const label = PAPEIS.find((p) => p.valor === novoPapel)?.label ?? novoPapel;
    confirmar(
      'Alterar papel',
      `Mudar o papel de ${usuario.nome} para ${label}? Isso muda o que essa pessoa pode ver e fazer no app imediatamente.`,
      'Alterar',
      () => mudarPapel(novoPapel)
    );
  }

  function confirmarAlternarAtivo() {
    if (!usuario || editandoSiMesmo) return;
    const vaiAtivar = !usuario.ativo;
    confirmar(
      vaiAtivar ? 'Ativar usuário' : 'Desativar usuário',
      vaiAtivar
        ? `Reativar o acesso de ${usuario.nome}?`
        : `Desativar o acesso de ${usuario.nome}? A pessoa não vai conseguir mais entrar no app até ser reativada.`,
      vaiAtivar ? 'Ativar' : 'Desativar',
      alternarAtivo
    );
  }

  async function mudarPapel(novoPapel: Papel) {
    if (!usuario || editandoSiMesmo || novoPapel === usuario.papel) return;
    setSalvando(true);
    setError(null);
    try {
      await atualizarPapel(usuario.id, novoPapel);
      setUsuario({ ...usuario, papel: novoPapel });
    } catch (err) {
      console.error(err);
      setError('Erro ao atualizar papel. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo() {
    if (!usuario || editandoSiMesmo) return;
    const novoValor = !usuario.ativo;
    setSalvando(true);
    setError(null);
    try {
      await atualizarAtivo(usuario.id, novoValor);
      setUsuario({ ...usuario, ativo: novoValor });
    } catch (err) {
      console.error(err);
      setError('Erro ao atualizar status. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  async function vincular(alunoId: string) {
    if (!usuario) return;
    setSalvando(true);
    setError(null);
    try {
      await vincularPerfil(alunoId, usuario.id);
      setAlunos(await getAlunos());
    } catch (err) {
      console.error(err);
      setError('Erro ao vincular cadastro. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  function confirmarDesvincular(aluno: Aluno) {
    if (!usuario) return;
    confirmar(
      'Desvincular cadastro',
      `Desvincular ${aluno.nome} da conta de ${usuario.nome}?`,
      'Desvincular',
      () => desvincular(aluno.id)
    );
  }

  async function desvincular(alunoId: string) {
    setSalvando(true);
    setError(null);
    try {
      await desvincularPerfil(alunoId);
      setAlunos(await getAlunos());
    } catch (err) {
      console.error(err);
      setError('Erro ao desvincular cadastro. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  if (meuPapel !== 'dono') {
    return <Redirect href="/" />;
  }

  if (loading) {
    return (
      <WebModal>
        <PageHeader titulo="Usuário" />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </WebModal>
    );
  }

  return (
    <WebModal>
      <PageHeader titulo={usuario?.nome ?? 'Usuário'} />
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {error ? <Text style={[type.body, styles.error]}>{error}</Text> : null}

          {usuario ? (
            <>
              <Text style={[type.label, styles.rotulo]}>Telefone</Text>
              <Text style={type.body}>{usuario.telefone ?? 'Não informado'}</Text>

              <Text style={[type.label, styles.rotulo]}>Cadastrado em</Text>
              <Text style={type.body}>{paraBR(usuario.criado_em.slice(0, 10))}</Text>

              <Text style={[type.label, styles.rotulo]}>Papel</Text>
              <View style={styles.chips}>
                {PAPEIS.map((p) => (
                  <Chip
                    key={p.valor}
                    label={p.label}
                    active={usuario.papel === p.valor}
                    onPress={() => confirmarMudarPapel(p.valor)}
                  />
                ))}
              </View>

              <Text style={[type.label, styles.rotulo]}>Status</Text>
              <View style={styles.chips}>
                <Chip label="Ativo" active={usuario.ativo} onPress={confirmarAlternarAtivo} />
                <Chip label="Inativo" active={!usuario.ativo} onPress={confirmarAlternarAtivo} />
              </View>

              {editandoSiMesmo ? (
                <Text style={[type.body, styles.aviso]}>
                  Você não pode alterar seu próprio papel ou status por aqui.
                </Text>
              ) : null}

              {usuario.papel === 'aluno' || usuario.papel === 'responsavel' || usuario.papel === 'professor' ? (
                <View style={styles.vinculos}>
                  <Text style={[type.label, styles.rotulo]}>Cadastros de aluno vinculados</Text>
                  {alunos.filter((aluno) => aluno.perfil_id === usuario.id).map((aluno) => (
                    <View key={aluno.id} style={styles.vinculoCard}>
                      <Text style={type.subtitle}>{aluno.nome}</Text>
                      <TouchableOpacity
                        style={styles.desvincularBotao}
                        onPress={() => confirmarDesvincular(aluno)}
                        disabled={salvando}
                      >
                        <Text style={styles.desvincularTexto}>Desvincular</Text>
                      </TouchableOpacity>
                    </View>
                  ))}

                  <Text style={[type.label, styles.rotulo]}>Registrar como aluno</Text>
                  {alunos.filter((aluno) => !aluno.perfil_id).length === 0 ? (
                    <Text style={[type.body, styles.aviso]}>Nenhum cadastro disponível para vínculo.</Text>
                  ) : (
                    alunos
                      .filter((aluno) => !aluno.perfil_id)
                      .map((aluno) => (
                        <TouchableOpacity
                          key={aluno.id}
                          style={styles.vinculoCard}
                          onPress={() => vincular(aluno.id)}
                          disabled={salvando}
                        >
                          <Text style={type.subtitle}>+ {aluno.nome}</Text>
                        </TouchableOpacity>
                      ))
                  )}
                </View>
              ) : null}

              {salvando ? <ActivityIndicator color={colors.primary} style={styles.spinner} /> : null}
            </>
          ) : null}
        </ScrollView>
      </View>
      <Footer />
    </WebModal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  scroll: {
    paddingBottom: spacing.xl,
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  error: {
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  aviso: {
    color: colors.textMuted,
    marginTop: spacing.lg,
  },
  spinner: {
    marginTop: spacing.lg,
  },
  vinculos: {
    marginTop: spacing.md,
  },
  vinculoCard: {
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  desvincularBotao: {
    minHeight: touchTarget,
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  desvincularTexto: {
    color: colors.danger,
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
  },
});
