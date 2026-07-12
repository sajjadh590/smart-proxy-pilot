import { useEffect, useState, useCallback } from "react";
import { AppState, DEFAULT_STATE } from "@/lib/types";
import { loadState, onStateChange } from "@/lib/storage";

// Reactive view of the persisted app state, kept in sync across contexts.
export function useAppState() {
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setState(await loadState());
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    return onStateChange((s) => setState(s));
  }, [refresh]);

  return { state, loading, refresh };
}
