<script setup lang="ts">
import { ref, computed } from 'vue';
import { useConvexQuery, useConvexMutation } from "@meideate/ui/convex";
import { api } from "@meideate/convex";
import type { Id } from "@meideate/convex/dataModel";
import Modal from "./Modal.vue";

const props = defineProps<{
  workspaceId: Id<"workspaces">;
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'read', doc: { url: string; name: string; type: string }): void;
}>();

const documentsArgs = computed(() => ({ workspaceId: props.workspaceId }));
const { data: documents, isPending } = useConvexQuery(api.documents.list, documentsArgs);
const generateUploadUrl = useConvexMutation(api.files.generateUploadUrl);
const saveDocument = useConvexMutation(api.documents.save);
const removeDocument = useConvexMutation(api.documents.remove);

const isUploading = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const docToDelete = ref<Id<"documents"> | null>(null);
const showDeleteConfirm = ref(false);

const triggerUpload = () => {
  fileInput.value?.click();
};

const handleFileDrop = async (event: DragEvent) => {
  const file = event.dataTransfer?.files[0];
  if (file) await uploadFile(file);
};

const handleFileSelect = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) await uploadFile(file);
  target.value = ''; // reset
};

const uploadFile = async (file: File) => {
  isUploading.value = true;
  try {
    const postUrl = await generateUploadUrl.mutate({});
    if (!postUrl) throw new Error("Failed to get upload URL");

    const result = await fetch(postUrl, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!result.ok) throw new Error(`Upload failed with status ${result.status} at ${postUrl}`);

    const { storageId } = await result.json();

    await saveDocument.mutate({
      workspaceId: props.workspaceId,
      name: file.name,
      fileId: storageId,
      type: file.type || 'application/octet-stream',
      size: file.size,
    });
  } catch (err) {
    console.error("Upload error:", err);
    alert("Failed to upload document.");
  } finally {
    isUploading.value = false;
  }
};

const confirmDelete = (id: Id<"documents">) => {
  docToDelete.value = id;
  showDeleteConfirm.value = true;
};

const handleDelete = async () => {
  if (docToDelete.value) {
    await removeDocument.mutate({ id: docToDelete.value });
    showDeleteConfirm.value = false;
    docToDelete.value = null;
  }
};
</script>

<template>
  <div class="fixed inset-0 z-[200] flex justify-end pointer-events-none">
    <!-- Backdrop -->
    <Transition name="fade">
      <div v-if="isOpen" class="absolute inset-0 bg-slate-900/20 backdrop-blur-sm pointer-events-auto"
        @click="emit('close')"></div>
    </Transition>
    <!-- Slide-over Panel -->
    <Transition name="slide-panel">
      <div v-if="isOpen"
        class="relative w-full sm:max-w-md h-full bg-background shadow-2xl flex flex-col pointer-events-auto border-l border-border">
        <!-- Header -->
        <header class="p-6 border-b border-border flex justify-between items-center bg-muted shrink-0">
          <div>
            <h2 class="text-xl font-black text-foreground tracking-tight">Reference Library</h2>
            <p class="text-[11px] text-muted-foreground font-bold uppercase tracking-widest mt-1 opacity-70">Knowledge Base</p>
          </div>
          <button @click="emit('close')"
            class="p-2 bg-background hover:bg-muted text-muted-foreground hover:text-foreground rounded-xl transition-all shadow-sm border border-border hover:scale-105 active:scale-95">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-6 bg-background relative flex flex-col no-scrollbar" @dragover.prevent
          @drop.prevent="handleFileDrop">
          <!-- Drop zone -->
          <div
            class="border-2 border-dashed border-primary/30 rounded-[2rem] p-8 text-center bg-primary/5 hover:bg-primary/10 transition-all cursor-pointer group mb-8 shrink-0 border-spacing-4 hover:border-primary"
            @click="triggerUpload">
            <input type="file" ref="fileInput" class="hidden" @change="handleFileSelect"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx" />
            <div
              class="w-14 h-14 bg-background rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/10 group-hover:scale-110 transition-transform border border-primary/20">
              <svg class="w-7 h-7 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <h3 class="text-[14px] font-black text-foreground mb-1">Add to Library</h3>
            <p class="text-[10px] text-muted-foreground uppercase tracking-widest font-black opacity-60">PDF, Office (50MB max)
            </p>
            <div v-if="isUploading"
              class="mt-4 flex items-center justify-center gap-2 text-primary font-black uppercase tracking-widest text-[10px]">
              <svg class="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none">
                </circle>
                <path class="opacity-75" fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
                </path>
              </svg>
              Syncing File...
            </div>
          </div>

          <!-- Document List -->
          <div class="flex-1 flex flex-col min-h-0">
            <h3 class="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-4 shrink-0 px-2">Stored
              Documents</h3>

            <div v-if="isPending" class="flex-1 flex items-center justify-center py-12">
              <div class="animate-pulse flex flex-col items-center gap-3">
                <div class="w-10 h-10 bg-muted rounded-xl"></div>
                <div class="h-2 w-24 bg-muted rounded"></div>
              </div>
            </div>
            <div v-else-if="documents?.length === 0"
              class="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-[2rem] min-h-[200px] bg-muted/30">
              <p class="text-[11px] uppercase tracking-widest font-black text-muted-foreground opacity-60">Library is empty</p>
            </div>
            <div v-else class="flex flex-col gap-3">
              <div v-for="doc in documents" :key="doc._id"
                class="group flex flex-col p-4 bg-muted/40 hover:bg-background rounded-2xl border border-border hover:border-primary/30 hover:shadow-xl transition-all">
                <div class="flex items-center gap-4">
                  <div
                    class="w-12 h-12 bg-background rounded-xl shadow-sm flex items-center justify-center shrink-0 border border-border group-hover:scale-105 transition-transform">
                    <svg class="w-6 h-6 text-red-500 dark:text-red-400" fill="currentColor" viewBox="0 0 24 24"
                      v-if="doc.type.includes('pdf')">
                      <path d="M7 3v18h10V8l-5-5H7zm5 6.5l3.5 3.5h-2v4h-3v-4H8.5L12 9.5z" />
                    </svg>
                    <svg class="w-6 h-6 text-blue-500 dark:text-blue-400" fill="currentColor" viewBox="0 0 24 24" v-else>
                      <path
                        d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
                    </svg>
                  </div>
                  <div class="flex-1 min-w-0">
                    <h4 class="text-[14px] font-black text-foreground truncate leading-tight">{{ doc.name }}</h4>
                    <p class="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">
                      {{ (doc.size / 1024 / 1024).toFixed(1) }} MB • {{ doc.type.split('/').pop()?.toUpperCase() }}
                    </p>
                  </div>

                  <div
                    class="flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all shrink-0">
                    <button @click="emit('read', { url: doc.url!, name: doc.name, type: doc.type })"
                      class="w-10 h-10 flex items-center justify-center bg-background text-muted-foreground hover:text-primary rounded-xl transition-all shadow-sm border border-border hover:scale-105 active:scale-95">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
                        viewBox="0 0 24 24">
                        <g fill="currentColor" fill-rule="evenodd" clip-rule="evenodd">
                          <path
                            d="M12 8.25a3.75 3.75 0 1 0 0 7.5a3.75 3.75 0 0 0 0-7.5M9.75 12a2.25 2.25 0 1 1 4.5 0a2.25 2.25 0 0 1-4.5 0" />
                          <path
                            d="M12 3.25c-4.514 0-7.555 2.704-9.32 4.997l-.031.041c-.4.519-.767.996-1.016 1.56c-.267.605-.383 1.264-.383 2.152s.116 1.547.383 2.152c.25.564.617 1.042 1.016 1.56l.032.041C4.445 18.046 7.486 20.75 12 20.75s7.555-2.704 9.32-4.997l.031-.041c.4-.518.767-.996 1.016-1.56c.267-.605.383-1.264.383-2.152s-.116 1.547-.383 2.152c-.25-.564-.617-1.041-1.016-1.56l-.032-.041C19.555 5.954 16.514 3.25 12 3.25M3.87 9.162C5.498 7.045 8.15 4.75 12 4.75s6.501 2.295 8.13 4.412c.44.57.696.91.865 1.292c.158.358.255.795.255 1.546s-.097 1.188-.255 1.546c.169.382.426.722c.864-1.292C18.5 16.955 15.85 19.25 12 19.25s-6.501-2.295-8.13-4.412c-.44-.57-.696-.91-.865-1.292c-.158-.358-.255-.795-.255-1.546s.097-1.188.255-1.546c.169-.382.426-.722c.864-1.292" />
                        </g>
                      </svg>
                    </button>
                    <button @click="confirmDelete(doc._id)"
                      class="w-10 h-10 flex items-center justify-center bg-background text-muted-foreground hover:text-red-500 rounded-xl transition-all shadow-sm border border-border hover:scale-105 active:scale-95">
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <Modal :isOpen="showDeleteConfirm" title="Remove Document?" confirmText="Yes, Delete"
      @close="showDeleteConfirm = false" @confirm="handleDelete">
      <p class="text-slate-600 text-sm">Are you sure you want to remove this document from the library? This action
        cannot be undone.</p>
    </Modal>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-panel-enter-active,
.slide-panel-leave-active {
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease-out;
}

.slide-panel-enter-from,
.slide-panel-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>
