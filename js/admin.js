/* ============================================================
   admin.js — Golden Pride Hub
   Admin panel: statistics, manage users/announcements/events/
   gallery/achievements. Only runs on admin.html (route-protected
   via body[data-auth="admin"] in auth.js).
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  if (!document.body.classList.contains("admin-page")) return;

  initAdminTabs();
  loadAdminStats();
  bindAnnouncementForm();
  bindEventForm();
  bindGalleryForm();
  bindAchievementForm();
  loadAdminAnnouncementsTable();
  loadAdminUsersTable();
  loadAdminEventsTable();
  loadAdminGalleryTable();
  loadAdminAchievementsTable();
});

/* ---------- Tabs ---------- */
function initAdminTabs() {
  const tabs = document.querySelectorAll(".admin-tab");
  const panels = document.querySelectorAll(".admin-panel");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      panels.forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(tab.dataset.target).classList.add("active");
    });
  });
}

/* ---------- Statistics ---------- */
async function loadAdminStats() {
  const [users, announcements, events, gallery, achievements] = await Promise.all([
    db.collection(COLLECTIONS.USERS).get(),
    db.collection(COLLECTIONS.ANNOUNCEMENTS).get(),
    db.collection(COLLECTIONS.EVENTS).get(),
    db.collection(COLLECTIONS.GALLERY).get(),
    db.collection(COLLECTIONS.ACHIEVEMENTS).get()
  ]);

  setText("admin-stat-users", users.size);
  setText("admin-stat-announcements", announcements.size);
  setText("admin-stat-events", events.size);
  setText("admin-stat-gallery", gallery.size);
  setText("admin-stat-achievements", achievements.size);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

/* ---------- Announcements CRUD ---------- */
function bindAnnouncementForm() {
  const form = document.getElementById("announcement-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("announcement-id").value;
    const title = document.getElementById("announcement-title").value.trim();
    const content = document.getElementById("announcement-content").value.trim();
    const image = document.getElementById("announcement-image").value.trim();

    if (!title || !content) {
      showToast("Title and content are required.", "warning");
      return;
    }

    const payload = { title, content, image, author: currentUserData.fullname };

    try {
      if (id) {
        await db.collection(COLLECTIONS.ANNOUNCEMENTS).doc(id).update(payload);
        showToast("Announcement updated.", "success");
      } else {
        payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection(COLLECTIONS.ANNOUNCEMENTS).add(payload);
        showToast("Announcement posted.", "success");
      }
      form.reset();
      document.getElementById("announcement-id").value = "";
      loadAdminAnnouncementsTable();
    } catch (err) {
      showToast("Failed to save announcement.", "error");
    }
  });
}

async function loadAdminAnnouncementsTable() {
  const tbody = document.getElementById("admin-announcements-table");
  if (!tbody) return;

  const snap = await db.collection(COLLECTIONS.ANNOUNCEMENTS).orderBy("createdAt", "desc").get();
  tbody.innerHTML = snap.docs
    .map((doc) => {
      const d = doc.data();
      return `
      <tr>
        <td>${sanitize(d.title)}</td>
        <td>${sanitize(d.author)}</td>
        <td>${formatDate(d.createdAt)}</td>
        <td class="table-actions">
          <button class="btn-icon" onclick="editAnnouncement('${doc.id}')"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-icon" onclick="deleteAnnouncement('${doc.id}')"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>`;
    })
    .join("") || `<tr><td colspan="4" class="empty-state">No announcements yet.</td></tr>`;
}

async function editAnnouncement(id) {
  const doc = await db.collection(COLLECTIONS.ANNOUNCEMENTS).doc(id).get();
  const d = doc.data();
  document.getElementById("announcement-id").value = id;
  document.getElementById("announcement-title").value = d.title;
  document.getElementById("announcement-content").value = d.content;
  document.getElementById("announcement-image").value = d.image || "";
  document.getElementById("announcement-form").scrollIntoView({ behavior: "smooth" });
}

async function deleteAnnouncement(id) {
  const ok = await confirmDialog("Delete this announcement? This cannot be undone.");
  if (!ok) return;
  await db.collection(COLLECTIONS.ANNOUNCEMENTS).doc(id).delete();
  showToast("Announcement deleted.", "success");
  loadAdminAnnouncementsTable();
}

/* ---------- Users Management ---------- */
async function loadAdminUsersTable() {
  const tbody = document.getElementById("admin-users-table");
  if (!tbody) return;

  const snap = await db.collection(COLLECTIONS.USERS).orderBy("fullname").get();
  tbody.innerHTML = snap.docs
    .map((doc) => {
      const d = doc.data();
      return `
      <tr>
        <td>${sanitize(d.fullname)}</td>
        <td>${sanitize(d.email)}</td>
        <td><span class="role-badge ${d.role === ROLES.ADMIN ? "badge-admin" : "badge-member"}">${sanitize(d.role)}</span></td>
        <td class="table-actions">
          <button class="btn-icon" onclick="toggleUserRole('${doc.id}', '${d.role}')">
            <i class="fa-solid fa-user-gear"></i>
          </button>
        </td>
      </tr>`;
    })
    .join("") || `<tr><td colspan="4" class="empty-state">No members yet.</td></tr>`;
}

async function toggleUserRole(uid, currentRole) {
  const newRole = currentRole === ROLES.ADMIN ? ROLES.MEMBER : ROLES.ADMIN;
  const ok = await confirmDialog(`Change this user's role to "${newRole}"?`);
  if (!ok) return;
  await db.collection(COLLECTIONS.USERS).doc(uid).update({ role: newRole });
  showToast("User role updated.", "success");
  loadAdminUsersTable();
}

/* ---------- Events CRUD ---------- */
function bindEventForm() {
  const form = document.getElementById("event-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("event-title").value.trim();
    const description = document.getElementById("event-description").value.trim();
    const location = document.getElementById("event-location").value.trim();
    const date = document.getElementById("event-date").value;

    if (!title || !date) {
      showToast("Title and date are required.", "warning");
      return;
    }

    try {
      await db.collection(COLLECTIONS.EVENTS).add({
        title,
        description,
        location,
        date: new Date(date)
      });
      showToast("Event added.", "success");
      form.reset();
      loadAdminEventsTable();
    } catch (err) {
      showToast("Failed to add event.", "error");
    }
  });
}

async function loadAdminEventsTable() {
  const tbody = document.getElementById("admin-events-table");
  if (!tbody) return;

  const snap = await db.collection(COLLECTIONS.EVENTS).orderBy("date", "desc").get();
  tbody.innerHTML = snap.docs
    .map((doc) => {
      const d = doc.data();
      return `
      <tr>
        <td>${sanitize(d.title)}</td>
        <td>${sanitize(d.location)}</td>
        <td>${formatDate(d.date)}</td>
        <td class="table-actions">
          <button class="btn-icon" onclick="deleteEvent('${doc.id}')"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>`;
    })
    .join("") || `<tr><td colspan="4" class="empty-state">No events yet.</td></tr>`;
}

async function deleteEvent(id) {
  const ok = await confirmDialog("Delete this event?");
  if (!ok) return;
  await db.collection(COLLECTIONS.EVENTS).doc(id).delete();
  showToast("Event deleted.", "success");
  loadAdminEventsTable();
}

/* ---------- Gallery CRUD ---------- */
function bindGalleryForm() {
  const form = document.getElementById("gallery-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const image = document.getElementById("gallery-image").value.trim();
    const caption = document.getElementById("gallery-caption").value.trim();

    if (!image) {
      showToast("Image URL is required.", "warning");
      return;
    }

    try {
      await db.collection(COLLECTIONS.GALLERY).add({
        image,
        caption,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      showToast("Photo added to gallery.", "success");
      form.reset();
      loadAdminGalleryTable();
    } catch (err) {
      showToast("Failed to upload photo.", "error");
    }
  });
}

async function loadAdminGalleryTable() {
  const tbody = document.getElementById("admin-gallery-table");
  if (!tbody) return;

  const snap = await db.collection(COLLECTIONS.GALLERY).orderBy("createdAt", "desc").get();
  tbody.innerHTML = snap.docs
    .map((doc) => {
      const d = doc.data();
      return `
      <tr>
        <td><img class="table-thumb" src="${sanitize(d.image)}" alt=""></td>
        <td>${sanitize(d.caption)}</td>
        <td class="table-actions">
          <button class="btn-icon" onclick="deleteGalleryItem('${doc.id}')"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>`;
    })
    .join("") || `<tr><td colspan="3" class="empty-state">No photos yet.</td></tr>`;
}

async function deleteGalleryItem(id) {
  const ok = await confirmDialog("Delete this photo?");
  if (!ok) return;
  await db.collection(COLLECTIONS.GALLERY).doc(id).delete();
  showToast("Photo deleted.", "success");
  loadAdminGalleryTable();
}

/* ---------- Achievements CRUD ---------- */
function bindAchievementForm() {
  const form = document.getElementById("achievement-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("achievement-title").value.trim();
    const description = document.getElementById("achievement-description").value.trim();
    const image = document.getElementById("achievement-image").value.trim();

    if (!title) {
      showToast("Title is required.", "warning");
      return;
    }

    try {
      await db.collection(COLLECTIONS.ACHIEVEMENTS).add({
        title,
        description,
        image,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      showToast("Achievement added.", "success");
      form.reset();
      loadAdminAchievementsTable();
    } catch (err) {
      showToast("Failed to add achievement.", "error");
    }
  });
}

async function loadAdminAchievementsTable() {
  const tbody = document.getElementById("admin-achievements-table");
  if (!tbody) return;

  const snap = await db.collection(COLLECTIONS.ACHIEVEMENTS).orderBy("createdAt", "desc").get();
  tbody.innerHTML = snap.docs
    .map((doc) => {
      const d = doc.data();
      return `
      <tr>
        <td>${sanitize(d.title)}</td>
        <td>${sanitize((d.description || "").substring(0, 60))}</td>
        <td class="table-actions">
          <button class="btn-icon" onclick="deleteAchievement('${doc.id}')"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>`;
    })
    .join("") || `<tr><td colspan="3" class="empty-state">No achievements yet.</td></tr>`;
}

async function deleteAchievement(id) {
  const ok = await confirmDialog("Delete this achievement?");
  if (!ok) return;
  await db.collection(COLLECTIONS.ACHIEVEMENTS).doc(id).delete();
  showToast("Achievement deleted.", "success");
  loadAdminAchievementsTable();
}
