import { computed, ref, watch } from 'vue';
import { MANUAL_NODE_COUNTRY_ALIAS_MAP } from '@/constants/manualNodeCountryAliases.js';

const SEARCH_NODES_PER_PAGE = 24;

export function useManualNodeSearchPagination(options) {
  const {
    manualNodes,
    paginatedManualNodes,
    initialSearchTerm,
    onBasePageChange,
    onSearchTermChange
  } = options;

  const localSearchTerm = ref(initialSearchTerm.value || '');
  const currentSearchPage = ref(1);

  watch(initialSearchTerm, (value) => {
    const normalized = value || '';
    if (normalized !== localSearchTerm.value) {
      localSearchTerm.value = normalized;
    }
  });

  watch(localSearchTerm, (value) => {
    currentSearchPage.value = 1;
    if (typeof onSearchTermChange === 'function') {
      onSearchTermChange(value);
    }
  });

  const filteredNodes = computed(() => {
    if (!localSearchTerm.value) {
      return manualNodes.value;
    }

    const searchQuery = localSearchTerm.value.toLowerCase().trim();

    return manualNodes.value.filter((node) => {
      if (!node.name) return false;

      const nodeName = node.name.toLowerCase();
      if (nodeName.includes(searchQuery)) {
        return true;
      }

      const alternativeTerms = MANUAL_NODE_COUNTRY_ALIAS_MAP[searchQuery] || [];
      return alternativeTerms.some((term) => nodeName.includes(term.toLowerCase()));
    });
  });

  const totalSearchPages = computed(() => {
    const total = Math.ceil(filteredNodes.value.length / SEARCH_NODES_PER_PAGE);
    return total > 0 ? total : 1;
  });

  const paginatedNodes = computed(() => {
    if (!localSearchTerm.value) {
      return paginatedManualNodes.value || [];
    }

    const start = (currentSearchPage.value - 1) * SEARCH_NODES_PER_PAGE;
    const end = start + SEARCH_NODES_PER_PAGE;
    return filteredNodes.value.slice(start, end);
  });

  function handlePageChange(page) {
    const parsed = parseInt(page, 10);
    if (Number.isNaN(parsed)) return;

    if (localSearchTerm.value) {
      const clamped = Math.min(Math.max(parsed, 1), totalSearchPages.value);
      currentSearchPage.value = clamped;
      return;
    }

    if (typeof onBasePageChange === 'function') {
      onBasePageChange(parsed);
    }
  }

  return {
    localSearchTerm,
    filteredNodes,
    paginatedNodes,
    currentSearchPage,
    totalSearchPages,
    handlePageChange
  };
}
