'use client';

import type { DashboardFilters } from '@orgwise/types';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  activeFilterCount,
  filtersKey,
  filtersToQuery,
  queryToFilters,
} from '@/lib/analytics-filters';
// URL-synced global analytics filter state. Filters initialize from the URL query (so shared dashboard links…
// and drill-downs work) and every change is written back with `router.replace` (scroll preserved) — the URL is…
export function useAnalyticsFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const [filters, setFilters] = useState<DashboardFilters>({});
  const [hydrated, setHydrated] = useState(false);
  // Hydrate from the URL on first mount and on every popstate (browser back/forward between filtered dashboard…
  // URLs while the page stays mounted). The write-back effect below uses `router.replace`, which never pushes…
  useEffect(() => {
    const hydrateFromUrl = () => {
      setFilters((current) => {
        const fromUrl = queryToFilters(window.location.search);
        return Object.keys(fromUrl).length > 0 ? fromUrl : current;
      });
    };
    if (!hydrated) {
      hydrateFromUrl();
      setHydrated(true);
    }
    window.addEventListener('popstate', hydrateFromUrl);
    return () => window.removeEventListener('popstate', hydrateFromUrl);
  }, [hydrated]);

  const setFilter = useCallback(
    <K extends keyof DashboardFilters>(key: K, value: DashboardFilters[K] | undefined) => {
      setFilters((current) => {
        const next = { ...current };
        if (value === undefined || value === null || value === '') {
          delete next[key];
        } else {
          next[key] = value;
        }
        return next;
      });
    },
    [],
  );

  const resetFilters = useCallback(() => setFilters({}), []);

  // Write the URL whenever the state changes (after hydration).
  useEffect(() => {
    if (!hydrated) return;
    const query = filtersToQuery(filters).toString();
    const target = query ? `${pathname}?${query}` : pathname;
    router.replace(target, { scroll: false });
  }, [filters, hydrated, pathname, router]);

  const key = useMemo(() => filtersKey(filters), [filters]);

  return {
    filters,
    setFilter,
    resetFilters,
    activeCount: activeFilterCount(filters),
    key,
    hydrated,
  };
}
