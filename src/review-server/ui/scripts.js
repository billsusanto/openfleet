const POLL_INTERVAL_MS = 5000;

let state = {
  review: null,
  document: null,
  threads: [],
  selectedLines: null,
  filter: "all",
  isLoading: true,
};

// Initialize
async function init() {
  await loadData();
  render();
  setupPolling();
}

// Data Loading
async function loadData() {
  try {
    const [reviewRes, docRes, threadsRes] = await Promise.all([
      fetch("/api/reviews/" + REVIEW_ID),
      fetch("/api/reviews/" + REVIEW_ID + "/document"),
      fetch("/api/reviews/" + REVIEW_ID + "/threads"),
    ]);

    if (!reviewRes.ok || !docRes.ok || !threadsRes.ok) {
      throw new Error("Failed to load review data");
    }

    state.review = await reviewRes.json();
    state.document = await docRes.json();
    const threadsData = await threadsRes.json();
    state.threads = threadsData.threads || [];
    state.isLoading = false;
  } catch (error) {
    console.error("Error loading data:", error);
    showToast("Failed to load review data", "error");
  }
}

function setupPolling() {
  setInterval(async () => {
    if (document.hidden) return;

    try {
      const [docRes, threadsRes] = await Promise.all([
        fetch("/api/reviews/" + REVIEW_ID + "/document"),
        fetch("/api/reviews/" + REVIEW_ID + "/threads"),
      ]);

      if (docRes.ok && threadsRes.ok) {
        const newDoc = await docRes.json();
        const threadsData = await threadsRes.json();

        // Check if document changed
        if (state.document && newDoc.hash !== state.document.hash) {
          state.document = newDoc;
          renderDocument();
          showToast("Document updated", "success");
        }

        // Update threads
        state.threads = threadsData.threads || [];
        renderThreads();
      }
    } catch (error) {
      console.error("Polling error:", error);
    }
  }, POLL_INTERVAL_MS);
}

// Rendering
function render() {
  const app = document.getElementById("app");

  if (state.isLoading) {
    app.innerHTML =
      '<div class="loading"><div class="loading-spinner"></div>Loading review...</div>';
    return;
  }

  if (!state.review || !state.document) {
    app.innerHTML = '<div class="loading">Failed to load review</div>';
    return;
  }

  const docName = state.review.documentPath.split("/").pop();
  const statusLabel = state.review.status.replace(/_/g, " ");

  app.innerHTML = `
    <header class="review-header">
      <div class="review-title">
        <span class="doc-icon">📄</span>
        <h1>${escapeHtml(docName)}</h1>
      </div>
      <div class="review-meta">
        <span class="round-badge">Round ${state.review.currentRound}</span>
        <span class="status-badge ${state.review.status}">${statusLabel}</span>
      </div>
    </header>

    <main class="review-content">
      <section class="document-panel">
        <div class="document-viewer" id="documentViewer"></div>
      </section>
      
      <aside class="comments-panel">
        <div class="comments-header">
          <h2>Comments (<span id="commentCount">0</span>)</h2>
          <div class="comment-filter">
            <button class="filter-btn ${state.filter === "all" ? "active" : ""}" onclick="setFilter('all')">All</button>
            <button class="filter-btn ${state.filter === "pending" ? "active" : ""}" onclick="setFilter('pending')">Pending</button>
            <button class="filter-btn ${state.filter === "resolved" ? "active" : ""}" onclick="setFilter('resolved')">Resolved</button>
          </div>
        </div>
        <div class="threads-list" id="threadsList"></div>
      </aside>
    </main>

    <button class="add-comment-btn" id="addCommentBtn" onclick="openCommentModal()">
      💬 Add Comment
    </button>

    <div class="modal-overlay hidden" id="commentModal">
      <div class="modal-content">
        <h3>Add Comment</h3>
        <p class="line-indicator">Lines <span id="modalLineRange"></span></p>
        <textarea class="modal-textarea" id="commentBody" placeholder="Enter your comment..."></textarea>
        <div class="modal-actions">
          <button class="btn-cancel" onclick="closeCommentModal()">Cancel</button>
          <button class="btn-submit" id="submitCommentBtn" onclick="submitComment()">Add Comment</button>
        </div>
      </div>
    </div>

    <div class="modal-overlay hidden" id="replyModal">
      <div class="modal-content">
        <h3>Reply to Comment</h3>
        <textarea class="modal-textarea" id="replyBody" placeholder="Enter your reply..."></textarea>
        <div class="modal-actions">
          <button class="btn-cancel" onclick="closeReplyModal()">Cancel</button>
          <button class="btn-submit" onclick="submitReply()">Reply</button>
        </div>
      </div>
    </div>

    <footer class="review-actions ${state.review.status !== "pending_review" ? "hidden" : ""}" id="reviewActions">
      <div class="action-buttons">
        <button class="btn-request-changes" onclick="submitReview('request_changes')">
          ❌ Request Changes
        </button>
        <button class="btn-approve" onclick="submitReview('approve')">
          ✅ Approve
        </button>
      </div>
    </footer>
  `;

  renderDocument();
  renderThreads();
}

function renderDocument() {
  const viewer = document.getElementById("documentViewer");
  if (!viewer || !state.document) return;

  const linesWithComments = new Set();
  state.threads.forEach((thread) => {
    for (let i = thread.lineStart; i <= thread.lineEnd; i++) {
      linesWithComments.add(i);
    }
  });

  const html = state.document.lines
    .map((line, index) => {
      const lineNum = index + 1;
      const hasComment = linesWithComments.has(lineNum);
      const isSelected =
        state.selectedLines &&
        lineNum >= state.selectedLines.start &&
        lineNum <= state.selectedLines.end;

      const classes = ["document-line"];
      if (hasComment) classes.push("has-comment");
      if (isSelected) classes.push("selected");

      return `
      <div class="${classes.join(" ")}" data-line="${lineNum}" onclick="handleLineClick(event, ${lineNum})">
        <div class="line-number">${lineNum}</div>
        <div class="line-content">${escapeHtml(line) || " "}</div>
      </div>
    `;
    })
    .join("");

  viewer.innerHTML = html;
}

function renderThreads() {
  const list = document.getElementById("threadsList");
  const countEl = document.getElementById("commentCount");
  if (!list) return;

  let filteredThreads = state.threads;
  if (state.filter === "pending") {
    filteredThreads = state.threads.filter((t) => !t.resolved);
  } else if (state.filter === "resolved") {
    filteredThreads = state.threads.filter((t) => t.resolved);
  }

  // Sort by line number
  filteredThreads.sort((a, b) => a.lineStart - b.lineStart);

  if (countEl) {
    countEl.textContent = state.threads.length;
  }

  if (filteredThreads.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">💬</div>
        <p>${state.filter === "all" ? "No comments yet" : "No " + state.filter + " comments"}</p>
        <p style="font-size: 12px; margin-top: 8px;">Click on line numbers to add a comment</p>
      </div>
    `;
    return;
  }

  list.innerHTML = filteredThreads
    .map((thread) => {
      const lineRange =
        thread.lineStart === thread.lineEnd
          ? "Line " + thread.lineStart
          : "Lines " + thread.lineStart + "-" + thread.lineEnd;

      const authorLabel = thread.author === "human" ? "👤 Human" : "🤖 Agent";
      const time = formatTime(thread.createdAt);

      return `
      <div class="thread-card ${thread.resolved ? "resolved" : ""}" data-thread-id="${thread.id}">
        <div class="thread-header">
          <span class="thread-lines" onclick="scrollToLine(${thread.lineStart})">${lineRange}</span>
          <div class="thread-status">
            ${thread.resolved ? '<span class="resolved-badge">✓ Resolved</span>' : ""}
          </div>
        </div>
        <div class="thread-body">
          <div class="comment-content">${escapeHtml(thread.body)}</div>
          <div class="comment-meta">
            <span class="author-badge ${thread.author}">${authorLabel}</span>
            <span class="comment-time">${time}</span>
          </div>
        </div>
        ${
          thread.replies && thread.replies.length > 0
            ? `
          <div class="replies-section">
            ${thread.replies
              .map((reply) => {
                const replyAuthorLabel = reply.author === "human" ? "👤 Human" : "🤖 Agent";
                const replyTime = formatTime(reply.createdAt);
                return `
                <div class="reply-item">
                  <div class="comment-content">${escapeHtml(reply.body)}</div>
                  <div class="comment-meta">
                    <span class="author-badge ${reply.author}">${replyAuthorLabel}</span>
                    <span class="comment-time">${replyTime}</span>
                  </div>
                </div>
              `;
              })
              .join("")}
          </div>
        `
            : ""
        }
        <div class="thread-actions">
          <button class="btn-small" onclick="openReplyModal('${thread.id}')">Reply</button>
          ${
            thread.resolved
              ? '<button class="btn-small unresolve" onclick="toggleResolved(\'' +
                thread.id +
                "', false)\">Unresolve</button>"
              : '<button class="btn-small resolve" onclick="toggleResolved(\'' +
                thread.id +
                "', true)\">Resolve</button>"
          }
        </div>
      </div>
    `;
    })
    .join("");
}

// Line Selection
let lastClickedLine = null;

function handleLineClick(event, lineNum) {
  if (event.shiftKey && lastClickedLine !== null) {
    const start = Math.min(lastClickedLine, lineNum);
    const end = Math.max(lastClickedLine, lineNum);
    state.selectedLines = { start, end };
  } else {
    state.selectedLines = { start: lineNum, end: lineNum };
    lastClickedLine = lineNum;
  }

  renderDocument();
  updateAddCommentButton();
}

function updateAddCommentButton() {
  const btn = document.getElementById("addCommentBtn");
  if (!btn) return;

  if (state.selectedLines) {
    btn.classList.add("visible");

    const selectedLine = document.querySelector(".document-line.selected");
    if (selectedLine) {
      const lineRect = selectedLine.getBoundingClientRect();
      const panelRect = document.querySelector(".document-panel").getBoundingClientRect();

      const topPosition = Math.max(
        80,
        Math.min(lineRect.top + window.scrollY, window.innerHeight - 60),
      );
      const leftPosition = panelRect.left + 60;

      btn.style.top = topPosition + "px";
      btn.style.left = leftPosition + "px";
    }
  } else {
    btn.classList.remove("visible");
  }
}

function clearSelection() {
  state.selectedLines = null;
  lastClickedLine = null;
  renderDocument();
  updateAddCommentButton();
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  modal.classList.remove("hidden");
  modal.offsetHeight;
  modal.classList.add("visible");

  const input = modal.querySelector("textarea, input");
  if (input) input.focus();
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  modal.classList.remove("visible");

  const handleTransitionEnd = (e) => {
    if (e.propertyName === "opacity") {
      modal.classList.add("hidden");
      modal.removeEventListener("transitionend", handleTransitionEnd);
    }
  };
  modal.addEventListener("transitionend", handleTransitionEnd);
}

function setButtonLoading(button, isLoading) {
  if (isLoading) {
    button.classList.add("btn-loading");
    button.disabled = true;
  } else {
    button.classList.remove("btn-loading");
    button.disabled = false;
  }
}

// Comment Modal
function openCommentModal() {
  if (!state.selectedLines) return;

  const lineRange = document.getElementById("modalLineRange");
  const textarea = document.getElementById("commentBody");

  if (lineRange && textarea) {
    lineRange.textContent =
      state.selectedLines.start === state.selectedLines.end
        ? state.selectedLines.start
        : state.selectedLines.start + "-" + state.selectedLines.end;
    textarea.value = "";
    openModal("commentModal");
  }
}

function closeCommentModal() {
  closeModal("commentModal");
}

async function submitComment() {
  const textarea = document.getElementById("commentBody");
  const body = textarea?.value?.trim();
  const btn = document.getElementById("submitCommentBtn");

  if (!body || !state.selectedLines) {
    showToast("Please enter a comment", "error");
    return;
  }

  setButtonLoading(btn, true);

  try {
    const response = await fetch("/api/reviews/" + REVIEW_ID + "/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lineStart: state.selectedLines.start,
        lineEnd: state.selectedLines.end,
        body: body,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to add comment");
    }

    const thread = await response.json();
    state.threads.push(thread);

    closeCommentModal();
    clearSelection();
    renderDocument();
    renderThreads();
    showToast("Comment added", "success");
  } catch (error) {
    console.error("Error adding comment:", error);
    showToast("Failed to add comment", "error");
  } finally {
    setButtonLoading(btn, false);
  }
}

// Reply Modal
let currentReplyThreadId = null;

function openReplyModal(threadId) {
  currentReplyThreadId = threadId;
  const textarea = document.getElementById("replyBody");

  if (textarea) {
    textarea.value = "";
    openModal("replyModal");
  }
}

function closeReplyModal() {
  currentReplyThreadId = null;
  closeModal("replyModal");
}

async function submitReply() {
  const textarea = document.getElementById("replyBody");
  const body = textarea?.value?.trim();

  if (!body || !currentReplyThreadId) {
    showToast("Please enter a reply", "error");
    return;
  }

  try {
    const response = await fetch(
      "/api/reviews/" + REVIEW_ID + "/threads/" + currentReplyThreadId + "/replies",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body }),
      },
    );

    if (!response.ok) {
      throw new Error("Failed to add reply");
    }

    const reply = await response.json();
    const thread = state.threads.find((t) => t.id === currentReplyThreadId);
    if (thread) {
      thread.replies = thread.replies || [];
      thread.replies.push(reply);
    }

    closeReplyModal();
    renderThreads();
    showToast("Reply added", "success");
  } catch (error) {
    console.error("Error adding reply:", error);
    showToast("Failed to add reply", "error");
  }
}

// Resolve/Unresolve
async function toggleResolved(threadId, resolved) {
  try {
    const response = await fetch("/api/reviews/" + REVIEW_ID + "/threads/" + threadId, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolved: resolved }),
    });

    if (!response.ok) {
      throw new Error("Failed to update thread");
    }

    const thread = state.threads.find((t) => t.id === threadId);
    if (thread) {
      thread.resolved = resolved;
      if (resolved) {
        thread.resolvedBy = "human";
        thread.resolvedAt = new Date().toISOString();
      } else {
        thread.resolvedBy = undefined;
        thread.resolvedAt = undefined;
      }
    }

    renderThreads();
    showToast(resolved ? "Comment resolved" : "Comment unresolved", "success");
  } catch (error) {
    console.error("Error updating thread:", error);
    showToast("Failed to update comment", "error");
  }
}

// Submit Review
async function submitReview(decision) {
  if (
    !confirm(
      decision === "approve"
        ? "Are you sure you want to approve this document?"
        : "Are you sure you want to request changes?",
    )
  ) {
    return;
  }

  try {
    const response = await fetch("/api/reviews/" + REVIEW_ID + "/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: decision }),
    });

    if (!response.ok) {
      throw new Error("Failed to submit review");
    }

    const result = await response.json();
    state.review.status = result.status;

    render();
    showToast(decision === "approve" ? "Review approved! ✅" : "Changes requested", "success");
  } catch (error) {
    console.error("Error submitting review:", error);
    showToast("Failed to submit review", "error");
  }
}

// Filter
function setFilter(filter) {
  state.filter = filter;

  // Update filter buttons
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.textContent.toLowerCase() === filter);
  });

  renderThreads();
}

// Scroll to line
function scrollToLine(lineNum) {
  const line = document.querySelector('.document-line[data-line="' + lineNum + '"]');
  if (line) {
    line.scrollIntoView({ behavior: "smooth", block: "center" });

    line.classList.add("highlight-flash");
    setTimeout(() => {
      line.classList.remove("highlight-flash");
    }, 1500);
  }
}

// Utilities
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function formatTime(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return diffMins + "m ago";
  if (diffHours < 24) return diffHours + "h ago";
  if (diffDays < 7) return diffDays + "d ago";

  return date.toLocaleDateString();
}

function showToast(message, type) {
  const existing = document.querySelector(".toast");
  if (existing) {
    existing.classList.add("hiding");
    setTimeout(() => existing.remove(), 200);
  }

  const toast = document.createElement("div");
  toast.className = "toast " + type;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("hiding");
    setTimeout(() => toast.remove(), 200);
  }, 3000);
}

document.addEventListener("click", (e) => {
  const isDocumentLine = e.target.closest(".document-line");
  const isAddCommentBtn = e.target.id === "addCommentBtn" || e.target.closest("#addCommentBtn");
  const isModal = e.target.closest(".modal-content");
  const isModalOverlay = e.target.classList.contains("modal-overlay");

  if (isModalOverlay) {
    closeCommentModal();
    closeReplyModal();
    return;
  }

  if (!isDocumentLine && !isAddCommentBtn && !isModal && state.selectedLines) {
    clearSelection();
  }
});

// Handle keyboard shortcuts
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeCommentModal();
    closeReplyModal();
    clearSelection();
  }
});

// Start the app
init();
