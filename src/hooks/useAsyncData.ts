import { useCallback, useEffect, useState, type DependencyList } from 'react';
import { useFocusEffect } from 'expo-router';

type Options = {
  /** false (padrão): busca ao montar / quando `deps` muda. true: rebusca toda
   *  vez que a tela ganha foco (expo-router) — pra refletir dado que pode ter
   *  mudado em outra tela (ex.: lista após cadastro). */
  onFocus?: boolean;
  /** false: pula a busca e mantém o estado atual. Útil pra esperar uma
   *  dependência obrigatória (sessão, id) antes de disparar a query. */
  enabled?: boolean;
  mensagemErro?: string;
};

/**
 * Substitui o par useEffect/useFocusEffect + "let ativo = true" + loading/error
 * repetido tela a tela pra carregar dados do Supabase: cancela o setState se o
 * componente desmontar (ou a tela perder foco) antes da promise resolver.
 */
export function useAsyncData<T>(fetcher: () => Promise<T>, deps: DependencyList, options: Options = {}) {
  const { onFocus = false, enabled = true, mensagemErro = 'Erro ao carregar dados. Tente novamente.' } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(() => {
    if (!enabled) {
      setLoading(false);
      return undefined;
    }

    let ativo = true;
    setLoading(true);
    setError(null);

    fetcher()
      .then((resultado) => {
        if (ativo) setData(resultado);
      })
      .catch((err) => {
        console.error(err);
        if (ativo) setError(mensagemErro);
      })
      .finally(() => {
        if (ativo) setLoading(false);
      });

    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, mensagemErro, ...deps]);

  useEffect(() => {
    if (onFocus) return;
    return carregar();
  }, [carregar, onFocus]);

  useFocusEffect(
    useCallback(() => {
      if (!onFocus) return;
      return carregar();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [carregar, onFocus])
  );

  return { data, loading, error, setData, setError, reload: carregar } as const;
}
