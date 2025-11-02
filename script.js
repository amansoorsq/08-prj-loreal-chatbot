// DOM refs
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const latestQuestionEl = document.getElementById("latestQuestion");

// System prompt that constrains assistant behavior
const systemPrompt = {
  role: "system",
  content:
    "You are the L'Oréal Product Assistant. Only answer questions related to L'Oréal products, routines, and recommendations. Provide clear, concise product suggestions, step-by-step routine guidance, and explain why a product fits a user's need. Ask clarifying questions if a user's request is ambiguous. Do not provide medical diagnoses. If a user asks about topics outside L'Oréal products, routines, recommendations, or general beauty topics, politely refuse and steer the conversation back to L'Oréal-related assistance. Be polite and professional.",
};

// Conversation state
const messages = [systemPrompt];

// Simple in-memory context for personalization
const context = {
  userName: null,
  pastQuestions: [],
};

// small helper to pull a name from text if the user sets it
function extractNameFromText(text) {
  if (text.startsWith("/name ")) {
    return text.slice(6).trim();
  }
  const m = text.match(
    /\b(?:my name is|i am|i'm)\s+([A-Za-z][A-Za-z'’-]+(?:\s[A-Za-z][A-Za-z'’-]+)?)\b/i
  );
  return m ? m[1].trim() : null;
}

// build a short context summary to help the model stay consistent
function buildContextSummary() {
  const namePart = context.userName
    ? `Name: ${context.userName}`
    : "Name: unknown";
  const recent = context.pastQuestions.slice(-8).join(" | ");
  const pastPart = recent
    ? `Recent user questions: ${recent}`
    : "No prior questions recorded.";
  return `${namePart}\n${pastPart}\nPlease use this context to deliver personalized, consistent L'Oréal product recommendations.`;
}

// insert the context summary just after the initial system prompt
function buildMessagesForAPI() {
  const apiMsgs = [...messages];
  const contextMsg = { role: "system", content: buildContextSummary() };
  apiMsgs.splice(1, 0, contextMsg);
  return apiMsgs;
}

// escape HTML to avoid injection
function escapeHTML(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// Render a chat bubble for user or assistant
function appendMessage(role, text) {
  const el = document.createElement("div");
  el.className = `msg ${role}`;

  const label = role === "user" ? "You" : "L'Oréal Assistant";
  const safeText = escapeHTML(text).replace(/\n/g, "<br />");

  el.innerHTML = `
    <div class="bubble ${role}">
      <span class="label">${label}</span>
      <div class="content">${safeText}</div>
    </div>
  `;
  chatWindow.appendChild(el);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// initial greeting
const initialGreeting =
  "👋 Hello! I can help you discover L'Oréal products, build routines, and give recommendations. What would you like to know?";
appendMessage("ai", initialGreeting);
messages.push({ role: "assistant", content: initialGreeting });

// Send messages to Cloudflare Worker and return assistant text
async function fetchAssistantReply(messagesArray) {
  const workerUrl = "https://lorealbotworker.ams63tube.workers.dev/";
  const body = { messages: messagesArray };

  const res = await fetch(workerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    const errMsg = data.error?.message || data?.message || `HTTP ${res.status}`;
    throw new Error(errMsg);
  }

  const assistantText = data.choices?.[0]?.message?.content;
  if (!assistantText) throw new Error("No assistant response in API result.");
  return assistantText;
}

// form submit handler — main interaction flow
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const text = userInput.value.trim();
  if (!text) return;

  // show latest question above the chat
  if (latestQuestionEl) {
    latestQuestionEl.classList.remove("visually-hidden");
    latestQuestionEl.innerHTML = `<strong>Latest question:</strong> ${escapeHTML(
      text
    )}`;
  }

  // check if the user set their name (quick local handling)
  const possibleName = extractNameFromText(text);
  if (possibleName && !context.userName) {
    context.userName = possibleName;
    appendMessage("user", text);
    messages.push({ role: "user", content: text });
    context.pastQuestions.push(text);

    const greeting = `Nice to meet you, ${context.userName}! I’ll remember your name for this session. How can I help you with L'Oréal products today?`;
    appendMessage("ai", greeting);
    messages.push({ role: "assistant", content: greeting });

    userInput.value = "";
    userInput.focus();
    return;
  }

  // normal message flow
  appendMessage("user", text);
  messages.push({ role: "user", content: text });
  context.pastQuestions.push(text);

  // disable input while we wait
  userInput.value = "";
  userInput.disabled = true;
  const sendButton = document.getElementById("sendBtn");
  if (sendButton) sendButton.disabled = true;

  // small loading indicator
  const loadingEl = document.createElement("div");
  loadingEl.className = "msg ai";
  loadingEl.innerHTML = `<strong>L'Oréal Assistant:</strong> ...typing`;
  chatWindow.appendChild(loadingEl);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  try {
    const apiMessages = buildMessagesForAPI();
    const reply = await fetchAssistantReply(apiMessages);

    loadingEl.remove();
    appendMessage("ai", reply);
    messages.push({ role: "assistant", content: reply });
  } catch (err) {
    loadingEl.remove();
    console.error(err);
    appendMessage("ai", `Sorry — something went wrong: ${err.message}`);
  } finally {
    userInput.disabled = false;
    if (sendButton) sendButton.disabled = false;
    userInput.focus();
  }
});
