"use client";

import * as React from "react";

interface AsyncState<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
}

/**
 * Standardizes loading/error/data handling for the mock API calls so every
 * screen gets the same shape to render loading/error/empty/success states
 * from, instead of each page reinventing it.
 */
export function useAsync<T>(fetcher: () => Promise<T>, deps: React.DependencyList = []) {
  const [state, setState] = React.useState<AsyncState<T>>({
    data: undefined,
    loading: true,
    error: null,
  });
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    // Kicking off a fetch (an external system) on mount/refetch, not deriving
    // state from props - the sanctioned effect use case the lint rule allows.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((s) => ({ ...s, loading: true, error: null }));
    fetcher()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((error: Error) => {
        if (!cancelled) setState({ data: undefined, loading: false, error });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadKey]);

  const refetch = React.useCallback(() => setReloadKey((k) => k + 1), []);

  return { ...state, refetch };
}
