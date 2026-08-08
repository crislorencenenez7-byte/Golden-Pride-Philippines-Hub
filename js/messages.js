/* ============================================================
   messages.js — Golden Pride Hub
   1-on-1 direct messaging between members.
   Firestore structure:
     chats/{chatId}                — doc with participants[], names, lastMessage, lastTimestamp, unread_<uid>
     chats/{chatId}/messages/{id}  — {senderUid, text, createdAt}
   chatId = the two participant uids sorted alphabetically and
   joined with "_", so both users always resolve the same doc.
   ============================================================ */

let activeChatId = null;
let activeChatUnsub = null;
let chatListUnsub = null;
let allMembersCache = [];

function buildChatId(uidA, uidB) {
  return [uidA, uidB].sort().join("_");
}

document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("chat-app")) return;

  auth.onAuthStateChanged((user) => {
    if (!user) return;
    initChatList(user.uid);
    initMemberSearch(user.uid);

    // Deep-link support: messages.html?to=<uid> opens/creates that chat directly
    const params = new URLSearchParams(window.location.search);
    const toUid = params.get("to");
    if (toUid && toUid !== user.uid) {
      openChatWith(toUid);
    }
  });

  document.getElementById("chat-back-btn")?.addEventListener("click", () => {
    document.getElementById("chat-app").classList.remove("chat-mobile-open");
  });

  document.getElementById("chat-input-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("chat-input");
    const text = input.value.trim();
    if (!text || !activeChatId) return;
    sendMessage(text);
    input.value = "";
  });
});

/* ---------- Conversation List ---------- */
function initChatList(myUid) {
  const listEl = document.getElementById("chat-list");

  if (chatListUnsub) chatListUnsub();
  chatListUnsub = db
    .collection(COLLECTIONS.CHATS)
    .where("participants", "array-contains", myUid)
    .onSnapshot((snap) => {
      if (snap.empty) {
        listEl.innerHTML = `<p class="empty-state small">No conversations yet. Search a member above to say hi 👋</p>`;
        updateNavBadge(0);
        return;
      }

      const chats = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.lastTimestamp?.toMillis?.() || 0) - (a.lastTimestamp?.toMillis?.() || 0));

      let totalUnread = 0;

      listEl.innerHTML = chats
        .map((c) => {
          const otherUid = c.participants.find((id) => id !== myUid);
          const otherName = c.participantNames?.[otherUid] || "Member";
          const unread = c[`unread_${myUid}`] || 0;
          totalUnread += unread;
          return `
          <div class="chat-list-item ${c.id === activeChatId ? "active" : ""}" data-chat-id="${c.id}" data-other-uid="${otherUid}" data-other-name="${sanitize(otherName)}">
            <div class="avatar-circle">${getInitials(otherName)}</div>
            <div class="chat-list-item-info">
              <strong>${sanitize(otherName)}</strong>
              <span>${sanitize((c.lastMessage || "").substring(0, 40))}</span>
            </div>
            ${unread > 0 ? `<span class="chat-unread-badge">${unread}</span>` : ""}
          </div>`;
        })
        .join("");

      updateNavBadge(totalUnread);

      listEl.querySelectorAll(".chat-list-item").forEach((item) => {
        item.addEventListener("click", () => {
          openChat(item.dataset.chatId, item.dataset.otherUid, item.dataset.otherName);
        });
      });
    });
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

/* ---------- Member Search (to start a new chat) ---------- */
async function initMemberSearch(myUid) {
  const input = document.getElementById("chat-member-search");
  const resultsEl = document.getElementById("chat-member-results");
  if (!input) return;

  if (allMembersCache.length === 0) {
    const snap = await db.collection(COLLECTIONS.USERS).orderBy("fullname").get();
    allMembersCache = snap.docs.map((d) => d.data()).filter((m) => m.uid !== myUid);
  }

  input.addEventListener(
    "input",
    debounce(() => {
      const term = input.value.trim().toLowerCase();
      if (!term) {
        resultsEl.innerHTML = "";
        resultsEl.style.display = "none";
        return;
      }
      const matches = allMembersCache.filter((m) => m.fullname.toLowerCase().includes(term)).slice(0, 6);
      resultsEl.style.display = matches.length ? "block" : "none";
      resultsEl.innerHTML = matches
        .map(
          (m) => `
        <div class="chat-list-item" data-uid="${m.uid}" data-name="${sanitize(m.fullname)}">
          <div class="avatar-circle">${getInitials(m.fullname)}</div>
          <div class="chat-list-item-info"><strong>${sanitize(m.fullname)}</strong></div>
        </div>`
        )
        .join("");

      resultsEl.querySelectorAll(".chat-list-item").forEach((item) => {
        item.addEventListener("click", () => {
          input.value = "";
          resultsEl.innerHTML = "";
          resultsEl.style.display = "none";
          openChatWith(item.dataset.uid, item.dataset.name);
        });
      });
    }, 250)
  );
}

/* Opens (or creates on first message) a chat with a given uid, looking up their name if not provided */
async function openChatWith(otherUid, otherName) {
  const myUid = auth.currentUser?.uid;
  if (!myUid) return;

  if (!otherName) {
    const doc = allMembersCache.find((m) => m.uid === otherUid);
    if (doc) {
      otherName = doc.fullname;
    } else {
      const snap = await db.collection(COLLECTIONS.USERS).doc(otherUid).get();
      otherName = snap.exists ? snap.data().fullname : "Member";
    }
  }

  const chatId = buildChatId(myUid, otherUid);
  openChat(chatId, otherUid, otherName);
}

/* ---------- Active Conversation ---------- */
function openChat(chatId, otherUid, otherName) {
  activeChatId = chatId;

  document.getElementById("chat-empty-state").style.display = "none";
  document.getElementById("chat-active").style.display = "flex";
  document.getElementById("chat-app").classList.add("chat-mobile-open");

  document.getElementById("chat-partner-avatar").textContent = getInitials(otherName);
  document.getElementById("chat-partner-name").textContent = otherName;

  document.querySelectorAll(".chat-list-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.chatId === chatId);
  });

  // Reset my unread count for this chat
  db.collection(COLLECTIONS.CHATS)
    .doc(chatId)
    .set({ [`unread_${auth.currentUser.uid}`]: 0 }, { merge: true })
    .catch(() => {});

  if (activeChatUnsub) activeChatUnsub();

  const messagesEl = document.getElementById("chat-messages");
  messagesEl.innerHTML = `<p class="empty-state small">Loading messages…</p>`;

  activeChatUnsub = db
    .collection(COLLECTIONS.CHATS)
    .doc(chatId)
    .collection("messages")
    .orderBy("createdAt", "asc")
    .onSnapshot((snap) => {
      if (snap.empty) {
        messagesEl.innerHTML = `<p class="empty-state small">No messages yet. Say hello 👋</p>`;
        return;
      }
      const myUid = auth.currentUser.uid;
      messagesEl.innerHTML = snap.docs
        .map((d) => {
          const m = d.data();
          const mine = m.senderUid === myUid;
          return `<div class="chat-bubble-row ${mine ? "mine" : ""}"><div class="chat-bubble">${sanitize(m.text)}</div></div>`;
        })
        .join("");
      messagesEl.scrollTop = messagesEl.scrollHeight;
    });

  // Update the status line with live online/offline info for the other member
  const statusEl = document.getElementById("chat-partner-status");
  db.collection(COLLECTIONS.USERS)
    .doc(otherUid)
    .get()
    .then((snap) => {
      if (snap.exists && statusEl) {
        const online = typeof isUserOnline === "function" ? isUserOnline(snap.data()) : false;
        statusEl.textContent = online ? "Online now" : "Offline";
        statusEl.className = `chat-partner-status ${online ? "text-online" : "text-offline"}`;
      }
    });
}

async function sendMessage(text) {
  const myUid = auth.currentUser.uid;
  const otherUid = activeChatId.split("_").find((id) => id !== myUid);
  const myName = currentUserData?.fullname || auth.currentUser.displayName || "Member";
  const partnerName = document.getElementById("chat-partner-name").textContent;

  const chatRef = db.collection(COLLECTIONS.CHATS).doc(activeChatId);

  try {
    await chatRef.set(
      {
        participants: [myUid, otherUid],
        participantNames: { [myUid]: myName, [otherUid]: partnerName },
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

/* Live unread badge on every page's sidebar (not just messages.html) */
auth.onAuthStateChanged((user) => {
  if (!user || document.getElementById("chat-app")) return; // messages.html handles its own badge via initChatList
  db.collection(COLLECTIONS.CHATS)
    .where("participants", "array-contains", user.uid)
    .onSnapshot((snap) => {
      let total = 0;
      snap.forEach((d) => (total += d.data()[`unread_${user.uid}`] || 0));
      updateNavBadge(total);
    });
});
