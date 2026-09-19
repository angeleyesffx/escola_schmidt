/**
 * Design tokens da Escola Schmidt.
 * Único lugar onde cor, tipografia e espaçamento são definidos.
 * Nenhum componente deve escrever hex, tamanho de fonte ou margem na mão.
 */

export const colors = {
  // Identidade
  primary: '#00B4CC',
  primarySoft: '#7DD4E4',
  surfaceTint: '#E6F7FA',
  /** Fundo suave dos blocos de ícone — um pouco mais saturado que o tint de superfície */
  iconWell: '#D4EFF5',
  surface: '#FFFFFF',
  text: '#333333',

  // Derivados de uso
  textMuted: '#6B7280',
  border: '#DCE7EB',
  background: '#F7FBFC',
  /** Sombra / profundidade leve nos cards da home */
  cardShadow: '#0AA4BF',

  // Estados da chamada — a lista precisa ser lida de relance
  present: '#1BA97B',
  absent: '#C4453D',
  justified: '#D99A2B',
  pending: '#B7C4C9',

  // "Conforme esperado" no desempenho — neutro-positivo, por isso não usa o
  // âmbar de "justified" (que carrega um sentido de ausência abonada).
  onTrack: '#3B82C4',

  // Feedback de sistema
  danger: '#C4453D',
  onPrimary: '#FFFFFF',
} as const;

/**
 * Montserrat carrega os títulos (mais geométrica, presença de marca).
 * Poppins carrega texto e interface (melhor legibilidade em tamanho pequeno).
 */
export const fonts = {
  heading: 'Montserrat_600SemiBold',
  headingBold: 'Montserrat_700Bold',
  body: 'Poppins_400Regular',
  bodyMedium: 'Poppins_500Medium',
  bodySemiBold: 'Poppins_600SemiBold',
} as const;

export const type = {
  display: { fontFamily: fonts.headingBold, fontSize: 28, lineHeight: 34 },
  title: { fontFamily: fonts.heading, fontSize: 20, lineHeight: 26 },
  subtitle: { fontFamily: fonts.bodySemiBold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16 },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
} as const;

/** Altura mínima de alvo de toque. A chamada é feita em pé, com luva, na beira da pista. */
export const touchTarget = 56;

export const theme = { colors, fonts, type, spacing, radius, touchTarget } as const;

export type Theme = typeof theme;
