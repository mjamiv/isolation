import { useState, useCallback } from 'react';
import { useModelStore } from '@/stores/modelStore';
import { serializeModel } from '@/services/modelSerializer';
import { submitModel } from '@/services/api';

interface RunAsyncConfig<TParams, TResult> {
  /** The async function to call after model submission. Receives modelId and caller params. */
  runFn: (modelId: string, params: TParams) => Promise<TResult>;
  /** Called before submission begins. */
  onStart: () => void;
  /** Called with the final result on success. */
  onResult: (result: TResult) => void;
  /** Called with a sanitized error message on failure. */
  onError: (message: string) => void;
}

/**
 * Generic hook for serializing the model, submitting it, and running an
 * async backend operation. Manages `submitting` state and provides a
 * unified error handling wrapper.
 *
 * Used by both `useRunAnalysis` (single analysis with polling) and
 * `useRunComparison` (comparison run, synchronous backend).
 */
export function useRunAsync<TParams, TResult>(config: RunAsyncConfig<TParams, TResult>) {
  const [submitting, setSubmitting] = useState(false);

  const run = useCallback(
    async (params: TParams) => {
      setSubmitting(true);
      try {
        // 1. Serialize the current model
        const storeState = useModelStore.getState();
        const serialized = serializeModel(storeState);

        // 2. Submit model to backend
        const { modelId } = await submitModel(serialized);

        // 3. Signal start
        config.onStart();

        // 4. Run the caller-supplied async function
        const result = await config.runFn(modelId, params);

        // 5. Deliver result
        config.onResult(result);
      } catch (err) {
        config.onError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setSubmitting(false);
      }
    },
    [config],
  );

  return { run, submitting };
}
