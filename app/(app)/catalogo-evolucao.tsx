import { Redirect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import {
  adicionarRequisitoNivel,
  atualizarCategoria,
  atualizarHabilidade,
  atualizarMetodologia,
  atualizarModalidade,
  atualizarRequisitoNivel,
  criarCategoria,
  criarHabilidade,
  criarMetodologia,
  criarModalidade,
  excluirCategoria,
  excluirHabilidade,
  excluirMetodologia,
  excluirModalidade,
  getCategoriasCatalogo,
  getHabilidadesCatalogo,
  getMetodologiasCatalogo,
  getMetodologiasAtivas,
  getModalidadesEvolucao,
  getRequisitosNivelAdmin,
  getUsoCategoria,
  getUsoHabilidade,
  getUsoMetodologia,
  getUsoModalidade,
  removerRequisitoNivel,
} from '../../src/features/evolucao/api';
import type {
  CategoriaCatalogo,
  HabilidadeCatalogo,
  MetodologiaCatalogo,
  MetodologiaDisponivel,
  ModalidadeEvolucao,
  RequisitoNivelAdmin,
  StatusHabilidadeEvolucao,
} from '../../src/features/evolucao/types';
import { useAuth } from '../../src/features/auth/AuthProvider';
import { useAsyncData } from '../../src/hooks/useAsyncData';
import { confirmDelete, confirmSave } from '../../src/lib/confirmar';
import { PageHeader } from '../../src/components/PageHeader';
import { Footer } from '../../src/components/Footer';
import { WebModal } from '../../src/components/WebModal';
import { Dropdown } from '../../src/components/Dropdown';
import { FormModal } from '../../src/components/FormModal';
import { RowActions } from '../../src/components/RowActions';
import { ToggleAtivo } from '../../src/components/ToggleAtivo';
import { colors, radius, spacing, touchTarget, type } from '../../src/constants/theme';

// Catálogo pedagógico de Minha Evolução — dono-only (docs/product/evolucao-
// vs-desempenho.md §8). RLS já era dono-only desde a migração fundacional
// (0007); até esta tela, categorias/habilidades/requisitos só podiam ser
// editados rodando SQL direto no Supabase.
//
// Adicionar/editar/excluir padronizados (pedido do dono, 2026-09-22): botão
// "+ [Nome]" no topo de cada seção abre um FormModal; cada linha ganha o
// lápis (edita no mesmo modal, com confirmação ao salvar) e a lixeira (exclui
// de vez, checando uso antes) além do toggle de ativo já existente.

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

  const [secaoAberta, setSecaoAberta] = useState<'categorias' | 'habilidades' | 'metodologias' | 'requisitos'>('categorias');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // --- Modalidades ---
  const [modalModalidadeAberto, setModalModalidadeAberto] = useState(false);
  const [editandoModalidade, setEditandoModalidade] = useState<ModalidadeEvolucao | null>(null);
  const [nomeModalidadeForm, setNomeModalidadeForm] = useState('');

  // --- Categorias ---
  const [modalCategoriaAberto, setModalCategoriaAberto] = useState(false);
  const [editandoCategoria, setEditandoCategoria] = useState<CategoriaCatalogo | null>(null);
  const [modalidadeCategoriaForm, setModalidadeCategoriaForm] = useState<string | null>(null);
  const [nomeCategoriaForm, setNomeCategoriaForm] = useState('');

  // --- Habilidades ---
  const [modalHabilidadeAberto, setModalHabilidadeAberto] = useState(false);
  const [editandoHabilidade, setEditandoHabilidade] = useState<HabilidadeCatalogo | null>(null);
  const [categoriaHabilidadeForm, setCategoriaHabilidadeForm] = useState<string | null>(null);
  const [nomeHabilidadeForm, setNomeHabilidadeForm] = useState('');
  const [codigoHabilidadeForm, setCodigoHabilidadeForm] = useState('');
  const [valorBaseHabilidadeForm, setValorBaseHabilidadeForm] = useState('1');

  // --- Requisitos ---
  const [metodologiaSelecionada, setMetodologiaSelecionada] = useState<string | null>(null);
  const [nivelSelecionado, setNivelSelecionado] = useState<string | null>(null);
  const [modalRequisitoAberto, setModalRequisitoAberto] = useState(false);
  const [editandoRequisito, setEditandoRequisito] = useState<RequisitoNivelAdmin | null>(null);
  const [habilidadeRequisitoForm, setHabilidadeRequisitoForm] = useState<string | null>(null);
  const [pesoRequisitoForm, setPesoRequisitoForm] = useState('1');
  const [statusRequisitoForm, setStatusRequisitoForm] = useState<StatusHabilidadeEvolucao>('dominado');
  const [notaRequisitoForm, setNotaRequisitoForm] = useState('');

  // --- Metodologias ---
  const [modalMetodologiaAberto, setModalMetodologiaAberto] = useState(false);
  const [editandoMetodologia, setEditandoMetodologia] = useState<MetodologiaCatalogo | null>(null);
  const [nomeMetodologiaForm, setNomeMetodologiaForm] = useState('');

  const {
    data: modalidades,
    loading: carregandoModalidades,
    reload: recarregarModalidades,
  } = useAsyncData<ModalidadeEvolucao[]>(getModalidadesEvolucao, [secaoAberta], {
    enabled: secaoAberta === 'categorias',
    mensagemErro: 'Erro ao carregar modalidades.',
  });

  const {
    data: categorias,
    loading: carregandoCategorias,
    reload: recarregarCategorias,
  } = useAsyncData<CategoriaCatalogo[]>(getCategoriasCatalogo, [secaoAberta], {
    enabled: secaoAberta === 'categorias',
    mensagemErro: 'Erro ao carregar categorias.',
  });

  const {
    data: habilidades,
    loading: carregandoHabilidades,
    reload: recarregarHabilidades,
  } = useAsyncData<HabilidadeCatalogo[]>(getHabilidadesCatalogo, [secaoAberta], {
    enabled: secaoAberta === 'habilidades' || secaoAberta === 'requisitos',
    mensagemErro: 'Erro ao carregar habilidades.',
  });

  const {
    data: metodologias,
    loading: carregandoMetodologias,
  } = useAsyncData<MetodologiaDisponivel[]>(getMetodologiasAtivas, [secaoAberta], {
    enabled: secaoAberta === 'requisitos',
    mensagemErro: 'Erro ao carregar metodologias.',
  });

  const {
    data: metodologiasCatalogo,
    loading: carregandoMetodologiasCatalogo,
    reload: recarregarMetodologiasCatalogo,
  } = useAsyncData<MetodologiaCatalogo[]>(getMetodologiasCatalogo, [secaoAberta], {
    enabled: secaoAberta === 'metodologias',
    mensagemErro: 'Erro ao carregar metodologias do catálogo.',
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

  // --- Modalidades ---

  function abrirNovaModalidade() {
    setEditandoModalidade(null);
    setNomeModalidadeForm('');
    setErro(null);
    setModalModalidadeAberto(true);
  }

  function abrirEdicaoModalidade(modalidade: ModalidadeEvolucao) {
    setEditandoModalidade(modalidade);
    setNomeModalidadeForm(modalidade.nome);
    setErro(null);
    setModalModalidadeAberto(true);
  }

  function confirmarSalvarModalidade() {
    if (!nomeModalidadeForm.trim()) {
      setErro('Informe o nome da modalidade.');
      return;
    }
    if (editandoModalidade) {
      confirmSave(salvarModalidade);
    } else {
      salvarModalidade();
    }
  }

  async function salvarModalidade() {
    setSalvando(true);
    setErro(null);
    try {
      if (editandoModalidade) {
        await atualizarModalidade(editandoModalidade.id, { nome: nomeModalidadeForm.trim() });
      } else {
        await criarModalidade(nomeModalidadeForm.trim(), null);
      }
      setModalModalidadeAberto(false);
      await recarregarModalidades();
    } catch (err) {
      console.error(err);
      setErro('Erro ao salvar modalidade. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivoModalidade(modalidade: ModalidadeEvolucao) {
    setErro(null);
    try {
      await atualizarModalidade(modalidade.id, { ativo: !modalidade.ativo });
      await recarregarModalidades();
    } catch (err) {
      console.error(err);
      setErro('Erro ao atualizar modalidade. Tente novamente.');
    }
  }

  async function excluirModalidadeHandler(modalidade: ModalidadeEvolucao) {
    setErro(null);
    try {
      const uso = await getUsoModalidade(modalidade.id);
      if (uso > 0) {
        setErro(`Não é possível excluir "${modalidade.nome}": tem ${uso} categoria(s). Desative em vez de excluir.`);
        return;
      }
      confirmDelete(modalidade.nome, async () => {
        try {
          await excluirModalidade(modalidade.id);
          await recarregarModalidades();
        } catch (err) {
          console.error(err);
          setErro('Erro ao excluir modalidade. Tente novamente.');
        }
      });
    } catch (err) {
      console.error(err);
      setErro('Erro ao verificar uso da modalidade. Tente novamente.');
    }
  }

  // --- Categorias ---

  function abrirNovaCategoria() {
    setEditandoCategoria(null);
    setModalidadeCategoriaForm(null);
    setNomeCategoriaForm('');
    setErro(null);
    setModalCategoriaAberto(true);
  }

  function abrirEdicaoCategoria(categoria: CategoriaCatalogo) {
    setEditandoCategoria(categoria);
    setModalidadeCategoriaForm(categoria.modalidadeId);
    setNomeCategoriaForm(categoria.nome);
    setErro(null);
    setModalCategoriaAberto(true);
  }

  function confirmarSalvarCategoria() {
    if (!editandoCategoria && !modalidadeCategoriaForm) {
      setErro('Escolha a modalidade.');
      return;
    }
    if (!nomeCategoriaForm.trim()) {
      setErro('Informe o nome da categoria.');
      return;
    }
    if (editandoCategoria) {
      confirmSave(salvarCategoria);
    } else {
      salvarCategoria();
    }
  }

  async function salvarCategoria() {
    setSalvando(true);
    setErro(null);
    try {
      if (editandoCategoria) {
        await atualizarCategoria(editandoCategoria.id, { nome: nomeCategoriaForm.trim() });
      } else {
        // Ordem é só dica de exibição (ordenação da lista) — próxima posição
        // dentro da mesma modalidade, calculada sozinha em vez de pedir pro
        // dono adivinhar um número.
        const proximaOrdem = (categorias ?? []).filter((c) => c.modalidadeId === modalidadeCategoriaForm).length + 1;
        await criarCategoria(modalidadeCategoriaForm!, nomeCategoriaForm.trim(), null, proximaOrdem);
      }
      setModalCategoriaAberto(false);
      await recarregarCategorias();
    } catch (err) {
      console.error(err);
      setErro('Erro ao salvar categoria. Tente novamente.');
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

  async function excluirCategoriaHandler(categoria: CategoriaCatalogo) {
    setErro(null);
    try {
      const uso = await getUsoCategoria(categoria.id);
      if (uso > 0) {
        setErro(`Não é possível excluir "${categoria.nome}": tem ${uso} habilidade(s). Desative em vez de excluir.`);
        return;
      }
      confirmDelete(categoria.nome, async () => {
        try {
          await excluirCategoria(categoria.id);
          await recarregarCategorias();
        } catch (err) {
          console.error(err);
          setErro('Erro ao excluir categoria. Tente novamente.');
        }
      });
    } catch (err) {
      console.error(err);
      setErro('Erro ao verificar uso da categoria. Tente novamente.');
    }
  }

  // --- Habilidades ---

  function abrirNovaHabilidade() {
    setEditandoHabilidade(null);
    setCategoriaHabilidadeForm(null);
    setNomeHabilidadeForm('');
    setCodigoHabilidadeForm('');
    setValorBaseHabilidadeForm('1');
    setErro(null);
    setModalHabilidadeAberto(true);
  }

  function abrirEdicaoHabilidade(habilidade: HabilidadeCatalogo) {
    setEditandoHabilidade(habilidade);
    setCategoriaHabilidadeForm(habilidade.categoriaId);
    setNomeHabilidadeForm(habilidade.nome);
    setCodigoHabilidadeForm(habilidade.nomeInternacional ?? '');
    setValorBaseHabilidadeForm(String(habilidade.valorBase));
    setErro(null);
    setModalHabilidadeAberto(true);
  }

  function confirmarSalvarHabilidade() {
    if (!editandoHabilidade && !categoriaHabilidadeForm) {
      setErro('Escolha a categoria.');
      return;
    }
    if (!nomeHabilidadeForm.trim()) {
      setErro('Informe o nome da habilidade.');
      return;
    }
    const valorBase = Number(valorBaseHabilidadeForm.replace(',', '.'));
    if (!valorBase || valorBase <= 0) {
      setErro('Valor base precisa ser maior que zero.');
      return;
    }
    if (editandoHabilidade) {
      confirmSave(salvarHabilidade);
    } else {
      salvarHabilidade();
    }
  }

  async function salvarHabilidade() {
    const valorBase = Number(valorBaseHabilidadeForm.replace(',', '.'));
    setSalvando(true);
    setErro(null);
    try {
      if (editandoHabilidade) {
        await atualizarHabilidade(editandoHabilidade.id, {
          nome: nomeHabilidadeForm.trim(),
          nomeInternacional: codigoHabilidadeForm.trim() || null,
          valorBase,
        });
      } else {
        await criarHabilidade(
          categoriaHabilidadeForm!,
          nomeHabilidadeForm.trim(),
          codigoHabilidadeForm.trim() || null,
          null,
          valorBase
        );
      }
      setModalHabilidadeAberto(false);
      await recarregarHabilidades();
    } catch (err) {
      console.error(err);
      setErro('Erro ao salvar habilidade. Tente novamente.');
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

  async function excluirHabilidadeHandler(habilidade: HabilidadeCatalogo) {
    setErro(null);
    try {
      const uso = await getUsoHabilidade(habilidade.id);
      if (uso > 0) {
        setErro(
          `Não é possível excluir "${habilidade.nome}": já foi avaliada ou é exigida em algum nível. Desative em vez de excluir.`
        );
        return;
      }
      confirmDelete(habilidade.nome, async () => {
        try {
          await excluirHabilidade(habilidade.id);
          await recarregarHabilidades();
        } catch (err) {
          console.error(err);
          setErro('Erro ao excluir habilidade. Tente novamente.');
        }
      });
    } catch (err) {
      console.error(err);
      setErro('Erro ao verificar uso da habilidade. Tente novamente.');
    }
  }

  // --- Requisitos ---

  function abrirNovoRequisito() {
    setEditandoRequisito(null);
    setHabilidadeRequisitoForm(null);
    setPesoRequisitoForm('1');
    setStatusRequisitoForm('dominado');
    setNotaRequisitoForm('');
    setErro(null);
    setModalRequisitoAberto(true);
  }

  function abrirEdicaoRequisito(requisito: RequisitoNivelAdmin) {
    setEditandoRequisito(requisito);
    setHabilidadeRequisitoForm(requisito.habilidadeId);
    setPesoRequisitoForm(String(requisito.peso));
    setStatusRequisitoForm(requisito.statusMinimo);
    setNotaRequisitoForm(requisito.notaMinima != null ? String(requisito.notaMinima) : '');
    setErro(null);
    setModalRequisitoAberto(true);
  }

  function confirmarSalvarRequisito() {
    if (!nivelSelecionado || (!editandoRequisito && !habilidadeRequisitoForm)) {
      setErro('Escolha o nível e a habilidade.');
      return;
    }
    const peso = Number(pesoRequisitoForm);
    if (!peso || peso <= 0) {
      setErro('Peso precisa ser maior que zero.');
      return;
    }
    if (editandoRequisito) {
      confirmSave(salvarRequisito);
    } else {
      salvarRequisito();
    }
  }

  async function salvarRequisito() {
    const peso = Number(pesoRequisitoForm);
    const notaMinima = notaRequisitoForm.trim() ? Number(notaRequisitoForm) : null;
    setSalvando(true);
    setErro(null);
    try {
      if (editandoRequisito) {
        await atualizarRequisitoNivel(editandoRequisito.id, { peso, statusMinimo: statusRequisitoForm, notaMinima });
      } else {
        await adicionarRequisitoNivel(nivelSelecionado!, habilidadeRequisitoForm!, peso, statusRequisitoForm, notaMinima, true);
      }
      setModalRequisitoAberto(false);
      await recarregarRequisitos();
    } catch (err) {
      console.error(err);
      setErro('Erro ao salvar requisito. Já pode existir um requisito pra essa habilidade nesse nível.');
    } finally {
      setSalvando(false);
    }
  }

  function excluirRequisitoHandler(requisito: RequisitoNivelAdmin) {
    setErro(null);
    confirmDelete(`o requisito de ${requisito.habilidadeNome}`, async () => {
      try {
        await removerRequisitoNivel(requisito.id);
        await recarregarRequisitos();
      } catch (err) {
        console.error(err);
        setErro('Erro ao excluir requisito. Tente novamente.');
      }
    });
  }

  function abrirNovaMetodologia() {
    setEditandoMetodologia(null);
    setNomeMetodologiaForm('');
    setErro(null);
    setModalMetodologiaAberto(true);
  }

  function abrirEdicaoMetodologia(metodologia: MetodologiaCatalogo) {
    setEditandoMetodologia(metodologia);
    setNomeMetodologiaForm(metodologia.nome);
    setErro(null);
    setModalMetodologiaAberto(true);
  }

  function confirmarSalvarMetodologia() {
    if (!nomeMetodologiaForm.trim()) {
      setErro('Informe o nome da metodologia.');
      return;
    }
    if (editandoMetodologia) {
      confirmSave(salvarMetodologia);
    } else {
      salvarMetodologia();
    }
  }

  async function salvarMetodologia() {
    setSalvando(true);
    setErro(null);
    try {
      if (editandoMetodologia) {
        await atualizarMetodologia(editandoMetodologia.id, { nome: nomeMetodologiaForm.trim() });
      } else {
        await criarMetodologia(nomeMetodologiaForm.trim());
      }
      setModalMetodologiaAberto(false);
      await recarregarMetodologiasCatalogo();
    } catch (err) {
      console.error(err);
      setErro('Erro ao salvar metodologia. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivoMetodologia(metodologia: MetodologiaCatalogo) {
    setErro(null);
    try {
      await atualizarMetodologia(metodologia.id, { ativa: !metodologia.ativa });
      await recarregarMetodologiasCatalogo();
    } catch (err) {
      console.error(err);
      setErro('Erro ao atualizar metodologia. Tente novamente.');
    }
  }

  async function excluirMetodologiaHandler(metodologia: MetodologiaCatalogo) {
    setErro(null);
    try {
      const uso = await getUsoMetodologia(metodologia.id);
      if (uso > 0) {
        setErro(`Não é possível excluir "${metodologia.nome}": está atribuída a ${uso} aluno(s). Desative em vez de excluir.`);
        return;
      }

      confirmDelete(metodologia.nome, async () => {
        try {
          await excluirMetodologia(metodologia.id);
          await recarregarMetodologiasCatalogo();
        } catch (err) {
          console.error(err);
          setErro('Erro ao excluir metodologia. Tente novamente.');
        }
      });
    } catch (err) {
      console.error(err);
      setErro('Erro ao verificar uso da metodologia. Tente novamente.');
    }
  }

  const carregandoGeral =
    secaoAberta === 'categorias'
      ? carregandoModalidades || carregandoCategorias
      : secaoAberta === 'habilidades'
        ? carregandoHabilidades
        : secaoAberta === 'metodologias'
          ? carregandoMetodologiasCatalogo
          : carregandoHabilidades || carregandoMetodologias;

  const opcoesModalidades = (modalidades ?? []).filter((m) => m.ativo).map((m) => ({ value: m.id, label: m.nome }));
  const opcoesCategorias = (categorias ?? [])
    .filter((c) => c.ativo)
    .map((c) => ({ value: c.id, label: c.nome, sublabel: c.modalidadeNome }));
  const opcoesHabilidadesDisponiveis = (habilidades ?? [])
    .filter((h) => h.ativo && !(requisitos ?? []).some((r) => r.habilidadeId === h.id))
    .map((h) => ({ value: h.id, label: h.nome, sublabel: h.categoriaNome }));

  return (
    <WebModal>
      <PageHeader titulo="Catálogo de Evolução" />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        <View style={styles.abas}>
          {(['categorias', 'habilidades', 'metodologias', 'requisitos'] as const).map((secao) => (
            <TouchableOpacity
              key={secao}
              testID={`catalogo-aba-${secao}`}
              style={[styles.aba, secaoAberta === secao && styles.abaAtiva]}
              onPress={() => setSecaoAberta(secao)}
            >
              <Text style={[styles.abaTexto, secaoAberta === secao && styles.abaTextoAtivo]}>
                {secao === 'categorias'
                  ? 'Categorias'
                  : secao === 'habilidades'
                    ? 'Habilidades'
                    : secao === 'metodologias'
                      ? 'Metodologias'
                      : 'Requisitos'}
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
            <View style={styles.tituloRow}>
              <Text style={styles.tituloSecao}>Modalidades</Text>
              <TouchableOpacity testID="catalogo-modalidade-abrir-novo" style={styles.novoBotao} onPress={abrirNovaModalidade}>
                <Text style={styles.novoBotaoTexto}>+ Modalidade</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.explicacao}>
              Uma modalidade agrupa as categorias técnicas (ex.: "Livre"). A maioria das escolas usa só uma.
            </Text>
            {(modalidades ?? []).map((modalidade) => (
              <View key={modalidade.id} style={styles.itemRow}>
                <Text style={[type.body, styles.itemTextoWrap, !modalidade.ativo && styles.inativo]}>
                  {modalidade.nome}
                </Text>
                <View style={styles.itemAcoes}>
                  <ToggleAtivo
                    testID={`catalogo-modalidade-${modalidade.id}-toggle`}
                    ativo={modalidade.ativo}
                    onToggle={() => alternarAtivoModalidade(modalidade)}
                  />
                  <RowActions
                    testIdBase={`catalogo-modalidade-${modalidade.id}`}
                    onEdit={() => abrirEdicaoModalidade(modalidade)}
                    onDelete={() => excluirModalidadeHandler(modalidade)}
                  />
                </View>
              </View>
            ))}

            <View style={styles.tituloRow}>
              <Text style={styles.tituloSecao}>Categorias</Text>
              <TouchableOpacity testID="catalogo-categoria-abrir-novo" style={styles.novoBotao} onPress={abrirNovaCategoria}>
                <Text style={styles.novoBotaoTexto}>+ Categoria</Text>
              </TouchableOpacity>
            </View>
            {(categorias ?? []).map((categoria) => (
              <View key={categoria.id} style={styles.itemRow}>
                <View style={styles.itemTextoWrap}>
                  <Text style={[type.body, !categoria.ativo && styles.inativo]}>{categoria.nome}</Text>
                  <Text style={type.caption}>{categoria.modalidadeNome}</Text>
                </View>
                <View style={styles.itemAcoes}>
                  <ToggleAtivo
                    testID={`catalogo-categoria-${categoria.id}-toggle`}
                    ativo={categoria.ativo}
                    onToggle={() => alternarAtivoCategoria(categoria)}
                  />
                  <RowActions
                    testIdBase={`catalogo-categoria-${categoria.id}`}
                    onEdit={() => abrirEdicaoCategoria(categoria)}
                    onDelete={() => excluirCategoriaHandler(categoria)}
                  />
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {!carregandoGeral && secaoAberta === 'habilidades' ? (
          <View>
            <View style={styles.tituloRow}>
              <Text style={styles.tituloSecao}>Habilidades</Text>
              <TouchableOpacity testID="catalogo-habilidade-abrir-novo" style={styles.novoBotao} onPress={abrirNovaHabilidade}>
                <Text style={styles.novoBotaoTexto}>+ Habilidade</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.explicacao}>
              Valor base é o "quanto vale" a habilidade na pontuação do aluno (docs/product/evolucao-vs-desempenho.md
              §8.2) — quanto maior, mais ela pesa quando avaliada.
            </Text>
            {(habilidades ?? []).map((habilidade) => (
              <View key={habilidade.id} style={styles.itemRow}>
                <View style={styles.itemTextoWrap}>
                  <Text style={[type.body, !habilidade.ativo && styles.inativo]}>{habilidade.nome}</Text>
                  <Text style={type.caption}>
                    {habilidade.categoriaNome}
                    {habilidade.nomeInternacional ? ` · ${habilidade.nomeInternacional}` : ''} · valor{' '}
                    {habilidade.valorBase}
                  </Text>
                </View>
                <View style={styles.itemAcoes}>
                  <ToggleAtivo
                    testID={`catalogo-habilidade-${habilidade.id}-toggle`}
                    ativo={habilidade.ativo}
                    onToggle={() => alternarAtivoHabilidade(habilidade)}
                  />
                  <RowActions
                    testIdBase={`catalogo-habilidade-${habilidade.id}`}
                    onEdit={() => abrirEdicaoHabilidade(habilidade)}
                    onDelete={() => excluirHabilidadeHandler(habilidade)}
                  />
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {!carregandoGeral && secaoAberta === 'requisitos' ? (
          <View>
            <Text style={styles.tituloSecao}>Requisitos por nível</Text>
            <Text style={styles.explicacao}>
              Escolha a metodologia e o nível pra ver e editar quais habilidades são exigidas ali.
            </Text>
            <Text style={[type.label, styles.campoRotulo]}>Metodologia</Text>
            <Dropdown
              testID="catalogo-requisito-metodologia"
              placeholder="Escolha a metodologia"
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
              <View style={styles.tituloRow}>
                <Text style={type.caption}>Requisitos deste nível</Text>
                <TouchableOpacity testID="catalogo-requisito-abrir-novo" style={styles.novoBotao} onPress={abrirNovoRequisito}>
                  <Text style={styles.novoBotaoTexto}>+ Requisito</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {nivelSelecionado ? (
              carregandoRequisitos ? (
                <ActivityIndicator color={colors.primary} style={styles.center} />
              ) : (
                (requisitos ?? []).map((requisito) => (
                  <View key={requisito.id} style={styles.itemRow}>
                    <View style={styles.itemTextoWrap}>
                      <Text style={type.body}>{requisito.habilidadeNome}</Text>
                      <Text style={type.caption}>
                        {requisito.categoriaNome} · peso {requisito.peso} · meta{' '}
                        {requisito.statusMinimo.replaceAll('_', ' ')}
                        {requisito.notaMinima != null ? ` · ${requisito.notaMinima}% mínimo` : ''}
                      </Text>
                    </View>
                    <View style={styles.itemAcoes}>
                      <RowActions
                        testIdBase={`catalogo-requisito-${requisito.id}`}
                        onEdit={() => abrirEdicaoRequisito(requisito)}
                        onDelete={() => excluirRequisitoHandler(requisito)}
                      />
                    </View>
                  </View>
                ))
              )
            ) : (
              <Text style={type.caption}>Escolha metodologia e nível pra ver/editar os requisitos.</Text>
            )}
          </View>
        ) : null}

        {!carregandoGeral && secaoAberta === 'metodologias' ? (
          <View>
            <View style={styles.tituloRow}>
              <Text style={styles.tituloSecao}>Metodologias</Text>
              <TouchableOpacity
                testID="catalogo-metodologia-abrir-novo"
                style={styles.novoBotao}
                onPress={abrirNovaMetodologia}
              >
                <Text style={styles.novoBotaoTexto}>+ Metodologia</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.explicacao}>
              Metodologias definem a jornada do aluno e podem ser ativadas ou desativadas sem apagar o histórico.
            </Text>
            {(metodologiasCatalogo ?? []).map((metodologia) => (
              <View key={metodologia.id} style={styles.itemRow}>
                <View style={styles.itemTextoWrap}>
                  <Text style={[type.body, !metodologia.ativa && styles.inativo]}>{metodologia.nome}</Text>
                  <Text style={type.caption}>
                    {metodologia.temporada} · {metodologia.ativa ? 'ativa' : 'inativa'}
                  </Text>
                </View>
                <View style={styles.itemAcoes}>
                  <ToggleAtivo
                    testID={`catalogo-metodologia-${metodologia.id}-toggle`}
                    ativo={metodologia.ativa}
                    onToggle={() => alternarAtivoMetodologia(metodologia)}
                  />
                  <RowActions
                    testIdBase={`catalogo-metodologia-${metodologia.id}`}
                    onEdit={() => abrirEdicaoMetodologia(metodologia)}
                    onDelete={() => excluirMetodologiaHandler(metodologia)}
                  />
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <FormModal
        visible={modalMetodologiaAberto}
        title={editandoMetodologia ? 'Editar metodologia' : 'Nova metodologia'}
        onClose={() => !salvando && setModalMetodologiaAberto(false)}
      >
        <Text style={[type.label, styles.campoRotulo]}>Nome</Text>
        <TextInput
          testID="catalogo-metodologia-nome"
          style={styles.input}
          value={nomeMetodologiaForm}
          onChangeText={setNomeMetodologiaForm}
          placeholder="Ex.: Schmidt Base 2026"
        />

        <TouchableOpacity
          testID="catalogo-metodologia-salvar"
          style={[styles.botao, salvando && styles.botaoDesabilitado]}
          onPress={confirmarSalvarMetodologia}
          disabled={salvando}
        >
          {salvando ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.botaoTexto}>{editandoMetodologia ? 'Salvar alterações' : 'Criar metodologia'}</Text>
          )}
        </TouchableOpacity>
      </FormModal>

      <FormModal
        visible={modalModalidadeAberto}
        title={editandoModalidade ? 'Editar modalidade' : 'Nova modalidade'}
        onClose={() => !salvando && setModalModalidadeAberto(false)}
      >
        <Text style={[type.label, styles.campoRotulo]}>Nome</Text>
        <TextInput
          testID="catalogo-modalidade-nome"
          style={styles.input}
          value={nomeModalidadeForm}
          onChangeText={setNomeModalidadeForm}
          placeholder="Ex.: Dupla de Dança"
        />
        <TouchableOpacity
          testID="catalogo-modalidade-salvar"
          style={[styles.botao, salvando && styles.botaoDesabilitado]}
          onPress={confirmarSalvarModalidade}
          disabled={salvando}
        >
          {salvando ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.botaoTexto}>{editandoModalidade ? 'Salvar alterações' : 'Criar modalidade'}</Text>
          )}
        </TouchableOpacity>
      </FormModal>

      <FormModal
        visible={modalCategoriaAberto}
        title={editandoCategoria ? 'Editar categoria' : 'Nova categoria'}
        onClose={() => !salvando && setModalCategoriaAberto(false)}
      >
        {!editandoCategoria ? (
          opcoesModalidades.length === 0 ? (
            <Text style={styles.avisoTexto}>Cadastre uma modalidade antes de criar uma categoria.</Text>
          ) : (
            <>
              <Text style={[type.label, styles.campoRotulo]}>Modalidade</Text>
              <Dropdown
                testID="catalogo-categoria-modalidade"
                placeholder="Escolha a modalidade"
                options={opcoesModalidades}
                value={modalidadeCategoriaForm}
                onChange={setModalidadeCategoriaForm}
              />
            </>
          )
        ) : null}
        <Text style={[type.label, styles.campoRotulo]}>Nome</Text>
        <TextInput
          testID="catalogo-categoria-nome"
          style={styles.input}
          value={nomeCategoriaForm}
          onChangeText={setNomeCategoriaForm}
          placeholder="Ex.: Figuras"
        />
        <TouchableOpacity
          testID="catalogo-categoria-salvar"
          style={[styles.botao, salvando && styles.botaoDesabilitado]}
          onPress={confirmarSalvarCategoria}
          disabled={salvando}
        >
          {salvando ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.botaoTexto}>{editandoCategoria ? 'Salvar alterações' : 'Adicionar categoria'}</Text>
          )}
        </TouchableOpacity>
      </FormModal>

      <FormModal
        visible={modalHabilidadeAberto}
        title={editandoHabilidade ? 'Editar habilidade' : 'Nova habilidade'}
        onClose={() => !salvando && setModalHabilidadeAberto(false)}
      >
        {!editandoHabilidade ? (
          opcoesCategorias.length === 0 ? (
            <Text style={styles.avisoTexto}>Cadastre uma categoria antes de continuar.</Text>
          ) : (
            <>
              <Text style={[type.label, styles.campoRotulo]}>Categoria</Text>
              <Dropdown
                testID="catalogo-habilidade-categoria"
                placeholder="Escolha a categoria"
                options={opcoesCategorias}
                value={categoriaHabilidadeForm}
                onChange={setCategoriaHabilidadeForm}
              />
            </>
          )
        ) : null}
        <Text style={[type.label, styles.campoRotulo]}>Nome</Text>
        <TextInput
          testID="catalogo-habilidade-nome"
          style={styles.input}
          value={nomeHabilidadeForm}
          onChangeText={setNomeHabilidadeForm}
          placeholder="Ex.: Figura de alongamento"
        />
        <Text style={[type.label, styles.campoRotulo]}>Código oficial (opcional)</Text>
        <TextInput
          testID="catalogo-habilidade-codigo"
          style={styles.input}
          value={codigoHabilidadeForm}
          onChangeText={setCodigoHabilidadeForm}
          placeholder="Ex.: FigA"
        />
        <Text style={[type.label, styles.campoRotulo]}>Valor base (peso na pontuação)</Text>
        <TextInput
          testID="catalogo-habilidade-valor-base"
          style={styles.input}
          value={valorBaseHabilidadeForm}
          onChangeText={setValorBaseHabilidadeForm}
          placeholder="Ex.: 10"
          keyboardType="numeric"
        />
        <TouchableOpacity
          testID="catalogo-habilidade-salvar"
          style={[styles.botao, salvando && styles.botaoDesabilitado]}
          onPress={confirmarSalvarHabilidade}
          disabled={salvando}
        >
          {salvando ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.botaoTexto}>{editandoHabilidade ? 'Salvar alterações' : 'Adicionar habilidade'}</Text>
          )}
        </TouchableOpacity>
      </FormModal>

      <FormModal
        visible={modalRequisitoAberto}
        title={editandoRequisito ? 'Editar requisito' : 'Novo requisito'}
        onClose={() => !salvando && setModalRequisitoAberto(false)}
      >
        {!editandoRequisito ? (
          <>
            <Text style={[type.label, styles.campoRotulo]}>Habilidade</Text>
            <Dropdown
              testID="catalogo-requisito-habilidade"
              placeholder="Escolha a habilidade"
              searchable
              options={opcoesHabilidadesDisponiveis}
              value={habilidadeRequisitoForm}
              onChange={setHabilidadeRequisitoForm}
              vazio="Todas as habilidades ativas já estão nesse nível."
            />
          </>
        ) : null}
        <Text style={[type.label, styles.campoRotulo]}>Peso (quanto conta no progresso do nível)</Text>
        <TextInput
          testID="catalogo-requisito-peso"
          style={styles.input}
          value={pesoRequisitoForm}
          onChangeText={setPesoRequisitoForm}
          placeholder="Ex.: 1"
          keyboardType="numeric"
        />
        <Text style={[type.label, styles.campoRotulo]}>Status mínimo pra contar como atingido</Text>
        <View style={styles.chipsRow}>
          {STATUS_OPCOES.map((opcao) => (
            <TouchableOpacity
              key={opcao.valor}
              style={[styles.chip, statusRequisitoForm === opcao.valor && styles.chipAtivo]}
              onPress={() => setStatusRequisitoForm(opcao.valor)}
            >
              <Text style={[styles.chipTexto, statusRequisitoForm === opcao.valor && styles.chipTextoAtivo]}>
                {opcao.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={[type.label, styles.campoRotulo]}>Nota mínima (opcional, 0-100)</Text>
        <TextInput
          testID="catalogo-requisito-nota"
          style={styles.input}
          value={notaRequisitoForm}
          onChangeText={setNotaRequisitoForm}
          placeholder="Deixe em branco se não exigir nota"
          keyboardType="numeric"
        />
        <TouchableOpacity
          testID="catalogo-requisito-salvar"
          style={[styles.botao, salvando && styles.botaoDesabilitado]}
          onPress={confirmarSalvarRequisito}
          disabled={salvando}
        >
          {salvando ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.botaoTexto}>{editandoRequisito ? 'Salvar alterações' : 'Adicionar requisito'}</Text>
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
  tituloRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.xl,
    marginBottom: spacing.xs,
  },
  tituloSecao: {
    ...type.subtitle,
    color: colors.text,
  },
  novoBotao: {
    height: touchTarget - 8,
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
  explicacao: {
    ...type.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  campoRotulo: {
    color: colors.textMuted,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  avisoTexto: {
    ...type.caption,
    color: colors.textMuted,
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
});
