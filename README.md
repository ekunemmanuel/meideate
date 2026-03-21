# Meideate Template

A cross-platform meideate template for building highly integrated Web, Desktop, and Mobile applications using a shared backend and UI logic. This project leverages **Bun Workspaces**, **Turbo**, and **Convex** to provide a seamless development experience across all platforms.

## 🚀 Architecture Overview

The project is structured as a meideate with multiple applications and shared packages:

### 📱 Applications (`apps/`)

- **[Web](./apps/web)**: A modern web application built with **Vue 3** and **Vite**.
- **[Desktop](./apps/desktop)**: A cross-platform desktop app powered by **Tauri**, using **Vue 3** and **Vite** for the frontend.
- **[Mobile](./apps/mobile)**: A mobile application built with **React Native** and **Expo**, utilizing **Uniwind (Tailwind CSS)** for styling.

### 📦 Shared Packages (`packages/`)

- **[UI](./packages/ui)**: Centralized design system.
  - Contains `global.css` with the core Tailwind configurations and shared styles used across Web, Desktop, and Mobile.
- **[Convex](./packages/convex)**: Shared backend logic and client configurations.
  - Manages database schemas, queries, and mutations.
  - Provides shared client wrappers for both Vue (Web/Desktop) and React (Mobile).

---

## 🛠️ Technology Stack

| Platform    | Framework           | Styling                | Tooling |
| :---------- | :------------------ | :--------------------- | :------ |
| **Web**     | Vue 3               | Tailwind CSS (Shared)  | Vite    |
| **Desktop** | Vue 3 + Tauri       | Tailwind CSS (Shared)  | Vite    |
| **Mobile**  | React Native + Expo | Uniwind (Tailwind CSS) | Metro   |
| **Backend** | Convex              | N/A                    | Bun     |

---

## 🔗 Shared Packages & Linking Strategy

One of the core strengths of this template is the ability to share logic and packages without redundant installations.

### workspace:\* Linking

This meideate uses **Bun Workspaces** to link packages. Instead of downloading or installing shared packages from a registry, they are referenced directly from the local `packages/` folder.

In each app's `package.json`, shared packages are linked like this:

```json
"dependencies": {
  "@meideate/ui": "workspace:*",
  "@meideate/convex": "workspace:*"
}
```

This ensures that any changes made in `packages/ui` or `packages/convex` are immediately reflected across all platforms without needing a re-install.

### Platform-Specific UI Usage

- **Web & Desktop**: Use the `global.css` and shared components directly via Vite.
- **Mobile**: Uses `uniwind` for Tailwind support. It references the global styles from the UI package to maintain visual consistency while adapting to React Native's component model.

### Convex Integration

Backend logic is centralized in `@meideate/convex`.

- **Web/Desktop**: Share the same Vue-specific Convex client logic.
- **Mobile**: Shares the schema and API definitions but uses a React-specific provider and client setup to handle the React Native environment.

---

## 🛠️ Getting Started

### Prerequisites

- [Bun](https://bun.sh/) installed on your machine.
- [Convex](https://www.convex.dev/) account and CLI.
- [Tauri](https://tauri.app/) dependencies (for Desktop).
- [Expo Go](https://expo.dev/go) (for Mobile testing).

### Installation

```bash
bun install
```

### Running the Apps

You can run all platforms using Turbo:

```bash
# Run Web
bun web

# Run Desktop (Tauri)
bun desktop

# Run Mobile (Expo)
bun mobile
```

### Development Tips

- **TypeScript Syntax**: If you encounter link-related TypeErrors that are non-critical, you may use `@ts-ignore` to maintain agility, though fixing the root cause in the shared package is preferred.
- **Tailwind**: Always prioritize adding shared styles to `packages/ui/src/global.css` to ensure they are available to all platforms.
- **Environment Management**: Keep platform-specific secrets in their respective `.env` files, but shared backend variables should stay in the root `.env`.

---

## 🔑 Environment Variables

To get the project running, you need the following variables in your root `.env` file. See the [**.env.example**](./.env.example) for a template.

| Variable                 | Description                                                  | App Usage                            |
| :----------------------- | :----------------------------------------------------------- | :----------------------------------- |
| `CONVEX_DEPLOYMENT`      | The name of your Convex deployment (e.g. `dev:foo-bar-123`). | Convex CLI                           |
| `CONVEX_URL`             | Your Convex deployment URL.                                  | Backend                              |
| `VITE_CONVEX_URL`        | Shared Convex URL for Web and Desktop apps.                  | `@meideate/web`, `@meideate/desktop` |
| `EXPO_PUBLIC_CONVEX_URL` | Shared Convex URL for Mobile (Native) apps.                  | `@meideate/mobile`                   |

---

## ♻️ Reusing this Template

### 🔧 Customizing for Your Project

1. **Rename Package Scope**:
   - Find and replace all instances of `@meideate` with your own scope (e.g., `@my-app`).
   - Update `package.json` files in the root and all subdirectories.
2. **Update App Metadata**:
   - **Web**: Update `<title>` in `apps/web/index.html`.
   - **Desktop**: Update `productName` and `identifier` in `apps/desktop/src-tauri/tauri.conf.json`.
   - **Mobile**: Update `name`, `slug`, and `scheme` in `apps/mobile/app.json`.
3. **Configure Convex**:
   - Run `npx convex dev` in `packages/convex` to initialize a new backend.
   - Update the `.env` file with your new `CONVEX_URL`.
4. **Vercel Deployment**:
   - Ensure you add `CONVEX_DEPLOY_KEY` to your Vercel Environment Variables.
   - Reference `turbo.json` to ensure your keys are exposed to the build pipeline.
