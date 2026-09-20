import { useRouter } from 'expo-router';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';

import { getAulasRecorrentesHoje } from '../../src/features/chamada/api';
import { useAuth } from '../../src/features/auth/AuthProvider';
import { useAsyncData } from '../../src/hooks/useAsyncData';
import { PageHeader } from '../../src/components/PageHeader';
import { Footer } from '../../src/components/Footer';
import { colors, radius, spacing, touchTarget, type } from '../../src/constants/theme';
import { uiAssets } from '../../src/constants/uiAssets';

const CARD_ILUSTRACOES = {
  calendario: uiAssets.card.calendario,
  chamada: uiAssets.card.chamada,
  alunos: uiAssets.card.alunos,
  evolucao: uiAssets.card.desempenho,
} as const;

const HERO_BANNER = uiAssets.banner.hero;
// Dimensões reais do arquivo (assets/banner-hero.png) — a patinadora fica do
// lado direito da imagem (não centralizada), então um "cover" comum, que
// corta os dois lados igualmente, some com ela em telas estreitas. Em vez
// disso, a gente calcula a mesma escala do cover, mas ancora o recorte na
// direita, cortando só o degradê vazio da esquerda.
const HERO_IMG_LARGURA = 2064;
const HERO_IMG_ALTURA = 512;

export default function Home() {
  const { meuPapel } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const souAluno = (meuPapel === 'aluno' || meuPapel === 'responsavel');
  const duasColunas = width >= 760;
  const larguraGrid = Math.min(width - spacing.xl * 2, 980);
  const heroAltura = width >= 980 ? 192 : width >= 760 ? 176 : 168;
  const heroEscala = Math.max(larguraGrid / HERO_IMG_LARGURA, heroAltura / HERO_IMG_ALTURA);
  const heroImagemLargura = HERO_IMG_LARGURA * heroEscala;
  const heroImagemAltura = HERO_IMG_ALTURA * heroEscala;
  const cardMinHeight = width >= 900 ? 300 : width >= 640 ? 260 : 210;
  const imagemLado = width >= 900 ? 150 : width >= 640 ? 130 : 100;
  // Ligeiramente maior que o wrap (que corta com overflow: hidden) — as
  // ilustrações já vêm com fundo/cantos redondos prontos, então preenchendo
  // até a borda some com o fundo azulado do "iconWell" por trás.
  const imagemIcone = imagemLado + 6;
  const cardPadding = width >= 900 ? spacing.xl : spacing.lg;

  const { data } = useAsyncData(() => getAulasRecorrentesHoje(new Date().getDay()), [], { enabled: !souAluno });
  const aulasHoje = data ?? [];

  function abrirListaChamada() {
    if (aulasHoje.length === 1) {
      router.push(`/chamada/${aulasHoje[0].id}`);
      return;
    }
    router.push('/chamada/lista');
  }

  return (
    <>
      <PageHeader titulo="Escola Schmidt" mostrarVoltar={false} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        <View style={[styles.heroSombra, { width: larguraGrid }]}>
          <View style={[styles.heroCard, { minHeight: heroAltura }]}>
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
              <Text style={styles.heroTag}>Painel</Text>
              <Text style={styles.heroTitulo}>Bem-vinda à Escola Schmidt</Text>
              <Text style={styles.heroTexto}>
                {souAluno ? 'Acesse sua agenda e acompanhe seu progresso.' : 'Organize chamadas e acompanhe suas turmas.'}
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.grid, { width: larguraGrid }]}>
          <TouchableOpacity
            style={[styles.cardAcao, duasColunas && styles.cardAcaoMetade, { minHeight: cardMinHeight, padding: cardPadding }]}
            onPress={() => router.push('/chamada')}
          >
            <View style={[styles.cardImagemWrap, { width: imagemLado, height: imagemLado }]}> 
              <Image source={CARD_ILUSTRACOES.calendario} style={[styles.cardImagem, { width: imagemIcone, height: imagemIcone }]} />
            </View>
            <Text style={styles.cardTitulo}>Agenda</Text>
            <Text style={styles.cardTexto}>Visualize semanas, meses e eventos.</Text>
            <View style={styles.cardAcaoRodape}>
              <Text style={styles.cardAcaoTexto}>Acessar agenda</Text>
              <View style={styles.cardAcaoSetaWrap}>
                <Text style={styles.cardAcaoSeta}>›</Text>
              </View>
            </View>
          </TouchableOpacity>

          {souAluno ? (
            <TouchableOpacity
              style={[styles.cardAcao, duasColunas && styles.cardAcaoMetade, { minHeight: cardMinHeight, padding: cardPadding }]}
              onPress={() => router.push('/minha-evolucao')}
            >
              <View style={[styles.cardImagemWrap, { width: imagemLado, height: imagemLado }]}> 
                <Image source={CARD_ILUSTRACOES.evolucao} style={[styles.cardImagem, { width: imagemIcone, height: imagemIcone }]} />
              </View>
              <Text style={styles.cardTitulo}>Minha evolução</Text>
              <Text style={styles.cardTexto}>Veja progresso, habilidades e próximos objetivos.</Text>
              <View style={styles.cardAcaoRodape}>
                <Text style={styles.cardAcaoTexto}>Abrir evolução</Text>
                <View style={styles.cardAcaoSetaWrap}>
                  <Text style={styles.cardAcaoSeta}>›</Text>
                </View>
              </View>
            </TouchableOpacity>
          ) : null}

          {!souAluno ? (
            <TouchableOpacity
              style={[
                styles.cardAcao,
                duasColunas && styles.cardAcaoMetade,
                { minHeight: cardMinHeight, padding: cardPadding },
                aulasHoje.length === 0 && styles.cardAcaoOpaco,
              ]}
              onPress={abrirListaChamada}
            >
              <View style={[styles.cardImagemWrap, { width: imagemLado, height: imagemLado }]}>
                <Image source={CARD_ILUSTRACOES.chamada} style={[styles.cardImagem, { width: imagemIcone, height: imagemIcone }]} />
              </View>
              <Text style={styles.cardTitulo}>Lista de chamada</Text>
              <Text style={styles.cardTexto}>
                {aulasHoje.length === 0 ? 'Sem turmas agendadas para hoje.' : 'Abra a chamada das turmas de hoje.'}
              </Text>
              <View style={styles.cardAcaoRodape}>
                <Text style={styles.cardAcaoTexto}>
                  {aulasHoje.length === 0 ? 'Ver agenda completa' : 'Ver turmas'}
                </Text>
                <View style={styles.cardAcaoSetaWrap}>
                  <Text style={styles.cardAcaoSeta}>›</Text>
                </View>
              </View>
            </TouchableOpacity>
          ) : null}

          {!souAluno ? (
            <TouchableOpacity
              style={[styles.cardAcao, duasColunas && styles.cardAcaoMetade, { minHeight: cardMinHeight, padding: cardPadding }]}
              onPress={() => router.push('/alunos')}
            >
              <View style={[styles.cardImagemWrap, { width: imagemLado, height: imagemLado }]}> 
                <Image source={CARD_ILUSTRACOES.alunos} style={[styles.cardImagem, { width: imagemIcone, height: imagemIcone }]} />
              </View>
              <Text style={styles.cardTitulo}>Alunos</Text>
              <Text style={styles.cardTexto}>Gerencie cadastros e histórico.</Text>
              <View style={styles.cardAcaoRodape}>
                <Text style={styles.cardAcaoTexto}>Gerenciar alunos</Text>
                <View style={styles.cardAcaoSetaWrap}>
                  <Text style={styles.cardAcaoSeta}>›</Text>
                </View>
              </View>
            </TouchableOpacity>
          ) : null}
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
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
    backgroundColor: colors.background,
  },
  // Sombra e "overflow: hidden" não convivem bem na mesma View em dispositivo
  // (a sombra soma "elevation" no Android, que ignora o recorte e deixa a
  // imagem vazar por cima da borda arredondada) — por isso a sombra fica numa
  // View de fora, e quem recorta a imagem é uma View de dentro, sem sombra.
  heroSombra: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  heroCard: {
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  heroIlustracao: {
    position: 'absolute',
    right: 0,
  },
  heroTextoWrap: {
    maxWidth: '58%',
    minWidth: 200,
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  cardAcao: {
    flexGrow: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
    justifyContent: 'space-between',
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 4,
  },
  cardAcaoMetade: {
    width: '48.8%',
  },
  // Sem aula hoje o toque ainda leva pra agenda completa (não "some"), mas
  // precisa parecer diferente de um card com ação disponível agora.
  cardAcaoOpaco: {
    opacity: 0.6,
  },
  cardImagemWrap: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cardImagem: {
    resizeMode: 'contain',
  },
  cardTitulo: {
    ...type.subtitle,
    color: colors.text,
  },
  cardTexto: {
    ...type.body,
    color: colors.textMuted,
  },
  cardAcaoRodape: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardAcaoTexto: {
    fontFamily: type.subtitle.fontFamily,
    fontSize: 31 / 2,
    lineHeight: 22,
    color: colors.primary,
  },
  cardAcaoSetaWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardAcaoSeta: {
    color: colors.primary,
    fontSize: 30,
    lineHeight: 30,
    marginTop: -3,
    fontFamily: type.subtitle.fontFamily,
  },
  button: {
    minHeight: touchTarget,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: colors.onPrimary,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
  buttonDesabilitado: {
    opacity: 0.5,
  },
});
