# CSHARE

Offline-first weekly assignment app (React Native + Firebase, Android first).
Administrators create assignments; people see them on their phone, get reminders, and can say
"I can't do this" — with or without internet after the first sign-in.

**Architecture = screen → small service → Firebase.** No custom backend, no custom auth, no custom sync.

| Need | Firebase feature used |
| --- | --- |
| Who is signed in (stays signed in, works offline) | Authentication (email + password) |
| Users, assignments, weeks, types, settings | Cloud Firestore, with its **built-in offline cache** and automatic sync |
| Who is allowed to do what | Firestore **security rules** (`firestore.rules`) |
| Instant "sync now" and "can't do" pushes (optional) | Cloud Messaging, sent by **one** Cloud Function (`functions/src/index.ts`) |
| Reminders before an assignment | **Not** Firebase: scheduled *on the phone* (Notifee + Android alarms) so they work offline |

## Folder map

```
src/
  services/    authService, userService, assignmentService, weekService, settingsService, notificationService
  context/     AuthContext (sign-in state), AppDataContext (settings, types, my assignments, reminder sync)
  screens/     auth/  user/  shared/  admin/  CallReminderRoot
  components/  small shared UI pieces
  utils/       pure logic (dates, reminders plan, auto-assign, status) — unit tested
android/       native project incl. CallActivity (call-style reminder) and the ring sound
firestore.rules  firestore.indexes.json  functions/  scripts/bootstrap-admin.js  tests/rules/
```

## One-time setup

1. **Firebase project** (console.firebase.google.com): create a project, then
   - *Build → Authentication → Sign-in method*: enable **Email/Password**.
   - *Build → Firestore Database*: create a database (production mode).
   - *Project settings → Your apps → Add Android app*, package name **`com.cshare`** (change it in
     `android/app/build.gradle` + the `.kt` package if you prefer another). Download
     **`google-services.json`** into **`android/app/`** (see `google-services.json.example`).
   - Cloud Functions (optional but recommended, needs the Blaze plan): used only for push messages.
2. **Tools**: Node 18+, JDK 17, Android Studio (SDK 35 + NDK 26.1.10909125), Firebase CLI (`npm i -g firebase-tools`).
3. **Install**:
   ```
   npm install
   cd android && gradle wrapper --gradle-version 8.10.2 && cd ..    # creates gradle-wrapper.jar (or open android/ once in Android Studio)
   ```
4. **Deploy rules, indexes and functions**:
   ```
   firebase login
   firebase use --add            # choose your project (updates .firebaserc)
   npm --prefix functions install
   npm run deploy:firebase
   ```
   (No Blaze plan? Deploy only `firestore:rules,firestore:indexes`; everything except push messages works.)
5. **Create the first administrator** (there is deliberately no in-app way):
   - Firebase console → Project settings → Service accounts → *Generate new private key* (keep it private, never commit it).
   - ```
     cd scripts && npm install
     node bootstrap-admin.js ./serviceAccount.json you@example.com "Your Name" "+15550100" --create-password=ChooseOne
     ```
   - Sign in with that email in the app. From then on administrators add other administrators inside the app.

## Run / build

```
npm start                 # Metro
npm run android           # debug build on a connected phone/emulator
npm run build:apk         # release APK (android/app/build/outputs/apk/release) — create your own signing key first (see android/app/build.gradle)
npm run typecheck && npm run lint && npm test
npm run test:rules        # security rules against the Firestore emulator (needs Firebase CLI + Java)
```

## How people join

1. Person installs the app → **Create account** (email + password) → name + phone. *(needs internet once)*
2. They wait on a "Waiting for approval" screen. An administrator opens **People → Waiting → Approve** and ticks their qualifications.
3. The person's app updates by itself; assignments appear. They stay signed in and everything works offline afterwards.


## Weekly sheets (the only place assignments are created)

Admin → **Week** tab (or the two meeting tiles on the dashboard). A week has two meetings, each with its own clean sheet like the printed one:
**Midweek** and **Weekend** (chairman, public talk speaker, Watchtower study conductor/reader). One person can hold parts in both.

- **First time:** Week tab → choose **English** or **Twi** → *Load the layout* (also under Settings → Language of the sheet). It creates the parts, minutes,
  sections and icons for both meetings. Every word is data: rename sections and parts to your congregation's language, and set how minutes are
  written (`{n} min` / `Simma {n}`). The app's own buttons are English for now.
- **Each week:** *Start the sheet*, then **tap any line** to choose who does it, change its title or minutes, or remove it. **＋ Add** puts an extra part in any section.
  **✨ Suggest people** fills empty parts (you review first). Every change is saved immediately and reaches the people involved: there is no separate save step.
- **Read / Update / Delete:** tap a line to change or remove it; *Change* on the top card edits day, time and reading; *Delete this sheet* removes the meeting.
  Times work themselves out from the start time and the minutes.
- **Statuses:** each line shows Seen / Not seen / Can't do for the people on it.
- **Share / Print:** *Share* sends the sheet as text (WhatsApp, SMS…). *Print / PDF* opens Android's print dialog (choose *Save as PDF* to share a file).
- **Members** see their own cards on Home (next, coming up, recent) and the whole sheets under Week → *Midweek / Weekend*, offline too (nearby weeks are kept on the phone).
- **Reload:** pull down on any screen, or tap **↻ Reload** on Home / Dashboard.

## Works with the app closed, and when internet returns

- Reminders are **Android alarms on the phone**: they ring offline with CSHARE closed.
- A phone learns about a new/changed assignment when it next has internet. That happens (a) when CSHARE is opened, (b) by **background sync**: Android runs it
  by itself every ~15+ minutes only when there is a connection, and after a restart, (c) **instantly** if you deploy the optional Cloud Function (silent push; needs the Blaze plan).
- On learning about an assignment the phone immediately shows "New assignment…" (or "Changed…") and schedules all its reminders. Administrators get the same for their own parts.
- Android may delay background work on some brands (battery saver). Allow CSHARE to run **without battery restrictions**.


## Planning ahead, and the phone calendar

- **Planner:** Week tab → *🗓️ Planner* (or the dashboard tile) lists the coming weeks (26, then 13 more at a time) with "Not started" / "5/9 assigned" for each meeting.
  Tap one to open its sheet. *📅 Go to a date* jumps to any week, including next year. People see their parts on Home as soon as you assign them:
  *Coming up* (next 30 days) and *Later* (with the year shown when it is not this year). Nearby weeks (26 ahead) are kept on the phone for offline reading.
- **Reminders window:** the phone schedules alarms for the next 60 days and moves that window at every sync (so a talk next year is picked up in time and Android's alarm limit is never reached).
- **Phone calendar:** Settings → *Phone calendar* → turn on. Each assignment becomes an event in the calendar you choose (its reminders become the calendar's own alerts, if you keep
  that switch on). It is added, moved and removed automatically when assignments change, offline too. If a Google account is on the phone, Android syncs the calendar to Google Calendar
  (and other devices). It is a **one-way** copy: changing an event in the calendar does not change CSHARE. The small native module for this is `android/.../CalendarModule.kt`.

## Reminders and the call-style alert (what Android does and does not allow)

- Each phone plans up to **3 reminders** per assignment (defaults: 3 days, 1 day, 2 hours before; changeable in Settings and per assignment). They are scheduled with Android's alarm manager through Notifee, so they fire with **no internet**.
- Every time Firestore delivers changes (including after reconnecting) `syncLocalReminders` compares the plan with what is scheduled and cancels/replaces outdated ones.
- The **final** reminder can be "call-style": a high-priority notification with ring sound + vibration and a full-screen intent that opens `CallActivity` (a CSHARE screen: "You have an assignment. Please check the CSHARE app"). It **never places a phone call**. If Android does not grant the full-screen intent (Android 14+ restricts it, or the phone is in use) it shows as a normal heads-up notification with sound/vibration.
- Android 12+: the person may need to allow **Alarms & reminders** for CSHARE (Settings shows a button). Some makers (Xiaomi, Huawei, Samsung "sleeping apps") kill background apps; allow CSHARE to run unrestricted. Settings has "Send me a test reminder" and "Try the loud final reminder".
- Push messages (FCM) need internet; they are additional, never a replacement for the local reminders.

## Verification status — please read

Built in a sandbox **without internet, Android SDK or Firebase access**. What was and was not verified:

| Check | Status |
| --- | --- |
| Unit tests for pure logic (dates/weeks, reminder plan, auto-assign, status, sheet grouping, people filters, error messages): 33 tests | **Run and passing** (in 4 time zones) |
| Strict TypeScript over all of `src/` | **Passing, but against hand-written type stubs** for React, React Native, Firebase, Notifee and React Navigation. It proves internal consistency (imports, props, types); it does **not** prove correct use of the real libraries' APIs. Run `npm run typecheck` after `npm install`. |
| Syntax of Cloud Function, rules tests, bootstrap script; JSON + Android XML validity | Passing |
| `npm install`, ESLint, Jest with the React Native preset | **Not run** (no network) |
| Android build (Gradle files, manifest, Kotlin) | **Not run.** Written from the React Native 0.76 template. Expect to possibly adjust versions on first build. |
| Firestore security rules | **Written, not executed.** `tests/rules/` (15 tests) exists; run `npm run test:rules`. |
| Cloud Function | Not compiled or deployed |
| Authentication, Firestore reads/writes, offline behaviour, notifications, full-screen call alert, reconnect sync, FCM | **Not tested on a device** — cannot be done here |

Known unknowns to check first on a real phone: (1) Notifee accepting `launchActivity: 'com.cshare.CallActivity'` for the call-style alert (if not, you still get the heads-up fallback; the fix would be in `notificationService.ts › androidFor`); (2) full-screen behaviour on Android 14+; (3) the Firestore composite index is created (`firestore.indexes.json`) — the first query error message in the log also contains a one-click link.

## Design decisions worth knowing

- **Per-person answers** live inside the assignment (`responses.{uid}`); the rules let a person write only their own entry. "Seen" is recorded when they open the assignment; if the day/time is edited, answers reset so people see the change.
- **Names are copied into each assignment** (`assigneeNames`) so people can see co-assignees without being allowed to read other people's profiles. Administrator contact details are the only profiles all active users may read.
- **Writes never freeze offline.** Firestore only confirms a write after the server does; `services/commit.ts` waits 4 seconds, throws real errors (e.g. permission denied) and otherwise reports "saved on this phone, will sync".
- **Auto-assign** is a deterministic suggestion (qualified → not already busy that week → longest since this type → fewest recent → name). It only fills a preview; nothing is saved until the administrator taps *Use these* and then *Save*.
- No exports, no WhatsApp integration, no scraping of jw.org, no custom backend.
