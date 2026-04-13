import { describe, it, expect } from 'vitest';
import { StorageFactory, DataMigrator } from '../../functions/storage-adapter.js';

function createKVMock(initialData = {}) {
  const store = new Map(Object.entries(initialData));
  return {
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async put(key, value) {
      store.set(key, value);
    },
    async delete(key) {
      store.delete(key);
    },
    async list({ prefix }) {
      return {
        keys: Array.from(store.keys())
          .filter(key => key.startsWith(prefix || ''))
          .map(name => ({ name }))
      };
    }
  };
}

function createD1Mock({ subscriptions = [], profiles = [], settings = [] } = {}) {
  const subMap = new Map(subscriptions.map(item => [item.id, JSON.stringify(item)]));
  const profileMap = new Map(profiles.map(item => [item.id, JSON.stringify(item)]));
  const settingsMap = new Map(settings.map(item => [item.key, JSON.stringify(item.value)]));

  return {
    prepare(sql) {
      const runUnboundAll = async () => {
        if (sql.includes('SELECT data FROM subscriptions')) {
          return { results: Array.from(subMap.values()).map(data => ({ data })) };
        }
        if (sql.includes('SELECT data FROM profiles')) {
          return { results: Array.from(profileMap.values()).map(data => ({ data })) };
        }
        return { results: [] };
      };

      return {
        all: runUnboundAll,
        async run() {
          return { success: true };
        },
        bind(...args) {
          return {
            async first() {
              if (sql.includes('FROM subscriptions WHERE id = ?')) {
                const data = subMap.get(args[0]);
                return data ? { data } : null;
              }
              if (sql.includes('FROM profiles WHERE id = ?')) {
                const data = profileMap.get(args[0]);
                return data ? { data } : null;
              }
              if (sql.includes('FROM settings WHERE key = ?')) {
                const data = settingsMap.get(args[0]);
                return data ? { data } : null;
              }
              return null;
            },
            async all() {
              if (sql.includes('FROM subscriptions WHERE id IN')) {
                return {
                  results: args
                    .filter(id => subMap.has(id))
                    .map(id => ({ data: subMap.get(id) }))
                };
              }
              return { results: [] };
            },
            async run() {
              if (sql.includes('INSERT OR REPLACE INTO subscriptions')) {
                subMap.set(args[0], args[1]);
              }
              if (sql.includes('INSERT OR REPLACE INTO profiles')) {
                profileMap.set(args[0], args[1]);
              }
              if (sql.includes('INSERT OR REPLACE INTO settings')) {
                settingsMap.set(args[0], args[1]);
              }
              if (sql.includes('DELETE FROM subscriptions WHERE id = ?')) {
                subMap.delete(args[0]);
              }
              if (sql.includes('DELETE FROM profiles WHERE id = ?')) {
                profileMap.delete(args[0]);
              }
              return { success: true };
            }
          };
        }
      };
    }
  };
}

describe('Storage adapter row-level APIs', () => {
  it('supports row-level subscription/profile lookup on KV adapter', async () => {
    const kv = createKVMock({
      misub_subscriptions_v1: JSON.stringify([
        { id: 'sub-1', name: 'Sub One', url: 'https://a.example.com' },
        { id: 'sub-2', name: 'Sub Two', url: 'https://b.example.com' }
      ]),
      misub_profiles_v1: JSON.stringify([
        { id: 'profile-1', customId: 'custom-1', name: 'Profile One' }
      ])
    });

    const adapter = StorageFactory.createAdapter({ MISUB_KV: kv }, 'kv');

    expect(await adapter.getSubscriptionById('sub-2')).toMatchObject({ id: 'sub-2', name: 'Sub Two' });
    expect(await adapter.getProfileById('custom-1')).toMatchObject({ id: 'profile-1', name: 'Profile One' });
    expect(await adapter.getAllSubscriptions()).toHaveLength(2);
    expect(await adapter.getAllProfiles()).toHaveLength(1);
    expect(await adapter.getSubscriptionsByIds(['sub-1', 'sub-2'])).toHaveLength(2);

    await adapter.putSubscription({ id: 'sub-3', name: 'Sub Three', url: 'https://c.example.com' });
    expect(await adapter.getSubscriptionById('sub-3')).toMatchObject({ id: 'sub-3', name: 'Sub Three' });

    await adapter.putProfile({ id: 'profile-2', customId: 'custom-2', name: 'Profile Two' });
    expect(await adapter.getProfileById('profile-2')).toMatchObject({ id: 'profile-2', name: 'Profile Two' });

    expect(await adapter.deleteSubscriptionById('sub-1')).toBe(true);
    expect(await adapter.getSubscriptionById('sub-1')).toBeNull();

    expect(await adapter.deleteProfileById('profile-1')).toBe(true);
    expect(await adapter.getProfileById('profile-1')).toBeNull();
  });

  it('supports row-level subscription/profile lookup and update on D1 adapter', async () => {
    const d1 = createD1Mock({
      subscriptions: [
        { id: 'sub-1', name: 'Sub One', url: 'https://a.example.com', nodeCount: 1 },
        { id: 'sub-2', name: 'Sub Two', url: 'https://b.example.com', nodeCount: 2 }
      ],
      profiles: [
        { id: 'profile-1', customId: 'custom-1', name: 'Profile One' }
      ]
    });

    const adapter = StorageFactory.createAdapter({ MISUB_DB: d1 }, 'd1');

    expect(await adapter.getSubscriptionById('sub-1')).toMatchObject({ id: 'sub-1', nodeCount: 1 });
    expect(await adapter.getProfileById('profile-1')).toMatchObject({ id: 'profile-1', name: 'Profile One' });
    expect(await adapter.getAllSubscriptions()).toHaveLength(2);
    expect(await adapter.getAllProfiles()).toHaveLength(1);

    const related = await adapter.getSubscriptionsByIds(['sub-2', 'sub-1']);
    expect(related.map(item => item.id).sort()).toEqual(['sub-1', 'sub-2']);

    await adapter.updateSubscriptionById('sub-2', current => ({ ...current, nodeCount: 9 }));
    expect(await adapter.getSubscriptionById('sub-2')).toMatchObject({ id: 'sub-2', nodeCount: 9 });

    await adapter.putSubscription({ id: 'sub-3', name: 'Sub Three', url: 'https://c.example.com', nodeCount: 0 });
    expect(await adapter.getSubscriptionById('sub-3')).toMatchObject({ id: 'sub-3', name: 'Sub Three' });

    await adapter.putProfile({ id: 'profile-2', customId: 'custom-2', name: 'Profile Two' });
    expect(await adapter.getProfileById('profile-2')).toMatchObject({ id: 'profile-2', name: 'Profile Two' });

    expect(await adapter.deleteSubscriptionById('sub-1')).toBe(true);
    expect(await adapter.getSubscriptionById('sub-1')).toBeNull();

    expect(await adapter.deleteProfileById('profile-1')).toBe(true);
    expect(await adapter.getProfileById('profile-1')).toBeNull();
  });

  it('reads legacy D1 main-row blob data alongside row-level records', async () => {
    const d1 = createD1Mock({
      subscriptions: [
        { id: 'main', items: true },
        { id: 'sub-new', name: 'Sub New', url: 'https://new.example.com' }
      ],
      profiles: [
        { id: 'main', items: true },
        { id: 'profile-new', name: 'Profile New' }
      ]
    });

    // Overwrite main rows with legacy blob arrays.
    d1.prepare('INSERT OR REPLACE INTO subscriptions (id, data, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)')
      .bind('main', JSON.stringify([{ id: 'sub-legacy', name: 'Legacy Sub', url: 'https://legacy.example.com' }]))
      .run();
    d1.prepare('INSERT OR REPLACE INTO profiles (id, data, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)')
      .bind('main', JSON.stringify([{ id: 'profile-legacy', customId: 'legacy-custom', name: 'Legacy Profile' }]))
      .run();

    const adapter = StorageFactory.createAdapter({ MISUB_DB: d1 }, 'd1');

    const allSubs = await adapter.getAllSubscriptions();
    expect(allSubs.map(item => item.id).sort()).toEqual(['sub-legacy', 'sub-new']);

    const allProfiles = await adapter.getAllProfiles();
    expect(allProfiles.map(item => item.id).sort()).toEqual(['profile-legacy', 'profile-new']);

    expect(await adapter.getSubscriptionById('sub-legacy')).toMatchObject({ id: 'sub-legacy', name: 'Legacy Sub' });
    expect(await adapter.getProfileById('legacy-custom')).toMatchObject({ id: 'profile-legacy', name: 'Legacy Profile' });

    const related = await adapter.getSubscriptionsByIds(['sub-legacy', 'sub-new']);
    expect(related.map(item => item.id).sort()).toEqual(['sub-legacy', 'sub-new']);
  });

  it('migrates legacy D1 main rows into row-level records', async () => {
    const d1 = createD1Mock();

    await d1.prepare('INSERT OR REPLACE INTO subscriptions (id, data, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)')
      .bind('main', JSON.stringify([{ id: 'sub-legacy', name: 'Legacy Sub', url: 'https://legacy.example.com' }]))
      .run();
    await d1.prepare('INSERT OR REPLACE INTO profiles (id, data, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)')
      .bind('main', JSON.stringify([{ id: 'profile-legacy', customId: 'legacy-custom', name: 'Legacy Profile' }]))
      .run();

    const result = await DataMigrator.migrateLegacyD1MainRows({ MISUB_DB: d1 });
    expect(result.errors).toEqual([]);
    expect(result.subscriptions).toBe(1);
    expect(result.profiles).toBe(1);

    const adapter = StorageFactory.createAdapter({ MISUB_DB: d1 }, 'd1');
    expect(await adapter.getSubscriptionById('sub-legacy')).toMatchObject({ id: 'sub-legacy', name: 'Legacy Sub' });
    expect(await adapter.getProfileById('profile-legacy')).toMatchObject({ id: 'profile-legacy', name: 'Legacy Profile' });
  });
});
