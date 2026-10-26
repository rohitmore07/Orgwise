'use client';

import type { OrgHierarchy } from '@orgwise/types';
import { useCallback, useState } from 'react';
import { PageHeader } from '@/components/app-shell/page-header';
import { OrgChart } from '@/components/organization/org-chart';
import { Card, CardContent } from '@/components/ui/card';
import { useAsync } from '@/hooks/use-async';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { api } from '@/lib/api';

export default function OrganizationPage() {
  const [version, setVersion] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  // Debounced so the tree is refetched (and filtered server-side) at most
  // once per pause — the client never filters the full dataset itself.
  const search = useDebouncedValue(searchInput, 300);
  // Whitespace-only input is treated as "no search" (no pointless request).
  const term = search.trim();
  const retry = useCallback(() => setVersion((v) => v + 1), []);
  const { data, loading, error } = useAsync<OrgHierarchy>(
    () => api.get(`/analytics/hierarchy${term ? `?search=${encodeURIComponent(term)}` : ''}`),
    [term, version],
  );

  return (
    <div>
      <PageHeader
        eyebrow="Workforce"
        title="Organization Chart"
        description="Explore the reporting structure — departments, teams, and the people in them. Click an employee to open their profile."
      />
      <Card>
        <CardContent className="p-4 sm:p-5">
          <OrgChart
            data={data}
            loading={loading}
            error={error}
            onRetry={() => void retry()}
            query={searchInput}
            onQueryChange={setSearchInput}
          />
        </CardContent>
      </Card>
    </div>
  );
}
