/* ============================================================
   firebase-config.js
   Golden Pride Hub — Firebase Initialization
   ------------------------------------------------------------
   IMPORTANT: Replace the placeholder values below with your
   actual Firebase project credentials before deploying.
   Get these from: Firebase Console > Project Settings > General
   ============================================================ */

const firebaseConfig = {
  apiKey: "AIzaSyDCMahXYd7RWsYmdYWZ3cuzEg5trQNxJds",
  authDomain: "goldenpridehub-4156b.firebaseapp.com",
  projectId: "goldenpridehub-4156b",
  storageBucket: "goldenpridehub-4156b.firebasestorage.app",
  messagingSenderId: "1035054021598",
  appId: "1:1035054021598:web:f853beba9dc1288f75bb4f",
  measurementId: "G-854N17PK3L"
};

// Initialize Firebase (using compat SDK for simple multi-page usage)
firebase.initializeApp(firebaseConfig);

// Shorthand references used across the app
const auth = firebase.auth();
const db = firebase.firestore();

// Collection name constants — keeps queries consistent across files
const COLLECTIONS = {
  USERS: "users",
  ANNOUNCEMENTS: "announcements",
  EVENTS: "events",
  GALLERY: "gallery",
  ACHIEVEMENTS: "achievements"
};

// Role constants
const ROLES = {
  ADMIN: "admin",
  MEMBER: "member"
};
