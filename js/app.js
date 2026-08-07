/* ============================================================
   app.js — Golden Pride Hub
   Shared utilities used across every page:
   - Loading screen
   - Toast notifications
   - Mobile navigation toggle
   - Scroll-to-top button
   - Confirmation dialogs
   - Simple helper functions
   ============================================================ */

/* ---------- Loading Screen ---------- */
window.addEventListener("load", () => {
  const loader = document.getElementById("loading-screen");
  if (loader) {
    setTimeout(() => {
      loader.classList.add("hide");
      setTimeout(() => (loader.style.display = "none"), 400);
    }, 400);
  }
});

/* ---------- Toast Notifications ---------- */
/**
 * Shows a toast notification.
 * @param {string} message - text to display
 * @param {"success"|"error"|"info"|"warning"} type
 */
function showToast(message, type = "info") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }

  const icons = {
    success: "fa-circle-check",
    error: "fa-circle-xmark",
    info: "fa-circle-info",
    warning: "fa-triangle-exclamation"
  };

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i class="fa-solid ${icons[type] || icons.info}"></i>
    <span>${message}</span>
  `;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("show"));

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/* ---------- Confirmation Dialog ---------- */
/**
 * Returns a Promise<boolean> resolved true/false based on user choice.
 * @param {string} message
 */
function confirmDialog(message = "Are you sure?") {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "confirm-overlay";
    overlay.innerHTML = `
      <div class="confirm-box glass">
        <p>${message}</p>
        <div class="confirm-actions">
          <button class="btn btn-outline" id="confirm-cancel">Cancel</button>
          <button class="btn btn-primary" id="confirm-ok">Confirm</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("show"));

    const close = (result) => {
      overlay.classList.remove("show");
      setTimeout(() => overlay.remove(), 250);
      resolve(result);
    };

    overlay.querySelector("#confirm-ok").addEventListener("click", () => close(true));
    overlay.querySelector("#confirm-cancel").addEventListener("click", () => close(false));
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close(false);
    });
  });
}

/* ---------- Mobile Navigation Toggle ---------- */
document.addEventListener("DOMContentLoaded", () => {
  const navToggle = document.querySelector(".nav-toggle");
  const navMenu = document.querySelector(".nav-menu");
  if (navToggle && navMenu) {
    navToggle.addEventListener("click", () => {
      navMenu.classList.toggle("open");
      navToggle.classList.toggle("active");
    });
  }

  const sidebarToggle = document.querySelector(".sidebar-toggle");
  const sidebar = document.querySelector(".sidebar");
  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener("click", () => {
      sidebar.classList.toggle("open");
    });
  }
});

/* ---------- Scroll To Top ---------- */
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("scroll-top");
  if (!btn) return;

  window.addEventListener("scroll", () => {
    btn.classList.toggle("visible", window.scrollY > 400);
  });

  btn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});

/* ---------- Helpers ---------- */

// Escape user-generated text before inserting into innerHTML (basic XSS guard)
function sanitize(str = "") {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Format a Firestore Timestamp or JS Date into a readable string
function formatDate(timestamp) {
  if (!timestamp) return "";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

// Debounce helper for search inputs
function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// Get initials from a full name, used for avatar placeholders
function getInitials(name = "") {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}
