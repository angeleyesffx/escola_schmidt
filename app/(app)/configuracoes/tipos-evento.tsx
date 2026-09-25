import { Redirect } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  type GestureResponderEvent,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

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
import { WebModal } from '../../../src/components/WebModal';
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

// Matiz do arco-íris pro slider de cor personalizada — saturação/luminosidade
// fixas (70%/50%) pra garantir contraste legível em qualquer ponto do slider.
const CORES_ARCO_IRIS = ['#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#FF0000'] as const;

function hslParaHex(matiz: number, saturacao: number, luminosidade: number): string {
  const s = saturacao / 100;
  const l = luminosidade / 100;
  const k = (n: number) => (n + matiz / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const paraHex = (n: number) =>
    Math.round(f(n) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${paraHex(0)}${paraHex(8)}${paraHex(4)}`;
}

function hexParaMatiz(hex: string): number {
  const valor = hex.replace('#', '');
  const bytes =
    valor.length === 3 ? valor.split('').map((c) => c + c) : [valor.slice(0, 2), valor.slice(2, 4), valor.slice(4, 6)];
  const [r, g, b] = bytes.map((par) => parseInt(par, 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta === 0) return 0;
  let matiz = 0;
  if (max === r) matiz = ((g - b) / delta) % 6;
  else if (max === g) matiz = (b - r) / delta + 2;
  else matiz = (r - g) / delta + 4;
  matiz *= 60;
  return matiz < 0 ? matiz + 360 : matiz;
}

export default function TiposEventoAdminScreen() {
  const { meuPapel } = useAuth();
  const souEquipe = meuPapel === 'dono' || meuPapel === 'professor';

  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<TipoEventoAdmin | null>(null);
  const [nomeForm, setNomeForm] = useState('');
  const [corForm, setCorForm] = useState(CORES_PRESET[0]);
  // Matiz do slider de cor personalizada (0-360) — só usado quando a pessoa
  // arrasta o dedo no gradiente; presets continuam sendo um toque só.
  const [matizPersonalizado, setMatizPersonalizado] = useState(0);
  const [larguraSlider, setLarguraSlider] = useState(0);

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
    setMatizPersonalizado(0);
    setErro(null);
    setModalAberto(true);
  }

  function abrirEdicao(tipo: TipoEventoAdmin) {
    setEditando(tipo);
    setNomeForm(tipo.nome);
    setCorForm(tipo.cor);
    // Cor já cadastrada pode não estar nos presets (import antigo, ajuste manual
    // no banco) — posiciona o slider pelo matiz aproximado dessa cor.
    setMatizPersonalizado(CORES_PRESET.includes(tipo.cor) ? 0 : hexParaMatiz(tipo.cor));
    setErro(null);
    setModalAberto(true);
  }

  function fecharModal() {
    if (salvando) return;
    setModalAberto(false);
  }

  function escolherMatizPeloToque(evento: GestureResponderEvent) {
    if (!larguraSlider) return;
    const x = Math.max(0, Math.min(evento.nativeEvent.locationX, larguraSlider));
    const matiz = (x / larguraSlider) * 360;
    setMatizPersonalizado(matiz);
    setCorForm(hslParaHex(matiz, 70, 50));
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
    <WebModal>
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
            <View style={styles.itemTopo}>
              <View style={[styles.corDot, { backgroundColor: tipo.cor }]} />
              <Text style={[type.body, styles.itemTextoWrap, !tipo.ativo && styles.inativo]}>{tipo.nome}</Text>
            </View>
            <View style={styles.itemAcoes}>
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

        <Text style={[type.label, styles.campoRotulo]}>Ou escolha uma cor personalizada</Text>
        <View style={styles.corPersonalizadaRow}>
          <View style={[styles.corOpcao, styles.corPersonalizadaPreview, { backgroundColor: corForm }]} />
          <View
            testID="tipo-evento-cor-slider"
            style={styles.corSlider}
            onLayout={(e) => setLarguraSlider(e.nativeEvent.layout.width)}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={escolherMatizPeloToque}
            onResponderMove={escolherMatizPeloToque}
          >
            <LinearGradient
              colors={CORES_ARCO_IRIS}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.corSliderGradiente}
            />
            <View
              pointerEvents="none"
              style={[
                styles.corSliderMarcador,
                { left: larguraSlider ? (matizPersonalizado / 360) * larguraSlider - 10 : 0 },
              ]}
            />
          </View>
        </View>
        <Text style={[type.caption, styles.corSliderDica]}>Arraste o dedo pela faixa colorida acima.</Text>

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
  itemTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  corDot: {
    width: 12,
    height: 12,
    borderRadius: radius.pill,
  },
  itemTextoWrap: {
    flex: 1,
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
  corPersonalizadaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  corPersonalizadaPreview: {
    borderColor: colors.border,
  },
  corSlider: {
    flex: 1,
    height: 40,
    borderRadius: radius.pill,
    overflow: 'visible',
    justifyContent: 'center',
  },
  corSliderGradiente: {
    height: 40,
    borderRadius: radius.pill,
  },
  corSliderMarcador: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    borderWidth: 3,
    borderColor: colors.surface,
    backgroundColor: colors.text,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  corSliderDica: {
    color: colors.textMuted,
    marginTop: spacing.xs,
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
