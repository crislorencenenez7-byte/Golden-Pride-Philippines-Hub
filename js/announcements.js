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
    .map(
      (a) => `
    <article class="announcement-card glass fade-in" data-id="${a.id}">
      ${a.image ? `<img src="${sanitize(a.image)}" alt="${sanitize(a.title)}" loading="lazy">` : ""}
      <div class="announcement-card-body">
        <h3>${sanitize(a.title)}</h3>
        <p>${sanitize(a.content)}</p>
        <div class="announcement-meta">
          <span><i class="fa-solid fa-user"></i> ${sanitize(a.author)}</span>
          <span><i class="fa-solid fa-calendar"></i> ${formatDate(a.createdAt)}</span>
        </div>
        <div class="admin-only announcement-actions" style="display:none;">
          <button class="btn-icon edit-announcement" data-id="${a.id}"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-icon delete-announcement" data-id="${a.id}"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    </article>`
    )
    .join("");

  // Reveal admin action buttons if current user is admin
  if (currentUserData?.role === ROLES.ADMIN) {
    document.querySelectorAll(".announcement-actions").forEach((el) => (el.style.display = "flex"));
  }

  renderPagination(filtered.length);
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
