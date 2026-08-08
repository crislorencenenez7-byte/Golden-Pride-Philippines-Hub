/* ============================================================
   polls.js — Golden Pride Hub
   Renders the latest active community poll on the Dashboard and
   handles voting. Admin creation/management lives in admin.js.
   Firestore: polls/{id} { question, options:[{id,text}], active }
              polls/{id}/votes/{uid} { optionId }
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("poll-section");
  if (!container) return;

  auth.onAuthStateChanged((user) => {
    if (user) loadActivePoll(container, user.uid);
  });
});

async function loadActivePoll(container, myUid) {
  try {
    const snap = await db
      .collection(COLLECTIONS.POLLS)
      .where("active", "==", true)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    if (snap.empty) {
      container.innerHTML = "";
      return;
    }

    const pollDoc = snap.docs[0];
    const poll = { id: pollDoc.id, ...pollDoc.data() };

    const votesSnap = await db.collection(COLLECTIONS.POLLS).doc(poll.id).collection("votes").get();
    const votes = votesSnap.docs.map((d) => d.data());
    const myVote = votesSnap.docs.find((d) => d.id === myUid);
    const totalVotes = votes.length;

    renderPoll(container, poll, votes, totalVotes, myVote ? myVote.data().optionId : null);
  } catch (err) {
    container.innerHTML = "";
  }
}

function renderPoll(container, poll, votes, totalVotes, myOptionId) {
  container.innerHTML = `
    <div class="poll-card glass fade-in">
      <h3><i class="fa-solid fa-square-poll-vertical text-gold"></i> Community Poll</h3>
      <p class="poll-question">${sanitize(poll.question)}</p>
      <div class="poll-options" id="poll-options-${poll.id}">
        ${poll.options
          .map((opt) => {
            const count = votes.filter((v) => v.optionId === opt.id).length;
            const pct = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
            const isMine = myOptionId === opt.id;
            return `
            <button class="poll-option-btn ${isMine ? "voted" : ""}" data-poll-id="${poll.id}" data-option-id="${opt.id}">
              <span class="poll-option-fill" style="width:${pct}%"></span>
              <span class="poll-option-label"><i class="fa-solid ${isMine ? "fa-circle-check" : "fa-circle"}"></i> ${sanitize(opt.text)}</span>
              <span class="poll-option-pct">${pct}%</span>
            </button>`;
          })
          .join("")}
      </div>
      <span class="poll-total">${totalVotes} vote${totalVotes === 1 ? "" : "s"} total ${myOptionId ? "· tap another option to change your vote" : "· tap an option to vote"}</span>
    </div>
  `;

  container.querySelectorAll(".poll-option-btn").forEach((btn) => {
    btn.addEventListener("click", () => castVote(btn.dataset.pollId, btn.dataset.optionId, container));
  });
}

async function castVote(pollId, optionId, container) {
  const user = auth.currentUser;
  if (!user) return;

  try {
    await db
      .collection(COLLECTIONS.POLLS)
      .doc(pollId)
      .collection("votes")
      .doc(user.uid)
      .set({
        optionId,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
    showToast("Vote counted!", "success");
    loadActivePoll(container, user.uid);
  } catch (err) {
    showToast("Failed to cast vote.", "error");
  }
}
