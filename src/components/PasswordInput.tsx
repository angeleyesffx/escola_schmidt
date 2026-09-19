import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View, type TextInputProps } from 'react-native';

import { colors, touchTarget } from '../constants/theme';

type Props = Omit<TextInputProps, 'secureTextEntry'>;

export function PasswordInput({ style, testID, ...props }: Props) {
  const [visivel, setVisivel] = useState(false);

  return (
    <View style={styles.wrap}>
      <TextInput {...props} testID={testID} style={[style, styles.inputComOlho]} secureTextEntry={!visivel} />
      <TouchableOpacity
        style={styles.olhoBotao}
        onPress={() => setVisivel((atual) => !atual)}
        accessibilityLabel={visivel ? 'Ocultar senha' : 'Mostrar senha'}
        testID={testID ? `${testID}-toggle` : undefined}
        hitSlop={8}
      >
        <Ionicons name={visivel ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    justifyContent: 'center',
  },
  inputComOlho: {
    paddingRight: touchTarget,
  },
  olhoBotao: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
