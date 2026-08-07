/* ============================================================
   dashboard.js — Golden Pride Hub
   Loads current user info into the sidebar/header and populates
   dashboard summary cards, plus logic shared by member-facing
   pages: profile, members, events, gallery, achievements.
   ============================================================ */

let currentUserData = null;

auth.onAuthStateChanged(async (user) => {
  if (!user) return;

  const snap = await db.collection(COLLECTIONS.USERS).doc(user.uid).get();
  currentUserData = snap.exists ? snap.data() : { fullname: user.displayName || "Member", role: ROLES.MEMBER };

  document.querySelectorAll(".user-fullname").forEach((el) => (el.textContent = currentUserData.fullname));
  document.querySelectorAll(".user-role-badge").forEach((el) => {
    el.textContent = currentUserData.role;
    el.classList.add(currentUserData.role === ROLES.ADMIN ? "badge-admin" : "badge-member");
  });
  document.querySelectorAll(".user-avatar-initials").forEach((el) => (el.textContent = getInitials(currentUserData.fullname)));
  document.querySelectorAll(".user-email").forEach((el) => (el.textContent = currentUserData.email));

  // Show admin-only nav links if applicable
  if (currentUserData.role === ROLES.ADMIN) {
    document.querySelectorAll(".admin-only").forEach((el) => (el.style.display = ""));
  }

  loadDashboardStats();
});

/* ---------- Dashboard Summary Cards ---------- */
async function loadDashboardStats() {
  const statsEls = {
    announcements: document.getElementById("stat-announcements"),
    members: document.getElementById("stat-members"),
    events: document.getElementById("stat-events"),
    gallery: document.getElementById("stat-gallery"),
    achievements: document.getElementById("stat-achievements")
  };

  // Only run counts for elements that exist on this page
  if (statsEls.announcements) {
    const c = await db.collection(COLLECTIONS.ANNOUNCEMENTS).get();
    statsEls.announcements.textContent = c.size;
  }
  if (statsEls.members) {
    const c = await db.collection(COLLECTIONS.USERS).get();
    statsEls.members.textContent = c.size;
  }
  if (statsEls.events) {
    const c = await db.collection(COLLECTIONS.EVENTS).get();
    statsEls.events.textContent = c.size;
  }
  if (statsEls.gallery) {
    const c = await db.collection(COLLECTIONS.GALLERY).get();
    statsEls.gallery.textContent = c.size;
  }
  if (statsEls.achievements) {
    const c = await db.collection(COLLECTIONS.ACHIEVEMENTS).get();
    statsEls.achievements.textContent = c.size;
  }

  loadRecentAnnouncementPreview();
}

/* ---------- Latest Announcement Preview (dashboard + landing page) ---------- */
async function loadRecentAnnouncementPreview() {
  const container = document.getElementById("latest-announcement");
  if (!container) return;

  try {
    const snap = await db
      .collection(COLLECTIONS.ANNOUNCEMENTS)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    if (snap.empty) {
      container.innerHTML = `<p class="empty-state">No announcements yet.</p>`;
      return;
    }

    const doc = snap.docs[0].data();
    container.innerHTML = `
      <div class="announcement-card glass fade-in">
        ${doc.image ? `<img src="${sanitize(doc.image)}" alt="Announcement image" loading="lazy">` : ""}
        <div class="announcement-card-body">
          <h3>${sanitize(doc.title)}</h3>
          <p>${sanitize(doc.content).substring(0, 140)}…</p>
          <span class="announcement-meta">${sanitize(doc.author)} • ${formatDate(doc.createdAt)}</span>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<p class="empty-state">Unable to load announcements.</p>`;
  }
}

/* ---------- Members Page ---------- */
async function loadMembers(searchTerm = "") {
  const grid = document.getElementById("members-grid");
  if (!grid) return;

  grid.innerHTML = `<p class="empty-state">Loading members…</p>`;
  const snap = await db.collection(COLLECTIONS.USERS).orderBy("fullname").get();

  const members = snap.docs
    .map((d) => d.data())
    .filter((m) => m.fullname.toLowerCase().includes(searchTerm.toLowerCase()));

  if (members.length === 0) {
    grid.innerHTML = `<p class="empty-state">No members found.</p>`;
    return;
  }

  grid.innerHTML = members
    .map(
      (m) => `
      <div class="member-card glass fade-in">
        <div class="avatar-circle">${getInitials(m.fullname)}</div>
        <h4>${sanitize(m.fullname)}</h4>
        <span class="role-badge ${m.role === ROLES.ADMIN ? "badge-admin" : "badge-member"}">${sanitize(m.role)}</span>
        <p class="member-email">${sanitize(m.email)}</p>
      </div>`
    )
    .join("");
}

document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("member-search");
  if (searchInput) {
    searchInput.addEventListener("input", debounce((e) => loadMembers(e.target.value), 300));
  }
  if (document.getElementById("members-grid")) loadMembers();
});

/* ---------- Events Page ---------- */
async function loadEvents() {
  const upcomingEl = document.getElementById("upcoming-events");
  const pastEl = document.getElementById("past-events");
  if (!upcomingEl && !pastEl) return;

  const snap = await db.collection(COLLECTIONS.EVENTS).orderBy("date", "asc").get();
  const now = new Date();
  const upcoming = [];
  const past = [];

  snap.forEach((doc) => {
    const data = doc.data();
    const eventDate = data.date?.toDate ? data.date.toDate() : new Date(data.date);
    (eventDate >= now ? upcoming : past).push(data);
  });

  const cardHtml = (e) => `
    <div class="event-card glass fade-in">
      <div class="event-date-badge">
        <span class="day">${new Date(e.date?.toDate ? e.date.toDate() : e.date).getDate()}</span>
        <span class="month">${new Date(e.date?.toDate ? e.date.toDate() : e.date).toLocaleString("en-PH", { month: "short" })}</span>
      </div>
      <div class="event-info">
        <h4>${sanitize(e.title)}</h4>
        <p>${sanitize(e.description)}</p>
        <span class="event-location"><i class="fa-solid fa-location-dot"></i> ${sanitize(e.location)}</span>
      </div>
    </div>`;

  if (upcomingEl) upcomingEl.innerHTML = upcoming.length ? upcoming.map(cardHtml).join("") : `<p class="empty-state">No upcoming events.</p>`;
  if (pastEl) pastEl.innerHTML = past.length ? past.map(cardHtml).join("") : `<p class="empty-state">No past events yet.</p>`;
}
document.addEventListener("DOMContentLoaded", loadEvents);

/* ---------- Gallery Page ---------- */
async function loadGallery() {
  const grid = document.getElementById("gallery-grid");
  if (!grid) return;

  const snap = await db.collection(COLLECTIONS.GALLERY).orderBy("createdAt", "desc").get();
  if (snap.empty) {
    grid.innerHTML = `<p class="empty-state">No photos uploaded yet.</p>`;
    return;
  }

  grid.innerHTML = snap.docs
    .map((doc) => {
      const d = doc.data();
      return `
      <figure class="gallery-item fade-in" data-img="${sanitize(d.image)}" data-caption="${sanitize(d.caption)}">
        <img src="${sanitize(d.image)}" alt="${sanitize(d.caption)}" loading="lazy">
        <figcaption>${sanitize(d.caption)}</figcaption>
      </figure>`;
    })
    .join("");

  document.querySelectorAll(".gallery-item").forEach((item) => {
    item.addEventListener("click", () => openLightbox(item.dataset.img, item.dataset.caption));
  });
}
document.addEventListener("DOMContentLoaded", loadGallery);

function openLightbox(imgSrc, caption) {
  const lightbox = document.createElement("div");
  lightbox.className = "lightbox show";
  lightbox.innerHTML = `
    <span class="lightbox-close"><i class="fa-solid fa-xmark"></i></span>
    <img src="${imgSrc}" alt="${caption}">
    <p class="lightbox-caption">${caption}</p>
  `;
  document.body.appendChild(lightbox);
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox || e.target.closest(".lightbox-close")) lightbox.remove();
  });
}

/* ---------- Achievements Page ---------- */
async function loadAchievements() {
  const grid = document.getElementById("achievements-grid");
  if (!grid) return;

  const snap = await db.collection(COLLECTIONS.ACHIEVEMENTS).orderBy("createdAt", "desc").get();
  if (snap.empty) {
    grid.innerHTML = `<p class="empty-state">No achievements posted yet.</p>`;
    return;
  }

  grid.innerHTML = snap.docs
    .map((doc) => {
      const d = doc.data();
      return `
      <div class="achievement-card glass fade-in">
        ${d.image ? `<img src="${sanitize(d.image)}" alt="${sanitize(d.title)}" loading="lazy">` : `<i class="fa-solid fa-trophy achievement-icon"></i>`}
        <h4>${sanitize(d.title)}</h4>
        <p>${sanitize(d.description)}</p>
      </div>`;
    })
    .join("");
}
document.addEventListener("DOMContentLoaded", loadAchievements);

/* ---------- Profile Page ---------- */
const profileForm = document.getElementById("profile-form");
if (profileForm) {
  auth.onAuthStateChanged((user) => {
    if (!user) return;
    db.collection(COLLECTIONS.USERS)
      .doc(user.uid)
      .get()
      .then((snap) => {
        const data = snap.data();
        document.getElementById("profile-fullname").value = data.fullname || "";
        document.getElementById("profile-email").value = data.email || "";
        document.getElementById("profile-photo").src = data.photoURL || "";
      });
  });

  profileForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const fullname = document.getElementById("profile-fullname").value.trim();
    const submitBtn = profileForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.classList.add("btn-loading");

    try {
      await db.collection(COLLECTIONS.USERS).doc(user.uid).update({ fullname });
      await user.updateProfile({ displayName: fullname });
      showToast("Profile updated successfully!", "success");
    } catch (err) {
      showToast("Failed to update profile.", "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.classList.remove("btn-loading");
    }
  });
}

/* Profile picture upload — stores as base64 data URL in Firestore
   (Note: for production at scale, use Firebase Storage instead) */
const photoInput = document.getElementById("profile-photo-input");
if (photoInput) {
  photoInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      showToast("Image too large. Max size is 500KB.", "warning");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const user = auth.currentUser;
      await db.collection(COLLECTIONS.USERS).doc(user.uid).update({ photoURL: reader.result });
      document.getElementById("profile-photo").src = reader.result;
      showToast("Profile picture updated!", "success");
    };
    reader.readAsDataURL(file);
  });
}
