"use client";

import { useState } from "react";

/**
 * Runs `reset` during render whenever any dep changes (and on first render).
 * This is React's "adjust state when a prop changes" pattern: it avoids the
 * extra render pass of calling setState from an effect.
 * https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
 */
export function useResetOnChange(
  deps: readonly unknown[],
  reset: () => void,
): void {
  const [prevDeps, setPrevDeps] = useState<readonly unknown[] | null>(null);
  const changed =
    prevDeps === null ||
    prevDeps.length !== deps.length ||
    deps.some((dep, index) => !Object.is(dep, prevDeps[index]));

  if (changed) {
    setPrevDeps(deps);
    reset();
  }
}
