<script setup lang="ts">
import { ref, onUnmounted, nextTick } from 'vue';
import { useConvexMutation } from "@meideate/ui/convex";
import { api } from "@meideate/convex";

const props = defineProps<{
  type: 'audio' | 'video';
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'select', data: { url: string; storageId?: string }): void;
}>();

const mode = ref<'record' | 'link'>('record');
const linkUrl = ref('');
const isRecording = ref(false);
const recordingTime = ref(0);
const previewUrl = ref<string | null>(null);
const isUploading = ref(false);
const stream = ref<MediaStream | null>(null);
const mediaRecorder = ref<MediaRecorder | null>(null);
const chunks = ref<Blob[]>([]);

// Advanced Audio State for VAD & Waveform
const audioContext = ref<AudioContext | null>(null);
const analyser = ref<AnalyserNode | null>(null);
const dataArray = ref<Uint8Array | null>(null);
const animationFrame = ref<number | null>(null);
const isSpeaking = ref(false);
const silenceStartTime = ref<number | null>(null);
const waveformData = ref<number[]>(new Array(16).fill(0));

// VAD & Smoothing Configuration
const SILENCE_THRESHOLD = 25; // Higher threshold to avoid background noise
const AUTO_STOP_SILENCE_MS = 30000;
let smoothedSpeakingFactor = 0; // Smoothing factor to prevent glitchy state changes

const timerInterval = ref<ReturnType<typeof setInterval>>();
const recordPreview = ref<HTMLVideoElement | null>(null);
const audioPlayer = ref<HTMLAudioElement | null>(null);
let playbackSource: MediaElementAudioSourceNode | null = null;
let micSource: MediaStreamAudioSourceNode | null = null;

const generateUploadUrl = useConvexMutation(api.files.generateUploadUrl);
const getUrlMutation = useConvexMutation(api.files.getUrlMutation);

const initAudioContext = () => {
  if (!audioContext.value) {
    audioContext.value = new (window.AudioContext || (window as any).webkitAudioContext)();
    analyser.value = audioContext.value.createAnalyser();
    analyser.value.fftSize = 64;
    
    // Explicitly initialize to avoid TS Uint8Array error
    dataArray.value = new Uint8Array(analyser.value.frequencyBinCount);
  }
};

const startRecording = async () => {
  try {
    const constraints: MediaStreamConstraints = {
      audio: true,
      video: props.type === 'video'
    };

    stream.value = await navigator.mediaDevices.getUserMedia(constraints);

    initAudioContext();
    if (audioContext.value?.state === 'suspended') {
      await audioContext.value.resume();
    }

    // CRITICAL: Ensure we are NOT connected to destination to avoid echo
    analyser.value?.disconnect(); // Disconnect everything from analyser (like destination)
    
    if (micSource) micSource.disconnect();
    micSource = audioContext.value!.createMediaStreamSource(stream.value);
    micSource.connect(analyser.value!);
    // Note: Do NOT connect analyser to destination here!

    silenceStartTime.value = null;
    smoothedSpeakingFactor = 0;

    mediaRecorder.value = new MediaRecorder(stream.value);
    chunks.value = [];

    mediaRecorder.value.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.value.push(e.data);
    };

    mediaRecorder.value.onstop = () => {
      const blob = new Blob(chunks.value, { type: props.type === 'audio' ? 'audio/webm' : 'video/webm' });
      if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
      previewUrl.value = URL.createObjectURL(blob);
    };

    mediaRecorder.value.start();
    isRecording.value = true;
    recordingTime.value = 0;

    await nextTick();
    if (recordPreview.value && stream.value) {
      if (props.type === 'video') {
        recordPreview.value.srcObject = stream.value;
        recordPreview.value.play().catch(e => console.error("[MediaModal] Playback error:", e));
      }
    }

    timerInterval.value = setInterval(() => {
      recordingTime.value++;
    }, 1000);

    processAudio();
  } catch (err) {
    console.error("[MediaModal] Error accessing media devices:", err);
    alert("Could not access camera or microphone.");
  }
};

const processAudio = () => {
  if (!analyser.value || !dataArray.value) return;

  // Check if we should still be processing
  const isPlaying = audioPlayer.value && !audioPlayer.value.paused;
  if (!isRecording.value && !isPlaying) return;

  // Fix for the TypeScript Uint8Array error
  analyser.value.getByteFrequencyData(dataArray.value as any);

  const newWaveform = [];
  let sum = 0;
  for (let i = 0; i < 16; i++) {
    const val = (dataArray.value as any)[i] || 0;
    newWaveform.push(val);
    sum += val;
  }
  waveformData.value = newWaveform;

  if (isRecording.value) {
    // Smoothed VAD logic
    const average = sum / 16;
    const currentlyNoisy = average > SILENCE_THRESHOLD;

    // Smooth the speaking state (0 to 1)
    if (currentlyNoisy) {
      smoothedSpeakingFactor = Math.min(1, smoothedSpeakingFactor + 0.2);
    } else {
      smoothedSpeakingFactor = Math.max(0, smoothedSpeakingFactor - 0.1);
    }

    const currentlySpeaking = smoothedSpeakingFactor > 0.4;

    if (currentlySpeaking) {
      if (!isSpeaking.value) isSpeaking.value = true;
      silenceStartTime.value = null;
    } else {
      if (isSpeaking.value) isSpeaking.value = false;

      if (silenceStartTime.value === null) {
        silenceStartTime.value = Date.now();
      } else if (Date.now() - silenceStartTime.value > AUTO_STOP_SILENCE_MS) {
        stopRecording();
        return;
      }
    }
  }

  animationFrame.value = requestAnimationFrame(processAudio);
};

const handlePlayback = () => {
  if (!audioPlayer.value || !audioContext.value || !analyser.value) return;

  if (!playbackSource) {
    playbackSource = audioContext.value.createMediaElementSource(audioPlayer.value);
  }
  
  // Reconnect path for audible playback
  playbackSource.disconnect();
  playbackSource.connect(analyser.value);
  analyser.value.disconnect();
  analyser.value.connect(audioContext.value.destination);

  if (audioContext.value.state === 'suspended') {
    audioContext.value.resume();
  }

  processAudio();
};

const stopRecording = () => {
  if (mediaRecorder.value && isRecording.value) {
    mediaRecorder.value.stop();
    isRecording.value = false;
    isSpeaking.value = false;
    clearInterval(timerInterval.value);

    if (animationFrame.value) cancelAnimationFrame(animationFrame.value);
    
    if (micSource) {
      micSource.disconnect();
      micSource = null;
    }

    if (recordPreview.value) {
      recordPreview.value.srcObject = null;
    }

    if (stream.value) {
      stream.value.getTracks().forEach(track => track.stop());
    }
  }
};

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const resetRecording = () => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = null;
  chunks.value = [];
  recordingTime.value = 0;
  isRecording.value = false;
  isSpeaking.value = false;
  silenceStartTime.value = null;
  if (timerInterval.value) clearInterval(timerInterval.value);
  if (animationFrame.value) cancelAnimationFrame(animationFrame.value);

  if (recordPreview.value) {
    recordPreview.value.srcObject = null;
    recordPreview.value.src = '';
  }
  if (stream.value) {
    stream.value.getTracks().forEach(track => track.stop());
    stream.value = null;
  }
  
  // Reset waveform and VAD factor
  waveformData.value = new Array(16).fill(0);
  smoothedSpeakingFactor = 0;
  if (audioPlayer.value) {
    audioPlayer.value.pause();
    audioPlayer.value.currentTime = 0;
  }
};

const handleUpload = async () => {
  if (mode.value === 'link') {
    if (!linkUrl.value) return;
    emit('select', { url: linkUrl.value });
    return;
  }

  if (chunks.value.length === 0 && !previewUrl.value) return;
  const blobToUpload = new Blob(chunks.value, { type: props.type === 'audio' ? 'audio/webm' : 'video/webm' });

  isUploading.value = true;

  try {
    const postUrl = await generateUploadUrl.mutate({});
    if (!postUrl) throw new Error("Failed to get upload URL");

    const result = await fetch(postUrl, {
      method: "POST",
      body: blobToUpload,
    });

    if (!result.ok) throw new Error(`Upload failed with status ${result.status}`);

    const { storageId } = await result.json();
    const publicUrl = await getUrlMutation.mutate({ storageId });

    if (!publicUrl) throw new Error("Failed to retrieve public URL.");

    emit('select', { url: publicUrl, storageId });
  } catch (err) {
    console.error("[MediaModal] Upload error:", err);
    alert("Upload failed. Please try again.");
  } finally {
    isUploading.value = false;
  }
};

onUnmounted(() => {
  stopRecording();
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  if (audioContext.value) audioContext.value.close();
});
</script>

<template>
  <div class="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-md transition-all duration-500" @click="emit('close')">
    </div>

    <!-- Modal Container -->
    <div
      class="relative w-full max-w-xl bg-white dark:bg-slate-900 backdrop-blur-3xl border border-white/40 dark:border-slate-800 rounded-2xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] overflow-hidden animate-modal-entrance">
      <div class="p-10 pb-3 flex flex-col h-full">
        <!-- Close Button -->
        <button @click="emit('close')"
          class="absolute top-6 right-6 p-2.5 bg-slate-100/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-700 rounded-full transition-all duration-300 group hover:rotate-90">
          <svg class="w-5 h-5 text-slate-400 dark:text-slate-500 group-hover:text-slate-900 dark:group-hover:text-slate-100" fill="none" stroke="currentColor"
            viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <header class="mb-10 text-center sm:text-left">
          <h2 class="text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
            Insert {{ type === 'audio' ? 'Audio' : 'Video' }}
          </h2>
          <p class="text-[15px] font-medium text-slate-700 dark:text-slate-300 leading-relaxed">
            Record a quick {{ type }} note or embed from a link.
          </p>
        </header>

        <!-- Dynamic Mode Pill -->
        <div class="relative flex p-1.5 bg-slate-200/50 dark:bg-slate-800/50 rounded-full mb-10 w-fit self-center sm:self-start">
          <div
            class="absolute h-[calc(100%-12px)] top-1.5 bg-white dark:bg-slate-700 rounded-full shadow-sm transition-all duration-500 ease-out"
            :style="{
              left: mode === 'record' ? '6px' : 'calc(50% + 3px)',
              width: 'calc(50% - 9px)'
            }"></div>
          <button @click="mode = 'record'" :class="[
            'relative z-10 px-8 py-2.5 rounded-full text-sm font-bold transition-colors duration-300',
            mode === 'record' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'
          ]">
            Record
          </button>
          <button @click="mode = 'link'" :class="[
            'relative z-10 px-8 py-2.5 rounded-full text-sm font-bold transition-colors duration-300',
            mode === 'link' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'
          ]">
            Paste Link
          </button>
        </div>

        <!-- Content Area -->
        <div class="flex-1 min-h-[300px] flex flex-col transition-all duration-500 ease-out">
          <!-- Mode: Link -->
          <div v-if="mode === 'link'" class="space-y-6 animate-fade-in-up">
            <div class="group">
              <label class="block text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-[0.2em] mb-4 ml-1">Embedded
                Media URL</label>
              <div class="relative">
                <input v-model="linkUrl" type="url" placeholder="https://example.com/media"
                  class="w-full px-6 py-5 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-3xl focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600 shadow-sm" />
                <div class="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <!-- Mode: Record -->
          <div v-else class="space-y-8 animate-fade-in-up flex flex-col items-center flex-1">
            <!-- Recording Surface -->
            <div
              class="relative w-full aspect-video bg-slate-50/50 dark:bg-slate-950 rounded-[32px] overflow-hidden shadow-2xl border border-white/10 dark:border-white/5 group group-hover:border-indigo-500/30 transition-colors">
              <!-- Video Preview -->
              <video ref="recordPreview" v-show="type === 'video' && (isRecording || previewUrl)"
                :src="previewUrl || undefined" class="w-full h-full object-cover" :autoplay="isRecording"
                :muted="isRecording" playsinline controls>
              </video>

              <!-- Audio Waveform -->
              <div v-if="type === 'audio'"
                class="absolute inset-0 flex flex-col items-center justify-center p-12">
                <div class="flex items-end gap-1.5 h-20 mb-10">
                  <div v-for="(val, i) in waveformData" :key="i" class="w-1.5 rounded-full transition-all duration-100"
                    :class="val > 10 ? 'bg-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.5)]' : 'bg-slate-700 dark:bg-slate-800'" :style="{
                      height: `${Math.max(10, (val / 255) * 100)}%`,
                    }">
                  </div>
                </div>

                <audio v-if="previewUrl" ref="audioPlayer" :src="previewUrl" controls class="w-full"
                  @play="handlePlayback"></audio>

                <div v-else class="text-center">
                  <p class="text-indigo-400 font-black uppercase tracking-[0.3em] text-[10px] mb-2"
                    :class="{ 'animate-pulse': isRecording }">Sonic Capture Active</p>
                  <p class="text-slate-400 dark:text-slate-500 text-sm font-medium">Capture your brilliant thoughts...</p>
                </div>
              </div>

              <!-- Glow Overlay -->
              <div v-if="isRecording"
                class="absolute inset-0 pointer-events-none ring-4 ring-inset ring-indigo-500/20 animate-pulse"></div>

              <!-- Indicators -->
              <div v-if="isRecording" class="absolute top-6 left-6 flex items-center gap-3">
                <div
                  class="px-3 py-1.5 bg-red-600/90 backdrop-blur-md text-white rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg">
                  <span class="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                  LIVE
                </div>
                <div
                  class="px-3 py-1.5 bg-slate-900/80 backdrop-blur-md text-white/90 rounded-full text-[11px] font-black tracking-widest shadow-lg">
                  {{ formatTime(recordingTime) }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Actions -->
      <footer class="p-10 pt-3 flex flex-col items-center gap-6">
        <!-- Main Controls -->
        <div v-if="mode === 'record'" class="flex items-center justify-center w-full px-4">
          <!-- Record Toggle -->
          <div v-if="!previewUrl" class="relative">
            <button v-if="!isRecording" @click="startRecording"
              class="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-lg shadow-red-500/30 group">
              <div class="w-6 h-6 bg-white rounded-full"></div>
            </button>
            <button v-else @click="stopRecording"
              class="w-16 h-16 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110 active:scale-95 border-2 border-red-500 group">
              <!-- Dynamic Icon: Speaking vs Idle -->
              <div v-if="isSpeaking" class="flex gap-1 items-end h-5">
                <div class="w-1.5 bg-red-500 rounded-full animate-waveform h-full"></div>
                <div class="w-1.5 bg-red-500 rounded-full animate-waveform h-2/3" style="animation-delay: 0.1s"></div>
                <div class="w-1.5 bg-red-500 rounded-full animate-waveform h-5/6" style="animation-delay: 0.2s"></div>
              </div>
              <svg v-else class="w-7 h-7 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path
                  d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Submit/Discard Button Group -->
        <div v-if="previewUrl || (mode === 'link' && linkUrl)" class="flex gap-6 items-center w-full">
          <!-- Discard Button -->
          <button v-if="previewUrl" @click="resetRecording"
            class="p-5 rounded-full bg-slate-200 dark:bg-slate-800 hover:bg-red-300 dark:hover:bg-red-900/40 transition-all flex items-center justify-center group shadow-sm">
            <svg class="w-5 h-5 text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-100" fill="none" stroke="currentColor"
              viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          
          <button @click="handleUpload" :disabled="isUploading"
            class="flex-1 py-5 px-10 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-2xl font-black text-sm uppercase tracking-[0.15em] shadow-xl shadow-indigo-600/20 transition-all flex items-center justify-center gap-4 group active:scale-[0.98]">
            <template v-if="isUploading">
              <svg class="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none">
                </circle>
                <path class="opacity-75" fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
                </path>
              </svg>
              Processing...
            </template>
            <template v-else>
              {{ mode === 'link' ? 'Integrate Media' : 'Finalize & Insert' }}
              <svg class="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor"
                viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </template>
          </button>
        </div>
      </footer>
    </div>
  </div>
</template>

<style scoped>
@keyframes modal-entrance {
  from {
    opacity: 0;
    transform: translateY(40px) scale(0.95);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes waveform {

  0%,
  100% {
    transform: scaleY(1);
  }

  50% {
    transform: scaleY(1.6);
  }
}

.animate-modal-entrance {
  animation: modal-entrance 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.animate-fade-in-up {
  animation: fade-in-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.animate-waveform {
  animation: waveform 0.6s ease-in-out infinite;
}
</style>
