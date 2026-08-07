/* ============================================================
   notifications.js — Golden Pride Hub
   Real-time "in-app" notifications: a bell icon with an unread
   badge, a dropdown of recent announcements, and (if the user
   grants permission) a browser desktop notification when a new
   announcement is posted while the tab is open.

   LIMITATION: This works while the browser/tab is open (even in
   the background). It CANNOT deliver notifications when the
   browser is fully closed — that requires Firebase Cloud
   Messaging + a Cloud Function, which needs a paid Blaze plan.
   ============================================================ */

const LAST_SEEN_KEY = "gph_last_seen_announcement";
let notifInitialLoadDone = false;
let latestAnnouncements = [];

document.addEventListener("DOMContentLoaded", () => {
  auth.onAuthStateChanged((user) => {
    if (!user) return;
    injectNotificationBell();
    listenForAnnouncements();
  });
});

/* Injects the bell icon + dropdown into the topbar of whatever
   page is currently loaded (no need to edit every HTML file). */
function injectNotificationBell() {
  const topbar = document.querySelector(".topbar");
  if (!topbar || document.getElementById("notif-bell")) return;

  const wrap = document.createElement("div");
  wrap.className = "notif-bell-wrap";
  wrap.innerHTML = `
    <button id="notif-bell" class="btn-icon" aria-label="Notifications">
      <i class="fa-solid fa-bell"></i>
      <span id="notif-badge" class="notif-badge" style="display:none;">0</span>
    </button>
    <div id="notif-dropdown" class="notif-dropdown glass">
      <div class="notif-dropdown-header">
        <span>Notifications</span>
        <button id="notif-enable-btn" class="notif-enable-btn"><i class="fa-solid fa-bell"></i> Enable</button>
      </div>
      <div id="notif-list"></div>
    </div>
  `;
  topbar.appendChild(wrap);

  document.getElementById("notif-bell").addEventListener("click", (e) => {
    e.stopPropagation();
    const dropdown = document.getElementById("notif-dropdown");
    dropdown.classList.toggle("open");
    if (dropdown.classList.contains("open")) markAllRead();
  });

  document.addEventListener("click", (e) => {
    const dropdown = document.getElementById("notif-dropdown");
    if (dropdown && !wrap.contains(e.target)) dropdown.classList.remove("open");
  });

  document.getElementById("notif-enable-btn").addEventListener("click", requestNotificationPermission);
  updateEnableButtonState();
}

function updateEnableButtonState() {
  const btn = document.getElementById("notif-enable-btn");
  if (!btn || !("Notification" in window)) return;
  if (Notification.permission === "granted") {
    btn.innerHTML = `<i class="fa-solid fa-check"></i> Enabled`;
    btn.disabled = true;
  }
}

async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    showToast("Browser notifications are not supported here.", "warning");
    return;
  }
  const result = await Notification.requestPermission();
  if (result === "granted") {
    showToast("Desktop notifications enabled!", "success");
  } else {
    showToast("Notifications were not enabled.", "info");
  }
  updateEnableButtonState();
}

/* Real-time listener — fires on every announcement change */
function listenForAnnouncements() {
  db.collection(COLLECTIONS.ANNOUNCEMENTS)
    .orderBy("createdAt", "desc")
    .limit(15)
    .onSnapshot((snap) => {
      latestAnnouncements = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Fire a desktop notification for newly-added docs (skip the very
      // first snapshot load, which would otherwise notify for everything)
      if (notifInitialLoadDone) {
        snap.docChanges().forEach((change) => {
          if (change.type === "added") {
            const d = change.doc.data();
            maybeShowBrowserNotification(d.title, d.content);
          }
        });
      }
      notifInitialLoadDone = true;

      renderNotifDropdown();
      updateNotifBadge();
    });
}

function maybeShowBrowserNotification(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(`📢 ${title}`, {
      body: body.substring(0, 120),
      icon: "assets/icons/icon-192.png"
    });
  } catch (err) {
    // Some browsers restrict Notification() outside a service worker context
  }
}

function renderNotifDropdown() {
  const list = document.getElementById("notif-list");
  if (!list) return;

  if (latestAnnouncements.length === 0) {
    list.innerHTML = `<p class="empty-state" style="padding:20px;">No announcements yet.</p>`;
    return;
  }

  list.innerHTML = latestAnnouncements
    .map(
      (a) => `
      <a href="announcements.html" class="notif-item">
        <strong>${sanitize(a.title)}</strong>
        <span>${sanitize((a.content || "").substring(0, 70))}…</span>
        <small>${formatDate(a.createdAt)}</small>
      </a>`
    )
    .join("");
}

function updateNotifBadge() {
  const badge = document.getElementById("notif-badge");
  if (!badge) return;

  const lastSeen = Number(localStorage.getItem(LAST_SEEN_KEY) || 0);
  const unread = latestAnnouncements.filter((a) => {
    const t = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
    return t > lastSeen;
  }).length;

  if (unread > 0) {
    badge.textContent = unread > 9 ? "9+" : unread;
    badge.style.display = "flex";
  } else {
    badge.style.display = "none";
  }
}

function markAllRead() {
  localStorage.setItem(LAST_SEEN_KEY, String(Date.now()));
  updateNotifBadge();
}
