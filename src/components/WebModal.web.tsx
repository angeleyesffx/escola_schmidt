import { router } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '../constants/theme';

type Props = {
  children: ReactNode;
};

export function WebModal({ children }: Props) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && router.canGoBack()) router.back();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function dismiss() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  return (
    <View style={styles.overlay}>
      <Pressable accessibilityLabel="Fechar modal" onPress={dismiss} style={StyleSheet.absoluteFill} />
      <View role="dialog" style={styles.dialog}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.38)',
    padding: spacing.lg,
  },
  dialog: {
    width: '100%',
    maxWidth: 720,
    height: '88%',
    overflow: 'hidden',
    borderRadius: radius.lg,
    backgroundColor: colors.background,
  },
});
