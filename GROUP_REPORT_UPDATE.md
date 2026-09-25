# CSHARE Group Reports update

This update adds:

- Group Monthly Report screen for ministry-group overseers.
- Admin Group Reports page with group selection.
- `groupId` + `reporterName` snapshot on new monthly reports.
- Firestore rules allowing only the assigned group overseer (or an admin) to read that group's reports.
- Home/dashboard entry points.
- A Firebase Cloud Function notification when a new group report is submitted.
- Security-rule tests for group report access.

## Files changed

- `src/types/index.ts`
- `src/services/reportService.ts`
- `src/screens/shared/MyReportScreen.tsx`
- `src/screens/shared/GroupReportScreen.tsx` (new)
- `src/screens/user/HomeScreen.tsx`
- `src/screens/admin/DashboardScreen.tsx`
- `src/navigation/types.ts`
- `src/navigation/UserNavigator.tsx`
- `src/navigation/AdminNavigator.tsx`
- `src/navigation/navigationRef.ts`
- `src/services/notificationService.ts`
- `src/services/backgroundSync.ts`
- `firestore.rules`
- `functions/src/index.ts`
- `tests/rules/firestore.rules.test.ts`

## Deployment

1. Replace the corresponding files with the versions in this update.
2. Install/build dependencies normally.
3. Run the app typecheck/build.
4. Deploy Firestore rules and functions:

`firebase deploy --only firestore:rules,firestore:indexes,functions`

The group report query only uses `groupId`, so no composite index is required.

## Important: reports already submitted before this update

Old report documents do not contain `groupId`/`reporterName`, so they will not automatically appear in a group report. New submissions will work immediately.

If old reports need to be shown, backfill them deliberately using an admin migration based on the correct historical group assignment. Do not blindly use a person's current group if people have been moved between groups.
