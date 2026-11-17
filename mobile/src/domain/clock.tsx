import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { toLocalDate } from './dates';
import type { LocalDate } from './types';

type Clock = () => Date;

const ClockContext = createContext<Clock>(() => new Date());

/** Lets tests pin "now". The app uses the real device clock. */
export function ClockProvider({ now, children }: { now: Clock; children: ReactNode }) {
  return <ClockContext.Provider value={now}>{children}</ClockContext.Provider>;
}

export function useNow(): Clock {
  return useContext(ClockContext);
}

/**
 * Today's local date. Re-evaluated when the app returns to the foreground and once a
 * minute, so Home rolls over to the new day after midnight without a restart.
 */
export function useToday(): LocalDate {
  const now = useNow();
  const [today, setToday] = useState(() => toLocalDate(now()));

  useEffect(() => {
    const refresh = () => setToday(toLocalDate(now()));
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    const timer = setInterval(refresh, 60_000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [now]);

  return today;
}
