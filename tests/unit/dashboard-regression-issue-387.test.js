import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dashboardSource = () => readFileSync(resolve(process.cwd(), 'src/components/features/Dashboard/Dashboard.vue'), 'utf8');

describe('Dashboard regression coverage for issue #387', () => {
  it('wires manual node speed test state and actions in the dashboard view', () => {
    const source = dashboardSource();

    expect(source).toContain('pingResults');
    expect(source).toContain('pingingNodes');
    expect(source).toContain('pingNodeId');
    expect(source).toContain('pingAllNodes');
    expect(source).toContain(':ping-results="pingResults"');
    expect(source).toContain(':pinging-nodes="pingingNodes"');
    expect(source).toContain('@ping="pingNodeId"');
    expect(source).toContain('@ping-all="pingAllNodes"');
  });

  it('keeps profile manual sorting state connected to ProfilePanel', () => {
    const source = dashboardSource();

    expect(source).toContain('const isSortingProfiles = ref(false);');
    expect(source).toContain(':is-sorting="isSortingProfiles"');
    expect(source).toContain('@toggle-sort="isSortingProfiles = !isSortingProfiles"');
  });
});
