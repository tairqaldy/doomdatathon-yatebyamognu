# Freedom AIM Demo (Expo Go)

The phone demo [`/phone/`](../phone/) (AIM inside a copy of the Freedom Broker iOS app, #21) wrapped in a native app, so you can show it on a real phone through **Expo Go** (#24). The app is one full-screen WebView. All logic lives in the web page, so a deploy to `main` updates the app with no rebuild.

## Run it on your phone (2 minutes)

1. Install **Expo Go** from the App Store / Google Play.
2. On the laptop:
   ```bash
   cd mobile
   npm install
   npx expo start
   ```
3. Scan the QR code from the terminal: with the iPhone Camera (iOS) or inside Expo Go (Android). The phone and laptop must be on the same Wi-Fi. If they can't see each other (venue Wi-Fi, hotspot), use `npx expo start --tunnel`.

The app opens `https://freedom-cqa.vercel.app/phone/` (production, which has the AI keys). To point it at a local dev server instead:
```bash
EXPO_PUBLIC_DEMO_URL=http://<laptop-LAN-IP>:3000/phone/ npx expo start
```

## If it doesn't open
- **Camera says "No usable data found":** Expo Go isn't installed yet. Install it, open it once, scan again.
- **"You're signed in to Expo Go as …, but not signed in to Expo CLI":** run `npx expo login` on the laptop with the same Expo account (or sign out in Expo Go), then scan again.
- **Spinner forever:** the phone can't reach the laptop. Use the same Wi-Fi or hotspot, or `npx expo start --tunnel`.
- **No install possible:** open https://freedom-cqa.vercel.app/phone/ in Safari → Share → Add to Home Screen. It runs full screen and looks almost the same.

## What the wrapper adds
- Edge to edge on iOS: the page pads itself with CSS `env(safe-area-inset-*)`, so the blue Счета header runs under the status bar as in the real app. On Android it pads natively.
- Light status bar on navy, a loading screen, and an error screen with «Повторить».
- Microphone allowed for AIM voice questions (`mediaCapturePermissionGrantType="grant"`).
- Links outside the demo open in the system browser.
- After an iOS WebView crash it reloads by itself.

## Checks
```bash
npx tsc --noEmit      # typecheck
npx expo-doctor       # SDK / dependency check
npx expo start --ios  # iOS Simulator with Expo Go (needs Xcode)
```

Stack: Expo SDK 58, React Native 0.88, `react-native-webview` 14 (bundled in Expo Go, so no dev build is needed). Versions are pinned by `npx expo install`.
