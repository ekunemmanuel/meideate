<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useConvexQuery, useConvexMutation } from "convex-vue";
import { api } from "@meideate/convex";
import type { Id } from "@meideate/convex/dataModel";
import { MilkdownProvider } from "@milkdown/vue";

// Local component imports (since they are in the same directory)
import IdeaEditor from "./IdeaEditor.vue";
import WorkspaceLibraryModal from "./WorkspaceLibraryModal.vue";
import WorkspaceRemindersModal from "./WorkspaceRemindersModal.vue";
import Modal from "./Modal.vue";
import SettingsModal from "./SettingsModal.vue";
import SearchModal from "./SearchModal.vue";
import MediaModal from "./MediaModal.vue";

const searchQuery = ref("");
const showSettings = ref(false);
const isSaving = ref(false);
const showMobileSidebar = ref(false);
const showSearchModal = ref(false);
const showLandingVoiceModal = ref(false);
const isDark = ref(localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches));

const toggleTheme = () => {
  isDark.value = !isDark.value;
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light');
};

// Immediate sync for theme class
const syncTheme = (dark: boolean) => {
  if (dark) document.documentElement.classList.add('dark');
  else document.documentElement.classList.remove('dark');
};
syncTheme(isDark.value);

watch(isDark, (newVal: boolean) => {
  syncTheme(newVal);
});

// Workspaces
const { data: workspaces, isPending: loadingWorkspaces } = useConvexQuery(api.workspaces.list, {});
const createWorkspaceMutation = useConvexMutation(api.workspaces.create);
const removeWorkspaceMutation = useConvexMutation(api.workspaces.remove);
const updateWorkspaceMutation = useConvexMutation(api.workspaces.update);
const trackFile = useConvexMutation(api.workspaces.trackFile);

const selectedWorkspaceId = ref<Id<"workspaces">>();

const selectedWorkspace = computed(() => {
  return workspaces.value?.find((w) => w._id === selectedWorkspaceId.value);
});

// Auto-save logic
const saveTimeout = ref<ReturnType<typeof setTimeout>>();
const handleContentUpdate = (newContent: string) => {
  if (!selectedWorkspaceId.value) return;

  // Clear existing timeout
  if (saveTimeout.value) clearTimeout(saveTimeout.value);

  // Debounce save (500ms)
  saveTimeout.value = setTimeout(async () => {
    isSaving.value = true;
    try {
      let updateData: any = { id: selectedWorkspaceId.value, content: newContent };
      // ... Title Sync Logic ...
      const lines = newContent.split('\n');
      const firstH1 = lines.find(line => line.trim().startsWith('# '));
      if (firstH1) {
        let newName = firstH1.replace('# ', '').trim();
        newName = newName
          .replace(/(\*\*|__)(.*?)\1/g, '$2')
          .replace(/(\*|_)(.*?)\1/g, '$2')
          .replace(/~~(.*?)~~/g, '$1')
          .replace(/`(.*?)`/g, '$1')
          .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
          .trim();

        if (newName && newName !== selectedWorkspace.value?.name) {
          updateData.name = newName;
        }
      }

      await updateWorkspaceMutation.mutate(updateData);
    } finally {
      isSaving.value = false;
    }
  }, 500);
};

// Actions
const selectWorkspace = (id: Id<"workspaces">) => {
  selectedWorkspaceId.value = id;
  activeDocument.value = null;
};

const showLibrary = ref(false);
const activeDocument = ref<{ url: string; name: string; type: string } | null>(null);

const handleReadDocument = (doc: { url: string; name: string; type: string }) => {
  activeDocument.value = doc;
  showLibrary.value = false;
};

const showReminders = ref(false);
const remindersArgs = computed(() => ({ workspaceId: selectedWorkspaceId.value }));
const { data: workspaceReminders } = useConvexQuery(api.reminders.list, remindersArgs);

const pendingRemindersCount = computed(() => {
  if (!workspaceReminders.value) return 0;
  return workspaceReminders.value.filter((r) => !r.isCompleted).length;
});

const createWorkspace = async (initialTitle?: string, initialContent?: string) => {
  const name = initialTitle || "New Idea";
  const content = initialContent || `# ${name}\n\n`;
  const id = await createWorkspaceMutation.mutate({ name, content });
  if (id) selectedWorkspaceId.value = id;
};

const handleLandingVoiceCapture = async (data: { url: string; storageId?: string }) => {
  showLandingVoiceModal.value = false;
  const dateStr = new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(':', '.');
  const name = `Voice Capture (${dateStr})`;
  const content = `# ${name}\n\n::audio{src="${data.url}"}\n\n`;

  const id = await createWorkspaceMutation.mutate({ name, content });

  // Track the audio file in the new workspace if storageId is present
  if (id && data.storageId) {
    try {
      await trackFile.mutate({ workspaceId: id, storageId: data.storageId as Id<"_storage"> });
    } catch (err) {
      console.error("[App] Failed to track voice file:", err);
    }
  }

  selectedWorkspaceId.value = id;
};

// Workspace Deletion Modal State
const workspaceToDelete = ref<Id<"workspaces"> | null>(null);
const showDeleteConfirm = ref(false);

const confirmDelete = (id: Id<"workspaces">) => {
  workspaceToDelete.value = id;
  showDeleteConfirm.value = true;
};

const handlePermanentDelete = async () => {
  if (!workspaceToDelete.value) return;
  await removeWorkspaceMutation.mutate({ id: workspaceToDelete.value });
  if (selectedWorkspaceId.value === workspaceToDelete.value) {
    selectedWorkspaceId.value = undefined;
  }
  showDeleteConfirm.value = false;
  workspaceToDelete.value = null;
};

// Sidebar Grouping Logic
const groupedWorkspaces = computed(() => {
  if (!workspaces.value) return {};

  const groups: Record<string, any[]> = {
    'Today': [],
    'Yesterday': [],
    'Previous 7 Days': [],
    'Previous 30 Days': [],
    'Older': []
  };

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - (24 * 60 * 60 * 1000);
  const sevenDaysAgo = today - (7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = today - (30 * 24 * 60 * 60 * 1000);

  workspaces.value.forEach(w => {
    // Search Filter
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase();
      const nameMatch = w.name?.toLowerCase().includes(query);
      const contentMatch = w.content?.toLowerCase().includes(query);
      if (!nameMatch && !contentMatch) return;
    }

    // FALLBACK: Use _creationTime if updatedAt is not yet populated
    const time = (w as any).updatedAt || w._creationTime || 0;
    let target = 'Older';
    if (time >= today) target = 'Today';
    else if (time >= yesterday) target = 'Yesterday';
    else if (time >= sevenDaysAgo) target = 'Previous 7 Days';
    else if (time >= thirtyDaysAgo) target = 'Previous 30 Days';

    const group = groups[target];
    if (group) {
      group.push(w);
    }
  });

  // Filter out empty groups
  return Object.fromEntries(Object.entries(groups).filter(([_, list]) => list.length > 0));
});

const seedMutation = useConvexMutation(api.seed.seed);
const runSeed = async () => {
  await seedMutation.mutate({});
};

// Sidebar Toggle
const showSidebar = ref(true);

// Desktop Notifications Poller
const { data: allReminders } = useConvexQuery(api.reminders.listAll, {});
const notifiedReminders = new Set<string>();
let notificationInterval: ReturnType<typeof setInterval>;

onMounted(() => {
  if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
    Notification.requestPermission();
  }

  notificationInterval = setInterval(() => {
    if (!allReminders.value) return;
    const now = Date.now();
    for (const r of allReminders.value) {
      if (r.isCompleted || !r.dueDate) continue;
      const diff = r.dueDate - now;
      const thresholds = [
        { min: 120, ms: 120 * 60000, msg: "2 Hours Left! Get to work!" },
        { min: 60, ms: 60 * 60000, msg: "1 Hour Left! Time is ticking!" },
        { min: 30, ms: 30 * 60000, msg: "30 Mins Left! Focus!" },
        { min: 15, ms: 15 * 60000, msg: "15 Mins Left! ALMOST OUT OF TIME!" }
      ];
      for (const t of thresholds) {
        if (diff > 0 && diff <= t.ms) {
          const key = `${r._id}-${t.min}`;
          if (!notifiedReminders.has(key)) {
            notifiedReminders.add(key);
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification(`Due soon: ${r.task}`, { body: t.msg });
            }
          }
        }
      }
    }
  }, 60000);
});

onUnmounted(() => {
  if (notificationInterval) clearInterval(notificationInterval);
});


// Document Rendering Helper
const getDocumentIframeSrc = (doc: { url: string; name: string; type: string }) => {
  const officeExtensions = ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'];
  // IMPORTANT: Use doc.name instead of doc.url because storage URLs (/api/storage/...) don't have extensions!
  const extension = doc.name.split('.').pop()?.toLowerCase() || '';

  if (officeExtensions.includes(extension)) {
    // Using Google Docs Viewer for better cross-compatibility with storage URLs
    return `https://docs.google.com/viewer?url=${encodeURIComponent(doc.url)}&embedded=true`;
  }
  return doc.url;
};

const formatRelativeTime = (time: number) => {
  const diff = Date.now() - time;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
};
</script>

<template>
  <div class="flex h-screen text-foreground overflow-hidden font-sans bg-background">
    <!-- Mobile Sidebar Backdrop -->
    <Transition name="fade">
      <div v-if="showMobileSidebar" @click="showMobileSidebar = false"
        class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[45] md:hidden"></div>
    </Transition>

    <!-- Sidebar -->
    <aside :class="[
      showSidebar ? 'w-64' : 'w-[72px]',
      showMobileSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
      'fixed md:relative inset-y-0 left-0 border-r border-border flex flex-col bg-muted shrink-0 transition-all duration-300 z-50 overflow-hidden'
    ]">

      <div class="p-3 flex items-center h-16 shrink-0" :class="showSidebar ? 'justify-between' : 'justify-center'">
        <div v-if="showSidebar" class="flex items-center gap-3 overflow-hidden ml-3">
          <img src="/logo.png" alt="M" class="w-8 h-8 rounded-lg shadow-lg shadow-primary/20 shrink-0 object-cover" />
          <h1 class="text-xl font-bold tracking-tight text-foreground truncate">Meideate</h1>
        </div>

        <button @click="showSidebar = !showSidebar"
          class="p-2 text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10 rounded-xl transition-colors shrink-0"
          :title="showSidebar ? 'Close Sidebar' : 'Open Sidebar'">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7" />
          </svg>
        </button>
      </div>

      <div class="px-3 mb-4 space-y-1">
        <div @click="!showSidebar && (showSearchModal = true)"
          class="px-3 py-2 rounded-xl text-muted-foreground hover:text-foreground bg-accent/50 flex items-center gap-3 text-sm font-medium transition-all"
          :class="!showSidebar && 'justify-center border-transparent cursor-pointer'" title="Search">
          <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input v-if="showSidebar" v-model="searchQuery" placeholder="Search..."
            class="bg-transparent border-none outline-none text-xs w-full placeholder:text-muted-foreground font-bold text-foreground" />
        </div>
        <button @click="toggleTheme"
          class="w-full py-2 px-3 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent flex items-center gap-3 text-sm font-medium"
          :class="!showSidebar && 'justify-center'" :title="isDark ? 'Light Mode' : 'Dark Mode'">
          <svg v-if="isDark" class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <svg v-else class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
          <span v-if="showSidebar" class="truncate">{{ isDark ? 'Light Mode' : 'Dark Mode' }}</span>
        </button>
      </div>

      <div class="px-3 mb-6 flex justify-center w-full">
        <button @click="createWorkspace()"
          class="h-11 rounded-xl border border-border bg-background hover:bg-muted/80 transition-all flex items-center justify-center gap-2 shadow-sm w-full mx-auto text-muted-foreground hover:text-foreground hover:shadow-md group"
          title="New Idea" :class="showSidebar ? 'px-4' : 'px-0 max-w-[44px]'">
          <svg class="w-5 h-5 shrink-0 text-primary group-hover:scale-110 transition-transform" fill="none"
            stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
          </svg>
          <span v-if="showSidebar" class="text-sm font-bold whitespace-nowrap overflow-hidden transition-all">New
            Idea</span>
        </button>
      </div>

      <div v-if="loadingWorkspaces && showSidebar"
        class="p-4 text-xs text-muted-foreground uppercase tracking-widest font-semibold text-center mt-4">
        Loading...
      </div>
      <div v-else-if="workspaces?.length === 0 && showSidebar"
        class="p-4 text-xs text-muted-foreground italic text-center mt-4">
        No workspaces yet.
        <button @click="runSeed" class="text-primary mt-2 block hover:underline w-full text-center font-bold">Run
          Seed</button>
      </div>

      <div v-else-if="showSidebar" class="flex-1 overflow-y-auto px-4 custom-scrollbar">
        <div v-for="(list, group) in groupedWorkspaces" :key="group" class="mb-6">
          <div v-if="showSidebar"
            class="px-3 mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
            {{ group }}
            <div class="h-px flex-1 bg-border/50"></div>
          </div>
          <div class="space-y-1">
            <div v-for="workspace in list" :key="workspace._id" @click="selectWorkspace(workspace._id)"
              class="group p-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-3 relative" :class="[
                selectedWorkspaceId === workspace._id
                  ? 'bg-background text-foreground shadow-sm border border-border'
                  : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground'
              ]">
              <!-- Letter Icon (Commented out as per user's latest change) -->
              <!-- <div
                class="w-8 h-8 rounded-lg flex items-center justify-center text-[13px] font-bold transition-transform group-hover:scale-110 shadow-sm border"
                :class="selectedWorkspaceId === workspace._id ? 'bg-primary/10 text-primary border-primary/20' : 'bg-muted text-muted-foreground border-border'">
                {{ (workspace.name || "N").charAt(0).toUpperCase() }}
              </div> -->
              <div v-if="showSidebar" class="flex-1 min-w-0">
                <div class="text-[13px] font-bold truncate">{{ workspace.name || 'Untitled Idea' }}</div>
                <div class="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">
                  {{ formatRelativeTime((workspace as any).updatedAt || workspace._creationTime) }}
                </div>
              </div>

              <button @click.stop="confirmDelete(workspace._id)"
                class="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all absolute right-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>


      <div
        class="mt-auto p-4 flex items-center opacity-40 dark:opacity-60 shrink-0 overflow-hidden text-muted-foreground"
        :class="showSidebar ? 'justify-start' : 'justify-center'" title="v0.1.0 Alpha">
        <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span v-if="showSidebar" class="ml-2 text-[10px] uppercase tracking-widest font-bold whitespace-nowrap">v0.1.0
          Alpha</span>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 flex flex-col relative overflow-hidden min-h-screen bg-background">

      <!-- Workspace Header -->
      <header v-if="selectedWorkspaceId"
        class="h-16 shrink-0 flex items-center justify-between px-4 sm:px-8 border-b border-border bg-background/80 backdrop-blur-md z-10 transition-all duration-300">
        <div class="flex items-center gap-4">
          <!-- Mobile Menu Toggle -->
          <button @click="showMobileSidebar = true"
            class="md:hidden p-2 -ml-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-xl transition-all">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>


          <div class="min-w-0 flex-1 flex flex-col">
            <div class="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em] truncate w-40 sm:w-100">
              {{ selectedWorkspace?.name || 'Untitled' }}
            </div>
            <div class="text-[9px] font-bold uppercase tracking-widest transition-all duration-300"
              :class="isSaving ? 'text-primary animate-pulse' : 'text-muted-foreground opacity-50'">
              {{ isSaving ? 'Saving...' : 'Saved' }}
            </div>
          </div>
        </div>
        <div class="flex items-center gap-3 shrink-0 ml-4">
          <button @click="showReminders = true"
            class="relative flex items-center justify-center p-2.5 bg-background hover:bg-muted text-foreground rounded-xl transition-all shadow-sm border border-border group hover:border-primary/30 active:scale-95"
            title="Reminders">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
              <g fill="none" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M15.75 4.5h3.75A1.5 1.5 0 0 1 21 6v15.75a1.5 1.5 0 0 1-1.5 1.5h-15a1.5 1.5 0 0 1-1.5-1.5V6a1.5 1.5 0 0 1 1.5-1.5h3.75a3.75 3.75 0 0 1 7.5 0" />
                <path d="M12 4.5a.375.375 0 0 1 0-.75m0 .75a.375.375 0 0 0 0-.75" />
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M6.75 10.5H12m3 0h2.25m0 3.75H12m-3 0H6.75m0 3.75H12m3 0h2.25" />
              </g>
            </svg>
            <span v-if="pendingRemindersCount > 0" class="absolute -top-1 -right-1 flex h-4 w-4">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span
                class="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-[9px] leading-none font-black text-white items-center justify-center ring-2 ring-background">{{
                  pendingRemindersCount }}</span>
            </span>
          </button>

          <button @click="showLibrary = true"
            class="flex items-center justify-center p-2.5 bg-background hover:bg-primary/10 text-primary rounded-xl transition-all shadow-sm border border-border group hover:border-primary/30 active:scale-95"
            title="Reference Library">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 512 512"
              class="text-muted-foreground group-hover:text-primary transition-colors"><!-- Icon from IonIcons by Ben Sperry - https://github.com/ionic-team/ionicons/blob/main/LICENSE -->
              <rect width="64" height="368" x="32" y="96" fill="none" stroke="currentColor" stroke-linejoin="round"
                stroke-width="32" rx="16" ry="16" />
              <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"
                d="M112 224h128M112 400h128" />
              <rect width="128" height="304" x="112" y="160" fill="none" stroke="currentColor" stroke-linejoin="round"
                stroke-width="32" rx="16" ry="16" />
              <rect width="96" height="416" x="256" y="48" fill="none" stroke="currentColor" stroke-linejoin="round"
                stroke-width="32" rx="16" ry="16" />
              <path fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32"
                d="m422.46 96.11l-40.4 4.25c-11.12 1.17-19.18 11.57-17.93 23.1l34.92 321.59c1.26 11.53 11.37 20 22.49 18.84l40.4-4.25c11.12-1.17 19.18-11.57 17.93-23.1L445 115c-1.31-11.58-11.42-20.06-22.54-18.89Z" />
            </svg>
          </button>
        </div>
      </header>

      <div v-if="selectedWorkspaceId" class="flex-1 flex overflow-hidden">

        <!-- Editor Area -->
        <div class="flex-1 overflow-y-auto no-scrollbar transition-all duration-500 ease-out">
          <div
            :class="['mx-auto w-full transition-all duration-500 ease-out py-6 sm:py-8 max-w-[1400px] px-4 sm:px-12 md:px-20']">
            <MilkdownProvider :key="selectedWorkspaceId">
              <IdeaEditor :modelValue="selectedWorkspace?.content || ''" @update:modelValue="handleContentUpdate"
                @read="handleReadDocument" @open-reminders="showReminders = true" :workspaceId="selectedWorkspaceId" />
            </MilkdownProvider>
          </div>
        </div>

        <!-- Reader Sidebar -->
        <Transition name="slide-reader">
          <aside v-if="activeDocument"
            class="fixed md:relative inset-y-0 right-0 w-full md:w-[50vw] md:min-w-[400px] md:max-w-[1000px] border-l border-border bg-muted flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.02)] no-scrollbar z-[60] md:z-auto">
            <!-- Reader Header -->
            <div
              class="h-14 px-4 sm:px-6 flex items-center justify-between border-b border-border bg-background shrink-0">
              <div class="flex items-center gap-3 truncate">
                <div
                  class="w-6 h-6 rounded bg-red-100 dark:bg-red-900/30 text-red-500 flex items-center justify-center shrink-0">
                  <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M7 3v18h10V8l-5-5H7zm5 6.5l3.5 3.5h-2v4h-3v-4H8.5L12 9.5z" />
                  </svg>
                </div>
                <h3 class="text-sm font-bold text-foreground truncate">{{ activeDocument.name }}</h3>
              </div>
              <button @click="activeDocument = null"
                class="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <!-- Reader Content -->
            <iframe :src="getDocumentIframeSrc(activeDocument)"
              class="flex-1 w-full border-none bg-background no-scrollbar" />
          </aside>
        </Transition>

      </div>
      <div v-else-if="loadingWorkspaces" class="h-full flex items-center justify-center">
        <div class="animate-pulse text-muted-foreground uppercase tracking-widest font-bold text-xs">
          Loading Workspace...
        </div>
      </div>

      <div v-else class="flex-1 flex flex-col items-center justify-center bg-background relative p-8">
        <!-- Dashboard Header (Mobile Toggle) -->
        <header class="md:hidden absolute top-0 left-0 right-0 h-16 flex items-center px-4">
          <button @click="showMobileSidebar = true"
            class="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-xl transition-all">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </header>

        <div class="max-w-2xl w-full text-center flex flex-col items-center mt-[-10vh]">
          <h2 class="text-[32px] font-serif text-primary mb-8 tracking-tight flex items-center gap-3">
            <img src="/logo.png" alt="Logo" class="w-10 h-10 rounded-xl shadow-lg shadow-primary/20" />
            {{ new Date().getHours() < 12 ? 'Morning' : (new Date().getHours() < 18 ? 'Afternoon' : 'Evening') }},
              Pablo </h2>

              <!-- Input Box -->
              <div
                class="w-full relative shadow-[0_4px_20px_rgba(0,0,0,0.05)] rounded-2xl bg-muted border border-border focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/50 transition-all mb-6 px-4 py-3 flex items-center">
                <button class="text-muted-foreground hover:text-foreground p-1.5 mr-2" title="Attach file">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
                <input @keydown.enter="createWorkspace(($event.target as HTMLInputElement).value)" type="text"
                  placeholder="What brilliant idea do you want to brainstorm?"
                  class="flex-1 bg-transparent border-none outline-none text-[15px] font-medium text-foreground placeholder:text-muted-foreground/60 h-10" />
                <button
                  class="text-muted-foreground hover:text-primary p-1.5 ml-2 hover:bg-accent rounded-xl transition-colors"
                  @click="showLandingVoiceModal = true" title="Voice Capture">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3"
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </button>
              </div>
        </div>
      </div>
    </main>

    <WorkspaceLibraryModal v-if="selectedWorkspaceId" :isOpen="showLibrary" :workspaceId="selectedWorkspaceId"
      @close="showLibrary = false" @read="handleReadDocument" />

    <WorkspaceRemindersModal v-if="selectedWorkspaceId" :isOpen="showReminders" :workspaceId="selectedWorkspaceId"
      @close="showReminders = false" />

    <SettingsModal :isOpen="showSettings" @close="showSettings = false" />

    <SearchModal :isOpen="showSearchModal" :workspaces="workspaces" @close="showSearchModal = false"
      @select="selectWorkspace" />

    <MediaModal v-if="showLandingVoiceModal" type="audio" @close="showLandingVoiceModal = false"
      @select="handleLandingVoiceCapture" />

    <Modal :isOpen="showDeleteConfirm" title="Delete Workspace?"
      message="Are you sure you want to delete this workspace? All its content and documents will be permanently removed. This action cannot be undone."
      confirmText="Delete Workspace" cancelText="Wait, keep it" isDestructive @confirm="handlePermanentDelete"
      @close="showDeleteConfirm = false" />
  </div>
</template>

<style>
/* Hide scrollbars but allow scrolling */
.no-scrollbar::-webkit-scrollbar {
  display: none;
}

.no-scrollbar {
  -ms-overflow-style: none;
  /* IE and Edge */
  scrollbar-width: none;
  /* Firefox */
}

.slide-reader-enter-active,
.slide-reader-leave-active {
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease-out;
}

.slide-reader-enter-from,
.slide-reader-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>
