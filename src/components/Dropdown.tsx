import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { normalizar } from '../lib/texto';
import { colors, radius, spacing, touchTarget, type } from '../constants/theme';

export type DropdownOption = {
  value: string;
  label: string;
  sublabel?: string;
};

type PropsComuns = {
  options: DropdownOption[];
  placeholder: string;
  searchable?: boolean;
  testID?: string;
  vazio?: string;
};

type PropsUnica = PropsComuns & {
  multiple?: false;
  value: string | null;
  onChange: (value: string) => void;
};

type PropsMultipla = PropsComuns & {
  multiple: true;
  value: string[];
  onChange: (value: string[]) => void;
};

type Props = PropsUnica | PropsMultipla;

/** Campo de seleção com painel inline (abre/fecha embaixo do botão) — mesmo
 * padrão de expansão inline já usado no calendário e no DateRangePicker,
 * pra não introduzir Modal/Picker nativo à parte. */
export function Dropdown(props: Props) {
  const { options, placeholder, searchable = false, testID, vazio = 'Nenhuma opção disponível.' } = props;
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');

  const selecionados = props.multiple ? props.value : props.value ? [props.value] : [];
  const rotulo = selecionados.length
    ? options
        .filter((o) => selecionados.includes(o.value))
        .map((o) => o.label)
        .join(', ')
    : placeholder;

  const opcoesFiltradas = busca.trim()
    ? options.filter((o) => normalizar(o.label).includes(normalizar(busca)))
    : options;

  function escolher(valor: string) {
    if (props.multiple) {
      const atual = props.value;
      const proximo = atual.includes(valor) ? atual.filter((v) => v !== valor) : [...atual, valor];
      props.onChange(proximo);
      return;
    }
    props.onChange(valor);
    setAberto(false);
    setBusca('');
  }

  return (
    <View>
      <TouchableOpacity
        testID={testID}
        style={styles.campo}
        onPress={() => setAberto((atual) => !atual)}
      >
        <Text style={[styles.campoTexto, selecionados.length === 0 && styles.campoPlaceholder]} numberOfLines={1}>
          {rotulo}
        </Text>
        <Ionicons name={aberto ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
      </TouchableOpacity>

      {aberto ? (
        <View style={styles.painel}>
          {searchable ? (
            <TextInput
              style={styles.busca}
              value={busca}
              onChangeText={setBusca}
              placeholder="Buscar por nome"
              autoCorrect={false}
            />
          ) : null}

          {opcoesFiltradas.length === 0 ? (
            <Text style={[type.body, styles.vazioTexto]}>{vazio}</Text>
          ) : (
            <ScrollView style={styles.lista} keyboardShouldPersistTaps="handled">
              {opcoesFiltradas.map((opcao) => {
                const ativo = selecionados.includes(opcao.value);
                return (
                  <TouchableOpacity
                    key={opcao.value}
                    testID={testID ? `${testID}-opcao-${opcao.value}` : undefined}
                    style={[styles.opcao, ativo && styles.opcaoAtiva]}
                    onPress={() => escolher(opcao.value)}
                  >
                    <View style={styles.opcaoTextos}>
                      <Text style={[type.body, ativo && styles.opcaoTextoAtivo]}>{opcao.label}</Text>
                      {opcao.sublabel ? (
                        <Text style={[type.caption, styles.opcaoSublabel]}>{opcao.sublabel}</Text>
                      ) : null}
                    </View>
                    {ativo ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {props.multiple ? (
            <TouchableOpacity style={styles.concluirBotao} onPress={() => setAberto(false)}>
              <Text style={styles.concluirTexto}>Concluído</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  campo: {
    height: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
  },
  campoTexto: {
    flex: 1,
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
    color: colors.text,
  },
  campoPlaceholder: {
    color: colors.textMuted,
  },
  painel: {
    marginTop: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm,
  },
  busca: {
    height: touchTarget,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
    marginBottom: spacing.sm,
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
    color: colors.text,
  },
  lista: {
    maxHeight: 260,
  },
  opcao: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  opcaoAtiva: {
    backgroundColor: colors.surfaceTint,
  },
  opcaoTextos: {
    flex: 1,
  },
  opcaoTextoAtivo: {
    color: colors.primary,
  },
  opcaoSublabel: {
    color: colors.textMuted,
    marginTop: 1,
  },
  vazioTexto: {
    color: colors.textMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  concluirBotao: {
    minHeight: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  concluirTexto: {
    color: colors.primary,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
});
