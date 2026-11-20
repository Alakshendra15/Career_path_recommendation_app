# Mobile app (Expo + React Native + TypeScript)

Dark-themed Android app for the Career Path Recommendation System. Talks to the Express backend (`../backend`),
which calls the ML service (`../ai-ml`).

## Run
```
npm install
npx expo start          # scan the QR code with Expo Go on a phone on the same Wi-Fi
```
Start the backend (port 4000) and ML service (port 8000) first; see their READMEs.

The API address is detected automatically in Expo Go (your PC's LAN IP, port 4000). To override it, set
`EXPO_PUBLIC_API_URL` (see `.env.example`). Android emulator fallback is `http://10.0.2.2:4000`.

## Structure
- `app/` expo-router screens
  - `(auth)/` welcome, login, signup
  - `onboarding.tsx` 6-7 step wizard (the project step only appears for "practical" students; also used for Edit profile)
  - `(tabs)/` career, roadmap, roles (jobs), profile
  - `_layout.tsx` route guards: signed out -> auth, signed in without a profile -> onboarding, otherwise -> tabs
- `src/lib/api.ts` fetch client with Bearer token; `src/lib/session.ts` token in SecureStore
- `src/store/` zustand stores: auth, onboarding draft, analysis (shared by the four tabs)
- `src/components/ui/` shared UI kit; `src/constants/` states/cities and skill lists (generated from the ML data)
- `src/theme.ts` colours ported from the website

## Checks
`npx tsc --noEmit` type-checks the app.
`npx expo export --platform android --no-bytecode` confirms it bundles.
