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
  bindImagePreviews();
});

/* ---------- Image Upload Helper ----------
   Reads a <input type="file"> as a compressed base64 data URL.
   Images are stored directly in Firestore documents (no Firebase
   Storage needed), so we cap the size to keep documents small. */
const MAX_IMAGE_BYTES = 700 * 1024; // 700KB raw file size limit

function readImageAsBase64(fileInput) {
  return new Promise((resolve, reject) => {
    const file = fileInput.files[0];
    if (!file) {
      resolve(null);
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      reject(new Error("Image too large. Please choose a photo under 700KB."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });
}

// Live preview thumbnails for the three admin upload forms
function bindImagePreviews() {
  const pairs = [
    ["gallery-image", "gallery-image-preview"],
    ["announcement-image", "announcement-image-preview"],
    ["achievement-image", "achievement-image-preview"]
  ];
  pairs.forEach(([inputId, previewId]) => {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    if (!input || !preview) return;
    input.addEventListener("change", () => {
      const file = input.files[0];
      if (!file) {
        preview.style.display = "none";
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        preview.src = reader.result;
        preview.style.display = "block";
      };
      reader.readAsDataURL(file);
    });
  });
}

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
    const imageInput = document.getElementById("announcement-image");
    const submitBtn = form.querySelector('button[type="submit"]');

    if (!title || !content) {
      showToast("Title and content are required.", "warning");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.classList.add("btn-loading");

    try {
      const image = await readImageAsBase64(imageInput);
      const payload = { title, content, author: currentUserData.fullname };
      if (image) payload.image = image;

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
      document.getElementById("announcement-image-preview").style.display = "none";
      loadAdminAnnouncementsTable();
    } catch (err) {
      showToast(err.message || "Failed to save announcement.", "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.classList.remove("btn-loading");
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
  // File inputs can't be pre-filled for security reasons.
  // Show the current image as a preview; leave the file input
  // untouched — only choose a new photo if you want to replace it.
  const preview = document.getElementById("announcement-image-preview");
  if (d.image) {
    preview.src = d.image;
    preview.style.display = "block";
  } else {
    preview.style.display = "none";
  }
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
          <button class="btn-icon" onclick="viewRsvps('${doc.id}', '${sanitize(d.title).replace(/'/g, "\\'")}')" title="View RSVPs"><i class="fa-solid fa-user-group"></i></button>
          <button class="btn-icon" onclick="deleteEvent('${doc.id}')"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>`;
    })
    .join("") || `<tr><td colspan="4" class="empty-state">No events yet.</td></tr>`;
}

/* Shows a simple overlay listing everyone who RSVP'd to an event */
async function viewRsvps(eventId, eventTitle) {
  const snap = await db.collection(COLLECTIONS.EVENTS).doc(eventId).collection("rsvps").orderBy("timestamp").get();

  const overlay = document.createElement("div");
  overlay.className = "confirm-overlay show";
  overlay.innerHTML = `
    <div class="confirm-box glass" style="max-width:400px; text-align:left;">
      <h3 style="margin-bottom:14px;"><i class="fa-solid fa-user-group text-gold"></i> Attendees — ${sanitize(eventTitle)}</h3>
      <div style="max-height:280px; overflow-y:auto; margin-bottom:16px;">
        ${
          snap.empty
            ? `<p class="empty-state">No RSVPs yet.</p>`
            : snap.docs.map((d, i) => `<p style="padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.05);">${i + 1}. ${sanitize(d.data().fullname)}</p>`).join("")
        }
      </div>
      <p style="color:var(--color-gray); font-size:0.85rem; margin-bottom:16px;">Total: ${snap.size} going</p>
      <div class="confirm-actions">
        <button class="btn btn-primary" id="rsvp-modal-close">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector("#rsvp-modal-close").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
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
    const imageInput = document.getElementById("gallery-image");
    const caption = document.getElementById("gallery-caption").value.trim();
    const submitBtn = form.querySelector('button[type="submit"]');

    if (!imageInput.files[0]) {
      showToast("Please choose a photo to upload.", "warning");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.classList.add("btn-loading");

    try {
      const image = await readImageAsBase64(imageInput);
      await db.collection(COLLECTIONS.GALLERY).add({
        image,
        caption,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      showToast("Photo added to gallery.", "success");
      form.reset();
      document.getElementById("gallery-image-preview").style.display = "none";
      loadAdminGalleryTable();
    } catch (err) {
      showToast(err.message || "Failed to upload photo.", "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.classList.remove("btn-loading");
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
    const imageInput = document.getElementById("achievement-image");
    const submitBtn = form.querySelector('button[type="submit"]');

    if (!title) {
      showToast("Title is required.", "warning");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.classList.add("btn-loading");

    try {
      const image = await readImageAsBase64(imageInput);
      const payload = {
        title,
        description,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      if (image) payload.image = image;

      await db.collection(COLLECTIONS.ACHIEVEMENTS).add(payload);
      showToast("Achievement added.", "success");
      form.reset();
      document.getElementById("achievement-image-preview").style.display = "none";
      loadAdminAchievementsTable();
    } catch (err) {
      showToast(err.message || "Failed to add achievement.", "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.classList.remove("btn-loading");
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
