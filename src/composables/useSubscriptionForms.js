import { ref } from 'vue';
import { useToastStore } from '../stores/toast.js';
import { generateSubscriptionId } from '../utils/id.js';

const isDev = import.meta.env.DEV;

export function useSubscriptionForms({ addSubscription, updateSubscription }) {
    const { showToast } = useToastStore();
    const showModal = ref(false);
    const isNew = ref(false);
    const editingSubscription = ref(null);

    const openAdd = () => {
        isNew.value = true;
        editingSubscription.value = {
            name: '',
            url: '',
            enabled: true,
            exclude: '',
            customUserAgent: 'MiSub',
            fetchProxy: '',
            notes: ''
        };
        showModal.value = true;
    };

    const openEdit = (sub) => {
        if (!sub) {
            console.error('UseSubscriptionForms: openEdit called with null/undefined');
            return;
        }
        if (isDev) {
            console.debug('UseSubscriptionForms: openEdit called with', sub);
        }
        isNew.value = false;
        // Deep copy to avoid mutating store state directly before save
        try {
            editingSubscription.value = JSON.parse(JSON.stringify(sub));
            if (isDev) {
                console.debug('UseSubscriptionForms: editingSubscription set to', editingSubscription.value);
            }
            showModal.value = true;
        } catch (e) {
            console.error('UseSubscriptionForms: Failed to clone subscription', e);
        }
    };

    const handleSave = () => {
        if (!editingSubscription.value || !editingSubscription.value.url) {
            showToast('订阅链接不能为空', 'error');
            return;
        }
        if (!/^https?:\/\//.test(editingSubscription.value.url)) {
            showToast('请输入有效的 http:// 或 https:// 订阅链接', 'error');
            return;
        }

        if (isNew.value) {
            addSubscription({ ...editingSubscription.value, id: generateSubscriptionId() });
        } else {
            updateSubscription(editingSubscription.value);
        }
        showModal.value = false;
    };

    return {
        showModal,
        isNew,
        editingSubscription,
        openAdd,
        openEdit,
        handleSave
    };
}
