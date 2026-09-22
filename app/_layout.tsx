import { useFonts, Montserrat_600SemiBold, Montserrat_700Bold } from '@expo-google-fonts/montserrat';
import { Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold } from '@expo-google-fonts/poppins';
import { Slot, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';

import { AuthProvider } from '../src/features/auth/AuthProvider';
import { colors, radius, spacing, type } from '../src/constants/theme';

SplashScreen.preventAutoHideAsync();

const DURACAO_MINIMA_ABERTURA_MS = 2600;
const DURACAO_MAXIMA_ABERTURA_MS = 9000;

const VIDEO_ABERTURA_SOURCE: number = require('../assets/opening.mp4');

// Variável de módulo (não state) de propósito: sobrevive a re-renders e a
// remounts do RootLayout dentro do mesmo processo JS (ex.: Fast Refresh do
// Metro em dev), então a abertura só toca de novo se o app for realmente
// reaberto do zero — não a cada navegação ou hot reload.
let jaExibiuAbertura = false;

// Captura erros que aconteceriam antes de qualquer tela renderizar (ex.: envs
// do Supabase faltando no build) e mostra uma mensagem em vez de o app
// simplesmente fechar sem explicação.
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>Não foi possível abrir o app</Text>
      <Text style={styles.errorMessage}>{error.message}</Text>
      <Pressable style={styles.retryButton} onPress={retry}>
        <Text style={styles.retryButtonText}>Tentar novamente</Text>
      </Pressable>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
  });
  const [aberturaMinimaConcluida, setAberturaMinimaConcluida] = useState(jaExibiuAbertura);
  const [aberturaForcadaConcluida, setAberturaForcadaConcluida] = useState(jaExibiuAbertura);
  const [videoFinalizado, setVideoFinalizado] = useState(jaExibiuAbertura);
  const player = useVideoPlayer(VIDEO_ABERTURA_SOURCE, (p) => {
    p.loop = false;
    p.muted = true;
  });

  const aberturaConcluida = aberturaForcadaConcluida || (aberturaMinimaConcluida && videoFinalizado);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    if (aberturaConcluida) {
      jaExibiuAbertura = true;
    }
  }, [aberturaConcluida]);

  useEffect(() => {
    if (!fontsLoaded || jaExibiuAbertura) return;
    setVideoFinalizado(false);
    setAberturaMinimaConcluida(false);
    setAberturaForcadaConcluida(false);
    // Build de release já visto derrubando o app inteiro num FunctionCall
    // Exception/NotFoundException do ExpoModulesCore quando o objeto nativo
    // do player some antes do esperado — a abertura é só cosmética, então
    // qualquer chamada nele (aqui, no listener e no cleanup abaixo) nunca
    // pode ser motivo pra crashar o app: se falhar, só pula a abertura.
    let subscription: { remove: () => void } | undefined;
    try {
      player.currentTime = 0;
      player.play();
      subscription = (
        player as unknown as {
          addListener?: (eventName: 'playToEnd', callback: () => void) => { remove: () => void };
        }
      ).addListener?.('playToEnd', () => setVideoFinalizado(true));
    } catch (err) {
      console.error(err);
      setVideoFinalizado(true);
    }

    const timerMinimo = setTimeout(() => setAberturaMinimaConcluida(true), DURACAO_MINIMA_ABERTURA_MS);
    const timerForcado = setTimeout(() => setAberturaForcadaConcluida(true), DURACAO_MAXIMA_ABERTURA_MS);

    return () => {
      clearTimeout(timerMinimo);
      clearTimeout(timerForcado);
      subscription?.remove();
      // Mesmo motivo do try/catch acima: no teardown, o player pode já ter
      // sido liberado pelo lado nativo — chamar pause() nele então é só
      // ruído, nunca motivo pra derrubar o app.
      try {
        player.pause();
      } catch (err) {
        console.error(err);
      }
    };
  }, [fontsLoaded, player]);

  if (!fontsLoaded) {
    return null;
  }

  if (!aberturaConcluida) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <View style={styles.loadingContainer}>
          {VIDEO_ABERTURA_SOURCE ? (
            <VideoView
              style={styles.loadingVideo}
              player={player}
              nativeControls={false}
              contentFit="cover"
              playsInline
              useExoShutter={false}
            />
          ) : (
            <View style={styles.loadingFallback}>
              <Image source={require('../assets/marca-escola-schmidt.png')} style={styles.loadingLogo} />
              <Text style={styles.loadingTexto}>Preparando sua experiência...</Text>
            </View>
          )}
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <View style={styles.moldura}>
        <View style={styles.app}>
          <AuthProvider>
            <Slot />
          </AuthProvider>
        </View>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  // Sem contraste de cor entre moldura e app — um cinza chapado ao redor de
  // uma coluna estreita lia como "tela quebrada", não como layout intencional.
  moldura: {
    flex: 1,
    backgroundColor: colors.background,
  },
  app: {
    flex: 1,
    width: '100%',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  errorTitle: {
    ...type.title,
    color: colors.text,
    textAlign: 'center',
  },
  errorMessage: {
    ...type.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  retryButtonText: {
    ...type.subtitle,
    color: colors.onPrimary,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingVideo: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  loadingFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  loadingLogo: {
    width: 180,
    height: 180,
    resizeMode: 'contain',
  },
  loadingTexto: {
    ...type.subtitle,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
