import { ref, watch, onMounted, onUnmounted } from "vue";
import { useConvexQuery } from "../convex";
import { api } from "@meideate/convex";
import type { Doc } from "@meideate/convex/dataModel";

// Only import types if needed, or use 'any' for window.__TAURI__ specific calls

interface Threshold {
  label: string;
  lead: number;
  title: string;
}

const THRESHOLDS: Threshold[] = [
  {
    label: "6h",
    lead: 6 * 60 * 60 * 1000,
    title: "🕒 Reminder: 6 hours to go",
  },
  {
    label: "3h",
    lead: 3 * 60 * 60 * 1000,
    title: "⏳ Reminder: 3 hours to go",
  },
  { label: "1h", lead: 1 * 60 * 60 * 1000, title: "🔔 Reminder: 1 hour left" },
  { label: "15m", lead: 15 * 60 * 1000, title: "⚡ Reminder: 15 minutes!" },
  { label: "due", lead: 0, title: "🚨 Task Due!" },
];

// Store notifications to prevent garbage collection and handle clicks
const activeNotifications: Notification[] = [];

export function useRemindersMonitor(
  workspaces: any,
  selectedWorkspaceId: any,
  showReminders: any,
) {
  const alertedIds = ref(new Set<string>());
  const { data: reminders } = useConvexQuery(api.reminders.listAll, {});

  const runCheck = () => {
    if (!reminders.value || !workspaces.value) return;

    const now = Date.now();
    reminders.value.forEach((reminder) => {
      if (!reminder.dueDate || reminder.isCompleted) return;

      const passedThresholds = THRESHOLDS.filter(
        (t) => now >= reminder.dueDate! - t.lead,
      );

      if (passedThresholds.length === 0) return;

      const mostUrgent = passedThresholds.reduce((prev, curr) =>
        curr.lead < prev.lead ? curr : prev,
      );

      const alertedKey = `${reminder._id}:${mostUrgent.label}`;

      if (!alertedIds.value.has(alertedKey)) {
        const workspace = workspaces.value.find(
          (w: any) => w._id === reminder.workspaceId,
        );
        const workspaceName = workspace?.name || "Unknown Workspace";

        triggerNotification(reminder, mostUrgent, workspaceName);

        passedThresholds.forEach((t) => {
          alertedIds.value.add(`${reminder._id}:${t.label}`);
        });
      }
    });
  };

  watch(
    () => [reminders.value, workspaces.value],
    () => {
      runCheck();
    },
    { immediate: true, deep: true },
  );

  let interval: any;
  onMounted(() => {
    interval = setInterval(runCheck, 60000);
  });

  onUnmounted(() => {
    if (interval) clearInterval(interval);
  });

  async function checkPermission() {
    if (typeof window === "undefined" || !window.Notification) return false;
    
    // If not in Tauri, use standard Web API
    if (!(window as any).__TAURI__) {
      if (window.Notification.permission === "granted") return true;
      if (window.Notification.permission === "denied") return false;
      const res = await window.Notification.requestPermission();
      return res === "granted";
    }

    // In Tauri, use the plugin for better OS integration if possible
    try {
      const { isPermissionGranted, requestPermission } = await import("@tauri-apps/plugin-notification");
      let granted = await isPermissionGranted();
      if (!granted) {
        const permission = await requestPermission();
        granted = permission === "granted";
      }
      return granted;
    } catch (e) {
      console.error("Tauri notification skip:", e);
      return window.Notification.permission === "granted";
    }
  }

  const triggerNotification = async (
    reminder: Doc<"reminders">,
    threshold: Threshold,
    workspaceName: string,
  ) => {
    try {
      const permission = await checkPermission();

      if (permission) {
        const notification = new window.Notification(threshold.title, {
          body: `${reminder.task}\nWorkspace: ${workspaceName}`,
          icon: "icon",
          tag: reminder._id, // Prevent duplicate notifications for the same reminder
        });

        notification.onclick = async () => {
          try {
            // Restore window if in Tauri
            if ((window as any).__TAURI__) {
              const { invoke } = await import("@tauri-apps/api/core");
              await invoke("focus_window");
            }

            // Navigate
            selectedWorkspaceId.value = reminder.workspaceId;
            showReminders.value = true;
            window.focus();
            notification.close();
          } catch (e) {
            console.error("Navigation error:", e);
          }
        };

        activeNotifications.push(notification);
        // Keep only the last 10 notifications to avoid memory leak
        if (activeNotifications.length > 10) {
          activeNotifications.shift();
        }
      }
    } catch (error) {
      console.error("Failed to send notification:", error);
    }
  };

  return {};
}
