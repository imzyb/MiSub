import { createExternalError, createExternalSuccess, getExternalStorageAdapter } from './external-api-utils.js';
import { detectNodeProtocol, isManualNode, isRemoteSubscription, toExternalProfile } from './external-api-mappers.js';

export async function handleExternalPreviewRequest(_request, env, profileId) {
  const storageAdapter = await getExternalStorageAdapter(env);
  const profile = await storageAdapter.getProfileById(profileId);
  if (!profile) return createExternalError('profile_not_found', 'Profile not found', 404);

  const allSubscriptions = await storageAdapter.getAllSubscriptions();
  const byId = new Map(allSubscriptions.map(item => [item.id, item]));
  const subscriptionIds = Array.isArray(profile.subscriptions) ? profile.subscriptions : [];
  const manualNodeIds = Array.isArray(profile.manualNodes) ? profile.manualNodes : [];

  const remoteSources = subscriptionIds
    .map(id => byId.get(id))
    .filter(item => item && isRemoteSubscription(item))
    .map(item => ({ id: item.id, type: 'subscription', name: item.name || '', url: item.url || '' }));

  const manualSources = manualNodeIds
    .map(id => byId.get(id))
    .filter(item => item && isManualNode(item))
    .map(item => ({
      id: item.id,
      type: 'manual_node',
      name: item.name || '',
      protocol: detectNodeProtocol(item.url),
      nodeCount: 1,
      url: item.url || ''
    }));

  const byProtocol = {};
  manualSources.forEach(item => {
    byProtocol[item.protocol] = (byProtocol[item.protocol] || 0) + 1;
  });

  return createExternalSuccess({
    profile: toExternalProfile(profile),
    counts: {
      subscriptions: remoteSources.length,
      manualNodes: manualSources.length,
      totalNodes: manualSources.length
    },
    byProtocol,
    sources: [...remoteSources, ...manualSources]
  });
}
