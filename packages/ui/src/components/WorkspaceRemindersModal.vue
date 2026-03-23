<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import Modal from './Modal.vue';
import { useConvexQuery, useConvexMutation } from "@meideate/ui/convex";
import { api } from "@meideate/convex";
import type { Id } from "@meideate/convex/dataModel";

const props = defineProps<{
  workspaceId: Id<"workspaces">;
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const remindersArgs = computed(() => ({ workspaceId: props.workspaceId }));
const { data: reminders } = useConvexQuery(api.reminders.list, remindersArgs);
const addReminder = useConvexMutation(api.reminders.add);
const toggleReminder = useConvexMutation(api.reminders.toggle);
const removeReminder = useConvexMutation(api.reminders.remove);
const editTaskMutation = useConvexMutation(api.reminders.editTask as any);

const newTask = ref('');
const recurrenceType = ref<'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually'>('none');
const dueTimeInput = ref<string>('');

const now = ref(Date.now());
let timerInterval: any;
onMounted(() => {
  timerInterval = setInterval(() => { now.value = Date.now() }, 60000);
});
onUnmounted(() => clearInterval(timerInterval));

const isOverdue = (reminder: any) => reminder.dueDate && reminder.dueDate < now.value && !reminder.isCompleted;
const formatDueTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const parseInputToTimestamp = (input: string, recurrence: string) => {
  if (!input) return undefined;
  if (recurrence === 'none') {
    const ts = new Date(input).getTime();
    return isNaN(ts) ? undefined : ts;
  }

  // For recurring: combine HH:mm with today's date
  const parts = input.split(':');
  if (parts.length < 2) return undefined;

  const hours = parseInt(parts[0]!, 10);
  const minutes = parseInt(parts[1]!, 10);
  if (isNaN(hours) || isNaN(minutes)) return undefined;

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);

  // If this time has already passed today, move it to tomorrow
  if (date.getTime() < Date.now()) {
    date.setDate(date.getDate() + 1);
  }
  return date.getTime();
};

const handleAdd = async () => {
  if (!newTask.value.trim()) return;

  const dueDate = parseInputToTimestamp(dueTimeInput.value, recurrenceType.value);
  if (dueDate && dueDate < Date.now() && recurrenceType.value === 'none') {
    alert("Please select a future time.");
    return;
  }

  await addReminder.mutate({
    workspaceId: props.workspaceId,
    task: newTask.value.trim(),
    dueDate: dueDate ?? undefined,
    recurrence: recurrenceType.value
  });

  newTask.value = '';
  recurrenceType.value = 'none';
  dueTimeInput.value = '';
};

const minDateTime = computed(() => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + 'T' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
});

const processingToggles = ref(new Set<string>());
const handleToggle = async (reminder: any) => {
  if (processingToggles.value.has(reminder._id)) return;
  processingToggles.value.add(reminder._id);
  try {
    await toggleReminder.mutate({ id: reminder._id, isCompleted: !reminder.isCompleted });
  } finally {
    processingToggles.value.delete(reminder._id);
  }
};

const deleteConfirmId = ref<string | null>(null);
const confirmDelete = async () => {
  if (!deleteConfirmId.value) return;
  await removeReminder.mutate({ id: deleteConfirmId.value as any });
  deleteConfirmId.value = null;
};

// Full Edit & Analytics Details State
const activeTaskDetails = ref<any | null>(null);
const editFormTitle = ref('');
const editFormRecurrence = ref<'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually'>('none');
const editFormDueTime = ref<string>('');
const heatmapMonthOffset = ref(0);

const openDetails = (reminder: any) => {
  activeTaskDetails.value = reminder;
  editFormTitle.value = reminder.task;
  editFormRecurrence.value = reminder.recurrence || 'none';

  if (reminder.dueDate) {
    const d = new Date(reminder.dueDate);
    if (reminder.recurrence && reminder.recurrence !== 'none') {
      // Time string HH:mm
      editFormDueTime.value = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    } else {
      // Date string YYYY-MM-DDTHH:mm
      editFormDueTime.value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + 'T' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }
  } else {
    editFormDueTime.value = '';
  }
  heatmapMonthOffset.value = 0;
};

const saveDetails = async () => {
  if (!activeTaskDetails.value || !editFormTitle.value.trim()) return;

  const dueDate = parseInputToTimestamp(editFormDueTime.value, editFormRecurrence.value);
  if (dueDate && dueDate < Date.now() && editFormRecurrence.value === 'none') {
    alert("Please select a future time.");
    return;
  }

  await editTaskMutation.mutate({
    id: activeTaskDetails.value._id as any,
    task: editFormTitle.value.trim(),
    recurrence: editFormRecurrence.value,
    dueDate: dueDate ?? undefined
  });
  activeTaskDetails.value.task = editFormTitle.value.trim();
  activeTaskDetails.value.recurrence = editFormRecurrence.value;
  activeTaskDetails.value.dueDate = dueDate;
};

const hasChanges = computed(() => {
  if (!activeTaskDetails.value) return false;
  const currentDueTime = activeTaskDetails.value.dueDate ? (() => {
    const d = new Date(activeTaskDetails.value.dueDate);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + 'T' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  })() : '';
  return editFormTitle.value !== activeTaskDetails.value.task ||
    editFormRecurrence.value !== (activeTaskDetails.value.recurrence || 'none') ||
    editFormDueTime.value !== currentDueTime;
});

const getHeatmapGrid = (reminder: any) => {
  const grid = [];
  const now = new Date();
  const targetMonth = new Date(now.getFullYear(), now.getMonth() + heatmapMonthOffset.value, 1);
  const year = targetMonth.getFullYear();
  const month = targetMonth.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const creationTime = reminder._creationTime;
  const completedDates = reminder.completedDates || [];

  for (let d = 1; d <= daysInMonth; d++) {
    const currentDay = new Date(year, month, d);
    const dateStr = currentDay.getFullYear() + '-' + String(currentDay.getMonth() + 1).padStart(2, '0') + '-' + String(currentDay.getDate()).padStart(2, '0');

    // Future if the offset is positive, or if current month and day is past today
    const isFuture = heatmapMonthOffset.value > 0 || (heatmapMonthOffset.value === 0 && d > now.getDate());
    const isBeforeCreation = currentDay.getTime() < new Date(creationTime).setHours(0, 0, 0, 0);

    let state = 'neutral';
    if (completedDates.includes(dateStr)) {
      state = 'success';
    } else if (!isFuture && !isBeforeCreation && reminder.recurrence !== 'none') {
      state = 'missed';
    }

    grid.push({ day: d, dateStr, state });
  }
  return grid;
};

const currentMonthName = computed(() => {
  const targetMonth = new Date(new Date().getFullYear(), new Date().getMonth() + heatmapMonthOffset.value, 1);
  return targetMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
});

watch(() => props.isOpen, (open) => {
  if (!open) {
    activeTaskDetails.value = null;
    deleteConfirmId.value = null;
  }
});
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
            <h2 class="text-xl font-black text-foreground tracking-tight">Workspace Tasks</h2>
            <p class="text-[11px] text-muted-foreground font-bold uppercase tracking-widest mt-1 opacity-70">Focus & Goals</p>
          </div>
          <button @click="emit('close')"
            class="p-2 bg-background hover:bg-muted text-muted-foreground hover:text-foreground rounded-xl transition-all shadow-sm border border-border hover:scale-105 active:scale-95">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div class="flex-1 relative overflow-hidden flex flex-col">
          <Transition name="slide-out" mode="out-in">
            <!-- Content / List View -->
            <div v-if="!activeTaskDetails" key="list"
              class="absolute inset-0 flex-1 overflow-y-auto p-6 bg-background flex flex-col gap-4">

              <!-- Add Field -->
              <div class="relative mb-2 shrink-0">
                <input v-model="newTask" @keydown.enter="handleAdd" type="text" placeholder="What needs to be done?"
                  class="w-full pl-5 pr-12 py-3.5 bg-muted border border-border rounded-2xl text-[13px] font-semibold outline-none focus:border-primary focus:bg-background transition-all placeholder:text-muted-foreground text-foreground shadow-sm" />
                <button @click="handleAdd" :disabled="!newTask.trim()"
                  class="absolute right-2 top-2 bottom-2 aspect-square bg-primary text-primary-foreground rounded-xl flex items-center justify-center hover:opacity-90 disabled:opacity-50 transition-all shadow-sm shadow-primary/20">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>

              <!-- Recurrence and Time Picker -->
              <div class="flex items-center gap-2 mb-4 px-1 shrink-0">
                <select v-model="recurrenceType"
                  class="px-3 py-1.5 rounded-lg text-[11px] uppercase tracking-wider font-black transition-colors border shadow-sm outline-none cursor-pointer w-full"
                  :class="recurrenceType !== 'none' ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-background border-border text-muted-foreground hover:bg-muted'">
                  <option value="none">One-time Task</option>
                  <option value="daily">Daily Habit</option>
                  <option value="weekly">Weekly Routine</option>
                  <option value="biweekly">Bi-weekly Check</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annually">Annually</option>
                </select>

                <input :type="recurrenceType === 'none' ? 'datetime-local' : 'time'" v-model="dueTimeInput"
                  :min="minDateTime"
                  class="px-3 py-1.5 rounded-lg text-[11px] uppercase tracking-wider font-black bg-background border border-border text-muted-foreground outline-none hover:bg-muted transition-colors shadow-sm focus:border-primary cursor-pointer w-full" />
              </div>

              <!-- List -->
              <div v-if="reminders?.length === 0" class="flex-1 flex flex-col items-center justify-center py-12">
                <div
                  class="w-14 h-14 bg-background rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/10 transition-transform border border-primary/10">
                  <svg class="w-7 h-7 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <p class="text-[11px] uppercase tracking-widest font-black text-muted-foreground opacity-60">Tasks are empty
                </p>
              </div>

              <div v-else class="flex flex-col gap-3 pb-8">
                <div v-for="reminder in reminders" :key="reminder._id"
                  class="group flex items-start gap-4 p-4 rounded-2xl border hover:shadow-xl hover:shadow-primary/5 transition-all"
                  :class="[
                    reminder.isCompleted ? 'bg-muted/50 border-border' : 'bg-background border-border hover:border-primary/30',
                  ]">
                  <!-- Checkbox -->
                  <button @click="handleToggle(reminder)" :disabled="processingToggles.has(reminder._id)"
                    class="mt-1 shrink-0 w-7 h-7 rounded-2xl border-2 flex items-center justify-center transition-all shadow-sm"
                    :class="[
                      reminder.isCompleted ? 'bg-primary border-primary text-primary-foreground shadow-primary/20' : 'bg-background border-border hover:border-primary text-transparent',
                      processingToggles.has(reminder._id) ? 'opacity-50 cursor-not-allowed' : ''
                    ]">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <!-- Details -->
                  <div class="flex-1 min-w-0 flex flex-col">
                    <span @dblclick="openDetails(reminder)"
                      class="text-[14px] font-black leading-tight mb-1 transition-all break-words cursor-pointer select-none"
                      :class="[
                        reminder.isCompleted ? 'text-muted-foreground line-through decoration-muted-foreground/30 decoration-2' : 'text-foreground',
                        !reminder.isCompleted && isOverdue(reminder) ? 'text-red-500' : ''
                      ]" title="Double click to edit details">
                      {{ reminder.task }}
                    </span>

                    <div
                      class="flex flex-wrap items-center gap-3 text-[10px] font-black tracking-widest uppercase mt-1">
                      <span v-if="reminder.dueDate" class="flex items-center gap-1.5"
                        :class="reminder.isCompleted ? 'text-muted-foreground/40' : (!reminder.isCompleted && isOverdue(reminder) ? 'text-red-500' : 'text-foreground/60')">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {{ formatDueTime(reminder.dueDate) }}
                      </span>

                      <span v-if="reminder.recurrence !== 'none'" class="flex items-center gap-1.5"
                        :class="reminder.isCompleted ? 'text-muted-foreground/40' : 'text-primary'">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        {{ reminder.recurrence }}
                      </span>

                      <span v-if="(reminder.strikes || 0) > 0 && !reminder.isCompleted"
                        class="flex items-center gap-1 text-orange-600">
                        ❌ {{ reminder.strikes }} Strike{{ (reminder.strikes || 0) > 1 ? 's' : '' }}
                      </span>
                    </div>
                  </div>
                  <!-- Actions -->
                  <div
                    class="flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all shrink-0">
                    <button @click="openDetails(reminder)"
                      class="w-9 h-9 flex items-center justify-center rounded-xl bg-background text-muted-foreground hover:text-primary transition-all shadow-sm border border-border hover:scale-105 active:scale-95">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"
                        viewBox="0 0 24 24">
                        <g fill="currentColor" fill-rule="evenodd" clip-rule="evenodd">
                          <path
                            d="M12 8.25a3.75 3.75 0 1 0 0 7.5a3.75 3.75 0 0 0 0-7.5M9.75 12a2.25 2.25 0 1 1 4.5 0a2.25 2.25 0 0 1-4.5 0" />
                          <path
                            d="M12 3.25c-4.514 0-7.555 2.704-9.32 4.997l-.031.041c-.4.519-.767.996-1.016 1.56c-.267.605-.383 1.264-.383 2.152s.116 1.547.383 2.152c.25.564.617 1.042 1.016 1.56l.032.041C4.445 18.046 7.486 20.75 12 20.75s7.555-2.704 9.32-4.997l.031-.041c.4-.518.767-.996 1.016-1.56c.267-.605.383-1.264.383-2.152s-.116-1.547-.383-2.152c-.25-.564-.617-1.041-1.016-1.56l-.032-.041C19.555 5.954 16.514 3.25 12 3.25M3.87 9.162C5.498 7.045 8.15 4.75 12 4.75s6.501 2.295 8.13 4.412c.44.57.696.91.865 1.292c.158.358.255.795.255 1.546s-.097 1.188-.255 1.546c-.169.382-.426.722 .864 1.292C18.5 16.955 15.85 19.25 12 19.25s-6.501-2.295-8.13-4.412c-.44-.57-.696-.91-.865-1.292c-.158-.358-.255-.795-.255-1.546s.097-1.188.255-1.546c.169-.382.426-.722.864-1.292" />
                        </g>
                      </svg>
                    </button>
                    <button @click="deleteConfirmId = reminder._id"
                      class="w-9 h-9 flex items-center justify-center rounded-xl bg-background text-muted-foreground hover:text-red-500 transition-all shadow-sm border border-border hover:scale-105 active:scale-95">
                      <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

            </div>

            <!-- Edit & Analytics View -->
            <div v-else key="analytics" class="absolute inset-0 flex-1 overflow-y-auto p-6 bg-background flex flex-col">
              <button @click="activeTaskDetails = null"
                class="self-start flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors mb-6 group bg-muted px-3 py-1.5 rounded-lg border border-border shadow-sm">
                <svg class="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" fill="none"
                  stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Tasks
              </button>

              <!-- Edit Form -->
              <div class="mb-8">
                <h3 class="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                  Edit Settings</h3>
                <input v-model="editFormTitle"
                  class="w-full text-xl font-black text-foreground leading-tight mb-3 bg-muted border border-transparent focus:bg-background focus:border-primary outline-none rounded-lg px-3 py-2 transition-all shadow-sm"
                  placeholder="Task description..." />

                <div class="flex flex-col gap-2 shrink-0 mb-4">
                  <select v-model="editFormRecurrence"
                    class="px-3 py-2 rounded-lg text-xs uppercase tracking-wider font-black transition-colors border shadow-sm outline-none cursor-pointer w-full text-foreground"
                    :class="editFormRecurrence !== 'none' ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-background border-border hover:bg-muted text-muted-foreground'">
                    <option value="none">One-time Task</option>
                    <option value="daily">Daily Habit</option>
                    <option value="weekly">Weekly Routine</option>
                    <option value="biweekly">Bi-weekly Check</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annually">Annually</option>
                  </select>

                  <input :type="editFormRecurrence === 'none' ? 'datetime-local' : 'time'" v-model="editFormDueTime"
                    :min="minDateTime"
                    class="px-3 py-2 rounded-lg text-xs uppercase tracking-wider font-black bg-background border border-border text-muted-foreground outline-none hover:bg-muted transition-colors shadow-sm focus:border-primary cursor-pointer w-full" />
                </div>

                <button @click="saveDetails" :disabled="!hasChanges"
                  class="w-full py-2.5 rounded-xl text-xs font-bold shadow-sm transition-all flex justify-center items-center"
                  :class="hasChanges ? 'bg-primary text-primary-foreground shadow-primary/20 hover:opacity-90' : 'bg-muted text-muted-foreground cursor-not-allowed'">
                  Save Changes
                </button>
              </div>

              <p
                class="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2 border-b border-border pb-4">
                Tracking Habit Console
              </p>

              <!-- Stats Row -->
              <div class="grid grid-cols-2 gap-4 mb-8">
                <div class="p-4 rounded-2xl bg-primary/10 border border-primary/20 flex flex-col shadow-sm">
                  <span class="text-[10px] uppercase tracking-widest font-black text-primary mb-1">Consistency</span>
                  <span class="text-3xl font-black text-primary">{{ activeTaskDetails.completedDates?.length || 0 }}
                    Days</span>
                </div>
                <div class="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex flex-col shadow-sm">
                  <span class="text-[10px] uppercase tracking-widest font-black text-orange-500 mb-1">Missed</span>
                  <span class="text-3xl font-black text-orange-500">{{ activeTaskDetails.strikes || 0 }} Strikes</span>
                </div>
              </div>

              <!-- Heatmap -->
              <div class="mb-3 flex items-center justify-between">
                <div class="flex items-center gap-2 bg-muted rounded-lg p-1 border border-border">
                  <button @click="heatmapMonthOffset--"
                    class="p-1 hover:bg-background rounded text-muted-foreground hover:text-foreground transition-all shadow-sm">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <h4
                    class="text-[11px] font-black text-foreground uppercase tracking-widest px-2 min-w-[100px] text-center">
                    {{ currentMonthName }}</h4>
                  <button @click="heatmapMonthOffset++"
                    class="p-1 hover:bg-background rounded text-muted-foreground hover:text-foreground transition-all shadow-sm">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
                <div
                  class="flex gap-2 text-[9px] font-black text-muted-foreground uppercase tracking-widest bg-muted px-2 py-1.5 rounded-lg border border-border">
                  <span class="flex items-center gap-1"><span
                      class="w-2 h-2 rounded-[2px] bg-emerald-500 shadow-sm"></span> Hit</span>
                  <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-[2px] bg-red-400 shadow-sm"></span>
                    Miss</span>
                </div>
              </div>

              <div class="grid grid-cols-7 gap-1.5 bg-muted p-4 rounded-2xl border border-border shadow-inner">
                <div v-for="d in ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']"
                  class="text-center text-[9px] font-black uppercase text-muted-foreground mb-1 tracking-widest">
                  {{ d }}
                </div>
                <!-- Pad start of month -->
                <div
                  v-for="n in new Date(new Date().getFullYear(), new Date().getMonth() + heatmapMonthOffset, 1).getDay()"
                  :key="'pad-' + n" class="aspect-square opacity-0"></div>

                <div v-for="day in getHeatmapGrid(activeTaskDetails)" :key="day.day"
                  class="aspect-square rounded-[5px] flex items-center justify-center text-[11px] font-black transition-all border outline-offset-1 relative group hover:z-10 shadow-sm"
                  :class="{
                    'bg-emerald-500 border-emerald-600 text-white ring-2 ring-emerald-500/20': day.state === 'success',
                    'bg-red-400 border-red-500 text-white shadow-red-400/30': day.state === 'missed',
                    'bg-background border-border text-muted-foreground/40': day.state === 'neutral'
                  }" :title="`Day ${day.day}`">
                  {{ day.day }}
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </Transition>

    <Modal :isOpen="!!deleteConfirmId" title="Delete Task"
      message="Are you sure you want to permanently delete this task? All tracking history will be lost."
      confirmText="Delete" :isDestructive="true" @close="deleteConfirmId = null" @confirm="confirmDelete" />
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

.slide-out-enter-active,
.slide-out-leave-active {
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
}

.slide-out-enter-from {
  opacity: 0;
  transform: translateX(-15px);
}

.slide-out-leave-to {
  opacity: 0;
  transform: translateX(15px);
}
</style>
