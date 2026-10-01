import { useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";

// useMutation for save/create actions: while one call is in flight, further
// mutate() calls are ignored. React Query only flips isPending on its next
// notify tick, so a fast double click (or Enter + click) used to slip a
// second create through before the button disabled — creating duplicates.
// The ref is set synchronously at the moment of the first call.
export function useSingleFlightMutation(options) {
  const inFlight = useRef(false);
  const mutation = useMutation({
    ...options,
    onSettled: (...args) => {
      inFlight.current = false;
      return options.onSettled?.(...args);
    },
  });
  const { mutate: rawMutate } = mutation;
  const mutate = useCallback((variables, callOptions) => {
    if (inFlight.current) return;
    inFlight.current = true;
    rawMutate(variables, callOptions);
  }, [rawMutate]);
  return { ...mutation, mutate, isPending: mutation.isPending || inFlight.current };
}
