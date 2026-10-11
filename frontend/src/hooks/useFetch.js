import { useCallback, useEffect, useReducer, useRef } from 'react';

const initialState = { data: null, loading: false, error: null };

function reducer(state, action) {
  switch (action.type) {
    case 'LOADING': return { ...state, loading: true, error: null };
    case 'SUCCESS': return { data: action.payload, loading: false, error: null };
    case 'ERROR':   return { ...state, loading: false, error: action.payload };
    case 'RESET':   return initialState;
    default:        return state;
  }
}

/**
 * Generic data-fetching hook.
 *
 * @param {() => Promise<any>} fetcher  — async function that returns data
 * @param {any[]}             [deps=[]] — re-fetch when these change
 *
 * @example
 * const { data, loading, error, refetch } = useFetch(() => listAssets({ status: 'available' }), []);
 */
export function useFetch(fetcher, deps = []) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const abortRef = useRef(null);

  const execute = useCallback(async () => {
    // Cancel any in-flight fetch
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    dispatch({ type: 'LOADING' });
    try {
      const result = await fetcher(controller.signal);
      if (!controller.signal.aborted) {
        dispatch({ type: 'SUCCESS', payload: result });
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        dispatch({ type: 'ERROR', payload: err });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    execute();
    return () => abortRef.current?.abort();
  }, [execute]);

  return { ...state, refetch: execute };
}
