import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import {
  atualizarModulo,
  criarModulo,
  excluirModulo,
  getModulos,
  getUsoModulo,
  type Modulo,
} from '../../../src/features/chamada/api';
import { useAuth } from '../../../src/features/auth/AuthProvider';
import { useAsyncData } from '../../../src/hooks/useAsyncData';
import { confirmDelete, confirmSave } from '../../../src/lib/confirmar';
import { PageHeader } from '../../../src/components/PageHeader';
import { Footer } from '../../../src/components/Footer';
import { WebModal } from '../../../src/components/WebModal';
import { FormModal } from '../../../src/components/FormModal';
import { RowActions } from '../../../src/components/RowActions';
import { ToggleAtivo } from '../../../src/components/ToggleAtivo';
import { colors, radius, spacing, touchTarget, type } from '../../../src/constants/theme';

// Módulos (dono-only) — supabase/migrations/0040. Até aqui "módulo" era só
// um número 1-4 hardcoded em três telas diferentes; o dono não conseguia
// criar um 5º, renomear ou desativar um sem editar código (pedido direto do
// usuário, 2026-09-22).
//
// Mesmo padrão de adicionar/editar/excluir já usado em grade-semanal.tsx e
// tipos-evento.tsx: botão "+ Módulo" abre um FormModal; cada linha ganha o
// lápis (edita o nome) e a lixeira (exclui de vez, checando uso antes) além
// do toggle de ativo. Número não é editável — é a chave que várias outras
// tabelas referenciam.

export default function ModulosAdmin() {
  const { meuPapel } = useAuth();
  const souDono = meuPapel === 'dono';

  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Modulo | null>(null);
  const [nomeForm, setNomeForm] = useState('');

  const { data: modulos, loading, reload: recarregar } = useAsyncData<Modulo[]>(getModulos, [], {
    mensagemErro: 'Erro ao carregar os módulos. Tente novamente.',
  });

  if (!souDono) {
    return <Redirect href="/" />;
  }

  function abrirNovo() {
    setEditando(null);
    setNomeForm('');
    setErro(null);
    setModalAberto(true);
  }

  function abrirEdicao(modulo: Modulo) {
    setEditando(modulo);
    setNomeForm(modulo.nome);
    setErro(null);
    setModalAberto(true);
  }

  function fecharModal() {
    if (salvando) return;
    setModalAberto(false);
  }

  function confirmarSalvar() {
    if (!nomeForm.trim()) {
      setErro('Informe o nome do módulo.');
      return;
    }
    if (editando) {
      confirmSave(salvar);
    } else {
      salvar();
    }
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      if (editando) {
        await atualizarModulo(editando.numero, { nome: nomeForm.trim() });
      } else {
        await criarModulo(nomeForm.trim());
      }
      setModalAberto(false);
      await recarregar();
    } catch (err) {
      console.error(err);
      setErro('Erro ao salvar módulo. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo(modulo: Modulo) {
    setErro(null);
    try {
      await atualizarModulo(modulo.numero, { ativo: !modulo.ativo });
      await recarregar();
    } catch (err) {
      console.error(err);
      setErro('Erro ao atualizar módulo. Tente novamente.');
    }
  }

  async function excluir(modulo: Modulo) {
    setErro(null);
    try {
      const uso = await getUsoModulo(modulo.numero);
      if (uso.alunos > 0 || uso.grade > 0) {
        setErro(
          `Não é possível excluir "${modulo.nome}": em uso por ${uso.alunos} aluno(s) e ${uso.grade} horário(s) da grade. Desative em vez de excluir.`
        );
        return;
      }
      confirmDelete(modulo.nome, async () => {
        try {
          await excluirModulo(modulo.numero);
          await recarregar();
        } catch (err) {
          console.error(err);
          setErro('Erro ao excluir módulo. Tente novamente.');
        }
      });
    } catch (err) {
      console.error(err);
      setErro('Erro ao verificar uso do módulo. Tente novamente.');
    }
  }

  if (loading) {
    return (
      <>
        <PageHeader titulo="Módulos" />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </>
    );
  }

  return (
    <WebModal>
      <PageHeader titulo="Módulos" />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        <View style={styles.topoRow}>
          <Text style={styles.explicacao}>
            Módulos usados na grade, no cadastro de alunos e na divisão por turma.
          </Text>
          <TouchableOpacity testID="modulo-abrir-novo" style={styles.novoBotao} onPress={abrirNovo}>
            <Text style={styles.novoBotaoTexto}>+ Módulo</Text>
          </TouchableOpacity>
        </View>

        {erro ? <Text style={styles.erro}>{erro}</Text> : null}

        {(modulos ?? []).map((modulo) => (
          <View key={modulo.numero} style={styles.itemRow}>
            <View style={styles.itemTextoWrap}>
              <Text style={[type.body, !modulo.ativo && styles.inativo]}>{modulo.nome}</Text>
              <Text style={type.caption}>Número {modulo.numero}</Text>
            </View>
            <View style={styles.itemAcoes}>
              <ToggleAtivo
                testID={`modulo-${modulo.numero}-toggle`}
                ativo={modulo.ativo}
                onToggle={() => alternarAtivo(modulo)}
              />
              <RowActions
                testIdBase={`modulo-${modulo.numero}`}
                onEdit={() => abrirEdicao(modulo)}
                onDelete={() => excluir(modulo)}
              />
            </View>
          </View>
        ))}
      </ScrollView>

      <FormModal visible={modalAberto} title={editando ? 'Editar módulo' : 'Novo módulo'} onClose={fecharModal}>
        <Text style={[type.label, styles.campoRotulo]}>Nome</Text>
        <TextInput
          testID="modulo-nome"
          style={styles.input}
          value={nomeForm}
          onChangeText={setNomeForm}
          placeholder="Ex.: Módulo 5"
        />

        <TouchableOpacity
          testID="modulo-salvar"
          style={[styles.botao, salvando && styles.botaoDesabilitado]}
          onPress={confirmarSalvar}
          disabled={salvando}
        >
          {salvando ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.botaoTexto}>{editando ? 'Salvar alterações' : 'Adicionar módulo'}</Text>
          )}
        </TouchableOpacity>
      </FormModal>

      <Footer />
    </WebModal>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  container: {
    backgroundColor: colors.background,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  topoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
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
  erro: {
    color: colors.danger,
    marginBottom: spacing.md,
  },
  itemRow: {
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  itemTextoWrap: {
    gap: 2,
  },
  itemAcoes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  inativo: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
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
    backgroundColor: colors.background,
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
    color: colors.text,
  },
  botao: {
    height: touchTarget,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  botaoDesabilitado: {
    opacity: 0.6,
  },
  botaoTexto: {
    color: colors.onPrimary,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
});
