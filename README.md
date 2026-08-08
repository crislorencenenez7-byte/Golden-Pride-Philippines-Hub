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
      allow create, delete: if isAdmin();
      // Admins can edit everything; any signed-in member can update ONLY
      // the likedBy array (for the heart/like button) without admin rights.
      allow update: if isAdmin() ||
        (isSignedIn() && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['likedBy']));

      match /comments/{commentId} {
        allow read: if isSignedIn();
        allow create: if isSignedIn() && request.resource.data.uid == request.auth.uid;
        allow delete: if isSignedIn() && (resource.data.uid == request.auth.uid || isAdmin());
      }
    }

    match /events/{docId} {
      allow read: if isSignedIn();
      allow write: if isAdmin();

      match /rsvps/{uid} {
        allow read: if isSignedIn();
        allow create, update: if isSignedIn() && request.auth.uid == uid;
        allow delete: if isSignedIn() && (request.auth.uid == uid || isAdmin());
      }
    }

    match /gallery/{docId} {
      allow read: if isSignedIn();
      allow write: if isAdmin();
    }

    match /achievements/{docId} {
      allow read: if isSignedIn();
      allow write: if isAdmin();
    }

    match /polls/{pollId} {
      allow read: if isSignedIn();
      allow create, update, delete: if isAdmin();

      match /votes/{uid} {
        allow read: if isSignedIn();
        allow create, update: if isSignedIn() && request.auth.uid == uid;
        allow delete: if isSignedIn() && (request.auth.uid == uid || isAdmin());
      }
    }

    match /chats/{chatId} {
      allow read, update: if isSignedIn() && request.auth.uid in resource.data.participants;
      allow create: if isSignedIn() && request.auth.uid in request.resource.data.participants;

      match /messages/{messageId} {
        allow read: if isSignedIn() && request.auth.uid in get(/databases/$(database)/documents/chats/$(chatId)).data.participants;
        allow create: if isSignedIn() &&
          request.auth.uid in get(/databases/$(database)/documents/chats/$(chatId)).data.participants &&
          request.resource.data.senderUid == request.auth.uid;
      }
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
- **Event RSVP/Attendance** — members can RSVP to upcoming events; admins can view the full attendee list per event from the Admin Panel
- **Online/Offline presence** — members list shows a live green/gray dot based on a Firestore heartbeat (updates roughly every 60s; a member is shown offline after ~2 minutes of inactivity)
- **In-app notifications** — a bell icon shows unread announcement count in real time, with an optional browser desktop notification if the member grants permission. This works while the browser tab is open (including in the background) but **cannot** deliver notifications when the browser is fully closed — true "push while closed" requires Firebase Cloud Messaging + a Cloud Function on the paid Blaze plan
- **Comments & reactions** — members can like (heart) announcements and post real-time comment threads under each one
- **Direct messaging** — 1-on-1 real-time chat between any two members, opened directly from a "Message" button on their card in the Members page (shows as a popup/modal, no page navigation needed). An unread-count badge appears on the "Members" sidebar link on every page whenever a member has a new message waiting.
- **Polls/surveys** — admins publish a poll with 2+ options from the Admin Panel's Polls tab; members vote (and can change their vote) from a live-updating poll card on the Dashboard, with results shown as percentage bars
- **Birthday reminders** — members set their birthday on their Profile page; on that date, an automatic "Happy Birthday" banner appears on the Dashboard for everyone to see
- Search, filter, and pagination on Announcements; search on Members
- Responsive glassmorphism UI with dark mode aesthetic, mobile navigation, and scroll-to-top
- Toast notifications and confirmation dialogs for all destructive actions
- Profile editing with picture upload; Gallery/Announcement/Achievement images also upload directly as files (stored as compressed base64 in Firestore, capped at 700KB — swap in Firebase Storage for production use at scale)
- Installable as a Progressive Web App (PWA) — "Add to Home Screen" on mobile, or package via [PWABuilder](https://www.pwabuilder.com) for an Android APK

## 📝 Notes
- All user input is sanitized before rendering to prevent basic XSS.
- Profile photos and image fields currently accept image **URLs** (Gallery/Announcements/Achievements) or small base64 uploads (Profile). For a production deployment handling many large images, integrate **Firebase Storage** instead.
- This project uses the Firebase **compat SDK** (via CDN `<script>` tags) for simplicity across many plain HTML pages — no build step required.
