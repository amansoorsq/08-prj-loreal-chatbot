# L'Oréal Smart Product Advisor (AI Chatbot)

Overview
This is a small, self-contained web app that demonstrates how to build an AI-powered assistant focused on L'Oréal products and routines. The interface is a simple chat UI, and the assistant gives product recommendations, step-by-step routines, and short explanations for why a product fits a user need.

What it does

- Accepts natural user questions about L'Oréal makeup, skincare, haircare, and fragrances.
- Keeps short-term context (user name and recent questions) so replies stay consistent across turns.
- Shows the user's latest question above the assistant reply and renders messages as chat bubbles for a familiar conversation feel.
- Routes API requests through a Cloudflare Worker to avoid exposing the OpenAI API key in client code.

How AI is integrated

- Model: Uses OpenAI Chat Completions (gpt-4o) via a messages array (system, user, assistant).
- System prompt: A targeted system message constrains the assistant to only answer L'Oréal and beauty-related queries and to politely refuse unrelated topics.
- Context summary: The client keeps an in-memory list of recent user questions and an optional user name, and injects a short context summary as a system message before each API call so the model has relevant session state.
- Security: The app is designed so the browser posts the messages array to a Cloudflare Worker. The worker holds the OpenAI key and forwards the request to OpenAI, keeping secrets off the client.

Why this structure

- Simple prompt engineering keeps the behavior predictable without heavy orchestration.
- Passing a short context summary is an easy way to give the model session memory without persisting large conversation logs.
- A worker-based forwarder is a minimal, deployable pattern for protecting API keys in front-end demos.

Quick tech overview

- index.html — layout, logo, and script includes
- style.css — brand-inspired colors, latest-question banner, and chat bubble styles
- script.js — main logic: conversation state, context handling, UI rendering, and worker requests
- RESOURCE_cloudflare-worker.js — example worker that accepts { messages: [...] } and forwards to OpenAI
- secrets.js (local dev only) — optional file for local testing; the repo ignores this file

Running the app locally

1. Serve the project folder with a simple static server (or open index.html in a browser). Live Server in VS Code works well.
2. For local dev, create `secrets.js` with:
   window.OPENAI_KEY = "sk-..."
   This file is ignored by git and only for local testing.
3. To run securely in production, deploy the Cloudflare Worker and update `script.js` if needed to point to your worker URL.

What to look at in the code

- `script.js`
  - messages array and system prompt (how prompts are structured)
  - buildContextSummary and buildMessagesForAPI (how context is summarized and inserted)
  - fetchAssistantReply (how the client posts to the worker and reads data.choices[0].message.content)
  - UI helpers (appendMessage, escapeHTML) and the handling of the latest-question banner
- `RESOURCE_cloudflare-worker.js`
  - Example of forwarding incoming messages to OpenAI and returning the provider response
- `style.css`
  - How messages are rendered as bubbles and how brand colors are applied

Notes on tradeoffs and next steps

- Current context is in-memory for the session only. Persisting context (localStorage or user accounts) would support longer-term personalization.
- The system prompt is intentionally conservative; a production version should be reviewed and refined with content experts.
- Product data could be enriched by connecting to a product catalog or CMS so responses can include product links and images.
