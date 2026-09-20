import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Animated, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { uiAssets } from '../constants/uiAssets';
import { useAuth } from '../features/auth/AuthProvider';
import { PersonIcon } from './PersonIcon';
import { colors, radius, spacing, touchTarget, type } from '../constants/theme';

const LARGURA_DRAWER = 300;
const DURACAO_ANIMACAO = 240;

type ItemMenu =
  | { label: string; href: string; icon: number; pessoa?: false }
  | { label: string; href: string; pessoa: true };

type Props = {
  /** barra = ícone sobre header primário; claro = fundo pálido (legado) */
  variante?: 'barra' | 'escuro' | 'claro';
};

const ROTULO_PAPEL: Record<string, string> = {
  dono: 'Dono',
  professor: 'Professor(a)',
  aluno: 'Aluno',
};

export function QuickMenu({ variante = 'barra' }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, meuPapel, meuAluno, signOut } = useAuth();
  const [montado, setMontado] = useState(false);
  const [aberto, setAberto] = useState(false);
  const translateX = useRef(new Animated.Value(LARGURA_DRAWER)).current;

  useEffect(() => {
    if (!montado) return;
    Animated.timing(translateX, {
      toValue: aberto ? 0 : LARGURA_DRAWER,
      duration: DURACAO_ANIMACAO,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !aberto) setMontado(false);
    });
  }, [aberto, montado, translateX]);

  const souAluno = (meuPapel === 'aluno' || meuPapel === 'responsavel');
  const souEquipe = meuPapel === 'dono' || meuPapel === 'professor';
  const souDono = meuPapel === 'dono';

  const itens: ItemMenu[] = [
    { label: 'Início', href: '/', icon: uiAssets.card.inicio },
    { label: 'Agenda', href: '/chamada', icon: uiAssets.card.calendario },
    { label: 'Eventos', href: '/eventos', icon: uiAssets.card.eventos },
  ];

  if (souEquipe) {
    itens.push({ label: 'Alunos', href: '/alunos', icon: uiAssets.card.alunos });
    itens.push({ label: 'Chamada', href: '/chamada/lista', icon: uiAssets.card.chamada });
    itens.push({
      label: souDono ? 'Horários por professor' : 'Horários livres',
      href: '/chamada/disponibilidade',
      icon: uiAssets.card.calendario,
    });
    itens.push({
      label: souDono ? 'Módulos por professor' : 'Meus módulos',
      href: '/chamada/modulos',
      icon: uiAssets.card.chamada,
    });
  }

  if (souDono) {
    itens.push({ label: 'Usuários', href: '/usuarios', icon: uiAssets.card.perfil });
    itens.push({ label: 'Catálogo de Evolução', href: '/catalogo-evolucao', icon: uiAssets.card.desempenho });
  } else if (meuPapel === 'professor') {
    itens.push({ label: 'Convidar usuário', href: '/usuarios/novo', icon: uiAssets.card.perfil });
  }

  if (souAluno) {
    itens.push({ label: 'Minha evolução', href: '/minha-evolucao', icon: uiAssets.card.desempenho });
    if (meuAluno) {
      itens.push({
        label: 'Frequência',
        href: `/alunos/${meuAluno.id}/frequencia`,
        icon: uiAssets.card.frequencia,
      });
    }
  }

  itens.push({ label: 'Meu perfil', href: '/perfil', pessoa: true });

  function abrir() {
    setMontado(true);
    setAberto(true);
  }

  function fechar() {
    setAberto(false);
  }

  function navegar(href: string) {
    fechar();
    router.push(href);
  }

  async function sair() {
    fechar();
    await signOut();
  }

  const opacidadeOverlay = translateX.interpolate({
    inputRange: [0, LARGURA_DRAWER],
    outputRange: [1, 0],
  });

  return (
    <View>
      <TouchableOpacity
        style={[
          styles.botao,
          variante === 'barra' && styles.botaoBarra,
          variante === 'claro' && styles.botaoClaro,
        ]}
        onPress={abrir}
        accessibilityLabel="Menu"
      >
        <View style={styles.hamburguer}>
          <View style={styles.hamburguerBarra} />
          <View style={styles.hamburguerBarra} />
          <View style={styles.hamburguerBarra} />
        </View>
      </TouchableOpacity>

      <Modal visible={montado} transparent animationType="none" onRequestClose={fechar}>
        <View style={styles.overlayContainer}>
          <Animated.View style={[styles.overlayFundo, { opacity: opacidadeOverlay }]}>
            <TouchableOpacity style={styles.overlayToque} activeOpacity={1} onPress={fechar} />
          </Animated.View>

          <Animated.View
            style={[styles.drawer, { paddingTop: insets.top + spacing.lg, transform: [{ translateX }] }]}
          >
            <View style={styles.drawerTopo}>
              <Text style={styles.menuTitle}>Menu</Text>
              <TouchableOpacity style={styles.fecharBotao} onPress={fechar} accessibilityLabel="Fechar menu">
                <Text style={styles.fecharBotaoTexto}>✕</Text>
              </TouchableOpacity>
            </View>

            {session ? (
              <TouchableOpacity style={styles.perfilRow} onPress={() => navegar('/perfil')}>
                <View style={styles.perfilAvatar}>
                  <Text style={styles.perfilAvatarTexto}>
                    {(meuAluno?.nome ?? session.user.email ?? '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.perfilTextos}>
                  <Text style={styles.perfilNome} numberOfLines={1}>
                    {meuAluno?.nome ?? session.user.email}
                  </Text>
                  <Text style={styles.perfilPapel} numberOfLines={1}>
                    {meuPapel ? ROTULO_PAPEL[meuPapel] ?? meuPapel : session.user.email}
                  </Text>
                </View>
              </TouchableOpacity>
            ) : null}

            <View style={styles.drawerConteudo}>
              {itens.map((item) => (
                <TouchableOpacity key={`${item.href}-${item.label}`} style={styles.item} onPress={() => navegar(item.href)}>
                  <View style={styles.itemCard}>
                    {item.pessoa ? (
                      <PersonIcon size={60} color={colors.primary} />
                    ) : (
                      <Image source={item.icon} style={styles.itemIcone} resizeMode="contain" />
                    )}
                  </View>
                  <Text style={styles.itemTexto}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.drawerRodape}>
              <View style={styles.separador} />
              <TouchableOpacity style={styles.itemSair} onPress={sair}>
                <View style={styles.itemCardSair}>
                  <Image source={uiAssets.card.logout} style={styles.itemIconeSair} resizeMode="contain" />
                </View>
                <Text style={[styles.itemTexto, styles.sairTexto]}>Sair</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  botao: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoBarra: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  botaoClaro: {
    backgroundColor: 'rgba(255, 255, 255, 0.24)',
  },
  hamburguer: {
    width: 22,
    height: 14,
    justifyContent: 'space-between',
  },
  hamburguerBarra: {
    height: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.onPrimary,
  },
  overlayContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  overlayFundo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  overlayToque: {
    flex: 1,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: LARGURA_DRAWER,
    maxWidth: '85%',
    backgroundColor: '#EAF8FB',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 12,
  },
  drawerTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.lg,
    marginBottom: spacing.sm,
  },
  menuTitle: {
    color: colors.primary,
    fontFamily: type.title.fontFamily,
    fontSize: 24,
    lineHeight: 30,
  },
  fecharBotao: {
    width: touchTarget - 16,
    height: touchTarget - 16,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0, 180, 204, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fecharBotaoTexto: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  perfilRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.52)',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  perfilAvatar: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  perfilAvatarTexto: {
    color: colors.onPrimary,
    fontFamily: type.title.fontFamily,
    fontSize: 18,
  },
  perfilTextos: {
    flex: 1,
  },
  perfilNome: {
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
    color: colors.text,
  },
  perfilPapel: {
    color: colors.textMuted,
    marginTop: 2,
  },
  drawerConteudo: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  item: {
    width: '47%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(0,180,204,0.12)',
  },
  itemSair: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  itemCard: {
    width: 74,
    height: 74,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  itemCardSair: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: '#D8F3FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemIcone: {
    // As ilustrações já vêm com fundo/cantos arredondados prontos. Um pouco
    // maior que o cartão (que corta com overflow: hidden) garante que preencha
    // tudo até a borda arredondada, sem sobrar uma "caixinha" menor flutuando
    // dentro do cartão maior nem uma fresta sem imagem na borda.
    width: 80,
    height: 80,
  },
  itemIconeSair: {
    width: 26,
    height: 26,
  },
  drawerRodape: {
    paddingTop: spacing.sm,
  },
  itemTexto: {
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
    color: colors.text,
    textAlign: 'center',
  },
  separador: {
    height: 1,
    backgroundColor: 'rgba(0,180,204,0.18)',
    marginBottom: spacing.sm,
  },
  sairTexto: {
    color: colors.danger,
    textAlign: 'left',
  },
});
