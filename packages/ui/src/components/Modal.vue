<script setup lang="ts">
const props = defineProps<{
  isOpen: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  class?: string;
}>();

defineEmits<{
  (e: 'confirm'): void;
  (e: 'close'): void;
}>();
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="isOpen" class="fixed inset-0 z-[1000] flex items-center justify-center">
        <div class="absolute inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-sm" @click="$emit('close')"></div>
        <div :class="['relative bg-background rounded-2xl shadow-2xl w-[95vw] sm:w-full sm:max-w-lg p-6 animate-[modal-slide-up_0.2s_ease-out] border border-border', props.class]">
          <h3 v-if="title" class="text-xl font-black text-foreground mb-2 leading-tight tracking-tight">{{ title }}</h3>
          <div class="mb-2">
            <slot>
              <p v-if="message" class="text-[13px] font-semibold text-muted-foreground mb-6">{{ message }}</p>
            </slot>
          </div>
          <div class="flex gap-3 justify-end mt-4">
            <button @click="$emit('close')" class="px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted border border-border rounded-xl transition-colors">
              {{ cancelText || 'Cancel' }}
            </button>
            <button @click="$emit('confirm')" class="px-4 py-2 text-xs font-bold text-primary-foreground rounded-xl shadow-sm transition-all active:scale-95"
              :class="isDestructive ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' : 'bg-primary shadow-primary/20'">
              {{ confirmText || 'Confirm' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style>
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; pointer-events: none; }
@keyframes modal-slide-up {
  from { opacity: 0; transform: translateY(20px) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
</style>
