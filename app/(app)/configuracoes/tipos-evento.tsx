import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';

import {
  atualizarTipoEvento,
  criarTipoEvento,
  getTiposEventoAdmin,
  type TipoEventoAdmin,
} from '../../../src/features/eventos/api';
import { useAuth } from '../../../src/features/auth/AuthProvider';
import { useAsyncData } from '../../../src/hooks/useAsyncData';
import { PageHeader } from '../../../src/components/PageHeader';
import { Footer } from '../../../src/components/Footer';
import { colors, radius, spacing, touchTarget, type } from '../../../src/constants/theme';

// Tipos de evento (staff) — docs/product/papeis-e-permissoes.md §6.4. RLS já
// era eh_equipe() desde 0003; só faltava a tela (até aqui, só via SQL).

const CORES_PRESET = [
  '#8B5CF6', '#00B4CC', '#F97316', '#C4453D',
  '#1BA97B', '#D99A2B', '#6B7280', '#EC4899',
];

export default function TiposEventoAdminScreen() {
  const { meuPapel } = useAuth();
  const souEquipe = meuPapel === 'dono' || meuPapel === 'professor';

  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [nomeNovo, setNomeNovo] = useState('');
  const [corNova, setCorNova] = useState(CORES_PRESET[0]);

  const { data: tipos, loading, reload: recarregar } = useAsyncData<TipoEventoAdmin[]>(getTiposEventoAdmin, [], {
    mensagemErro: 'Erro ao carregar tipos de evento. Tente novamente.',
  });

  if (!souEquipe) {
    return <Redirect href="/" />;
  }

  async function adicionar() {
    if (!nomeNovo.trim()) {
      setErro('Informe o nome do tipo de evento.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const proximaOrdem = (tipos ?? []).length + 1;
      await criarTipoEvento(nomeNovo.trim(), corNova, proximaOrdem);
      setNomeNovo('');
      setCorNova(CORES_PRESET[0]);
      await recarregar();
    } catch (err: unknown) {
      console.error(err);
      const duplicado =
        typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === '23505';
      setErro(duplicado ? 'Já existe um tipo de evento com esse nome.' : 'Erro ao criar tipo de evento. Tente novamente.');
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
        <Text style={styles.explicacao}>
          As cores e nomes usados nos eventos do calendário (recesso, competição, feriado etc.).
        </Text>

        {erro ? <Text style={styles.erro}>{erro}</Text> : null}

        {(tipos ?? []).map((tipo) => (
          <View key={tipo.id} style={styles.itemRow}>
            <View style={[styles.corDot, { backgroundColor: tipo.cor }]} />
            <Text style={[type.body, styles.itemTextoWrap, !tipo.ativo && styles.inativo]}>{tipo.nome}</Text>
            <Switch value={tipo.ativo} onValueChange={() => alternarAtivo(tipo)} />
          </View>
        ))}

        <View style={styles.formCard}>
          <Text style={styles.formTitulo}>Novo tipo de evento</Text>

          <Text style={[type.label, styles.campoRotulo]}>Nome</Text>
          <TextInput
            testID="tipo-evento-nome"
            style={styles.input}
            value={nomeNovo}
            onChangeText={setNomeNovo}
            placeholder="Ex.: Passeio"
          />

          <Text style={[type.label, styles.campoRotulo]}>Cor</Text>
          <View style={styles.coresRow}>
            {CORES_PRESET.map((cor) => (
              <TouchableOpacity
                key={cor}
                testID={`tipo-evento-cor-${cor}`}
                style={[styles.corOpcao, { backgroundColor: cor }, corNova === cor && styles.corOpcaoAtiva]}
                onPress={() => setCorNova(cor)}
              />
            ))}
          </View>

          <TouchableOpacity
            testID="tipo-evento-adicionar"
            style={[styles.botao, salvando && styles.botaoDesabilitado]}
            onPress={adicionar}
            disabled={salvando}
          >
            {salvando ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.botaoTexto}>Adicionar tipo</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  explicacao: {
    ...type.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
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
  formCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  formTitulo: {
    ...type.subtitle,
    color: colors.text,
    marginBottom: spacing.xs,
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
