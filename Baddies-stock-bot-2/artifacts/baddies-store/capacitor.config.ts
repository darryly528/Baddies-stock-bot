import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.baddies.store",
  appName: "Baddies Store",
  webDir: "dist/public",
  server: {
    androidScheme: "https",
    // When running natively, point API calls to your deployed backend.
    // Replace this URL with your actual deployed API server URL after publishing.
    url: process.env["CAPACITOR_SERVER_URL"] ?? undefined,
    cleartext: false,
  },
  ios: {
    contentInset: "automatic",
    allowsLinkPreview: false,
    scrollEnabled: true,
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
