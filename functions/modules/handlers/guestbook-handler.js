/**
 * 留言板处理模块
 * 处理留言板的公开访问和管理接口
 */

import { StorageFactory } from '../../storage-adapter.js';
import { createJsonResponse, createErrorResponse } from '../utils.js';
import { sendTgNotification } from '../notifications.js';
import { KV_KEY_GUESTBOOK, KV_KEY_SETTINGS, DEFAULT_SETTINGS } from '../config.js';

const GUESTBOOK_INDEX_KEY = `${KV_KEY_GUESTBOOK}_index`;
const GUESTBOOK_ITEM_PREFIX = `${KV_KEY_GUESTBOOK}:item:`;

/**
 * 获取存储适配器实例
 */
async function getStorageAdapter(env) {
    const storageType = await StorageFactory.getStorageType(env);
    return StorageFactory.createAdapter(env, storageType);
}

function getGuestbookItemKey(id) {
    return `${GUESTBOOK_ITEM_PREFIX}${id}`;
}

async function loadGuestbookMessages(storageAdapter) {
    const index = await storageAdapter.get(GUESTBOOK_INDEX_KEY);
    if (Array.isArray(index) && index.length > 0) {
        const entries = await Promise.all(index.map(id => storageAdapter.get(getGuestbookItemKey(id))));
        return entries.filter(Boolean);
    }

    const legacy = await storageAdapter.get(KV_KEY_GUESTBOOK);
    return Array.isArray(legacy) ? legacy : [];
}

async function persistGuestbookMessage(storageAdapter, message) {
    const index = await storageAdapter.get(GUESTBOOK_INDEX_KEY);
    const ids = Array.isArray(index) ? index : [];
    if (!ids.includes(message.id)) {
        ids.push(message.id);
        await storageAdapter.put(GUESTBOOK_INDEX_KEY, ids);
    }
    await storageAdapter.put(getGuestbookItemKey(message.id), message);
}

async function removeGuestbookMessage(storageAdapter, id) {
    const index = await storageAdapter.get(GUESTBOOK_INDEX_KEY);
    const ids = Array.isArray(index) ? index.filter(item => item !== id) : [];
    await storageAdapter.put(GUESTBOOK_INDEX_KEY, ids);
    await storageAdapter.delete(getGuestbookItemKey(id));
}

/**
 * 获取公开留言列表
 * 仅返回 isVisible 为 true 的留言
 */
export async function handleGuestbookGet(env) {
    try {
        const storageAdapter = await getStorageAdapter(env);
        const [messages, settings] = await Promise.all([
            loadGuestbookMessages(storageAdapter),
            storageAdapter.get(KV_KEY_SETTINGS).then(res => res || {})
        ]);

        const guestbookConfig = settings.guestbook || DEFAULT_SETTINGS.guestbook;

        // 如果功能未启用，返回空列表或错误状态
        if (!guestbookConfig.enabled) {
            return createJsonResponse({
                success: false,
                message: '留言板功能未启用',
                data: [],
                disabled: true
            });
        }

        // 过滤可见消息，并在返回前移除可能的敏感字段（如果有）
        // 按时间倒序排列
        const publicMessages = messages
            .filter(msg => msg.isVisible)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .map(msg => ({
                id: msg.id,
                nickname: msg.nickname,
                content: msg.content,
                type: msg.type || 'general',
                status: msg.status, // approved, replied
                createdAt: msg.createdAt,
                reply: msg.reply,
                replyAt: msg.replyAt
            }));

        return createJsonResponse({
            success: true,
            data: publicMessages,
            config: {
                enabled: true
            }
        });

    } catch (e) {
        console.error('[Guestbook Error] Get:', e);
        return createErrorResponse('获取留言失败', 500);
    }
}

/**
 * 提交新留言 (Public)
 */
export async function handleGuestbookPost(request, env) {
    try {
        const storageAdapter = await getStorageAdapter(env);
        const settings = await storageAdapter.get(KV_KEY_SETTINGS).then(res => res || {});
        const guestbookConfig = settings.guestbook || DEFAULT_SETTINGS.guestbook;

        if (!guestbookConfig.enabled) {
            return createErrorResponse('留言板功能未启用', 403);
        }

        const body = await request.json();
        const { nickname, content, type } = body;

        // 基础验证
        if (!content || content.trim().length === 0) {
            return createErrorResponse('留言内容不能为空', 400);
        }
        if (content.length > 500) {
            return createErrorResponse('留言内容过长（最大500字）', 400);
        }

        let finalNickname = nickname ? nickname.trim() : '匿名用户';
        if (finalNickname.length > 20) {
            finalNickname = finalNickname.substring(0, 20);
        }

        // 构建新留言
        const newMessage = {
            id: crypto.randomUUID(),
            nickname: finalNickname,
            content: content.trim(),
            type: type || 'general', // general, feature, bug
            createdAt: new Date().toISOString(),
            status: 'pending',
            isVisible: !guestbookConfig.requireAudit, // 如果不需要审核，则默认可见
            reply: null,
            replyAt: null
        };

        // 保存
        await persistGuestbookMessage(storageAdapter, newMessage);

        // 发送通知给管理员
        try {
            const messageText = `📝 *新留言提醒*\n\n` +
                `*用户*: ${finalNickname}\n` +
                `*类型*: ${newMessage.type}\n` +
                `*内容*: ${newMessage.content}\n` +
                `*状态*: ${newMessage.isVisible ? '🟢 已显示' : '🔴 待审核'}`;
            await sendTgNotification(settings, messageText);
        } catch (notifyError) {
            console.warn('[Guestbook] Notification failed:', notifyError);
        }

        return createJsonResponse({
            success: true,
            message: newMessage.isVisible ? '留言提交成功' : '留言提交成功，等待管理员审核',
            data: newMessage
        });

    } catch (e) {
        console.error('[Guestbook Error] Post:', e);
        return createErrorResponse('提交留言失败', 500);
    }
}

/**
 * 获取管理端留言列表 (Auth Required)
 */
export async function handleGuestbookManageGet(env) {
    try {
        const storageAdapter = await getStorageAdapter(env);
        const messages = await loadGuestbookMessages(storageAdapter);

        // 管理端返回所有字段，按时间倒序
        const sortedMessages = messages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        return createJsonResponse({
            success: true,
            data: sortedMessages
        });
    } catch (e) {
        console.error('[Guestbook Manage Error] Get:', e);
        return createErrorResponse('获取留言数据失败', 500);
    }
}

/**
 * 管理操作 (Auth Required)
 * - reply: 回复
 * - delete: 删除
 * - toggle: 切换可见性
 */
export async function handleGuestbookManageAction(request, env) {
    try {
        const body = await request.json();
        const { action, id, replyContent } = body; // action: 'reply' | 'delete' | 'toggle' | 'update_status'

        const storageAdapter = await getStorageAdapter(env);
        const messages = await loadGuestbookMessages(storageAdapter);

        const index = messages.findIndex(m => m.id === id);
        if (index === -1) {
            return createErrorResponse('留言不存在', 404);
        }

        let updatedMessage = messages[index];
        let notificationMsg = null;

        if (action === 'delete') {
            messages.splice(index, 1);
            await removeGuestbookMessage(storageAdapter, id);
        } else if (action === 'reply') {
            updatedMessage.reply = replyContent;
            updatedMessage.replyAt = new Date().toISOString();
            updatedMessage.status = 'replied';
            // 自动通过审核（如果回复了肯定是要显示的）
            if (!updatedMessage.isVisible) {
                updatedMessage.isVisible = true;
            }
        } else if (action === 'toggle') {
            updatedMessage.isVisible = !updatedMessage.isVisible;
            // 如果变为可见且状态还是 pending，改为 approved
            if (updatedMessage.isVisible && updatedMessage.status === 'pending') {
                updatedMessage.status = 'approved';
            }
        } else if (action === 'status') {
            // 只更新状态，例如改为 'pending' or 'approved'
            if (body.status) updatedMessage.status = body.status;
        } else {
            return createErrorResponse('未知操作', 400);
        }

        if (action !== 'delete') {
            await persistGuestbookMessage(storageAdapter, updatedMessage);
        }

        return createJsonResponse({
            success: true,
            message: '操作成功',
            data: updatedMessage
        });

    } catch (e) {
        console.error('[Guestbook Manage Error] Action:', e);
        return createErrorResponse(`操作失败: ${e.message}`, 500);
    }
}
