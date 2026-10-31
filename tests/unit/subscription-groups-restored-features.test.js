import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (file) => readFileSync(path.resolve(process.cwd(), file), 'utf8');

describe('03e7c6e feature wiring regressions', () => {
    it('Dashboard applies detected names through the complete subscription object and remembers the root domain', () => {
        const source = read('src/components/features/Dashboard/Dashboard.vue');
        expect(source).toContain('updateSubscription({ ...subscription, name: target })');
        expect(source).toContain('rememberDomainName(domain, target)');
        expect(source).toContain('@applyDetectedName="handleApplyDetectedName"');
    });

    it('file-imported nodes from the subscriptions page reach manual-node insertion', () => {
        const source = read('src/views/SubscriptionGroupsView.vue');
        expect(source).toContain(
            '@files-imported="(nodes, group) => addNodesFromBulk(nodes, group)"'
        );
    });

    it('folded group name lookup and prettification use inferred airport root, not subdomain or suffix label', () => {
        const source = read('src/components/subscriptions/SubscriptionPanel.vue');
        expect(source).toContain('lookupDomainName(rootDomain)');
        expect(source).toContain('const root = inferAirportRootDomain(`https://${raw}`) || raw');
        expect(source).not.toContain('main = parts[1]');
    });

    it('exposes restore-automatic grouping for explicit airport groups and routes it through reset-group', () => {
        const source = read('src/components/subscriptions/SubscriptionPanel.vue');
        expect(source).toContain('handleResetGroup(group)');
        expect(source).toContain("emit(\n            'reset-group'");
        expect(source).toContain("t('subscriptions.automaticAirportIdentity')");
    });
});
