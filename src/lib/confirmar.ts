import { Alert, Platform } from 'react-native';

// react-native-web não implementa Alert.alert de verdade — é um stub vazio
// (node_modules/react-native-web/src/exports/Alert/index.js: `static alert() {}`),
// então nenhum botão (nem o de confirmar) nunca é chamado. Sem isso, qualquer
// exclusão/cancelamento que dependa de confirmação trava silenciosamente
// quando testado no navegador, sem erro nem diálogo nenhum.
export function confirmar(titulo: string, mensagem: string, textoConfirmar: string, onConfirmar: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${titulo}\n\n${mensagem}`)) {
      onConfirmar();
    }
    return;
  }

  Alert.alert(titulo, mensagem, [
    { text: 'Cancelar', style: 'cancel' },
    { text: textoConfirmar, style: 'destructive', onPress: onConfirmar },
  ]);
}
