# Golden Pride Hub

Official community web app for **Golden Pride Philippines** — announcements, events, gallery, achievements, and member management. Built with HTML5, CSS3, Vanilla JavaScript (ES6), Firebase Authentication, and Cloud Firestore.

## 🎨 Design
- **Colors:** Black `#0D0D0D`, Gold `#FFD700`, White `#FFFFFF`
- **Fonts:** Poppins (headings), Inter (body)
- **Style:** Glassmorphism, smooth fade/slide/hover animations, ripple buttons, toast notifications
- **Icons:** Font Awesome 6

## 📁 Project Structure
```
golden-pride-hub/
├── index.html              Landing page
├── login.html               Login
├── register.html             Register
├── forgot-password.html      Password reset
├── dashboard.html            Member dashboard
├── announcements.html        Announcements (search/filter/pagination)
├── members.html              Member directory
├── events.html                Upcoming & past events
├── gallery.html                Photo gallery with lightbox
├── achievements.html           Achievements showcase
├── profile.html                 Edit profile & photo
├── admin.html                    Admin panel (protected)
├── css/                            style.css, auth.css, dashboard.css, admin.css, responsive.css
├── js/                              firebase-config.js, app.js, auth.js, dashboard.js, admin.js, announcements.js
└── assets/                         images, icons, logo.png
```

## 🔧 Setup

### 1. Create a Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com) → **Add Project**.
2. Enable **Authentication → Email/Password** sign-in method.
3. Enable **Cloud Firestore** (start in production mode).

### 2. Add Your Firebase Config
Open `js/firebase-config.js` and replace the placeholder values with your real project credentials (found in **Project Settings → General → Your apps → SDK setup and configuration**):

```js
const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

⚠️ **Never commit real API keys to a public repository if your Firestore rules aren't locked down.** Firebase web API keys are not secret by design, but your Firestore Security Rules (below) are what actually protect your data.

### 3. Firestore Security Rules
Paste this into **Firestore → Rules** in the Firebase Console:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    function isAdmin() {
      return isSignedIn() &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    match /users/{userId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn() && request.auth.uid == userId;
      allow update: if isSignedIn() && (request.auth.uid == userId || isAdmin());
      allow delete: if isAdmin();
    }

    match /announcements/{docId} {
      allow read: if isSignedIn();
      allow write: if isAdmin();
    }

    match /events/{docId} {
      allow read: if isSignedIn();
      allow write: if isAdmin();
    }

    match /gallery/{docId} {
      allow read: if isSignedIn();
      allow write: if isAdmin();
    }

    match /achievements/{docId} {
      allow read: if isSignedIn();
      allow write: if isAdmin();
    }
  }
}
```

### 4. Create Your First Admin
New accounts register with role `member` by default. To make yourself an admin:
1. Register a normal account through `register.html`.
2. In **Firestore Console → users → [your uid]**, manually change `role` from `member` to `admin`.
3. Log out and back in — the Admin Panel link will now appear in your sidebar.

### 5. Deploy on GitHub Pages
1. Push this folder to a GitHub repository.
2. Go to **Settings → Pages → Deploy from branch** → select `main` / root.
3. Your site will be live at `https://<username>.github.io/<repo-name>/`.
4. In Firebase Console → **Authentication → Settings → Authorized domains**, add your GitHub Pages domain.

## ✅ Features
- Email/password auth with email verification, Remember Me, auto-login, and route protection
- Role-based access (Admin / Member) enforced both in the UI and Firestore rules
- Full CRUD for Announcements, Events, Gallery, and Achievements (admin only)
- Search, filter, and pagination on Announcements; search on Members
- Responsive glassmorphism UI with dark mode aesthetic, mobile navigation, and scroll-to-top
- Toast notifications and confirmation dialogs for all destructive actions
- Profile editing with picture upload (stored as compressed base64 in Firestore — swap in Firebase Storage for production use at scale)

## 📝 Notes
- All user input is sanitized before rendering to prevent basic XSS.
- Profile photos and image fields currently accept image **URLs** (Gallery/Announcements/Achievements) or small base64 uploads (Profile). For a production deployment handling many large images, integrate **Firebase Storage** instead.
- This project uses the Firebase **compat SDK** (via CDN `<script>` tags) for simplicity across many plain HTML pages — no build step required.
