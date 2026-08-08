/* ============================================================
   messages.js — Golden Pride Hub
   1-on-1 direct messaging between members, done entirely as an
   inline chat modal opened from a member's card on Members page.
   There is no separate Messages page/tab — chatting always
   starts from Members.

   Firestore structure:
     chats/{chatId}                — doc with participants[], names, lastMessage, lastTimestamp, unread_<uid>
     chats/{chatId}/messages/{id}  — {senderUid, text, createdAt}
   chatId = the two participant uids sorted alphabetically and
   joined with "_", so both users always resolve the same doc.
   ============================================================ */

function buildChatId(uidA, uidB) {
  return [uidA, uidB].sort().join("_");
}

function updateNavBadge(count) {
  const badge = document.getElementById("nav-msg-badge");
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = "inline-flex";
  } else {
    badge.style.display = "none";
  }
}

/* Live unread badge on the "Members" sidebar link, on every page */
auth.onAuthStateChanged((user) => {
  if (!user) return;
  if (!COLLECTIONS.CHATS) return; // safety guard in case firebase-config.js is out of date

  try {
    db.collection(COLLECTIONS.CHATS)
      .where("participants", "array-contains", user.uid)
      .onSnapshot(
        (snap) => {
          let total = 0;
          snap.forEach((d) => (total += d.data()[`unread_${user.uid}`] || 0));
          updateNavBadge(total);
        },
        (err) => console.error("Unread badge listener error:", err)
      );
  } catch (err) {
    console.error("Unread badge setup error:", err);
  }
});

/* ============================================================
   Inline Chat Modal — opened from a member's "Message" button
   on members.html. Only active on pages that include the
   #member-chat-overlay markup (currently just members.html).
   ============================================================ */
let memberModalChatId = null;
let memberModalUnsub = null;

function openMemberChatModal(otherUid, otherName) {
  const overlay = document.getElementById("member-chat-overlay");
  if (!overlay) return; // this page doesn't have the modal (safe no-op)

  const myUid = auth.currentUser?.uid;
  if (!myUid) return;

  memberModalChatId = buildChatId(myUid, otherUid);

  overlay.classList.add("open");
  document.getElementById("member-chat-avatar").textContent = getInitials(otherName);
  document.getElementById("member-chat-name").textContent = otherName;

  const statusEl = document.getElementById("member-chat-status");
  statusEl.textContent = "…";
  db.collection(COLLECTIONS.USERS)
    .doc(otherUid)
    .get()
    .then((snap) => {
      if (snap.exists) {
        const online = typeof isUserOnline === "function" ? isUserOnline(snap.data()) : false;
        statusEl.textContent = online ? "Online now" : "Offline";
        statusEl.className = `chat-partner-status ${online ? "text-online" : "text-offline"}`;
      }
    });

  // Reset my unread count for this chat
  db.collection(COLLECTIONS.CHATS)
    .doc(memberModalChatId)
    .set({ [`unread_${myUid}`]: 0 }, { merge: true })
    .catch(() => {});

  if (memberModalUnsub) memberModalUnsub();

  const messagesEl = document.getElementById("member-chat-messages");
  messagesEl.innerHTML = `<p class="empty-state small">Loading messages…</p>`;

  memberModalUnsub = db
    .collection(COLLECTIONS.CHATS)
    .doc(memberModalChatId)
    .collection("messages")
    .orderBy("createdAt", "asc")
    .onSnapshot(
      (snap) => {
        if (snap.empty) {
          messagesEl.innerHTML = `<p class="empty-state small">No messages yet. Say hello 👋</p>`;
          return;
        }
        messagesEl.innerHTML = snap.docs
          .map((d) => {
            const m = d.data();
            const mine = m.senderUid === myUid;
            return `<div class="chat-bubble-row ${mine ? "mine" : ""}"><div class="chat-bubble">${sanitize(m.text)}</div></div>`;
          })
          .join("");
        messagesEl.scrollTop = messagesEl.scrollHeight;
      },
      (err) => {
        console.error("Member chat modal error:", err);
        messagesEl.innerHTML = `<p class="empty-state small">Unable to load messages. Check Firestore Rules — see README.</p>`;
      }
    );

  overlay.dataset.otherUid = otherUid;
  overlay.dataset.otherName = otherName;
}

function closeMemberChatModal() {
  const overlay = document.getElementById("member-chat-overlay");
  if (!overlay) return;
  overlay.classList.remove("open");
  if (memberModalUnsub) {
    memberModalUnsub();
    memberModalUnsub = null;
  }
  memberModalChatId = null;
}

async function sendMemberModalMessage(text) {
  const myUid = auth.currentUser?.uid;
  const overlay = document.getElementById("member-chat-overlay");
  if (!myUid || !overlay || !memberModalChatId) return;

  const otherUid = overlay.dataset.otherUid;
  const otherName = overlay.dataset.otherName;
  const myName = currentUserData?.fullname || auth.currentUser.displayName || "Member";
  const chatRef = db.collection(COLLECTIONS.CHATS).doc(memberModalChatId);

  try {
    await chatRef.set(
      {
        participants: [myUid, otherUid],
        participantNames: { [myUid]: myName, [otherUid]: otherName },
        lastMessage: text,
        lastTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
        [`unread_${otherUid}`]: firebase.firestore.FieldValue.increment(1),
        [`unread_${myUid}`]: 0
      },
      { merge: true }
    );
    await chatRef.collection("messages").add({
      senderUid: myUid,
      text,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    showToast("Failed to send message.", "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const overlay = document.getElementById("member-chat-overlay");
  if (!overlay) return;

  document.getElementById("member-chat-close")?.addEventListener("click", closeMemberChatModal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeMemberChatModal();
  });

  document.getElementById("member-chat-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("member-chat-input");
    const text = input.value.trim();
    if (!text) return;
    sendMemberModalMessage(text);
    input.value = "";
  });
});
