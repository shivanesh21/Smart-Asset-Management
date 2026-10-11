import { useCallback, useReducer } from 'react';

const initialState = { loading: false, error: null, data: null };

function reducer(state, action) {
  switch (action.type) {
    case 'LOADING': return { ...state, loading: true, error: null };
    case 'SUCCESS': return { loading: false, error: null, data: action.payload };
    case 'ERROR':   return { loading: false, error: action.payload, data: null };
    default:        return state;
  }
}

/**
 * Hook for mutations (POST / PATCH / DELETE).
 * Returns `mutate(payload)` which executes the action and tracks state.
 *
 * @param {(payload: any) => Promise<any>} action
 *
 * @example
 * const { mutate, loading, error } = useMutation((p) => createAllocation(p));
 * await mutate({ assetId, userId });
 */
export function useMutation(action) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const mutate = useCallback(
    async (payload) => {
      dispatch({ type: 'LOADING' });
      try {
        const result = await action(payload);
        dispatch({ type: 'SUCCESS', payload: result });
        return result;
      } catch (err) {
        dispatch({ type: 'ERROR', payload: err });
        throw err;
      }
    },
    [action]
  );

  return { ...state, mutate };
}
