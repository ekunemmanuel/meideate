import { createApp } from "vue";
import "@meideate/ui/global.css";
import "./style.css";
import { convexVue } from "@meideate/ui/convex";
import App from "./App.vue";

const app = createApp(App);

app.use(convexVue, {
  url: import.meta.env.VITE_CONVEX_URL,
});

app.mount("#app");
