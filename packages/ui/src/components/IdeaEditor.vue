<script setup lang="ts">
import { Milkdown, useEditor } from '@milkdown/vue'
import { Crepe } from '@milkdown/crepe'
import { commandsCtx, editorViewOptionsCtx } from '@milkdown/kit/core'
import { watch, ref, onMounted, onUnmounted, computed } from 'vue'
import { useConvexQuery, useConvexMutation } from "@meideate/ui/convex";
import { api } from "@meideate/convex";
import {
  commonmark,
  headingAttr,
  paragraphAttr,
} from "@milkdown/kit/preset/commonmark";
import "@milkdown/crepe/theme/common/style.css";
import { audioPlugin } from '../plugins/audio'
import { videoPlugin } from '../plugins/video'
import MediaModal from './MediaModal.vue'
import type { Id } from '@meideate/convex/dataModel';

const props = defineProps<{
  modelValue: string
  placeholder?: string
  workspaceId?: Id<'workspaces'>
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'read', doc: { url: string; name: string; type: string }): void
  (e: 'open-reminders'): void
}>()

const isMac = ref(false)
const showMediaModal = ref(false)
const mediaModalType = ref<'audio' | 'video'>('audio')

const trackFile = useConvexMutation(api.workspaces.trackFile)
const generateUploadUrl = useConvexMutation(api.files.generateUploadUrl);
const getUrlMutation = useConvexMutation(api.files.getUrlMutation);

const uploadImageToConvex = async (file: File): Promise<string> => {
  try {
    console.log("[IdeaEditor] Starting upload for:", file.name, file.type, file.size);
    const postUrl = await generateUploadUrl.mutate({});
    if (!postUrl) throw new Error("Failed to get upload URL");
    console.log("[IdeaEditor] Uploading to:", postUrl);

    const result = await fetch(postUrl, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });

    if (!result.ok) {
      const errorText = await result.text().catch(() => "No error body");
      throw new Error(`Upload failed with status ${result.status}: ${errorText}`);
    }

    const { storageId } = await result.json();
    console.log("[IdeaEditor] Upload success, storageId:", storageId);

    if (props.workspaceId && storageId) {
      try {
        await trackFile.mutate({ workspaceId: props.workspaceId, storageId: storageId as Id<"_storage"> });
      } catch (err) {
        console.error("[IdeaEditor] Failed to track image file:", err);
      }
    }

    const publicUrl = await getUrlMutation.mutate({ storageId });
    if (!publicUrl) throw new Error("Failed to retrieve public URL");

    return publicUrl;
  } catch (err) {
    console.error("[IdeaEditor] Image upload error details:", err);
    throw err;
  }
};

// --- Link Autocomplete Overlay Logic ---
const documentQueryArgs = computed(() => props.workspaceId ? { workspaceId: props.workspaceId } : 'skip');
const { data: documents } = useConvexQuery(api.documents.list, documentQueryArgs as any);

const activeLinkInput = ref<HTMLInputElement | null>(null);
const linkTooltipCoords = ref({ top: 0, left: 0, width: 0 });
const linkSearchQuery = ref('');

const filteredDocuments = computed(() => {
  if (!documents.value) return [];
  if (linkSearchQuery.value.startsWith('http')) return []; // Exclude if obvious external link
  const query = linkSearchQuery.value.toLowerCase();
  return documents.value
    .filter((doc: any) => doc.name.toLowerCase().includes(query))
    .slice(0, 6);
});

const isFromTooltip = (target: EventTarget | null): HTMLInputElement | null => {
  if (!target) return null;
  const el = target as Element;
  if (el.tagName === 'INPUT' && el.classList.contains('input-area')) {
    const parent = el.closest('.milkdown-link-edit');
    if (parent) return el as HTMLInputElement;
  }
  return null;
};

const updateCoords = (input: HTMLInputElement) => {
  const rect = input.getBoundingClientRect();
  linkTooltipCoords.value = {
    top: rect.bottom + 8,
    left: rect.left,
    width: Math.max(rect.width, 320)
  };
};

const handleGlobalFocus = (e: FocusEvent) => {
  const input = isFromTooltip(e.target);
  if (input) {
    activeLinkInput.value = input;
    linkSearchQuery.value = input.value;
    updateCoords(input);
  } else {
    setTimeout(() => { activeLinkInput.value = null; }, 150);
  }
};

const handleGlobalInput = (e: Event) => {
  if (activeLinkInput.value && activeLinkInput.value === (e as any).composedPath()[0]) {
    linkSearchQuery.value = activeLinkInput.value.value;
    updateCoords(activeLinkInput.value);
  }
};

const selectDocument = (doc: any) => {
  if (!activeLinkInput.value) return;
  const inputEl = activeLinkInput.value;

  inputEl.value = doc.url;
  inputEl.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  inputEl.dispatchEvent(new Event('change', { bubbles: true, composed: true }));

  activeLinkInput.value = null;

  // Try pressing Enter
  inputEl.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    bubbles: true,
    composed: true,
  }));

  // Also try clicking the confirm button manually just in case
  const parent = inputEl.closest('.link-edit');
  if (parent) {
    const confirmBtn = parent.querySelector('.button') as HTMLElement;
    if (confirmBtn) confirmBtn.click();
  }
};

const handleGlobalPreviewClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  const linkPreview = target.closest('.milkdown-link-preview');
  if (!linkPreview) return;

  // Check if they clicked the main URL text or the visit icon
  if (!target.closest('.link-display') && !target.closest('.link-icon')) return;

  const anchor = linkPreview.querySelector('.link-display') as HTMLAnchorElement;
  if (!anchor) return;

  const url = anchor.href || anchor.textContent?.trim();
  if (!url) return;

  const internalDoc = documents.value?.find((d: any) => d.url === url);
  if (internalDoc) {
    e.preventDefault();
    e.stopPropagation();
    emit('read', { url: internalDoc.url!, name: internalDoc.name, type: internalDoc.type });
  }
};

onMounted(() => {
  isMac.value = window.navigator.platform.toUpperCase().indexOf('MAC') >= 0
  document.addEventListener('focusin', handleGlobalFocus, { capture: true });
  document.addEventListener('input', handleGlobalInput, { capture: true });
  document.addEventListener('click', handleGlobalPreviewClick, { capture: true });
  window.addEventListener('scroll', () => { activeLinkInput.value = null; }, true);
  window.addEventListener('resize', () => { activeLinkInput.value = null; });
})

onUnmounted(() => {
  document.removeEventListener('focusin', handleGlobalFocus, { capture: true });
  document.removeEventListener('input', handleGlobalInput, { capture: true });
  document.removeEventListener('click', handleGlobalPreviewClick, { capture: true });
  window.removeEventListener('scroll', () => { activeLinkInput.value = null; }, true);
  window.removeEventListener('resize', () => { activeLinkInput.value = null; });
})

let crepeInstance: Crepe | null = null

const onMediaSelect = async ({ url, storageId }: { url: string; storageId?: string }) => {
  showMediaModal.value = false

  // Track the file in the workspace schema if we have a workspaceId and a storageId
  if (props.workspaceId && storageId) {
    try {
      await trackFile.mutate({ workspaceId: props.workspaceId, storageId: storageId as Id<"_storage"> });
    } catch (err) {
      console.error("[IdeaEditor] Failed to track file:", err);
    }
  }

  if (crepeInstance) {
    const { editor } = crepeInstance
    if (mediaModalType.value === 'audio') {
      // @ts-ignore
      editor.ctx.get(commandsCtx).call('InsertAudio', url)
    } else {
      // @ts-ignore
      editor.ctx.get(commandsCtx).call('InsertVideo', url)
    }
  }
}

useEditor((root) => {
  const crepe = new Crepe({
    root,
    defaultValue: props.modelValue,
    featureConfigs: {
      'image-block': {
        onUpload: uploadImageToConvex,
        // blockOnUpload(file) {
        //   console.log(file)
        //   return new Promise((resolve) => {
        //     resolve('')
        //   })
        // },
      },
      placeholder: {
        text: props.placeholder || 'Start writing your brilliant idea...',
      },
      'block-edit': {
        buildMenu: (builder: any) => {
          const advancedGroup = builder.getGroup('advanced');
          advancedGroup.addItem('reminder', {
            label: 'Task Reminder',
            icon: '📋',
            onRun: () => {
              emit('open-reminders')
            },
          });
          advancedGroup.addItem('audio', {
            label: 'Audio',
            icon: '🎙️',
            onRun: () => {
              mediaModalType.value = 'audio'
              showMediaModal.value = true
            },
          });
          advancedGroup.addItem('video', {
            label: 'Video',
            icon: '🎥',
            onRun: () => {
              mediaModalType.value = 'video'
              showMediaModal.value = true
            },
          });
        }
      }
    },
  });

  crepe.editor
    .config((ctx) => {
      ctx.update(editorViewOptionsCtx, (prev) => ({
        ...prev,
        attributes: {
          class: "milkdown-editor mx-auto outline-none text-foreground leading-[1.8] text-[21px] font-medium",
          spellcheck: "false",
        },
      }));

      ctx.set(headingAttr.key, (node) => {
        const level = node.attrs.level;
        const classes = {
          1: 'text-5xl mb-10 tracking-tight leading-tight',
          2: 'text-3xl mt-12 mb-6 tracking-tight',
          3: 'text-xl mt-8 mb-4 tracking-tight'
        }[level as 1 | 2 | 3] || 'text-lg mt-6 mb-3';

        return {
          class: `${classes} font-bold text-foreground heading-${level}`,
          "data-level": level,
        };
      });

      ctx.set(paragraphAttr.key, () => ({
        class: "mb-6 last:mb-0 text-foreground",
      }));
    })
    .use(commonmark)
    .use(audioPlugin)
    .use(videoPlugin);

  crepeInstance = crepe;

  // Correctly listen for markdown updates for auto-save
  crepe.on((api) => {
    api.markdownUpdated((_ctx, markdown) => {
      emit('update:modelValue', markdown)
    })
  });

  return crepe;
})

// Watch for external content changes (e.g. switching workspaces)
watch(() => props.modelValue, (newVal) => {
  if (crepeInstance && newVal == crepeInstance.getMarkdown()) {
    // Note: Crepe doesn't have a direct setMarkdown yet in the same way, 
    // but the useEditor root usually handles the reactive binding or re-mount if needed.
    // For now, assume the parent manages the re-mount of the provider
  }
}, { immediate: true })
</script>

<template>
  <div class="milkdown-editor-wrapper h-full no-scrollbar">
    <Milkdown />

    <!-- Subtle Sync Status (Floating) -->
    <!-- <div
      class="fixed bottom-6 right-8 text-[10px] text-slate-700 font-bold uppercase tracking-widest pointer-events-none opacity-50 hover:opacity-100 transition-opacity">
      Auto-saving to cloud
    </div> -->

    <MediaModal v-if="showMediaModal" :type="mediaModalType" @close="showMediaModal = false" @select="onMediaSelect" />

    <!-- Link Autocomplete Overlay -->
    <Teleport to="body">
      <div v-if="activeLinkInput && filteredDocuments.length > 0"
        :style="{ top: `${linkTooltipCoords.top}px`, left: `${linkTooltipCoords.left}px`, width: `${linkTooltipCoords.width}px` }"
        class="fixed z-[9999] bg-background border border-border shadow-xl shadow-slate-900/5 rounded-2xl overflow-hidden animate-fade-in-up">
        <div
          class="px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground bg-muted/80 border-b border-border flex justify-between">
          <span>Internal Documents</span>
          <span class="text-primary/70">Click to Insert</span>
        </div>
        <div class="max-h-[240px] overflow-y-auto no-scrollbar py-1">
          <button v-for="doc in filteredDocuments" :key="doc._id" @mousedown.prevent.stop="selectDocument(doc)"
            class="w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-muted transition-colors group border-b border-border/50 last:border-transparent">
            <div
              class="w-9 h-9 rounded-xl bg-background shadow-sm border border-border flex items-center justify-center shrink-0 group-hover:border-primary/30 group-hover:shadow-primary/10 transition-all">
              <svg class="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 24 24" v-if="doc.type.includes('pdf')">
                <path d="M7 3v18h10V8l-5-5H7zm5 6.5l3.5 3.5h-2v4h-3v-4H8.5L12 9.5z" />
              </svg>
              <svg class="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 24 24" v-else>
                <path
                  d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
              </svg>
            </div>
            <div class="truncate">
              <div class="text-[13px] font-bold text-foreground group-hover:text-primary truncate transition-colors">{{
                doc.name }}</div>
              <div class="text-[9px] uppercase font-bold text-muted-foreground tracking-wider mt-0.5">Workspace File
              </div>
            </div>
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style>
@reference "../../../../packages/ui/src/global.css";

/* Override Milkdown Crepe styles to match our premium aesthetic */
.milkdown-editor-wrapper {
  font-family: "Urbanist", sans-serif;
}

.milkdown-editor-wrapper .milkdown {
  @apply bg-transparent border-none max-w-none;
}

.milkdown-editor-wrapper .crepe-editor {
  @apply max-w-none px-0;
}

.milkdown-editor-wrapper .ProseMirror {
  @apply outline-none pb-96 px-0 min-h-[80vh] pt-0;
  caret-color: var(--primary);
}

.milkdown-editor-wrapper .ProseMirror strong {
  @apply font-black;
}

/* Customize Crepe specific UI elements */
.milkdown-editor-wrapper .crepe-placeholder {
  @apply text-muted-foreground/50 font-normal not-italic;
}

/* Toolbars and menus styling */
/*  straight from milkdown docs but personalized */
.milkdown {
  /* Background Colors */
  --crepe-color-background: transparent;
  --crepe-color-surface: var(--background);
  --crepe-color-surface-low: var(--muted);

  /* Text Colors */
  --crepe-color-on-background: var(--foreground);
  --crepe-color-on-surface: var(--foreground);
  --crepe-color-on-surface-variant: var(--muted-foreground);

  /* Accent Colors */
  --crepe-color-primary: var(--primary);
  --crepe-color-secondary: color-mix(in srgb, var(--primary), transparent 85%);
  --crepe-color-on-secondary: var(--primary-foreground);

  /* UI Colors */
  --crepe-color-outline: var(--border);
  --crepe-color-inverse: var(--foreground);
  --crepe-color-on-inverse: var(--background);
  --crepe-color-inline-code: var(--primary);
  --crepe-color-error: #ef4444;

  /* Interactive Colors */
  --crepe-color-hover: var(--accent);
  --crepe-color-selected: var(--accent);
  --crepe-color-inline-area: var(--muted);

  /* Font Families */
  --crepe-font-title: "Urbanist", sans-serif;
  --crepe-font-default: "Urbanist", sans-serif;
  --crepe-font-code: "Fira Code", monospace;

  /* Large Shadow */
  --crepe-shadow-1: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  --crepe-shadow-2: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
}

.dark .milkdown {
  --crepe-color-secondary: color-mix(in srgb, var(--primary), transparent 80%);
  --crepe-shadow-1: 0 4px 6px -1px rgb(0 0 0 / 0.5), 0 2px 4px -2px rgb(0 0 0 / 0.3);
  --crepe-shadow-2: 0 20px 25px -5px rgb(0 0 0 / 0.5), 0 8px 10px -6px rgb(0 0 0 / 0.3);
}

/* Milkdown editor base styles */
.milkdown .editor {
  @apply max-w-none text-foreground!;
}

/* Paragraph styling */
.milkdown .editor .paragraph {
  @apply mb-0;
  /* Handled by config classes */
}

/* Ensure Milkdown icons and SVGs are visible and respect theme */
.milkdown .icon,
.milkdown svg,
.milk-icon {
  @apply text-foreground! fill-current!;
  color: var(--foreground);
}

/* Floating components specific overrides */
.milkdown-link-edit,
.milkdown-link-preview,
.crepe-menu,
.crepe-search {
  @apply bg-background! border! border-border! text-foreground! shadow-2xl!;
  --crepe-color-surface: var(--background);
  --crepe-color-on-surface: var(--foreground);
}

.milkdown-editor-wrapper .crepe-editor .paragraph {
  @apply mb-6 leading-relaxed;
}

.milkdown .editor .bullet-list,
.milkdown .editor .ordered-list {
  @apply pl-6 mb-6;
}

.milkdown .editor .list-item {
  @apply mb-2;
}

@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.98);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.animate-fade-in-up {
  animation: fade-in-up 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
</style>
