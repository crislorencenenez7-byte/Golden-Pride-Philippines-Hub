/* ============================================================
   announcements.js — Golden Pride Hub
   Handles the Announcements page: search, filter, pagination,
   and rendering cards. Admin create/edit/delete lives in admin.js
   ============================================================ */

const PAGE_SIZE = 6;
let allAnnouncements = [];
let currentPage = 1;

async function loadAnnouncements() {
  const list = document.getElementById("announcements-list");
  if (!list) return;

  list.innerHTML = `<p class="empty-state">Loading announcements…</p>`;

  try {
    const snap = await db.collection(COLLECTIONS.ANNOUNCEMENTS).orderBy("createdAt", "desc").get();
    allAnnouncements = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderAnnouncements();
  } catch (err) {
    list.innerHTML = `<p class="empty-state">Unable to load announcements.</p>`;
  }
}

function renderAnnouncements() {
  const list = document.getElementById("announcements-list");
  const searchTerm = (document.getElementById("announcement-search")?.value || "").toLowerCase();
  const authorFilter = document.getElementById("announcement-filter")?.value || "";

  let filtered = allAnnouncements.filter((a) => a.title.toLowerCase().includes(searchTerm));
  if (authorFilter) filtered = filtered.filter((a) => a.author === authorFilter);

  if (filtered.length === 0) {
    list.innerHTML = `<p class="empty-state">No announcements found.</p>`;
    renderPagination(0);
    return;
  }

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  list.innerHTML = pageItems
    .map((a) => {
      const likedBy = a.likedBy || [];
      const myUid = auth.currentUser?.uid;
      const iLiked = myUid && likedBy.includes(myUid);
      return `
    <article class="announcement-card glass fade-in" data-id="${a.id}">
      ${a.image ? `<img src="${sanitize(a.image)}" alt="${sanitize(a.title)}" loading="lazy">` : ""}
      <div class="announcement-card-body">
        <h3>${sanitize(a.title)}</h3>
        <p>${sanitize(a.content)}</p>
        <div class="announcement-meta">
          <span><i class="fa-solid fa-user"></i> ${sanitize(a.author)}</span>
          <span><i class="fa-solid fa-calendar"></i> ${formatDate(a.createdAt)}</span>
        </div>
        <div class="social-row">
          <button class="social-btn like-btn ${iLiked ? "liked" : ""}" data-id="${a.id}">
            <i class="fa-${iLiked ? "solid" : "regular"} fa-heart"></i> <span class="like-count">${likedBy.length}</span>
          </button>
          <button class="social-btn comment-toggle-btn" data-id="${a.id}">
            <i class="fa-regular fa-comment"></i> <span class="comment-count-label">Comments</span>
          </button>
        </div>
        <div class="comment-thread" id="comment-thread-${a.id}" style="display:none;">
          <div class="comment-list" id="comment-list-${a.id}"><p class="empty-state small">Loading comments…</p></div>
          <form class="comment-form" data-id="${a.id}">
            <input type="text" placeholder="Write a comment…" maxlength="300" required>
            <button type="submit"><i class="fa-solid fa-paper-plane"></i></button>
          </form>
        </div>
        <div class="admin-only announcement-actions" style="display:none;">
          <button class="btn-icon edit-announcement" data-id="${a.id}"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-icon delete-announcement" data-id="${a.id}"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    </article>`;
    })
    .join("");

  // Reveal admin action buttons if current user is admin
  if (currentUserData?.role === ROLES.ADMIN) {
    document.querySelectorAll(".announcement-actions").forEach((el) => (el.style.display = "flex"));
  }

  bindSocialActions();
  renderPagination(filtered.length);
}

/* ---------- Likes & Comments ---------- */
const openCommentThreads = {}; // id -> unsubscribe function, so we don't stack listeners

function bindSocialActions() {
  document.querySelectorAll(".like-btn").forEach((btn) => {
    btn.addEventListener("click", () => toggleLike(btn.dataset.id));
  });

  document.querySelectorAll(".comment-toggle-btn").forEach((btn) => {
    btn.addEventListener("click", () => toggleCommentThread(btn.dataset.id));
  });

  document.querySelectorAll(".comment-form").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = form.querySelector("input");
      const text = input.value.trim();
      if (!text) return;
      postComment(form.dataset.id, text);
      input.value = "";
    });
  });
}

async function toggleLike(announcementId) {
  const user = auth.currentUser;
  if (!user) return;

  const ref = db.collection(COLLECTIONS.ANNOUNCEMENTS).doc(announcementId);
  const announcement = allAnnouncements.find((a) => a.id === announcementId);
  const alreadyLiked = (announcement?.likedBy || []).includes(user.uid);

  try {
    await ref.update({
      likedBy: alreadyLiked
        ? firebase.firestore.FieldValue.arrayRemove(user.uid)
        : firebase.firestore.FieldValue.arrayUnion(user.uid)
    });
    // Reflect locally without a full reload
    if (announcement) {
      announcement.likedBy = alreadyLiked
        ? (announcement.likedBy || []).filter((id) => id !== user.uid)
        : [...(announcement.likedBy || []), user.uid];
    }
    renderAnnouncements();
  } catch (err) {
    showToast("Failed to update like.", "error");
  }
}

function toggleCommentThread(announcementId) {
  const thread = document.getElementById(`comment-thread-${announcementId}`);
  if (!thread) return;

  const isOpen = thread.style.display !== "none";
  if (isOpen) {
    thread.style.display = "none";
    if (openCommentThreads[announcementId]) {
      openCommentThreads[announcementId]();
      delete openCommentThreads[announcementId];
    }
    return;
  }

  thread.style.display = "block";
  const listEl = document.getElementById(`comment-list-${announcementId}`);

  const unsubscribe = db
    .collection(COLLECTIONS.ANNOUNCEMENTS)
    .doc(announcementId)
    .collection("comments")
    .orderBy("createdAt", "asc")
    .onSnapshot(
      (snap) => {
        if (snap.empty) {
          listEl.innerHTML = `<p class="empty-state small">No comments yet. Be the first!</p>`;
          return;
        }
        listEl.innerHTML = snap.docs
          .map((d) => {
            const c = d.data();
            return `
          <div class="comment-item">
            <div class="avatar-circle small">${getInitials(c.fullname || "")}</div>
            <div class="comment-body">
              <strong>${sanitize(c.fullname || "Member")}</strong>
              <p>${sanitize(c.text)}</p>
            </div>
          </div>`;
          })
          .join("");
        listEl.scrollTop = listEl.scrollHeight;
      },
      (err) => {
        console.error("Comment thread error:", err);
        listEl.innerHTML = `<p class="empty-state small">Unable to load comments. Check Firestore Rules.</p>`;
      }
    );

  openCommentThreads[announcementId] = unsubscribe;
}

async function postComment(announcementId, text) {
  const user = auth.currentUser;
  if (!user) return;

  try {
    await db.collection(COLLECTIONS.ANNOUNCEMENTS).doc(announcementId).collection("comments").add({
      uid: user.uid,
      fullname: currentUserData?.fullname || user.displayName || "Member",
      text,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    showToast("Failed to post comment.", "error");
  }
}

function renderPagination(totalItems) {
  const pager = document.getElementById("announcements-pagination");
  if (!pager) return;

  const totalPages = Math.ceil(totalItems / PAGE_SIZE);
  if (totalPages <= 1) {
    pager.innerHTML = "";
    return;
  }

  let html = "";
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="page-btn ${i === currentPage ? "active" : ""}" data-page="${i}">${i}</button>`;
  }
  pager.innerHTML = html;

  pager.querySelectorAll(".page-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentPage = Number(btn.dataset.page);
      renderAnnouncements();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("announcements-list")) return;

  loadAnnouncements();

  document.getElementById("announcement-search")?.addEventListener(
    "input",
    debounce(() => {
      currentPage = 1;
      renderAnnouncements();
    }, 300)
  );

  document.getElementById("announcement-filter")?.addEventListener("change", () => {
    currentPage = 1;
    renderAnnouncements();
  });
});
