"use client";

import { useEffect, useState } from "react";
import { AUTH_ENTRY_FLAG } from "@/lib/auth/entry-flag";

/**
 * True for the first paint after a successful login handoff.
 * Cleared immediately so revisiting the dashboard stays calm.
 */
export function usePostLoginEntrance(): boolean {
  const [active, setActive] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(AUTH_ENTRY_FLAG) === "1") {
        sessionStorage.removeItem(AUTH_ENTRY_FLAG);
        // Read after mount on purpose: sessionStorage does not exist during
        // SSR, so a lazy initial state would cause a hydration mismatch.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setActive(true);
      }
    } catch {
      // private mode / blocked storage: skip entrance
    }
  }, []);

  return active;
}
