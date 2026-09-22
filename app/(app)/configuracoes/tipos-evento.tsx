import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import {
  atualizarTipoEvento,
  criarTipoEvento,
  excluirTipoEvento,
  getTiposEventoAdmin,
  getUsoTipoEvento,
  type TipoEventoAdmin,
} from '../../../src/features/eventos/api';
import { useAuth } from '../../../src/features/auth/AuthProvider';
import { useAsyncData } from '../../../src/hooks/useAsyncData';
import { confirmDelete, confirmSave } from '../../../src/lib/confirmar';
import { PageHeader } from '../../../src/components/PageHeader';
import { Footer } from '../../../src/components/Footer';
import { FormModal } from '../../../src/components/FormModal';
import { RowActions } from '../../../src/components/RowActions';
import { ToggleAtivo } from '../../../src/components/ToggleAtivo';
import { colors, radius, spacing, touchTarget, type } from '../../../src/constants/theme';

// Tipos de evento (staff) — docs/product/papeis-e-permissoes.md §6.4. RLS já
// era eh_equipe() desde 0003; só faltava a tela (até aqui, só via SQL).
//
// Adicionar/editar/excluir padronizados (pedido do dono, 2026-09-22): botão
// "+ Tipo de evento" no topo abre um FormModal; cada linha ganha o lápis
// (edita nome/cor no mesmo modal) e a lixeira (exclui de vez, checando uso
// antes) além do toggle de ativo já existente.

const CORES_PRESET = [
  '#8B5CF6', '#00B4CC', '#F97316', '#C4453D',
  '#1BA97B', '#D99A2B', '#6B7280', '#EC4899',
];

export default function TiposEventoAdminScreen() {
  const { meuPapel } = useAuth();
  const souEquipe = meuPapel === 'dono' || meuPapel === 'professor';

  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<TipoEventoAdmin | null>(null);
  const [nomeForm, setNomeForm] = useState('');
  const [corForm, setCorForm] = useState(CORES_PRESET[0]);

  const { data: tipos, loading, reload: recarregar } = useAsyncData<TipoEventoAdmin[]>(getTiposEventoAdmin, [], {
    mensagemErro: 'Erro ao carregar tipos de evento. Tente novamente.',
  });

  if (!souEquipe) {
    return <Redirect href="/" />;
  }

  function abrirNovo() {
    setEditando(null);
    setNomeForm('');
    setCorForm(CORES_PRESET[0]);
    setErro(null);
    setModalAberto(true);
  }

  function abrirEdicao(tipo: TipoEventoAdmin) {
    setEditando(tipo);
    setNomeForm(tipo.nome);
    setCorForm(tipo.cor);
    setErro(null);
    setModalAberto(true);
  }

  function fecharModal() {
    if (salvando) return;
    setModalAberto(false);
  }

  function confirmarSalvar() {
    if (!nomeForm.trim()) {
      setErro('Informe o nome do tipo de evento.');
      return;
    }
    confirmSave(salvar);
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      if (editando) {
        await atualizarTipoEvento(editando.id, { nome: nomeForm.trim(), cor: corForm });
      } else {
        const proximaOrdem = (tipos ?? []).length + 1;
        await criarTipoEvento(nomeForm.trim(), corForm, proximaOrdem);
      }
      setModalAberto(false);
      await recarregar();
    } catch (err: unknown) {
      console.error(err);
      const duplicado =
        typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === '23505';
      setErro(duplicado ? 'Já existe um tipo de evento com esse nome.' : 'Erro ao salvar tipo de evento. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo(tipo: TipoEventoAdmin) {
    setErro(null);
    try {
      await atualizarTipoEvento(tipo.id, { ativo: !tipo.ativo });
      await recarregar();
    } catch (err) {
      console.error(err);
      setErro('Erro ao atualizar tipo de evento. Tente novamente.');
    }
  }

  async function excluir(tipo: TipoEventoAdmin) {
    setErro(null);
    try {
      const uso = await getUsoTipoEvento(tipo.id);
      if (uso > 0) {
        setErro(`Não é possível excluir "${tipo.nome}": em uso por ${uso} evento(s). Desative em vez de excluir.`);
        return;
      }
      confirmDelete(tipo.nome, async () => {
        try {
          await excluirTipoEvento(tipo.id);
          await recarregar();
        } catch (err) {
          console.error(err);
          setErro('Erro ao excluir tipo de evento. Tente novamente.');
        }
      });
    } catch (err) {
      console.error(err);
      setErro('Erro ao verificar uso do tipo de evento. Tente novamente.');
    }
  }

  if (loading) {
    return (
      <>
        <PageHeader titulo="Tipos de evento" />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </>
    );
  }

  return (
    <>
      <PageHeader titulo="Tipos de evento" />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        <View style={styles.topoRow}>
          <Text style={styles.explicacao}>
            As cores e nomes usados nos eventos do calendário (recesso, competição, feriado etc.).
          </Text>
          <TouchableOpacity testID="tipo-evento-abrir-novo" style={styles.novoBotao} onPress={abrirNovo}>
            <Text style={styles.novoBotaoTexto}>+ Tipo de evento</Text>
          </TouchableOpacity>
        </View>

        {erro ? <Text style={styles.erro}>{erro}</Text> : null}

        {(tipos ?? []).map((tipo) => (
          <View key={tipo.id} style={styles.itemRow}>
            <View style={[styles.corDot, { backgroundColor: tipo.cor }]} />
            <Text style={[type.body, styles.itemTextoWrap, !tipo.ativo && styles.inativo]}>{tipo.nome}</Text>
            <ToggleAtivo
              testID={`tipo-evento-${tipo.id}-toggle`}
              ativo={tipo.ativo}
              onToggle={() => alternarAtivo(tipo)}
            />
            <RowActions
              testIdBase={`tipo-evento-${tipo.id}`}
              onEdit={() => abrirEdicao(tipo)}
              onDelete={() => excluir(tipo)}
            />
          </View>
        ))}
      </ScrollView>

      <FormModal
        visible={modalAberto}
        title={editando ? 'Editar tipo de evento' : 'Novo tipo de evento'}
        onClose={fecharModal}
      >
        <Text style={[type.label, styles.campoRotulo]}>Nome</Text>
        <TextInput
          testID="tipo-evento-nome"
          style={styles.input}
          value={nomeForm}
          onChangeText={setNomeForm}
          placeholder="Ex.: Passeio"
        />

        <Text style={[type.label, styles.campoRotulo]}>Cor</Text>
        <View style={styles.coresRow}>
          {CORES_PRESET.map((cor) => (
            <TouchableOpacity
              key={cor}
              testID={`tipo-evento-cor-${cor}`}
              style={[styles.corOpcao, { backgroundColor: cor }, corForm === cor && styles.corOpcaoAtiva]}
              onPress={() => setCorForm(cor)}
            />
          ))}
        </View>

        <TouchableOpacity
          testID="tipo-evento-salvar"
          style={[styles.botao, salvando && styles.botaoDesabilitado]}
          onPress={confirmarSalvar}
          disabled={salvando}
        >
          {salvando ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.botaoTexto}>{editando ? 'Salvar alterações' : 'Adicionar tipo'}</Text>
          )}
        </TouchableOpacity>
      </FormModal>

      <Footer />
    </>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: touchTarget,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  corDot: {
    width: 12,
    height: 12,
    borderRadius: radius.pill,
  },
  itemTextoWrap: {
    flex: 1,
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
  coresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  corOpcao: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  corOpcaoAtiva: {
    borderColor: colors.text,
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
