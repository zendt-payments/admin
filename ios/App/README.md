# Zendt iOS — first time in Xcode

## “App (blue) is empty” — that is normal

In the **left sidebar** you see two **projects**:

```
▼ App          ← Zendt (your app) — click the ▸ triangle to expand
▼ Pods         ← libraries — big tree, ignore
```

### Expand App

Click the **small triangle (▸)** to the **left** of the blue **App** icon (not the icon alone).

After expanding **App** you should see:

```
▼ App
    ▼ App              ← yellow folder (Swift, public web files)
        AppDelegate.swift
        public/          ← your built website (index.html)
        Assets.xcassets
        ...
    ▼ Products
        App.app
    ▼ Pods             ← only 2 config files here (not the big Pods project)
    ▼ Frameworks
```

There is a **second** **Pods** at the **bottom** of the sidebar (separate project) — that is the large dependency tree. **Do not confuse** the two.

### Center panel looks “empty”

If you click the **blue App** icon, the **middle** of Xcode shows **project settings** (Signing, General), not a file list. That is correct — not broken.

**You do not need to open any file to run the app.**

### How to run (only this)

Top bar: **▶** | scheme **App** | **iPhone 17** (Simulator) → press **▶**.

---

# Zendt iOS — fix “Build Failed”

## #1 mistake: wrong Xcode file

| Open this ✅ | NOT this ❌ |
|-------------|------------|
| **`App.xcworkspace`** | `App.xcodeproj` |

If you open **only** `App.xcodeproj`, you get:

- `Unable to resolve module dependency: 'Capacitor'`
- `Search path ... Capacitor not found`

**Fix:** Quit Xcode. Run from `zendt-frontend`:

```bash
npm run cap:open:ios
```

That runs `open ios/App/App.xcworkspace`.

---

## #2 mistake: wrong run destination

For your **first** run, use a **simulator**, not “Any iOS Device”.

In the Xcode top bar, click the device menu and choose:

- **iPhone 17** (or any **iOS Simulator** entry)

If you pick **Any iOS Device** or a real iPhone without signing, you get:

- `Signing for "App" requires a development team`

**Fix (simulator):** Pick **iPhone 17** → press **Run ▶**.

**Fix (real iPhone):** Target **App** → **Signing & Capabilities** → enable **Automatically manage signing** → choose your **Team**.

---

## Prepare + clean (if it still fails)

Use **`npm run cap:sync`** or **`npm run cap:sync:ios`** (not raw `npx cap sync ios`) so `ZendtAppleSignInPlugin` stays registered after sync.

```bash
cd zendt-frontend
npm run ios:prepare
```

Then in Xcode:

1. **Product → Clean Build Folder** (⇧⌘K)
2. **Product → Run** (⌘R)

Optional:

```bash
rm -rf ~/Library/Developer/Xcode/DerivedData/App-*
```

---

## Face ID / Biometrics button missing on login

The button appears only when the device supports biometric login **and** (for quick unlock) you have enrolled before.

Zendt picks the best method in order: **Face ID → fingerprint → device passcode (PIN)**. Only one step is skipped if that method is not available on the device (e.g. iPhone with Face ID never asks for fingerprint). On Android, device PIN is not used for this button — enroll face or fingerprint, or use password.

### iOS Simulator

1. In the **Simulator** menu bar (while Simulator app is focused):  
   **Features → Face ID → Enrolled** (must be checked) — then Zendt shows **Face ID**, not only passcode.
2. When the Face ID dialog appears: **Features → Face ID → Matching Face**.
3. If Face ID is not enrolled, Zendt falls back to the Simulator **device passcode** (PIN) so you can still test.
4. In the app: sign in with **email + password** once → tap **Enable** when asked to save Face ID login.
5. Log out and return to login → **Use Face ID / Biometrics** should appear.

Without **Enrolled**, iOS reports no biometrics and the button stays hidden.

### Real iPhone

- Settings → **Face ID & Passcode** (or Touch ID) must be set up on the phone.
- Sign in once with password in Zendt → **Enable** biometric quick sign-in.

---

## Apple Sign In error 1000 (`authorizationError`)

**Not “Xcode is broken.”** Error 1000 is Apple’s generic “Sign in with Apple failed” — usually environment/setup, not your React code.

Most common on **Simulator**:

1. **No Apple ID on the Simulator** — **Settings → Apple Account** → sign in (this alone fixes many 1000s).
2. **Sign in with Apple not enabled** — [developer.apple.com](https://developer.apple.com) → Identifiers → **com.zendt.app** → Sign in with Apple; then Xcode → **Signing & Capabilities** → same capability + **Team** selected.
3. **Stale build** — `npm run ios:prepare`, open **`App.xcworkspace`**, **Product → Clean Build Folder**, **Run ▶**.

**Simulator:** Zendt uses **web** Apple sign-in (Safari sheet) with **`response_mode=form_post`** (required by Apple when requesting name/email).

You need:

- Simulator **Settings → Apple Account** signed in  
- **Backend + ngrok running** — Apple POSTs to `VITE_APPLE_REDIRECT_URI`; the server redirects into the app (`com.zendt.app://`)  
- **Apple Developer → Services ID `com.zendt.app.signin`:**  
  - **Domains:** `playtime-sitting-detection.ngrok-free.dev` (your ngrok host, no `https://`)  
  - **Return URLs:** exact `VITE_APPLE_REDIRECT_URI` (e.g. `https://…/auth/apple/callback`)

If Apple shows **invalid request**, it was usually `fragment` mode with email/name scope — fixed in code; rebuild with `npm run ios:prepare`.

After pulling latest:

1. From `zendt-frontend`: `npm install` then `npm run ios:prepare`
2. Open **`App.xcworkspace`** → **Product → Clean Build Folder** → **Run ▶**
3. **Signing & Capabilities** → confirm **Sign in with Apple** appears (or add it + Team).
4. **Apple Developer** → App ID `com.zendt.app` → Sign in with Apple enabled.

---

## Checklist before Run ▶

- [ ] Opened **`App.xcworkspace`**
- [ ] Scheme = **App**
- [ ] Destination = **iPhone 17** (Simulator)
- [ ] `npm run ios:prepare` run after last code change
