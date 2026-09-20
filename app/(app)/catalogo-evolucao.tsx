import { Redirect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  adicionarRequisitoNivel,
  atualizarCategoria,
  atualizarHabilidade,
  criarCategoria,
  criarHabilidade,
  getCategoriasCatalogo,
  getHabilidadesCatalogo,
  getMetodologiasAtivas,
  getModalidadesEvolucao,
  getRequisitosNivelAdmin,
  removerRequisitoNivel,
} from '../../src/features/evolucao/api';
import type {
  CategoriaCatalogo,
  HabilidadeCatalogo,
  MetodologiaDisponivel,
  ModalidadeEvolucao,
  RequisitoNivelAdmin,
  StatusHabilidadeEvolucao,
} from '../../src/features/evolucao/types';
import { useAuth } from '../../src/features/auth/AuthProvider';
import { useAsyncData } from '../../src/hooks/useAsyncData';
import { PageHeader } from '../../src/components/PageHeader';
import { Footer } from '../../src/components/Footer';
import { Dropdown } from '../../src/components/Dropdown';
import { colors, radius, spacing, touchTarget, type } from '../../src/constants/theme';

// Catálogo pedagógico de Minha Evolução — dono-only (docs/product/evolucao-
// vs-desempenho.md §8). RLS já era dono-only desde a migração fundacional
// (0007); até esta tela, categorias/habilidades/requisitos só podiam ser
// editados rodando SQL direto no Supabase.

const STATUS_OPCOES: { valor: StatusHabilidadeEvolucao; label: string }[] = [
  { valor: 'nao_iniciado', label: 'Não iniciado' },
  { valor: 'aprendendo', label: 'Aprendendo' },
  { valor: 'em_desenvolvimento', label: 'Em desenvolvimento' },
  { valor: 'dominado', label: 'Dominado' },
  { valor: 'consolidado', label: 'Consolidado' },
];

export default function CatalogoEvolucao() {
  const { meuPapel } = useAuth();
  const souDono = meuPapel === 'dono';

  const [secaoAberta, setSecaoAberta] = useState<'categorias' | 'habilidades' | 'requisitos'>('categorias');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // --- Categorias ---
  const [modalidadeNovaCategoria, setModalidadeNovaCategoria] = useState<string | null>(null);
  const [nomeNovaCategoria, setNomeNovaCategoria] = useState('');
  const [ordemNovaCategoria, setOrdemNovaCategoria] = useState('1');

  // --- Habilidades ---
  const [categoriaNovaHabilidade, setCategoriaNovaHabilidade] = useState<string | null>(null);
  const [nomeNovaHabilidade, setNomeNovaHabilidade] = useState('');
  const [codigoNovaHabilidade, setCodigoNovaHabilidade] = useState('');

  // --- Requisitos ---
  const [metodologiaSelecionada, setMetodologiaSelecionada] = useState<string | null>(null);
  const [nivelSelecionado, setNivelSelecionado] = useState<string | null>(null);
  const [habilidadeNovoRequisito, setHabilidadeNovoRequisito] = useState<string | null>(null);
  const [pesoNovoRequisito, setPesoNovoRequisito] = useState('1');
  const [statusNovoRequisito, setStatusNovoRequisito] = useState<StatusHabilidadeEvolucao>('dominado');
  const [notaNovoRequisito, setNotaNovoRequisito] = useState('');

  const { data: modalidades, loading: carregandoModalidades } = useAsyncData<ModalidadeEvolucao[]>(
    getModalidadesEvolucao,
    [],
    { mensagemErro: 'Erro ao carregar modalidades.' }
  );

  const {
    data: categorias,
    loading: carregandoCategorias,
    reload: recarregarCategorias,
  } = useAsyncData<CategoriaCatalogo[]>(getCategoriasCatalogo, [], { mensagemErro: 'Erro ao carregar categorias.' });

  const {
    data: habilidades,
    loading: carregandoHabilidades,
    reload: recarregarHabilidades,
  } = useAsyncData<HabilidadeCatalogo[]>(getHabilidadesCatalogo, [], { mensagemErro: 'Erro ao carregar habilidades.' });

  const {
    data: metodologias,
    loading: carregandoMetodologias,
  } = useAsyncData<MetodologiaDisponivel[]>(getMetodologiasAtivas, [], {
    mensagemErro: 'Erro ao carregar metodologias.',
  });

  const metodologiaEscolhida = (metodologias ?? []).find((m) => m.id === metodologiaSelecionada) ?? null;

  const carregarRequisitos = useCallback(async () => {
    if (!nivelSelecionado) return [] as RequisitoNivelAdmin[];
    return getRequisitosNivelAdmin(nivelSelecionado);
  }, [nivelSelecionado]);

  const {
    data: requisitos,
    loading: carregandoRequisitos,
    reload: recarregarRequisitos,
  } = useAsyncData<RequisitoNivelAdmin[]>(carregarRequisitos, [nivelSelecionado], {
    enabled: Boolean(nivelSelecionado),
    mensagemErro: 'Erro ao carregar requisitos do nível.',
  });

  if (!souDono) {
    return <Redirect href="/" />;
  }

  async function adicionarCategoria() {
    if (!modalidadeNovaCategoria || !nomeNovaCategoria.trim()) {
      setErro('Escolha a modalidade e informe o nome da categoria.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await criarCategoria(
        modalidadeNovaCategoria,
        nomeNovaCategoria.trim(),
        null,
        Number(ordemNovaCategoria) || 0
      );
      setNomeNovaCategoria('');
      setOrdemNovaCategoria('1');
      await recarregarCategorias();
    } catch (err) {
      console.error(err);
      setErro('Erro ao criar categoria. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivoCategoria(categoria: CategoriaCatalogo) {
    setErro(null);
    try {
      await atualizarCategoria(categoria.id, { ativo: !categoria.ativo });
      await recarregarCategorias();
    } catch (err) {
      console.error(err);
      setErro('Erro ao atualizar categoria. Tente novamente.');
    }
  }

  async function adicionarHabilidade() {
    if (!categoriaNovaHabilidade || !nomeNovaHabilidade.trim()) {
      setErro('Escolha a categoria e informe o nome da habilidade.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await criarHabilidade(
        categoriaNovaHabilidade,
        nomeNovaHabilidade.trim(),
        codigoNovaHabilidade.trim() || null,
        null
      );
      setNomeNovaHabilidade('');
      setCodigoNovaHabilidade('');
      await recarregarHabilidades();
    } catch (err) {
      console.error(err);
      setErro('Erro ao criar habilidade. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivoHabilidade(habilidade: HabilidadeCatalogo) {
    setErro(null);
    try {
      await atualizarHabilidade(habilidade.id, { ativo: !habilidade.ativo });
      await recarregarHabilidades();
    } catch (err) {
      console.error(err);
      setErro('Erro ao atualizar habilidade. Tente novamente.');
    }
  }

  async function adicionarRequisito() {
    if (!nivelSelecionado || !habilidadeNovoRequisito) {
      setErro('Escolha o nível e a habilidade.');
      return;
    }
    const peso = Number(pesoNovoRequisito);
    if (!peso || peso <= 0) {
      setErro('Peso precisa ser maior que zero.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await adicionarRequisitoNivel(
        nivelSelecionado,
        habilidadeNovoRequisito,
        peso,
        statusNovoRequisito,
        notaNovoRequisito.trim() ? Number(notaNovoRequisito) : null,
        true
      );
      setHabilidadeNovoRequisito(null);
      setPesoNovoRequisito('1');
      setNotaNovoRequisito('');
      await recarregarRequisitos();
    } catch (err) {
      console.error(err);
      setErro('Erro ao adicionar requisito. Já pode existir um requisito pra essa habilidade nesse nível.');
    } finally {
      setSalvando(false);
    }
  }

  async function removerRequisito(id: string) {
    setErro(null);
    try {
      await removerRequisitoNivel(id);
      await recarregarRequisitos();
    } catch (err) {
      console.error(err);
      setErro('Erro ao remover requisito. Tente novamente.');
    }
  }

  const carregandoGeral = carregandoModalidades || carregandoCategorias || carregandoHabilidades || carregandoMetodologias;

  const opcoesModalidades = (modalidades ?? []).map((m) => ({ value: m.id, label: m.nome }));
  const opcoesCategorias = (categorias ?? [])
    .filter((c) => c.ativo)
    .map((c) => ({ value: c.id, label: c.nome, sublabel: c.modalidadeNome }));
  const opcoesHabilidadesDisponiveis = (habilidades ?? [])
    .filter((h) => h.ativo && !(requisitos ?? []).some((r) => r.habilidadeId === h.id))
    .map((h) => ({ value: h.id, label: h.nome, sublabel: h.categoriaNome }));

  return (
    <>
      <PageHeader titulo="Catálogo de Evolução" />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        <View style={styles.abas}>
          {(['categorias', 'habilidades', 'requisitos'] as const).map((secao) => (
            <TouchableOpacity
              key={secao}
              testID={`catalogo-aba-${secao}`}
              style={[styles.aba, secaoAberta === secao && styles.abaAtiva]}
              onPress={() => setSecaoAberta(secao)}
            >
              <Text style={[styles.abaTexto, secaoAberta === secao && styles.abaTextoAtivo]}>
                {secao === 'categorias' ? 'Categorias' : secao === 'habilidades' ? 'Habilidades' : 'Requisitos'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {erro ? <Text style={styles.erro}>{erro}</Text> : null}

        {carregandoGeral ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}

        {!carregandoGeral && secaoAberta === 'categorias' ? (
          <View>
            {(categorias ?? []).map((categoria) => (
              <View key={categoria.id} style={styles.itemRow}>
                <View style={styles.itemTextoWrap}>
                  <Text style={[type.body, !categoria.ativo && styles.inativo]}>{categoria.nome}</Text>
                  <Text style={type.caption}>
                    {categoria.modalidadeNome} · ordem {categoria.ordem}
                  </Text>
                </View>
                <Switch value={categoria.ativo} onValueChange={() => alternarAtivoCategoria(categoria)} />
              </View>
            ))}

            <Text style={styles.subtitulo}>Nova categoria</Text>
            <Dropdown
              testID="catalogo-categoria-modalidade"
              placeholder="Modalidade"
              options={opcoesModalidades}
              value={modalidadeNovaCategoria}
              onChange={setModalidadeNovaCategoria}
            />
            <TextInput
              testID="catalogo-categoria-nome"
              style={styles.input}
              value={nomeNovaCategoria}
              onChangeText={setNomeNovaCategoria}
              placeholder="Nome da categoria"
            />
            <TextInput
              style={styles.input}
              value={ordemNovaCategoria}
              onChangeText={setOrdemNovaCategoria}
              placeholder="Ordem (número)"
              keyboardType="numeric"
            />
            <TouchableOpacity
              testID="catalogo-categoria-adicionar"
              style={[styles.botao, salvando && styles.botaoDesabilitado]}
              onPress={adicionarCategoria}
              disabled={salvando}
            >
              <Text style={styles.botaoTexto}>Adicionar categoria</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!carregandoGeral && secaoAberta === 'habilidades' ? (
          <View>
            {(habilidades ?? []).map((habilidade) => (
              <View key={habilidade.id} style={styles.itemRow}>
                <View style={styles.itemTextoWrap}>
                  <Text style={[type.body, !habilidade.ativo && styles.inativo]}>{habilidade.nome}</Text>
                  <Text style={type.caption}>
                    {habilidade.categoriaNome}
                    {habilidade.nomeInternacional ? ` · ${habilidade.nomeInternacional}` : ''}
                  </Text>
                </View>
                <Switch value={habilidade.ativo} onValueChange={() => alternarAtivoHabilidade(habilidade)} />
              </View>
            ))}

            <Text style={styles.subtitulo}>Nova habilidade</Text>
            <Dropdown
              testID="catalogo-habilidade-categoria"
              placeholder="Categoria"
              options={opcoesCategorias}
              value={categoriaNovaHabilidade}
              onChange={setCategoriaNovaHabilidade}
            />
            <TextInput
              testID="catalogo-habilidade-nome"
              style={styles.input}
              value={nomeNovaHabilidade}
              onChangeText={setNomeNovaHabilidade}
              placeholder="Nome da habilidade"
            />
            <TextInput
              style={styles.input}
              value={codigoNovaHabilidade}
              onChangeText={setCodigoNovaHabilidade}
              placeholder="Código oficial (opcional, ex.: FigA)"
            />
            <TouchableOpacity
              testID="catalogo-habilidade-adicionar"
              style={[styles.botao, salvando && styles.botaoDesabilitado]}
              onPress={adicionarHabilidade}
              disabled={salvando}
            >
              <Text style={styles.botaoTexto}>Adicionar habilidade</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!carregandoGeral && secaoAberta === 'requisitos' ? (
          <View>
            <Text style={styles.subtitulo}>Metodologia e nível</Text>
            <Dropdown
              testID="catalogo-requisito-metodologia"
              placeholder="Metodologia"
              options={(metodologias ?? []).map((m) => ({ value: m.id, label: m.nome }))}
              value={metodologiaSelecionada}
              onChange={(valor) => {
                setMetodologiaSelecionada(valor);
                setNivelSelecionado(null);
              }}
            />
            {metodologiaEscolhida ? (
              <View style={styles.chipsRow}>
                {metodologiaEscolhida.niveis.map((nivel) => (
                  <TouchableOpacity
                    key={nivel.id}
                    testID={`catalogo-requisito-nivel-${nivel.id}`}
                    style={[styles.chip, nivelSelecionado === nivel.id && styles.chipAtivo]}
                    onPress={() => setNivelSelecionado(nivel.id)}
                  >
                    <Text style={[styles.chipTexto, nivelSelecionado === nivel.id && styles.chipTextoAtivo]}>
                      {nivel.nome}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            {nivelSelecionado ? (
              carregandoRequisitos ? (
                <ActivityIndicator color={colors.primary} style={styles.center} />
              ) : (
                <>
                  {(requisitos ?? []).map((requisito) => (
                    <View key={requisito.id} style={styles.itemRow}>
                      <View style={styles.itemTextoWrap}>
                        <Text style={type.body}>{requisito.habilidadeNome}</Text>
                        <Text style={type.caption}>
                          {requisito.categoriaNome} · peso {requisito.peso} · meta{' '}
                          {requisito.statusMinimo.replaceAll('_', ' ')}
                          {requisito.notaMinima != null ? ` · ${requisito.notaMinima}% mínimo` : ''}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => removerRequisito(requisito.id)}>
                        <Text style={styles.removerTexto}>Remover</Text>
                      </TouchableOpacity>
                    </View>
                  ))}

                  <Text style={styles.subtitulo}>Novo requisito</Text>
                  <Dropdown
                    testID="catalogo-requisito-habilidade"
                    placeholder="Habilidade"
                    searchable
                    options={opcoesHabilidadesDisponiveis}
                    value={habilidadeNovoRequisito}
                    onChange={setHabilidadeNovoRequisito}
                    vazio="Todas as habilidades ativas já estão nesse nível."
                  />
                  <TextInput
                    style={styles.input}
                    value={pesoNovoRequisito}
                    onChangeText={setPesoNovoRequisito}
                    placeholder="Peso"
                    keyboardType="numeric"
                  />
                  <View style={styles.chipsRow}>
                    {STATUS_OPCOES.map((opcao) => (
                      <TouchableOpacity
                        key={opcao.valor}
                        style={[styles.chip, statusNovoRequisito === opcao.valor && styles.chipAtivo]}
                        onPress={() => setStatusNovoRequisito(opcao.valor)}
                      >
                        <Text
                          style={[styles.chipTexto, statusNovoRequisito === opcao.valor && styles.chipTextoAtivo]}
                        >
                          {opcao.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput
                    style={styles.input}
                    value={notaNovoRequisito}
                    onChangeText={setNotaNovoRequisito}
                    placeholder="Nota mínima (opcional, 0-100)"
                    keyboardType="numeric"
                  />
                  <TouchableOpacity
                    testID="catalogo-requisito-adicionar"
                    style={[styles.botao, salvando && styles.botaoDesabilitado]}
                    onPress={adicionarRequisito}
                    disabled={salvando}
                  >
                    <Text style={styles.botaoTexto}>Adicionar requisito</Text>
                  </TouchableOpacity>
                </>
              )
            ) : (
              <Text style={type.caption}>Escolha metodologia e nível pra ver/editar os requisitos.</Text>
            )}
          </View>
        ) : null}
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
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  abas: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  aba: {
    flex: 1,
    minHeight: touchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  abaAtiva: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  abaTexto: {
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
    color: colors.text,
  },
  abaTextoAtivo: {
    color: colors.onPrimary,
  },
  erro: {
    color: colors.danger,
    marginBottom: spacing.md,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: touchTarget,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  itemTextoWrap: {
    flex: 1,
    marginRight: spacing.sm,
  },
  inativo: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  subtitulo: {
    color: colors.textMuted,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
    fontFamily: type.label.fontFamily,
    fontSize: type.label.fontSize,
  },
  input: {
    height: touchTarget,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    marginTop: spacing.sm,
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
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  chip: {
    minHeight: touchTarget,
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
  removerTexto: {
    color: colors.danger,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
});
