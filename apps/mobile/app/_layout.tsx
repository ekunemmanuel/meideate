import "../mobile.css";
import { ConvexProvider, ConvexReactClient } from "@meideate/convex/react";
import { Stack } from "expo-router";

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

export default function RootLayout() {
  return (
    <ConvexProvider client={convex}>
      <Stack>
        <Stack.Screen name="index" options={{ title: "Workspaces", headerShown: false }} />
        <Stack.Screen name="workspace/[id]" options={{ title: "Ideas", headerShown: false }} />
      </Stack>
    </ConvexProvider>
  );
}
