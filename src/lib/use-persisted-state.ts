"use client";
import React, { useState, useEffect } from "react";

export function useSaved<T>(
  key: string,
  initial: T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) setValue(JSON.parse(saved) as T);
    } catch {}
    setHydrated(true);
  }, [key]);
  useEffect(() => {
    if (hydrated) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {}
    }
  }, [key, value, hydrated]);
  return [value, setValue];
}
