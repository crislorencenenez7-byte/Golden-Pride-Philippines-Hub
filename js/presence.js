/* ============================================================
   presence.js — Golden Pride Hub
   Tracks whether the current user is "online" by writing a
   heartbeat (isOnline + lastSeen) to their user document every
   60 seconds while the tab is active. Other pages (members.js
   logic in dashboard.js) read this to show a green/gray dot.

   NOTE: This is a best-effort approach using Firestore only.
   It is not instant like Firebase Realtime Database's
   onDisconnect() — a user is considered "online" if lastSeen is
   within the last 2 minutes. Closing the tab may take up to that
   long to visibly go "offline" to other users.
   ============================================================ */

const PRESENCE_INTERVAL_MS = 60 * 1000; // heartbeat every 60s
const PRESENCE_STALE_MS = 2 * 60 * 1000; // considered offline after 2 min

let presenceTimer = null;

auth.onAuthStateChanged((user) => {
  if (!user) {
    if (presenceTimer) clearInterval(presenceTimer);
    return;
  }

  const setOnline = () => {
    db.collection(COLLECTIONS.USERS).doc(user.uid).update({
      isOnline: true,
      lastSeen: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(() => {}); // ignore if doc not ready yet
  };

  const setOffline = () => {
    db.collection(COLLECTIONS.USERS).doc(user.uid).update({
      isOnline: false,
      lastSeen: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(() => {});
  };

  setOnline();
  presenceTimer = setInterval(setOnline, PRESENCE_INTERVAL_MS);

  // Best-effort: mark offline when the tab is hidden/closed.
  // Not 100% reliable (browsers can kill the page before this fires),
  // but the 2-minute staleness check above covers the gap.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") setOffline();
    else setOnline();
  });
  window.addEventListener("beforeunload", setOffline);
});

/**
 * Given a user doc's isOnline + lastSeen fields, returns true if
 * they should currently be displayed as "online".
 */
function isUserOnline(userData) {
  if (!userData.isOnline || !userData.lastSeen) return false;
  const lastSeenMs = userData.lastSeen.toDate ? userData.lastSeen.toDate().getTime() : new Date(userData.lastSeen).getTime();
  return Date.now() - lastSeenMs < PRESENCE_STALE_MS;
}
