import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
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

import {
  atualizarEvento,
  criarEvento,
  excluirEvento,
  getEvento,
  getTiposEvento,
  type TipoEvento,
} from '../../../src/features/eventos/api';
import { formatDataISO } from '../../../src/features/chamada/calendar';
import { useAuth } from '../../../src/features/auth/AuthProvider';
import { confirmar } from '../../../src/lib/confirmar';
import { PageHeader } from '../../../src/components/PageHeader';
import { DateRangePicker } from '../../../src/components/DateRangePicker';
import { Footer } from '../../../src/components/Footer';
import { WebModal } from '../../../src/components/WebModal';
import { colors, radius, spacing, touchTarget, type } from '../../../src/constants/theme';

function formatBR(dataISO: string): string {
  return dataISO.split('-').reverse().join('/');
}

export default function NovoEvento() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editando = Boolean(id);
  const { session, meuPapel } = useAuth();

  const [tipos, setTipos] = useState<TipoEvento[]>([]);
  const [tipoId, setTipoId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('');
  const [dataInicioISO, setDataInicioISO] = useState(formatDataISO(new Date()));
  const [dataFimISO, setDataFimISO] = useState(formatDataISO(new Date()));
  const [periodoAberto, setPeriodoAberto] = useState(false);
  const [descricao, setDescricao] = useState('');
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    setError(null);

    Promise.all([getTiposEvento(), id ? getEvento(id) : null])
      .then(([dadosTipos, evento]) => {
        if (!ativo) return;
        setTipos(dadosTipos);
        if (evento) {
          setTipoId(evento.tipo_id);
          setTitulo(evento.titulo);
          setDataInicioISO(evento.data_inicio);
          setDataFimISO(evento.data_fim);
          setDescricao(evento.descricao ?? '');
        } else {
          setTipoId((atual) => atual ?? dadosTipos[0]?.id ?? null);
        }
      })
      .catch((err) => {
        console.error(err);
        if (ativo) setError('Erro ao carregar evento. Tente novamente.');
      })
      .finally(() => {
        if (ativo) setLoading(false);
      });

    return () => {
      ativo = false;
    };
  }, [id]);

  async function salvar() {
    if (!tipoId || !titulo.trim()) {
      setError('Escolha um tipo e informe um título.');
      return;
    }
    const inicioISO = dataInicioISO;
    const fimISO = dataFimISO;
    if (fimISO < inicioISO) {
      setError('A data de fim não pode ser antes da data de início.');
      return;
    }

    setSalvando(true);
    setError(null);
    try {
      if (editando && id) {
        await atualizarEvento(id, tipoId, titulo.trim(), inicioISO, fimISO, descricao.trim() || null);
      } else {
        await criarEvento(tipoId, titulo.trim(), inicioISO, fimISO, descricao.trim() || null, session?.user.id ?? null);
      }
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch (err) {
      console.error(err);
      setError('Erro ao salvar evento. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  function confirmarExclusao() {
    if (!id) return;
    confirmar('Excluir evento', 'Tem certeza que quer excluir esse evento?', 'Excluir', excluir);
  }

  async function excluir() {
    if (!id) return;
    setExcluindo(true);
    setError(null);
    try {
      await excluirEvento(id);
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch (err) {
      console.error(err);
      setError('Erro ao excluir evento. Tente novamente.');
      setExcluindo(false);
    }
  }

  const tituloPagina = editando ? 'Editar evento' : 'Novo evento';

  if (meuPapel === 'aluno' || meuPapel === 'responsavel') {
    return <Redirect href="/" />;
  }

  if (loading) {
    return (
      <WebModal>
        <PageHeader titulo={tituloPagina} />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </WebModal>
    );
  }

  return (
    <WebModal>
    <PageHeader titulo={tituloPagina} />
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={[type.label, styles.rotulo]}>Tipo</Text>
        <View style={styles.chips}>
          {tipos.map((t) => {
            const ativo = tipoId === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[styles.chip, { borderColor: t.cor }, ativo && { backgroundColor: t.cor }]}
                onPress={() => setTipoId(t.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: ativo }}
              >
                <View style={[styles.chipCor, { backgroundColor: t.cor }]} />
                <Text style={[styles.chipTexto, ativo && styles.chipTextoAtivo]}>{t.nome}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[type.label, styles.rotulo]}>Título</Text>
        <TextInput style={styles.input} value={titulo} onChangeText={setTitulo} placeholder="Ex.: Recesso de julho" />

        <Text style={[type.label, styles.rotulo]}>Período</Text>
        <TouchableOpacity style={styles.periodoBotao} onPress={() => setPeriodoAberto((atual) => !atual)}>
          <Text style={styles.periodoTexto}>
            {dataInicioISO === dataFimISO
              ? formatBR(dataInicioISO)
              : `${formatBR(dataInicioISO)} → ${formatBR(dataFimISO)}`}
          </Text>
        </TouchableOpacity>

        {periodoAberto ? (
          <DateRangePicker
            inicioISO={dataInicioISO}
            fimISO={dataFimISO}
            onConfirmar={(inicio, fim) => {
              setDataInicioISO(inicio);
              setDataFimISO(fim);
              setPeriodoAberto(false);
            }}
            onFechar={() => setPeriodoAberto(false)}
          />
        ) : null}

        <Text style={[type.label, styles.rotulo]}>Descrição (opcional)</Text>
        <TextInput style={styles.input} value={descricao} onChangeText={setDescricao} placeholder="Detalhes" />

        {error ? <Text style={[type.body, styles.error]}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.salvarBotao, (salvando || excluindo) && styles.botaoDesabilitado]}
          onPress={salvar}
          disabled={salvando || excluindo}
        >
          {salvando ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.salvarBotaoTexto}>{editando ? 'Salvar alterações' : 'Salvar evento'}</Text>
          )}
        </TouchableOpacity>

        {editando ? (
          <TouchableOpacity
            style={[styles.excluirBotao, (salvando || excluindo) && styles.botaoDesabilitado]}
            onPress={confirmarExclusao}
            disabled={salvando || excluindo}
          >
            {excluindo ? (
              <ActivityIndicator color={colors.danger} />
            ) : (
              <Text style={styles.excluirBotaoTexto}>Excluir evento</Text>
            )}
          </TouchableOpacity>
        ) : null}
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
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
    color: colors.text,
  },
  periodoBotao: {
    height: touchTarget,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
  },
  periodoTexto: {
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
    color: colors.text,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: touchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: colors.surface,
  },
  chipCor: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
  },
  chipTexto: {
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
    color: colors.text,
  },
  chipTextoAtivo: {
    color: colors.onPrimary,
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
  excluirBotao: {
    height: touchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  excluirBotaoTexto: {
    color: colors.danger,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
});
