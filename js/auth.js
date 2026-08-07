/* ============================================================
   auth.js — Golden Pride Hub
   Handles: Register, Login, Logout, Forgot Password,
   Email Verification, Remember Me, Auto Login, Route Protection
   ============================================================ */

/* ---------- Route Protection ----------
   pages that require login list their own body[data-auth="required"]
   pages that require admin role use body[data-auth="admin"]
   pages that should redirect logged-in users away (login/register)
   use body[data-auth="guest"]
*/
document.addEventListener("DOMContentLoaded", () => {
  const authMode = document.body.dataset.auth;
  if (!authMode) return;

  auth.onAuthStateChanged(async (user) => {
    if (authMode === "required" || authMode === "admin") {
      if (!user) {
        window.location.href = "login.html";
        return;
      }
      if (authMode === "admin") {
        const snap = await db.collection(COLLECTIONS.USERS).doc(user.uid).get();
        const role = snap.exists ? snap.data().role : ROLES.MEMBER;
        if (role !== ROLES.ADMIN) {
          showToast("Admins only. Redirecting…", "error");
          setTimeout(() => (window.location.href = "dashboard.html"), 1200);
        }
      }
    }

    // Skip the guest redirect while a registration is actively in progress —
    // otherwise the auth-state change fired by createUserWithEmailAndPassword()
    // redirects to dashboard.html before the Firestore write / email
    // verification below has a chance to finish.
    if (authMode === "guest" && user && !window.__registrationInProgress) {
      window.location.href = "dashboard.html";
    }
  });
});

/* ---------- Register ---------- */
const registerForm = document.getElementById("register-form");
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fullname = document.getElementById("fullname").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirm-password").value;
    const submitBtn = registerForm.querySelector('button[type="submit"]');

    if (fullname.length < 2) {
      showToast("Please enter your full name.", "warning");
      return;
    }
    if (password.length < 6) {
      showToast("Password must be at least 6 characters.", "warning");
      return;
    }
    if (password !== confirmPassword) {
      showToast("Passwords do not match.", "error");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.classList.add("btn-loading");
    window.__registrationInProgress = true;

    try {
      const cred = await auth.createUserWithEmailAndPassword(email, password);

      await db.collection(COLLECTIONS.USERS).doc(cred.user.uid).set({
        uid: cred.user.uid,
        fullname,
        email,
        role: ROLES.MEMBER,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      await cred.user.updateProfile({ displayName: fullname });
      await cred.user.sendEmailVerification();

      // Sign the new user out immediately — they must verify their email
      // and log in explicitly before entering the app.
      await auth.signOut();

      showToast("Account created! Please check your email to verify.", "success");
      setTimeout(() => (window.location.href = "login.html"), 1500);
    } catch (err) {
      showToast(friendlyAuthError(err), "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.classList.remove("btn-loading");
      window.__registrationInProgress = false;
    }
  });
}

/* ---------- Login ---------- */
const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const rememberMe = document.getElementById("remember-me")?.checked;
    const submitBtn = loginForm.querySelector('button[type="submit"]');

    submitBtn.disabled = true;
    submitBtn.classList.add("btn-loading");

    try {
      // Remember Me: local persists across browser restarts,
      // session clears when the browser tab/window is closed.
      await auth.setPersistence(
        rememberMe
          ? firebase.auth.Auth.Persistence.LOCAL
          : firebase.auth.Auth.Persistence.SESSION
      );

      const cred = await auth.signInWithEmailAndPassword(email, password);

      if (!cred.user.emailVerified) {
        showToast("Please verify your email before logging in.", "warning");
        await auth.signOut();
        return;
      }

      showToast("Welcome back!", "success");
      setTimeout(() => (window.location.href = "dashboard.html"), 800);
    } catch (err) {
      showToast(friendlyAuthError(err), "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.classList.remove("btn-loading");
    }
  });
}

/* ---------- Forgot Password ---------- */
const forgotForm = document.getElementById("forgot-password-form");
if (forgotForm) {
  forgotForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value.trim();
    const submitBtn = forgotForm.querySelector('button[type="submit"]');

    submitBtn.disabled = true;
    submitBtn.classList.add("btn-loading");

    try {
      await auth.sendPasswordResetEmail(email);
      showToast("Password reset link sent! Check your inbox.", "success");
      forgotForm.reset();
    } catch (err) {
      showToast(friendlyAuthError(err), "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.classList.remove("btn-loading");
    }
  });
}

/* ---------- Logout (used on any page with a logout button/link) ---------- */
document.addEventListener("click", async (e) => {
  if (e.target.closest("#logout-btn")) {
    e.preventDefault();
    const ok = await confirmDialog("Log out of Golden Pride Hub?");
    if (!ok) return;
    await auth.signOut();
    showToast("Logged out successfully.", "success");
    setTimeout(() => (window.location.href = "index.html"), 800);
  }
});

/* ---------- Friendly Firebase Error Messages ---------- */
function friendlyAuthError(err) {
  const map = {
    "auth/email-already-in-use": "That email is already registered.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/weak-password": "Password is too weak. Use at least 6 characters.",
    "auth/user-not-found": "No account found with that email.",
    "auth/wrong-password": "Incorrect password. Please try again.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/too-many-requests": "Too many attempts. Please try again later."
  };
  return map[err.code] || err.message || "Something went wrong. Please try again.";
}
