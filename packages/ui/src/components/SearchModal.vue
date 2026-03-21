<script setup lang="ts">
import { ref, computed } from 'vue';
import Modal from './Modal.vue';
import type { Id } from "@meideate/convex/dataModel";

const props = defineProps<{
  isOpen: boolean;
  workspaces: any[] | undefined;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'select', id: Id<"workspaces">): void;
}>();

const searchQuery = ref('');

const filteredResults = computed(() => {
  if (!props.workspaces) return [];
  if (!searchQuery.value) return props.workspaces;
  const q = searchQuery.value.toLowerCase();
  return props.workspaces.filter(w =>
    w.name.toLowerCase().includes(q) ||
    (w.content && w.content.toLowerCase().includes(q))
  );
});

const handleSelect = (id: Id<"workspaces">) => {
  emit('select', id);
  emit('close');
  searchQuery.value = '';
};

const stripMarkdown = (content: string) => {
  if (!content) return '';

  return content
    .replace(/^#\s(.*?)\n/, '') // Remove H1 header
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Links [text](url) -> text
    .replace(/(\*\*|__)(.*?)\1/g, '$2') // Bold
    .replace(/(\*|_)(.*?)\1/g, '$2') // Italics
    .replace(/~~(.*?)~~/g, '$1') // Strikethrough
    .replace(/`(.*?)`/g, '$1') // Code
    .replace(/^>\s/gm, '') // Blockquotes
    .replace(/^#{1,6}\s/gm, '') // Other headers
    .replace(/::\w+\{.*?\}/g, '') // Custom markers like ::audio{...}
    .replace(/\!\[([^\]]*)\]\([^\)]+\)/g, '') // Images
    .trim()
    .substring(0, 100);
};
</script>

<template>
  <Modal :isOpen="isOpen" @close="emit('close')" title="Quick Jump Search" class="w-full">
    <div class="flex flex-col gap-4">
      <div class="relative">
        <input v-model="searchQuery" type="text" placeholder="Search workspaces or ideas..."
          class="w-full pl-11 pr-4 py-3.5 bg-muted border border-border rounded-2xl text-[14px] font-semibold outline-none focus:border-primary focus:bg-background transition-all shadow-sm text-foreground"
          autoFocus />
        <svg class="absolute left-4 top-4 w-4.5 h-4.5 text-muted-foreground" fill="none" stroke="currentColor"
          viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      <div class="max-h-[300px] overflow-y-auto no-scrollbar flex flex-col gap-1.5 pr-1">
        <div v-if="filteredResults.length === 0" class="py-12 text-center flex flex-col items-center gap-3">
          <div class="w-12 h-12 bg-muted rounded-full flex items-center justify-center border border-border">
            <svg class="w-6 h-6 text-muted-foreground opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p class="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">No ideas found</p>
        </div>
        <button v-for="w in filteredResults" :key="w._id" @click="handleSelect(w._id)"
          class="flex items-center gap-4 p-4 rounded-2xl hover:bg-muted transition-all text-left group border border-transparent hover:border-border">

          <div class="min-w-0">
            <span class="text-[14px] font-black text-foreground block truncate leading-none mb-1 group-hover:text-primary transition-colors">{{ w.name }}</span>
            <span v-if="w.content"
              class="text-[11px] text-muted-foreground font-medium line-clamp-1 leading-normal italic opacity-80">{{
                stripMarkdown(w.content) }}</span>
          </div>
        </button>
      </div>
    </div>
  </Modal>
</template>
