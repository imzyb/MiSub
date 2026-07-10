import { authenticateExternalApiRequest } from './external-api-auth.js';
import { createExternalError } from './external-api-utils.js';
import { handleExternalSubscriptionsRequest } from './external-subscriptions-handler.js';
import { handleExternalManualNodesRequest } from './external-manual-nodes-handler.js';
import { handleExternalProfilesRequest } from './external-profiles-handler.js';
import { handleExternalPreviewRequest } from './external-preview-handler.js';

export async function handleExternalApiRequest(request, env) {
  const url = new URL(request.url);
  const rawPath = url.pathname.replace(/^\/api\/ext\/v1/, '') || '/';

  const authResult = await authenticateExternalApiRequest(request, env);
  if (!authResult.ok) return authResult.response;

  const path = rawPath.replace(/\/+$/, '') || '/';

  if (path === '/subscriptions') {
    return await handleExternalSubscriptionsRequest(request, env);
  }

  if (path === '/subscriptions/validate') {
    return await handleExternalSubscriptionsRequest(request, env, { action: 'validate' });
  }

  if (path === '/subscriptions/batch-refresh') {
    return await handleExternalSubscriptionsRequest(request, env, { action: 'batch_refresh' });
  }

  const subscriptionRefreshMatch = path.match(/^\/subscriptions\/([^/]+)\/refresh$/);
  if (subscriptionRefreshMatch) {
    return await handleExternalSubscriptionsRequest(request, env, {
      id: decodeURIComponent(subscriptionRefreshMatch[1]),
      action: 'refresh'
    });
  }

  const subscriptionMatch = path.match(/^\/subscriptions\/([^/]+)$/);
  if (subscriptionMatch) {
    return await handleExternalSubscriptionsRequest(request, env, decodeURIComponent(subscriptionMatch[1]));
  }

  if (path === '/manual-nodes') {
    return await handleExternalManualNodesRequest(request, env);
  }

  if (path === '/manual-nodes/validate') {
    return await handleExternalManualNodesRequest(request, env, { action: 'validate' });
  }

  const manualNodeMatch = path.match(/^\/manual-nodes\/([^/]+)$/);
  if (manualNodeMatch) {
    return await handleExternalManualNodesRequest(request, env, decodeURIComponent(manualNodeMatch[1]));
  }

  if (path === '/profiles') {
    return await handleExternalProfilesRequest(request, env, {});
  }

  const previewMatch = path.match(/^\/profiles\/([^/]+)\/preview$/);
  if (previewMatch) {
    if (request.method !== 'POST') return createExternalError('method_not_allowed', 'Method Not Allowed', 405);
    return await handleExternalPreviewRequest(request, env, decodeURIComponent(previewMatch[1]));
  }

  const profileRefreshMatch = path.match(/^\/profiles\/([^/]+)\/refresh$/);
  if (profileRefreshMatch) {
    return await handleExternalProfilesRequest(request, env, {
      id: decodeURIComponent(profileRefreshMatch[1]),
      action: 'refresh'
    });
  }

  const profileRelationMatch = path.match(/^\/profiles\/([^/]+)\/(subscriptions|manual-nodes)$/);
  if (profileRelationMatch) {
    return await handleExternalProfilesRequest(request, env, {
      id: decodeURIComponent(profileRelationMatch[1]),
      relation: profileRelationMatch[2]
    });
  }

  const profileMatch = path.match(/^\/profiles\/([^/]+)$/);
  if (profileMatch) {
    return await handleExternalProfilesRequest(request, env, { id: decodeURIComponent(profileMatch[1]) });
  }

  return createExternalError('not_found', 'Not Found', 404);
}
