import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';

import { DateRangePicker } from '../../../components/DateRangePicker';

type Props = {
  dataISO: string;
  onSelecionarData: (data: Date) => void;
  onFechar: () => void;
};

// O seletor da Agenda usa o mesmo padrão de rodas de data dos demais fluxos.
// A Agenda mantém o modal externo, mas não duplica a implementação do picker.
export function PickerMesInline({ dataISO, onSelecionarData, onFechar }: Props) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onFechar}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onFechar} />
        <View style={styles.pickerInline}>
          <DateRangePicker
            apenasUmDia
            inicioISO={dataISO}
            fimISO={dataISO}
            onConfirmar={(inicio) => {
              onSelecionarData(new Date(`${inicio}T00:00:00`));
            }}
            onFechar={onFechar}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    padding: 16,
  },
  pickerInline: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
});
