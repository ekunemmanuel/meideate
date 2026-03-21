<script setup lang="ts">
import { ref } from 'vue';
import Modal from './Modal.vue';

defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const activeTab = ref('general');
const settings = ref({
  theme: 'light',
  notifications: true,
  showHeatmap: true
});

const tabs = [
  { id: 'general', name: 'General', icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4' },
  { id: 'profile', name: 'Profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  { id: 'appearance', name: 'Appearance', icon: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01' }
];

</script>

<template>
  <Modal :isOpen="isOpen" @close="emit('close')" title="Settings" confirmText="Save Changes" @confirm="emit('close')" class="w-full">
    <div class="flex h-[400px] -mx-6 my-6">
      <!-- Navigation -->
      <aside class="w-48 border-r border-slate-100 bg-slate-50 p-4 shrink-0 flex flex-col gap-1">
        <button 
          v-for="tab in tabs" 
          :key="tab.id"
          @click="activeTab = tab.id"
          class="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all"
          :class="activeTab === tab.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:bg-slate-200/50 hover:text-slate-900'"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" :d="tab.icon" />
          </svg>
          {{ tab.name }}
        </button>
      </aside>

      <!-- Content area -->
      <main class="flex-1 p-6 overflow-y-auto">
        <div v-if="activeTab === 'general'" class="space-y-6">
          <div>
            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">System</label>
            <div class="flex items-center justify-between p-3.5 bg-slate-50/50 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all">
              <span class="text-xs font-black text-slate-700 uppercase tracking-widest opacity-60">Desktop Notifications</span>
              <button @click="settings.notifications = !settings.notifications" 
                class="w-10 h-5 rounded-full transition-colors relative"
                :class="settings.notifications ? 'bg-indigo-600 shadow-lg shadow-indigo-600/20' : 'bg-slate-300'"
              >
                <div class="absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform" :class="settings.notifications ? 'translate-x-5' : 'translate-x-0'"></div>
              </button>
            </div>
          </div>

          <div>
            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Productivity</label>
            <div class="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <span class="text-xs font-bold text-slate-700">Show Activity Heatmap</span>
              <button @click="settings.showHeatmap = !settings.showHeatmap" 
                class="w-10 h-5 rounded-full transition-colors relative"
                :class="settings.showHeatmap ? 'bg-indigo-600' : 'bg-slate-300'"
              >
                <div class="absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform" :class="settings.showHeatmap ? 'translate-x-5' : 'translate-x-0'"></div>
              </button>
            </div>
          </div>

          <div v-if="settings.showHeatmap">
            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Activity Heatmap</label>
            <div class="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-3">
              <div class="grid grid-cols-7 gap-1">
                <div v-for="i in 28" :key="i" 
                  class="w-3 h-3 rounded-[2px]" 
                  :class="[
                    i % 7 === 0 ? 'bg-indigo-500' : 
                    i % 5 === 0 ? 'bg-indigo-300' : 
                    i % 3 === 0 ? 'bg-indigo-100' : 'bg-slate-200'
                  ]">
                </div>
              </div>
              <div class="flex justify-between items-center text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                <span>Less</span>
                <div class="flex gap-1">
                  <div class="w-2 h-2 rounded-[1px] bg-slate-200"></div>
                  <div class="w-2 h-2 rounded-[1px] bg-indigo-100"></div>
                  <div class="w-2 h-2 rounded-[1px] bg-indigo-300"></div>
                  <div class="w-2 h-2 rounded-[1px] bg-indigo-500"></div>
                </div>
                <span>More</span>
              </div>
            </div>
          </div>
        </div>

        <div v-if="activeTab === 'profile'" class="flex flex-col items-center justify-center h-full text-center">
          <div class="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 border-2 border-slate-200">
            <svg class="w-8 h-8 text-slate-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
          </div>
          <h4 class="text-sm font-bold text-slate-900">User Profile</h4>
          <p class="text-[11px] text-slate-500 font-medium">Coming soon in the next update.</p>
        </div>

        <div v-if="activeTab === 'appearance'" class="space-y-4">
          <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Theme</label>
          <div class="grid grid-cols-2 gap-4">
            <div class="p-4 rounded-2xl border-2 border-indigo-600 bg-white flex flex-col items-center gap-2 cursor-pointer shadow-sm">
              <div class="w-full h-12 bg-slate-50 rounded-lg"></div>
              <span class="text-[11px] font-bold text-slate-900">Light Mode</span>
            </div>
            <div class="p-4 rounded-2xl border-2 border-slate-100 bg-slate-900 flex flex-col items-center gap-2 cursor-not-allowed opacity-50">
              <div class="w-full h-12 bg-slate-800 rounded-lg"></div>
              <span class="text-[11px] font-bold text-slate-400">Dark Mode</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  </Modal>
</template>
