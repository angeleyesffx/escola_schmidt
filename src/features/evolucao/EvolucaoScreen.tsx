import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';

import { Dropdown } from '../../components/Dropdown';
import { FormModal } from '../../components/FormModal';
import { RadarChart } from '../../components/RadarChart';
import { PageHeader } from '../../components/PageHeader';
import { Footer } from '../../components/Footer';
import { colors, radius, spacing, type } from '../../constants/theme';
import { uiAssets } from '../../constants/uiAssets';
import { confirmar } from '../../lib/confirmar';
import { getAluno, getContratoAtual, getFrequenciaAluno, type Aluno } from '../alunos/api';
import { getGradeSemanal } from '../chamada/api';
import {
  atribuirMetodologiaAluno,
  AvaliacaoDuplicadaError,
  getCriteriosHabilidades,
  getHistoricoNivelAluno,
  getMetodologiaAtualAluno,
  getMetodologiasAtivas,
  getRequisitosNivel,
  hojeISO,
  registrarAvaliacaoDetalhadaEvolucao,
  registrarAvaliacaoRapidaEvolucao,
  registrarPromocaoNivel,
  getStatusHabilidadesAluno,
} from './api';
import {
  calcularFrequenciaPorPlano,
  calcularPercentualCriterios,
  calcularPontuacaoAluno,
  calcularProgressoNivel,
} from './selectors';
import type {
  CriterioHabilidadeEvolucao,
  HistoricoNivelEvolucao,
  MetodologiaAtualAluno,
  MetodologiaDisponivel,
  ProgressoNivelEvolucao,
  RequisitoNivelEvolucao,
  StatusAtualHabilidade,
  StatusHabilidadeEvolucao,
} from './types';

// Dimensões reais do arquivo — o patim e o texto script ficam do lado direito
// da imagem, então o recorte (quando a tela é estreita) é ancorado na direita
// pra não sumir com eles, no mesmo esquema do banner da Home.
const HERO_BANNER = uiAssets.banner.secundario;
const HERO_BANNER_LARGURA = 2156;
const HERO_BANNER_ALTURA = 729;

type EvolucaoScreenProps = {
  alunoId: string;
  tituloPagina: string;
  nomeFallback: string;
  podeEditar?: boolean;
  professorId?: string | null;
};

const STATUS_AVALIACAO_RAPIDA: { valor: StatusHabilidadeEvolucao; label: string; percentual: number }[] = [
  { valor: 'nao_iniciado', label: 'Não iniciado', percentual: 0 },
  { valor: 'aprendendo', label: 'Aprendendo', percentual: 30 },
  { valor: 'em_desenvolvimento', label: 'Em desenvolvimento', percentual: 65 },
  { valor: 'dominado', label: 'Dominado', percentual: 82 },
  { valor: 'consolidado', label: 'Consolidado', percentual: 95 },
];

function formatarDataBR(dataISO: string) {
  const [ano, mes, dia] = dataISO.split('-');
  return `${dia}/${mes}/${ano}`;
}

function labelTipoHistorico(tipoHistorico: HistoricoNivelEvolucao['tipo']) {
  switch (tipoHistorico) {
    case 'atribuicao_inicial':
      return 'Início da jornada';
    case 'pronto_para_avaliacao':
      return 'Pronto para avaliação';
    case 'aprovado':
      return 'Aprovado';
    case 'reprovado':
      return 'Reprovado';
    case 'promovido':
      return 'Nível conquistado';
    default:
      return 'Atualização';
  }
}

export function EvolucaoScreen({ alunoId, tituloPagina, nomeFallback, podeEditar = false, professorId = null }: EvolucaoScreenProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const heroAltura = 168;
  const heroCardLargura = width - spacing.xl * 2;
  const heroEscala = Math.max(heroCardLargura / HERO_BANNER_LARGURA, heroAltura / HERO_BANNER_ALTURA);
  const heroImagemLargura = HERO_BANNER_LARGURA * heroEscala;
  const heroImagemAltura = HERO_BANNER_ALTURA * heroEscala;

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aluno, setAluno] = useState<Aluno | null>(null);
  const [metodologiaAtual, setMetodologiaAtual] = useState<MetodologiaAtualAluno | null>(null);
  const [nomeNivel, setNomeNivel] = useState<string | null>(null);
  const [nomeMetodologia, setNomeMetodologia] = useState<string | null>(null);
  const [frequencia, setFrequencia] = useState<number | null>(null);
  const [progresso, setProgresso] = useState<ProgressoNivelEvolucao | null>(null);
  const [historico, setHistorico] = useState<HistoricoNivelEvolucao[]>([]);
  const [requisitos, setRequisitos] = useState<RequisitoNivelEvolucao[]>([]);
  const [statusHabilidades, setStatusHabilidades] = useState<StatusAtualHabilidade[]>([]);
  const [criteriosPorHabilidade, setCriteriosPorHabilidade] = useState<Record<string, CriterioHabilidadeEvolucao[]>>({});
  // Status escolhido pelo professor mas ainda não salvo — tocar num chip só
  // marca a intenção; o salvamento de tudo acontece de uma vez só, no botão
  // único do fim do modal (salvarTodasAvaliacoes).
  const [statusSelecionadoPorHabilidade, setStatusSelecionadoPorHabilidade] = useState<
    Record<string, StatusHabilidadeEvolucao>
  >({});
  const [salvandoTudo, setSalvandoTudo] = useState(false);
  // Erro do formulário do modal — separado do `erro` da página, senão uma
  // validação daqui esconderia todo o progresso/radar quando o modal fechar.
  const [erroAvaliacao, setErroAvaliacao] = useState<string | null>(null);
  const [observacoesRapidas, setObservacoesRapidas] = useState<Record<string, string>>({});
  // Antes era um botão à parte que forçava o status pra "em_desenvolvimento"
  // — confuso, porque ignorava o status real escolhido. Agora é só um toggle
  // que viaja junto com qualquer status que o professor tocar.
  const [atencaoPorHabilidade, setAtencaoPorHabilidade] = useState<Record<string, boolean>>({});
  const [valoresCriterios, setValoresCriterios] = useState<Record<string, Record<string, string>>>({});
  // Um único botão abre o modal com todas as habilidades do nível de uma vez
  // — nada de um modal por habilidade. Submeter dentro dele é o único jeito
  // de atualizar radar/progresso/jornada agora.
  const [avaliacaoAberta, setAvaliacaoAberta] = useState(false);
  // Uma habilidade por tela dentro do modal, em carrossel — o professor
  // arrasta pro lado pra passar de habilidade; "Salvar avaliação" só existe
  // na última tela. As bolinhas só refletem/pulam pra posição, quem navega
  // de fato é o swipe do ScrollView horizontal abaixo.
  const [passoAtual, setPassoAtual] = useState(0);
  const [larguraPagina, setLarguraPagina] = useState(0);
  const carrosselRef = useRef<ScrollView>(null);
  // Legenda de status escondida atrás de um "?" — fica disponível sem
  // ocupar espaço fixo na tela o tempo todo.
  const [legendaAberta, setLegendaAberta] = useState(false);
  // Textos explicativos das telas de atribuir/promover/avaliar também vivem
  // atrás de um "?" — o cliente relatou telas poluídas com informação que
  // só precisa aparecer quando pedida.
  const [ajudaAtribuirAberta, setAjudaAtribuirAberta] = useState(false);
  const [ajudaPromocaoAberta, setAjudaPromocaoAberta] = useState(false);
  const [ajudaAvaliacaoRapidaAberta, setAjudaAvaliacaoRapidaAberta] = useState(false);

  // Formulário de "atribuir metodologia" — só relevante pra staff quando o
  // aluno ainda não tem nenhuma (achado 4.2 de evolucao-vs-desempenho.md).
  const [metodologiasDisponiveis, setMetodologiasDisponiveis] = useState<MetodologiaDisponivel[]>([]);
  const [metodologiaSelecionada, setMetodologiaSelecionada] = useState<string | null>(null);
  const [nivelSelecionado, setNivelSelecionado] = useState<string | null>(null);
  const [atribuindo, setAtribuindo] = useState(false);

  // Formulário de "registrar nível conquistado" — só relevante pra staff
  // quando o aluno já tem metodologia ativa (evolucao-vs-desempenho.md,
  // decisão 5: "nível conquistado" vira a fonte da verdade de progressão).
  const [nivelPromocaoSelecionado, setNivelPromocaoSelecionado] = useState<string | null>(null);
  const [promovendo, setPromovendo] = useState(false);

  // `carregar` roda de novo depois de toda avaliação/promoção pra refletir o
  // dado salvo — mas só a primeira carga deve trocar a tela inteira por um
  // spinner. Recarregar em loading=true a cada clique desmonta e remonta
  // todo o conteúdo do ScrollView, o que joga a rolagem de volta pro topo.
  const primeiraCargaRef = useRef(true);

  const carregar = useCallback(async () => {
    const ehPrimeiraCarga = primeiraCargaRef.current;
    if (ehPrimeiraCarga) {
      setLoading(true);
    }
    setErro(null);

    try {
      const [dadosAluno, registrosFrequencia, contratoAtual, gradeSemanal, metodologiaAtual, historicoNivel] = await Promise.all([
        getAluno(alunoId),
        getFrequenciaAluno(alunoId),
        getContratoAtual(alunoId),
        getGradeSemanal(),
        getMetodologiaAtualAluno(alunoId),
        getHistoricoNivelAluno(alunoId),
      ]);

      setAluno(dadosAluno);
      setHistorico(historicoNivel);

      const aulasPorSemana = gradeSemanal.filter((aula) => aula.modulos.includes(dadosAluno.modulo)).length;
      setFrequencia(
        contratoAtual
          ? calcularFrequenciaPorPlano({
              dataInicio: contratoAtual.data_inicio,
              dataFim: contratoAtual.data_fim,
              aulasPorSemana,
              registros: registrosFrequencia,
              hojeISO: hojeISO(),
            })
          : null
      );
      setMetodologiaAtual(metodologiaAtual ?? null);
      setNomeMetodologia(metodologiaAtual?.metodologiaNome ?? null);
      setNomeNivel(metodologiaAtual?.nivelAtualNome ?? null);

      // Serve tanto o formulário de "atribuir" (aluno sem metodologia) quanto
      // o de "promover" (aluno já ativo, escolhendo o próximo nível dentro
      // da mesma metodologia) — os dois usam a mesma lista.
      if (podeEditar) {
        const disponiveis = await getMetodologiasAtivas();
        setMetodologiasDisponiveis(disponiveis);
        setMetodologiaSelecionada((atual) => atual ?? metodologiaAtual?.metodologiaId ?? disponiveis[0]?.id ?? null);
      }

      if (!metodologiaAtual?.nivelAtualId) {
        setProgresso(null);
        setRequisitos([]);
        setStatusHabilidades([]);
        setCriteriosPorHabilidade({});
        return;
      }

      const [requisitosNivel, statusAtual] = await Promise.all([
        getRequisitosNivel(metodologiaAtual.nivelAtualId),
        getStatusHabilidadesAluno(alunoId),
      ]);

      const criterios = await getCriteriosHabilidades(requisitosNivel.map((item) => item.habilidadeId));
      const agrupados = criterios.reduce<Record<string, CriterioHabilidadeEvolucao[]>>((acumulado, criterio) => {
        acumulado[criterio.habilidadeId] = [...(acumulado[criterio.habilidadeId] ?? []), criterio];
        return acumulado;
      }, {});

      setRequisitos(requisitosNivel);
      setStatusHabilidades(statusAtual);
      setCriteriosPorHabilidade(agrupados);
      setProgresso(calcularProgressoNivel(requisitosNivel, statusAtual));
    } catch (error) {
      console.error(error);
      setErro(
        podeEditar
          ? 'Não foi possível carregar a Evolução deste aluno. Confirme se a metodologia e o nível dele já foram configurados e tente novamente.'
          : 'Sua jornada está prestes a começar! Assim que seu professor configurar seu nível, tudo o que você for conquistando vai aparecer aqui.'
      );
    } finally {
      setLoading(false);
      primeiraCargaRef.current = false;
    }
  }, [alunoId, podeEditar]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  // Só chama a RPC — não mexe em loading/erro/modal. Quem orquestra isso é
  // salvarTodasAvaliacoes, que é o único botão de salvar do modal agora.
  async function registrarRapidaInterna(requisito: RequisitoNivelEvolucao, sobrescrever: boolean) {
    const status = statusSelecionadoPorHabilidade[requisito.habilidadeId];
    if (!status) return;
    const preset = STATUS_AVALIACAO_RAPIDA.find((item) => item.valor === status);
    const precisaAtencao = atencaoPorHabilidade[requisito.habilidadeId] ?? false;

    await registrarAvaliacaoRapidaEvolucao({
      alunoId,
      habilidadeId: requisito.habilidadeId,
      metodologiaId: metodologiaAtual!.metodologiaId,
      professorId,
      status,
      percentualGeral: preset?.percentual ?? null,
      precisaAtencao,
      prioridadeTreinamento: precisaAtencao ? 1 : null,
      observacoes: observacoesRapidas[requisito.habilidadeId]?.trim() || null,
      sobrescrever,
    });
  }

  async function registrarDetalhadaInterna(
    requisito: RequisitoNivelEvolucao,
    valoresNumericos: Record<string, number>,
    sobrescrever: boolean
  ) {
    const criterios = criteriosPorHabilidade[requisito.habilidadeId] ?? [];
    const precisaAtencao = atencaoPorHabilidade[requisito.habilidadeId] ?? false;

    await registrarAvaliacaoDetalhadaEvolucao({
      alunoId,
      habilidadeId: requisito.habilidadeId,
      metodologiaId: metodologiaAtual!.metodologiaId,
      professorId,
      observacoes: observacoesRapidas[requisito.habilidadeId]?.trim() || null,
      precisaAtencao,
      prioridadeTreinamento: precisaAtencao ? 1 : null,
      criterios: criterios.map((criterio) => ({
        criterioId: criterio.id,
        percentual: valoresNumericos[criterio.id],
        observacoes: null,
      })),
      dataAvaliacao: undefined,
      sobrescrever,
    });
  }

  // Único botão de salvar do modal: varre todas as habilidades tocadas pelo
  // professor (status escolhido e/ou critérios preenchidos) e submete todas
  // de uma vez. O aviso de sobrescrever só aparece aqui, no fim, e uma única
  // vez pro conjunto inteiro — não mais uma confirmação por habilidade no
  // meio da avaliação.
  async function salvarTodasAvaliacoes(habilidadesParaSobrescrever: Set<string> = new Set()) {
    if (!metodologiaAtual?.metodologiaId) {
      setErroAvaliacao('O aluno precisa ter uma metodologia ativa antes da avaliação.');
      return;
    }

    setErroAvaliacao(null);

    type Pendente = { requisito: RequisitoNivelEvolucao; valoresNumericos?: Record<string, number> };
    const pendentes: Pendente[] = [];

    for (const requisito of requisitos) {
      const criterios = criteriosPorHabilidade[requisito.habilidadeId] ?? [];
      const valoresBrutos = valoresCriterios[requisito.habilidadeId] ?? {};
      const preenchidos = criterios.filter((criterio) => valoresBrutos[criterio.id]?.trim());

      if (criterios.length && preenchidos.length > 0) {
        if (preenchidos.length !== criterios.length) {
          setErroAvaliacao(`Preencha todos os critérios de ${requisito.habilidadeNome} ou deixe todos em branco.`);
          return;
        }

        const valoresNumericos: Record<string, number> = {};
        for (const criterio of criterios) {
          const numero = Number(valoresBrutos[criterio.id]);
          if (Number.isNaN(numero) || numero < 0 || numero > 100) {
            setErroAvaliacao(`Preencha ${criterio.nome} com um valor entre 0 e 100.`);
            return;
          }
          valoresNumericos[criterio.id] = numero;
        }

        pendentes.push({ requisito, valoresNumericos });
        continue;
      }

      if (statusSelecionadoPorHabilidade[requisito.habilidadeId]) {
        pendentes.push({ requisito });
      }
    }

    if (pendentes.length === 0) {
      setErroAvaliacao('Marque ao menos um status ou preencha os critérios de alguma habilidade antes de salvar.');
      return;
    }

    setSalvandoTudo(true);

    const duplicadas: Pendente[] = [];
    const falhas: string[] = [];

    for (const pendente of pendentes) {
      const sobrescrever = habilidadesParaSobrescrever.has(pendente.requisito.habilidadeId);
      try {
        if (pendente.valoresNumericos) {
          await registrarDetalhadaInterna(pendente.requisito, pendente.valoresNumericos, sobrescrever);
        } else {
          await registrarRapidaInterna(pendente.requisito, sobrescrever);
        }
      } catch (error) {
        if (error instanceof AvaliacaoDuplicadaError) {
          duplicadas.push(pendente);
        } else {
          console.error(error);
          falhas.push(pendente.requisito.habilidadeNome);
        }
      }
    }

    setSalvandoTudo(false);

    if (duplicadas.length > 0) {
      confirmar(
        'Avaliação já registrada hoje',
        `${duplicadas.length === 1 ? 'Esta habilidade já tem' : `Estas ${duplicadas.length} habilidades já têm`} avaliação registrada hoje: ${duplicadas
          .map((item) => item.requisito.habilidadeNome)
          .join(', ')}. Sobrescrever?`,
        'Sobrescrever',
        () =>
          salvarTodasAvaliacoes(
            new Set([...habilidadesParaSobrescrever, ...duplicadas.map((item) => item.requisito.habilidadeId)])
          )
      );
      return;
    }

    if (falhas.length > 0) {
      setErroAvaliacao(`Erro ao salvar avaliação de: ${falhas.join(', ')}. Tente novamente.`);
      return;
    }

    setStatusSelecionadoPorHabilidade({});
    setAvaliacaoAberta(false);
    setPassoAtual(0);
    carrosselRef.current?.scrollTo({ x: 0, animated: false });
    await carregar();
  }

  async function atribuirMetodologia() {
    if (!metodologiaSelecionada || !nivelSelecionado) {
      setErro('Escolha a metodologia e o nível antes de atribuir.');
      return;
    }

    setAtribuindo(true);
    setErro(null);

    try {
      await atribuirMetodologiaAluno(alunoId, metodologiaSelecionada, nivelSelecionado);
      setNivelSelecionado(null);
      await carregar();
    } catch (error) {
      console.error(error);
      setErro('Erro ao atribuir metodologia. Tente novamente.');
    } finally {
      setAtribuindo(false);
    }
  }

  async function registrarPromocao() {
    if (!nivelPromocaoSelecionado) {
      setErro('Escolha o nível conquistado antes de confirmar.');
      return;
    }

    setPromovendo(true);
    setErro(null);

    try {
      await registrarPromocaoNivel(alunoId, nivelPromocaoSelecionado);
      setNivelPromocaoSelecionado(null);
      await carregar();
    } catch (error) {
      console.error(error);
      setErro('Erro ao registrar nível conquistado. Tente novamente.');
    } finally {
      setPromovendo(false);
    }
  }

  const requisitoAtual = requisitos[passoAtual];
  const statusAtualRequisitoAtual = requisitoAtual ? statusHabilidades.find((item) => item.habilidadeId === requisitoAtual.habilidadeId) : undefined;
  const nomeExibicaoAluno = aluno?.nome ?? nomeFallback;
  // Indicador complementar ao percentual de progresso — não substitui a
  // barra (docs/product/evolucao-vs-desempenho.md §8.2).
  const pontuacaoAtual = requisitos.length ? calcularPontuacaoAluno(requisitos, statusHabilidades) : null;
  const statusPorHabilidade = new Map(statusHabilidades.map((item) => [item.habilidadeId, item]));
  const metodologiaEscolhida = metodologiasDisponiveis.find((item) => item.id === metodologiaSelecionada) ?? null;
  const metodologiaDoAlunoAtiva = metodologiasDisponiveis.find(
    (item) => item.id === metodologiaAtual?.metodologiaId
  );
  const niveisParaPromocao = (metodologiaDoAlunoAtiva?.niveis ?? []).filter(
    (nivel) => nivel.id !== metodologiaAtual?.nivelAtualId
  );

  return (
    <>
      <PageHeader titulo={tituloPagina} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        <View style={[styles.heroCard, { height: heroAltura }]}>
          <Image
            source={HERO_BANNER}
            style={[
              styles.heroIlustracao,
              {
                width: heroImagemLargura,
                height: heroImagemAltura,
                top: (heroAltura - heroImagemAltura) / 2,
              },
            ]}
          />
          <View style={styles.heroTextoWrap}>
            <Text style={styles.heroTag}>Minha jornada</Text>
            <Text style={styles.heroTitulo}>{nomeExibicaoAluno}</Text>
            <Text style={styles.heroTexto}>
              {nomeNivel
                ? `${nomeNivel}${frequencia != null ? ` · Frequência ${frequencia}%` : ''}`
                : podeEditar
                  ? 'Configure a metodologia e o nível deste aluno para começar a acompanhar a evolução dele.'
                  : 'Sua jornada está prestes a começar. Em breve você vai ver aqui tudo o que já domina e o que ainda vai conquistar.'}
            </Text>
            {nomeMetodologia ? <Text style={styles.heroSubtexto}>{nomeMetodologia}</Text> : null}
          </View>
        </View>

        {loading ? (
          <View style={styles.cardBase}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}

        {!loading && erro ? <Text style={styles.erro}>{erro}</Text> : null}

        {!loading && !erro ? (
          <>
            {podeEditar && !metodologiaAtual ? (
              <View style={styles.cardBase}>
                <View style={styles.legendaCabecalho}>
                  <Text style={styles.cardTag}>Atribuir metodologia</Text>
                  <TouchableOpacity
                    testID="evolucao-botao-ajuda-atribuir"
                    style={styles.botaoAjuda}
                    onPress={() => setAjudaAtribuirAberta((atual) => !atual)}
                    accessibilityRole="button"
                    accessibilityLabel="O que é atribuir metodologia"
                  >
                    <Text style={styles.botaoAjudaTexto}>?</Text>
                  </TouchableOpacity>
                </View>
                {ajudaAtribuirAberta ? (
                  <Text style={styles.cardTexto}>
                    Este aluno ainda não tem metodologia e nível configurados — escolha abaixo para começar a
                    acompanhar a evolução dele.
                  </Text>
                ) : null}

                {metodologiasDisponiveis.length === 0 ? (
                  <Text style={styles.cardTexto}>
                    Nenhuma metodologia ativa cadastrada. Configure uma metodologia no banco antes de atribuir.
                  </Text>
                ) : null}

                {metodologiasDisponiveis.length > 1 ? (
                  <Dropdown
                    testID="evolucao-select-metodologia"
                    placeholder="Metodologia"
                    options={metodologiasDisponiveis.map((item) => ({ value: item.id, label: item.nome }))}
                    value={metodologiaSelecionada}
                    onChange={(valor) => {
                      setMetodologiaSelecionada(valor);
                      setNivelSelecionado(null);
                    }}
                  />
                ) : null}

                {metodologiaEscolhida ? (
                  <View style={styles.statusGrid}>
                    {metodologiaEscolhida.niveis.map((nivel) => {
                      const ativo = nivelSelecionado === nivel.id;
                      return (
                        <TouchableOpacity
                          key={nivel.id}
                          testID={`evolucao-nivel-${nivel.id}`}
                          style={[styles.statusChip, ativo && styles.statusChipAtivo]}
                          onPress={() => setNivelSelecionado(nivel.id)}
                        >
                          <Text style={[styles.statusChipTexto, ativo && styles.statusChipTextoAtivo]}>
                            {nivel.nome}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : null}

                <TouchableOpacity
                  testID="evolucao-botao-atribuir-metodologia"
                  style={[
                    styles.botaoSalvarDetalhado,
                    (!nivelSelecionado || atribuindo) && styles.botaoSecundarioDesabilitado,
                  ]}
                  onPress={atribuirMetodologia}
                  disabled={!nivelSelecionado || atribuindo}
                >
                  {atribuindo ? (
                    <ActivityIndicator color={colors.onPrimary} />
                  ) : (
                    <Text style={styles.botaoSalvarDetalhadoTexto}>Atribuir metodologia e nível</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={styles.cardBase}>
              <Text style={styles.cardTag}>Progresso para o próximo nível</Text>
              <Text style={styles.cardTitulo}>
                {nomeNivel ?? (podeEditar ? 'Nível ainda não configurado' : 'Sua jornada está começando')}
              </Text>
              <Text style={styles.progressoValor}>{progresso?.percentual ?? 0}%</Text>
              <View style={styles.barraFundo}>
                <View style={[styles.barraPreenchida, { width: `${progresso?.percentual ?? 0}%` }]} />
              </View>
              {pontuacaoAtual != null ? (
                <Text style={styles.pontuacaoTexto}>Pontuação atual: {pontuacaoAtual}</Text>
              ) : null}
              <Text style={styles.cardTexto}>
                {progresso
                  ? `${progresso.habilidadesAtingidas} de ${progresso.habilidadesTotais} habilidades atendidas.`
                  : podeEditar
                    ? 'Nenhuma habilidade vinculada a este nível ainda. Cadastre os requisitos para começar a acompanhar o progresso.'
                    : 'Assim que seu professor organizar as habilidades desse nível, seu progresso vai aparecer bem aqui.'}
              </Text>
            </View>

            {podeEditar && metodologiaAtual && niveisParaPromocao.length > 0 ? (
              <View style={styles.cardBase}>
                <View style={styles.legendaCabecalho}>
                  <Text style={styles.cardTag}>Registrar nível conquistado</Text>
                  <TouchableOpacity
                    testID="evolucao-botao-ajuda-promocao"
                    style={styles.botaoAjuda}
                    onPress={() => setAjudaPromocaoAberta((atual) => !atual)}
                    accessibilityRole="button"
                    accessibilityLabel="O que é registrar nível conquistado"
                  >
                    <Text style={styles.botaoAjudaTexto}>?</Text>
                  </TouchableOpacity>
                </View>
                {ajudaPromocaoAberta ? (
                  <Text style={styles.cardTexto}>
                    O sistema indica prontidão, mas não promove sozinho — confirme abaixo quando o aluno conquistar o
                    próximo nível.
                  </Text>
                ) : null}

                <View style={styles.statusGrid}>
                  {niveisParaPromocao.map((nivel) => {
                    const ativo = nivelPromocaoSelecionado === nivel.id;
                    return (
                      <TouchableOpacity
                        key={nivel.id}
                        testID={`evolucao-promocao-nivel-${nivel.id}`}
                        style={[styles.statusChip, ativo && styles.statusChipAtivo]}
                        onPress={() => setNivelPromocaoSelecionado(nivel.id)}
                      >
                        <Text style={[styles.statusChipTexto, ativo && styles.statusChipTextoAtivo]}>
                          {nivel.nome}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  testID="evolucao-botao-registrar-promocao"
                  style={[
                    styles.botaoSalvarDetalhado,
                    (!nivelPromocaoSelecionado || promovendo) && styles.botaoSecundarioDesabilitado,
                  ]}
                  onPress={registrarPromocao}
                  disabled={!nivelPromocaoSelecionado || promovendo}
                >
                  {promovendo ? (
                    <ActivityIndicator color={colors.onPrimary} />
                  ) : (
                    <Text style={styles.botaoSalvarDetalhadoTexto}>Confirmar nível conquistado</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : null}

            {progresso?.focoAtual ? (
              <View style={styles.cardBase}>
                <Text style={styles.cardTag}>Seu foco atual</Text>
                <Text style={styles.cardTitulo}>{progresso.focoAtual.categoriaNome}</Text>
                <Text style={styles.cardTexto}>
                  {progresso.focoAtual.emDesenvolvimento} habilidade(s) em desenvolvimento e {progresso.focoAtual.emAtencao} com atenção prioritária.
                </Text>
              </View>
            ) : null}

            {progresso?.resumoCategorias.length ? (
              <View style={styles.cardBase}>
                <Text style={styles.cardTag}>Radar pedagógico</Text>
                <Text style={styles.cardTexto}>Resumo por macroárea</Text>

                <View style={styles.radarWrap}>
                  <RadarChart
                    eixos={progresso.resumoCategorias.map((categoria) => ({
                      id: categoria.categoriaId,
                      label: categoria.categoriaNome,
                      percentual: categoria.percentual,
                    }))}
                  />
                </View>

                {progresso.resumoCategorias.length < 3 ? (
                  <Text style={styles.legendaStatus}>
                    O radar fica completo a partir de 3 macroáreas cadastradas neste nível — este aqui tem{' '}
                    {progresso.resumoCategorias.length}.
                  </Text>
                ) : null}

                {progresso.resumoCategorias.map((categoria) => (
                  <View key={categoria.categoriaId} style={styles.linhaCategoria}>
                    <View style={styles.linhaCategoriaTopo}>
                      <Text style={styles.categoriaNome}>{categoria.categoriaNome}</Text>
                      <Text style={styles.categoriaPercentual}>{categoria.percentual}%</Text>
                    </View>
                    <View style={styles.barraFundoPequena}>
                      <View style={[styles.barraPreenchida, { width: `${categoria.percentual}%` }]} />
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            {progresso?.faltantes.length ? (
              <View style={styles.cardBase}>
                <Text style={styles.cardTag}>O que falta conquistar</Text>
                {progresso.faltantes.map((faltante) => (
                  <View key={faltante.habilidadeId} style={styles.faltanteItem}>
                    <Text style={styles.faltanteNome}>{faltante.habilidadeNome}</Text>
                    <Text style={styles.faltanteMeta}>{faltante.categoriaNome}</Text>
                    <Text style={styles.cardTexto}>
                      {faltante.statusAtual ? `Status atual: ${faltante.statusAtual.replaceAll('_', ' ')}.` : 'Ainda sem avaliação registrada.'}{' '}
                      Meta: {faltante.statusMinimo.replaceAll('_', ' ')}
                      {faltante.notaMinima != null ? ` · ${faltante.notaMinima}% mínimo` : ''}.
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {podeEditar && requisitos.length ? (
              <View style={styles.cardBase}>
                <View style={styles.legendaCabecalho}>
                  <Text style={styles.cardTag}>Avaliação</Text>
                  <TouchableOpacity
                    testID="evolucao-botao-ajuda-avaliacao-rapida"
                    style={styles.botaoAjuda}
                    onPress={() => setAjudaAvaliacaoRapidaAberta((atual) => !atual)}
                    accessibilityRole="button"
                    accessibilityLabel="Como funciona a avaliação"
                  >
                    <Text style={styles.botaoAjudaTexto}>?</Text>
                  </TouchableOpacity>
                </View>
                {ajudaAvaliacaoRapidaAberta ? (
                  <Text style={styles.cardTexto}>
                    Abra a avaliação pra registrar o status de cada habilidade do nível — ao salvar, o radar, o
                    progresso e a jornada do aluno são atualizados na hora. Veja o detalhe de cada habilidade em "O
                    que falta conquistar".
                  </Text>
                ) : null}

                <TouchableOpacity
                  testID="evolucao-botao-iniciar-avaliacao"
                  style={styles.botaoAvaliar}
                  onPress={() => {
                    setPassoAtual(0);
                    setAvaliacaoAberta(true);
                    carrosselRef.current?.scrollTo({ x: 0, animated: false });
                  }}
                >
                  <Text style={styles.botaoAvaliarTexto}>Iniciar avaliação do aluno</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {historico.length ? (
              <View style={styles.cardBase}>
                <Text style={styles.cardTag}>Histórico</Text>
                {historico.slice(0, 5).map((evento) => (
                  <View key={evento.id} style={styles.historicoItem}>
                    <Text style={styles.historicoTitulo}>{labelTipoHistorico(evento.tipo)}</Text>
                    <Text style={styles.historicoData}>{formatarDataBR(evento.dataEvento)}</Text>
                    {evento.observacoes ? <Text style={styles.cardTexto}>{evento.observacoes}</Text> : null}
                  </View>
                ))}
                <TouchableOpacity
                  testID="evolucao-link-jornada-completa"
                  onPress={() => router.push(`/alunos/${alunoId}/desempenho`)}
                >
                  <Text style={styles.verJornadaLink}>Ver jornada completa</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      <FormModal
        visible={avaliacaoAberta}
        title={`Avaliação de ${nomeExibicaoAluno}`}
        onClose={() => {
          setAvaliacaoAberta(false);
          setErroAvaliacao(null);
          setPassoAtual(0);
          carrosselRef.current?.scrollTo({ x: 0, animated: false });
        }}
        stickyHeader={
          requisitoAtual ? (
            <View style={styles.avaliacaoStickyHeader}>
              <Text style={styles.faltanteNome}>{requisitoAtual.habilidadeNome}</Text>
              <Text style={styles.faltanteMeta}>{requisitoAtual.categoriaNome}</Text>
              <Text style={styles.cardTexto}>
                Atual: {statusAtualRequisitoAtual ? statusAtualRequisitoAtual.statusAtual.replaceAll('_', ' ') : 'sem avaliação'} · Meta: {requisitoAtual.statusMinimo.replaceAll('_', ' ')}
              </Text>
              <View style={styles.carrosselDots}>
                {requisitos.map((item, indice) => (
                  <TouchableOpacity
                    key={item.habilidadeId}
                    testID={`evolucao-dot-${indice}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Ir para a habilidade ${indice + 1} de ${requisitos.length}`}
                    onPress={() => {
                      setPassoAtual(indice);
                      carrosselRef.current?.scrollTo({ x: indice * larguraPagina, animated: true });
                    }}
                    disabled={salvandoTudo}
                    hitSlop={6}
                  >
                    <View style={[styles.dot, indice === passoAtual && styles.dotAtivo]} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null
        }
      >
        <View style={styles.legendaCabecalho}>
          <Text style={styles.cardTag}>Como avaliar</Text>
          <TouchableOpacity
            testID="evolucao-botao-ajuda-status"
            style={styles.botaoAjuda}
            onPress={() => setLegendaAberta((atual) => !atual)}
            accessibilityRole="button"
            accessibilityLabel="Como avaliar e o que significa cada status"
          >
            <Text style={styles.botaoAjudaTexto}>?</Text>
          </TouchableOpacity>
        </View>

        {legendaAberta ? (
          <>
            <Text style={styles.cardTexto}>
              Marque o status (e/ou os critérios) de cada habilidade que quiser avaliar e toque em "Salvar
              avaliação" no fim — o radar, o progresso e a jornada do aluno são atualizados de uma vez só.
            </Text>
            <Text style={styles.legendaStatus}>
              Não iniciado → Aprendendo → Em desenvolvimento → Dominado → Consolidado
            </Text>
          </>
        ) : null}

        {requisitos.length ? (
          <>
            <View onLayout={(evento) => setLarguraPagina(evento.nativeEvent.layout.width)}>
              {larguraPagina > 0 ? (
                <ScrollView
                  ref={carrosselRef}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  scrollEventThrottle={16}
                  onMomentumScrollEnd={(evento) => {
                    const indice = Math.round(evento.nativeEvent.contentOffset.x / larguraPagina);
                    setPassoAtual(indice);
                  }}
                >
                  {requisitos.map((requisito, indice) => {
                    const statusAtual = statusPorHabilidade.get(requisito.habilidadeId);
                    const statusSelecionado = statusSelecionadoPorHabilidade[requisito.habilidadeId];
                    const criterios = criteriosPorHabilidade[requisito.habilidadeId] ?? [];
                    const precisaAtencao = atencaoPorHabilidade[requisito.habilidadeId] ?? false;
                    const valoresBrutos = valoresCriterios[requisito.habilidadeId] ?? {};
                    const valoresNumericos: Record<string, number> = {};
                    for (const criterio of criterios) {
                      const bruto = valoresBrutos[criterio.id];
                      const numero = Number(bruto);
                      if (bruto?.trim() && !Number.isNaN(numero)) {
                        valoresNumericos[criterio.id] = numero;
                      }
                    }
                    const pontuacaoPreview = criterios.length
                      ? calcularPercentualCriterios(criterios, valoresNumericos)
                      : null;
                    const ultimaPagina = indice === requisitos.length - 1;

                    return (
                      <View key={requisito.habilidadeId} style={[styles.avaliacaoItem, { width: larguraPagina }]}>
                        <View style={styles.statusGrid}>
                          {STATUS_AVALIACAO_RAPIDA.map((opcao) => {
                            const ativo = (statusSelecionado ?? statusAtual?.statusAtual) === opcao.valor;
                            return (
                              <TouchableOpacity
                                key={opcao.valor}
                                style={[styles.statusChip, ativo && styles.statusChipAtivo]}
                                onPress={() =>
                                  setStatusSelecionadoPorHabilidade((atual) => ({
                                    ...atual,
                                    [requisito.habilidadeId]: opcao.valor,
                                  }))
                                }
                                disabled={salvandoTudo}
                              >
                                <Text style={[styles.statusChipTexto, ativo && styles.statusChipTextoAtivo]}>{opcao.label}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>

                        <TouchableOpacity
                          style={[
                            styles.botaoAtencao,
                            precisaAtencao && styles.botaoAtencaoAtivo,
                            salvandoTudo && styles.botaoSecundarioDesabilitado,
                          ]}
                          onPress={() =>
                            setAtencaoPorHabilidade((atual) => ({ ...atual, [requisito.habilidadeId]: !precisaAtencao }))
                          }
                          disabled={salvandoTudo}
                        >
                          <Text style={[styles.botaoAtencaoTexto, precisaAtencao && styles.botaoAtencaoTextoAtivo]}>
                            {precisaAtencao ? '⚠ Vai treinar com prioridade' : 'Precisa de atenção?'}
                          </Text>
                        </TouchableOpacity>
                        <Text style={styles.legendaStatus}>
                          Marque isso pra sinalizar que essa habilidade deve ter prioridade nos próximos treinos do aluno.
                        </Text>

                        <TextInput
                          style={styles.inputObservacao}
                          value={observacoesRapidas[requisito.habilidadeId] ?? ''}
                          onChangeText={(texto) => {
                            setObservacoesRapidas((atual) => ({ ...atual, [requisito.habilidadeId]: texto }));
                          }}
                          placeholder="Observação — escreva o que achar necessário, sempre opcional"
                          multiline
                        />

                        {criterios.length ? (
                          <View style={styles.detalheBox}>
                            <Text style={styles.cardTag}>Avaliação detalhada por critério</Text>
                            {criterios.map((criterio) => (
                              <View key={criterio.id} style={styles.criterioLinha}>
                                <View style={styles.criterioTextoWrap}>
                                  <Text style={styles.criterioNome}>{criterio.nome}</Text>
                                  <Text style={styles.criterioPeso}>Peso {criterio.peso}</Text>
                                  {criterio.descricao ? <Text style={styles.cardTexto}>{criterio.descricao}</Text> : null}
                                </View>
                                <TextInput
                                  style={styles.inputCriterio}
                                  value={valoresCriterios[requisito.habilidadeId]?.[criterio.id] ?? ''}
                                  onChangeText={(texto) => {
                                    setValoresCriterios((atual) => ({
                                      ...atual,
                                      [requisito.habilidadeId]: {
                                        ...(atual[requisito.habilidadeId] ?? {}),
                                        [criterio.id]: texto,
                                      },
                                    }));
                                  }}
                                  keyboardType="numeric"
                                  placeholder="0-100"
                                />
                              </View>
                            ))}

                            {pontuacaoPreview != null ? (
                              <Text style={styles.pontuacaoTexto}>Pontuação calculada: {pontuacaoPreview}%</Text>
                            ) : null}
                          </View>
                        ) : null}

                        {ultimaPagina ? (
                          <>
                            {erroAvaliacao ? <Text style={styles.erro}>{erroAvaliacao}</Text> : null}

                            <TouchableOpacity
                              testID="evolucao-botao-salvar-avaliacao"
                              style={[styles.botaoSalvarDetalhado, salvandoTudo && styles.botaoSecundarioDesabilitado]}
                              onPress={() => salvarTodasAvaliacoes()}
                              disabled={salvandoTudo}
                            >
                              {salvandoTudo ? (
                                <ActivityIndicator color={colors.onPrimary} />
                              ) : (
                                <Text style={styles.botaoSalvarDetalhadoTexto}>Salvar avaliação</Text>
                              )}
                            </TouchableOpacity>
                          </>
                        ) : (
                          <Text style={styles.legendaStatus}>Arraste para o lado pra ver a próxima habilidade</Text>
                        )}
                      </View>
                    );
                  })}
                </ScrollView>
              ) : null}
            </View>
          </>
        ) : null}
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
    flexGrow: 1,
    backgroundColor: colors.background,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  heroCard: {
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: colors.surfaceTint,
    overflow: 'hidden',
  },
  heroIlustracao: {
    position: 'absolute',
    right: 0,
  },
  heroTextoWrap: {
    maxWidth: '62%',
    gap: spacing.xs,
    paddingVertical: spacing.lg,
    paddingLeft: spacing.lg,
    zIndex: 1,
  },
  heroTag: {
    ...type.label,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  heroTitulo: {
    ...type.title,
    color: colors.text,
  },
  heroTexto: {
    ...type.body,
    color: colors.textMuted,
  },
  heroSubtexto: {
    ...type.caption,
    color: colors.textMuted,
  },
  cardBase: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardTag: {
    ...type.label,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  cardTitulo: {
    ...type.subtitle,
    color: colors.text,
  },
  cardTexto: {
    ...type.body,
    color: colors.textMuted,
  },
  legendaStatus: {
    ...type.caption,
    color: colors.primary,
  },
  legendaCabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  botaoAjuda: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: colors.surfaceTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoAjudaTexto: {
    ...type.caption,
    color: colors.primary,
    fontWeight: 'bold',
  },
  progressoValor: {
    fontFamily: type.display.fontFamily,
    fontSize: 30,
    lineHeight: 34,
    color: colors.text,
  },
  pontuacaoTexto: {
    ...type.caption,
    color: colors.textMuted,
  },
  barraFundo: {
    height: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  barraFundoPequena: {
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  barraPreenchida: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  radarWrap: {
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  linhaCategoria: {
    gap: spacing.xs,
  },
  linhaCategoriaTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  categoriaNome: {
    ...type.body,
    color: colors.text,
  },
  categoriaPercentual: {
    ...type.subtitle,
    color: colors.primary,
  },
  faltanteItem: {
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.xs,
  },
  faltanteNome: {
    ...type.subtitle,
    color: colors.text,
  },
  faltanteMeta: {
    ...type.caption,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  avaliacaoItem: {
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  avaliacaoStickyHeader: {
    gap: spacing.xs,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  statusChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: colors.surfaceTint,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  statusChipAtivo: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  statusChipTexto: {
    ...type.caption,
    color: colors.primary,
  },
  statusChipTextoAtivo: {
    color: colors.onPrimary,
  },
  inputObservacao: {
    minHeight: 72,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
    color: colors.text,
    textAlignVertical: 'top',
  },
  botaoAvaliar: {
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoAvaliarTexto: {
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
    color: colors.onPrimary,
  },
  carrosselDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
  dotAtivo: {
    width: 20,
    backgroundColor: colors.primary,
  },
  detalheBox: {
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  criterioLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  criterioTextoWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  criterioNome: {
    ...type.body,
    color: colors.text,
  },
  criterioPeso: {
    ...type.caption,
    color: colors.primary,
  },
  inputCriterio: {
    width: 82,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
    color: colors.text,
    textAlign: 'center',
  },
  botaoSalvarDetalhado: {
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoSalvarDetalhadoTexto: {
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
    color: colors.onPrimary,
  },
  botaoAtencao: {
    alignSelf: 'flex-start',
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  botaoAtencaoTexto: {
    ...type.caption,
    color: colors.danger,
  },
  botaoAtencaoAtivo: {
    backgroundColor: colors.danger,
  },
  botaoAtencaoTextoAtivo: {
    color: colors.onPrimary,
  },
  botaoSecundarioDesabilitado: {
    opacity: 0.6,
  },
  historicoItem: {
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.xs,
  },
  historicoTitulo: {
    ...type.subtitle,
    color: colors.text,
  },
  historicoData: {
    ...type.caption,
    color: colors.textMuted,
  },
  verJornadaLink: {
    ...type.caption,
    color: colors.primary,
    marginTop: spacing.sm,
  },
  erro: {
    ...type.body,
    color: colors.danger,
  },
});