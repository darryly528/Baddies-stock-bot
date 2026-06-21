# Building Baddies Store as a Native App

## What's set up

Capacitor is configured to wrap the React/Vite web build into native iOS, Android, and macOS apps.

- `android/` — Android Studio project (Kotlin + Gradle)
- `ios/` — Xcode project (Swift)
- `capacitor.config.ts` — App ID: `com.baddies.store`, Name: "Baddies Store"

---

## Prerequisites (on your local machine)

| Platform | Requirement |
|----------|-------------|
| Android  | Android Studio, Android SDK 22+ |
| iOS      | macOS + Xcode 15+, CocoaPods (`sudo gem install cocoapods`) |
| macOS    | Same as iOS — enable Mac Catalyst in Xcode |

---

## Step 1 — Set your API URL

When running as a native app, the app can't use relative `/api/...` URLs.
You must set `VITE_API_URL` to your deployed backend URL before building:

```bash
# In Baddies-stock-bot-2/artifacts/baddies-store/
echo "VITE_API_URL=https://your-api-server.replit.app" > .env.production
```

---

## Step 2 — Copy project to your Mac/PC

Download or clone the project to your local machine, then:

```bash
cd Baddies-stock-bot-2/artifacts/baddies-store
pnpm install
```

---

## Step 3 — Build & sync

```bash
# Builds the web app and copies it into both native projects
pnpm cap:sync
```

---

## Step 4 — Open in IDE and build

### Android
```bash
pnpm cap:android
# Opens Android Studio — click Run ▶ to build/install on device or emulator
```

### iOS / macOS
```bash
pnpm cap:ios
# Opens Xcode — select a simulator or device, click Run ▶
```

**For macOS app:** In Xcode, select your scheme → Edit Scheme → Destination → "My Mac (Mac Catalyst)". Xcode will compile a native macOS app from the same iOS project.

---

## Updating the app

Whenever you make changes to the web code:

```bash
pnpm cap:sync   # rebuilds and syncs into both native projects
```

Then rebuild in Xcode / Android Studio.

---

## App details

| Field    | Value |
|----------|-------|
| App ID   | `com.baddies.store` |
| App Name | Baddies Store |
| Web dir  | `dist/public` |
| Min Android SDK | 22 (Android 5.0+) |
| Min iOS  | 13.0+ |
