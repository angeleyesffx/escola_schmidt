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

// Confirmação padrão pra exclusão permanente (hard delete) — usada pelo
// ícone de lixeira de RowActions. Nome em inglês por ser código novo desta
// tarefa; reaproveita `confirmar()` acima, que já existe.
export function confirmDelete(nomeEntidade: string, onConfirm: () => void) {
  confirmar(
    `Excluir ${nomeEntidade}`,
    `Tem certeza que deseja excluir ${nomeEntidade} permanentemente? Essa ação não pode ser desfeita.`,
    'Excluir',
    onConfirm
  );
}

// Confirmação padrão ao salvar uma edição feita num FormModal.
export function confirmSave(onConfirm: () => void) {
  confirmar('Salvar alterações', 'Tem certeza que deseja salvar essas alterações?', 'Salvar', onConfirm);
}
