// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCVCjFuEwtwWhRZS47PopFGc86BTEHbFAc",
  authDomain: "hyperpixelai-ea0db.firebaseapp.com",
  databaseURL: "https://hyperpixelai-ea0db-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "hyperpixelai-ea0db",
  storageBucket: "hyperpixelai-ea0db.firebasestorage.app",
  messagingSenderId: "598829274532",
  appId: "1:598829274532:web:19f3748d355e96615c1d31",
  measurementId: "G-RSP1W1TYWM"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();

// App State
const API = window.location.origin;
let history = [];
let isStreaming = false;
let chats = [];
let currentChat = { id: Date.now(), title: "New conversation", messages: [] };
let uploadedFiles = [];
let currentUser = null;
let isSignupMode = false;

// List of all possible suggestions
const allSuggestions = [
  "Write a Python web scraper",
  "Explain how APIs work",
  "Debug my code",
  "Help me learn JavaScript",
  "Create a React component",
  "Write SQL queries",
  "Explain machine learning concepts",
  "Help with CSS styling",
  "Write a Flask API",
  "Explain Docker containers",
  "Help with Git commands",
  "Write unit tests",
  "Explain algorithms",
  "Help with data analysis",
  "Write a bash script",
  "Search for latest AI news",
  "Find Python tutorials",
  "Look up programming documentation",
  "Search for coding best practices"
];

// ── Page Navigation ─────────────────────────────────────────────────────────
function showAuthPage(mode = 'login') {
  hideAllPages();
  document.getElementById('auth-page').classList.add('active', 'fade-in');
  document.getElementById('auth-page').style.display = 'flex';
  isSignupMode = mode === 'signup';
  updateAuthUI();
}

function showChatPage() {
  hideAllPages();
  document.getElementById('chat-page').classList.add('active', 'fade-in');
  document.getElementById('chat-page').style.display = 'flex';
  // Load available models when entering chat
  loadAvailableModels();
  // Start status checking
  checkStatus();
}

function hideAllPages() {
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active', 'fade-in');
    page.style.display = 'none';
  });
}

// ── Authentication UI ─────────────────────────────────────────────────────────
function updateAuthUI() {
  const title = document.getElementById('auth-title');
  const subtitle = document.getElementById('auth-subtitle');
  const submitBtn = document.getElementById('auth-submit-btn');
  const switchLink = document.getElementById('auth-switch-link');
  const confirmPassword = document.getElementById('auth-confirm-password');

  if (isSignupMode) {
    title.textContent = 'Create Account';
    subtitle.textContent = 'Sign up to start your AI journey';
    submitBtn.textContent = 'Sign Up';
    switchLink.textContent = 'Already have an account? Sign in';
    confirmPassword.style.display = 'block';
    confirmPassword.required = true;
  } else {
    title.textContent = 'Welcome Back';
    subtitle.textContent = 'Sign in to continue your conversations';
    submitBtn.textContent = 'Sign In';
    switchLink.textContent = "Don't have an account? Sign up";
    confirmPassword.style.display = 'none';
    confirmPassword.required = false;
  }
}

function toggleAuthMode() {
  isSignupMode = !isSignupMode;
  updateAuthUI();
  clearAuthMessage();
}

function showAuthMessage(message, isError = false) {
  const messageDiv = document.getElementById('auth-message');
  messageDiv.innerHTML = isError 
    ? `<div class="auth-error">${message}</div>`
    : `<div class="auth-success">${message}</div>`;
}

function clearAuthMessage() {
  document.getElementById('auth-message').innerHTML = '';
}
// ── Firebase Authentication ───────────────────────────────────────────────────
async function handleAuth(event) {
  event.preventDefault();
  
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;
  const confirmPassword = document.getElementById('auth-confirm-password').value;
  const submitBtn = document.getElementById('auth-submit-btn');
  
  submitBtn.disabled = true;
  clearAuthMessage();

  try {
    if (isSignupMode) {
      if (password !== confirmPassword) {
        showAuthMessage('Passwords do not match', true);
        submitBtn.disabled = false;
        return;
      }
      if (password.length < 6) {
        showAuthMessage('Password must be at least 6 characters', true);
        submitBtn.disabled = false;
        return;
      }
      
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      showAuthMessage('Account created successfully!');
      await saveUserToDatabase(userCredential.user);
      setTimeout(() => showChatPage(), 1000);
    } else {
      await auth.signInWithEmailAndPassword(email, password);
      showAuthMessage('Signed in successfully!');
      setTimeout(() => showChatPage(), 1000);
    }
  } catch (error) {
    showAuthMessage(getAuthErrorMessage(error.code), true);
    submitBtn.disabled = false;
  }
}

function getAuthErrorMessage(code) {
  const errorMessages = {
    'auth/email-already-in-use': 'This email is already registered',
    'auth/invalid-email': 'Invalid email address',
    'auth/weak-password': 'Password is too weak',
    'auth/user-not-found': 'No account found with this email',
    'auth/wrong-password': 'Incorrect password',
    'auth/too-many-requests': 'Too many attempts. Please try again later',
    'auth/network-request-failed': 'Network error. Please check your connection'
  };
  return errorMessages[code] || 'An error occurred. Please try again.';
}

async function saveUserToDatabase(user) {
  const userRef = database.ref('users/' + user.uid);
  await userRef.set({
    email: user.email,
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    lastLogin: firebase.database.ServerValue.TIMESTAMP
  });
}

async function signOut() {
  try {
    await auth.signOut();
    currentUser = null;
    document.getElementById('user-avatar-btn').style.display = 'none';
    document.getElementById('user-dropdown').classList.remove('active');
    showAuthPage('login');
  } catch (error) {
    console.error('Sign out error:', error);
  }
}

// ── Social Authentication ─────────────────────────────────────────────────────
async function signInWithGoogle() {
  try {
    showAuthMessage('Signing in with Google...');
    const provider = new firebase.auth.GoogleAuthProvider();
    const result = await auth.signInWithPopup(provider);
    showAuthMessage('Signed in successfully!');
    await saveUserToDatabase(result.user);
    setTimeout(() => showChatPage(), 1000);
  } catch (error) {
    console.error('Google sign-in error:', error);
    if (error.code === 'auth/popup-closed-by-user') {
      showAuthMessage('Sign-in was cancelled', true);
    } else {
      showAuthMessage(getAuthErrorMessage(error.code), true);
    }
  }
}

async function signInWithGitHub() {
  try {
    showAuthMessage('Signing in with GitHub...');
    const provider = new firebase.auth.GithubAuthProvider();
    const result = await auth.signInWithPopup(provider);
    showAuthMessage('Signed in successfully!');
    await saveUserToDatabase(result.user);
    setTimeout(() => showChatPage(), 1000);
  } catch (error) {
    console.error('GitHub sign-in error:', error);
    if (error.code === 'auth/popup-closed-by-user') {
      showAuthMessage('Sign-in was cancelled', true);
    } else {
      showAuthMessage(getAuthErrorMessage(error.code), true);
    }
  }
}

function toggleUserMenu() {
  const dropdown = document.getElementById('user-dropdown');
  dropdown.classList.toggle('active');
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  const userMenu = document.querySelector('.user-menu');
  const dropdown = document.getElementById('user-dropdown');
  if (userMenu && !userMenu.contains(e.target)) {
    dropdown.classList.remove('active');
  }
});

// ── Auth State Observer ───────────────────────────────────────────────────────
auth.onAuthStateChanged(async (user) => {
  if (user) {
    currentUser = user;
    document.getElementById('user-avatar-btn').style.display = 'flex';
    document.getElementById('user-initial').textContent = user.email[0].toUpperCase();
    document.getElementById('user-email-display').textContent = user.email;

    // Update last login
    await database.ref('users/' + user.uid).update({
      lastLogin: firebase.database.ServerValue.TIMESTAMP
    });

    // Load user's chat history
    await loadUserChats();

    // If on auth page, go to chat
    if (document.getElementById('auth-page').classList.contains('active')) {
      showChatPage();
    }
  } else {
    currentUser = null;
    document.getElementById('user-avatar-btn').style.display = 'none';
    if (!document.getElementById('auth-page').classList.contains('active')) {
      showAuthPage('login');
    }
  }
});

// ── Firebase Database Operations ─────────────────────────────────────────────
async function saveChatToDatabase() {
  if (!currentUser) return;
  
  const chatRef = database.ref('users/' + currentUser.uid + '/chats/' + currentChat.id);
  await chatRef.set({
    title: currentChat.title,
    messages: currentChat.messages,
    updatedAt: firebase.database.ServerValue.TIMESTAMP
  });
}

async function loadUserChats() {
  if (!currentUser) return;
  
  const chatsRef = database.ref('users/' + currentUser.uid + '/chats');
  const snapshot = await chatsRef.once('value');
  
  if (snapshot.exists()) {
    const loadedChats = [];
    snapshot.forEach((childSnapshot) => {
      loadedChats.push({
        id: childSnapshot.key,
        ...childSnapshot.val()
      });
    });
    
    // Sort by most recent
    loadedChats.sort((a, b) => b.updatedAt - a.updatedAt);
    chats = loadedChats;
    renderHistory();
  }
}

async function deleteChatFromDatabase(chatId) {
  if (!currentUser) return;
  
  await database.ref('users/' + currentUser.uid + '/chats/' + chatId).remove();
}

// ── Learning System with Fact Verification ───────────────────────────────────
async function verifyFact(fact) {
  try {
    const response = await fetch(API + '/verify_fact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fact })
    });
    return await response.json();
  } catch (error) {
    console.error('Fact verification error:', error);
    return { verified: false, confidence: 0, sources: [] };
  }
}

async function extractAndLearnFacts(message, context = '') {
  if (!currentUser) return;
  
  // Simple fact extraction - look for statements that could be facts
  const facts = extractPotentialFacts(message);
  
  for (const fact of facts) {
    const verification = await verifyFact(fact);
    
    if (verification.verified && verification.confidence >= 0.7) {
      await storeLearnedFact(fact, context, verification);
    }
  }
}

function extractPotentialFacts(text) {
  // Extract potential facts from text
  const facts = [];
  
  // Look for statements with common fact patterns
  const patterns = [
    /(?:is|are|was|were)\s+(?:a|an|the)?\s*([^.!?]+)[.!?]/gi,
    /(?:has|have|had)\s+([^.!?]+)[.!?]/gi,
    /(?:can|could|will|would|should)\s+([^.!?]+)[.!?]/gi,
    /(?:means|means that)\s+([^.!?]+)[.!?]/gi
  ];
  
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      facts.push(...matches.slice(0, 3)); // Limit to 3 facts per message
    }
  }
  
  // Also extract sentences that look like definitions
  const sentences = text.split(/[.!?]+/);
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (trimmed.length > 20 && trimmed.length < 200) {
      if (!facts.includes(trimmed)) {
        facts.push(trimmed);
      }
    }
  }
  
  return [...new Set(facts)].slice(0, 5); // Return unique facts, max 5
}

async function storeLearnedFact(fact, context, verification) {
  if (!currentUser) return;
  
  const factRef = database.ref('users/' + currentUser.uid + '/learned_facts');
  const newFactRef = factRef.push();
  
  await newFactRef.set({
    fact: fact,
    context: context,
    verification: verification,
    learned_at: firebase.database.ServerValue.TIMESTAMP,
    confidence: verification.confidence
  });
}

async function getLearnedFacts() {
  if (!currentUser) return [];
  
  const factsRef = database.ref('users/' + currentUser.uid + '/learned_facts');
  const snapshot = await factsRef.once('value');
  
  if (snapshot.exists()) {
    const facts = [];
    snapshot.forEach((childSnapshot) => {
      facts.push({
        id: childSnapshot.key,
        ...childSnapshot.val()
      });
    });
    return facts.sort((a, b) => b.confidence - a.confidence);
  }
  
  return [];
}

async function checkStatus() {
  try {
    const r = await fetch(API + "/status");
    const d = await r.json();
    if (d.ready) {
      document.getElementById("status-dot").classList.remove("loading");
      const modelName = d.model || "Hyperpixel";
      const modelSize = d.model_size || "";
      document.getElementById("status-text").textContent = modelSize ? `${modelName} ${modelSize}` : modelName;
      document.getElementById("topbar-status").textContent = `Model ready (${modelName})`;
      document.getElementById("send-btn").disabled = false;
      // Update model selector if provided
      if (d.model_id) {
        document.getElementById("model-select").value = d.model_id;
      }
      return;
    }
    if (d.error) {
      document.getElementById("status-text").textContent = "Error loading model";
      document.getElementById("topbar-status").textContent = "Error: " + d.error;
      return;
    }
  } catch (_) {}
  setTimeout(checkStatus, 1500);
}

// ── Model Switching ───────────────────────────────────────────────────────
async function switchModel(modelId) {
  try {
    document.getElementById("topbar-status").textContent = "Switching model...";
    document.getElementById("status-dot").classList.add("loading");
    document.getElementById("send-btn").disabled = true;
    
    const response = await fetch(API + "/switch-model", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model_id: modelId })
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast(`Switched to ${data.model.name}`);
      // Refresh status to update UI
      await checkStatus();
    } else {
      showToast("Failed to switch model: " + (data.error || "Unknown error"));
      // Revert selector to current model
      const statusResp = await fetch(API + "/status");
      const statusData = await statusResp.json();
      if (statusData.model_id) {
        document.getElementById("model-select").value = statusData.model_id;
      }
    }
  } catch (err) {
    showToast("Error switching model: " + err.message);
    // Refresh to get current state
    await checkStatus();
  }
}

// ── Load available models ────────────────────────────────────────────────────
async function loadAvailableModels() {
  try {
    const response = await fetch(API + "/models");
    const data = await response.json();
    
    if (data.models) {
      const select = document.getElementById("model-select");
      select.innerHTML = data.models.map(m => 
        `<option value="${m.id}" ${m.id === data.current_model ? 'selected' : ''}>${m.name} (${m.size})</option>`
      ).join('');
    }
  } catch (err) {
    console.error("Failed to load models:", err);
  }
}

function updateLiveClock() {
  const live = document.getElementById("topbar-live");
  if (!live) return;
  const now = new Date();
  
  // Time formatting with hours, minutes, seconds
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  
  // Date formatting
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  
  // Day of week
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayOfWeek = days[now.getDay()];
  
  // Timezone
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timezoneOffset = now.getTimezoneOffset();
  const offsetHours = Math.floor(Math.abs(timezoneOffset) / 60);
  const offsetMinutes = Math.abs(timezoneOffset) % 60;
  const offsetSign = timezoneOffset <= 0 ? '+' : '-';
  const offsetString = `UTC${offsetSign}${String(offsetHours).padStart(2, "0")}:${String(offsetMinutes).padStart(2, "0")}`;
  
  live.textContent = `Live · ${dayOfWeek} ${year}-${month}-${day} · ${hours}:${minutes}:${seconds} (${timezone} ${offsetString})`;
}

setInterval(updateLiveClock, 1000);
updateLiveClock();
checkStatus();

// ── Auto resize textarea ──────────────────────────────────────────────────
const input = document.getElementById("user-input");
input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 200) + "px";
});

input.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

// ── File upload ─────────────────────────────────────────────────────────
async function handleFileUpload(input) {
  const file = input.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch(API + '/upload', {
      method: 'POST',
      body: formData
    });

    const result = await response.json();
    if (result.error) {
      alert('Upload failed: ' + result.error);
      return;
    }

    // Add file info to uploaded files
    uploadedFiles.push({
      filename: result.filename,
      content: result.content
    });

    // Show upload success message
    const msgs = document.getElementById("messages");
    const uploadMsg = document.createElement("div");
    uploadMsg.className = "message-row user";
    uploadMsg.innerHTML = `<div class="bubble">File uploaded: ${result.filename}</div>`;
    msgs.appendChild(uploadMsg);
    scrollToBottom();

    // Clear the input
    input.value = '';

  } catch (error) {
    alert('Upload failed: ' + error.message);
  }
}

// ── Suggestions ───────────────────────────────────────────────────────────
function suggest(text) {
  input.value = text;
  input.style.height = "auto";
  sendMessage();
}

// ── Edit message ───────────────────────────────────────────────────────────
function editMessage(btn, originalText) {
  const bubble = btn.parentElement;
  const currentText = originalText;
  
  // Create edit input
  bubble.innerHTML = `<textarea class="edit-input">${currentText}</textarea>
    <div class="edit-actions">
      <button class="edit-save" onclick="saveEdit(this, '${originalText.replace(/'/g, "\\'")}')">Save</button>
      <button class="edit-cancel" onclick="cancelEdit(this, '${originalText.replace(/'/g, "\\'")}')">Cancel</button>
    </div>`;
  
  const textarea = bubble.querySelector('.edit-input');
  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);
}

// ── Save edit ──────────────────────────────────────────────────────────────
function saveEdit(btn, originalText) {
  const bubble = btn.parentElement.parentElement;
  const newText = bubble.querySelector('.edit-input').value.trim();
  
  if (newText && newText !== originalText) {
    // Find the message index in currentChat.messages
    const userMessages = currentChat.messages.filter(m => m.role === 'user');
    const messageIndex = Array.from(document.querySelectorAll('.message-row.user')).indexOf(bubble.parentElement);
    
    if (messageIndex >= 0 && userMessages[messageIndex]) {
      userMessages[messageIndex].content = newText;
      history = currentChat.messages.map(m => ({ role: m.role, content: m.content }));
      
      // Remove all messages after this one
      currentChat.messages = currentChat.messages.slice(0, currentChat.messages.findIndex(m => m === userMessages[messageIndex]) + 1);
      history = history.slice(0, history.findIndex(m => m.content === originalText && m.role === 'user') + 1);
      
      // Re-render messages
      const msgs = document.getElementById("messages");
      msgs.innerHTML = "";
      currentChat.messages.forEach(m => {
        if (m.role === "user") appendUserBubble(m.content);
        else appendAIBubble(m.content, m.image, m.imagePrompt);
      });
    }
  } else {
    // Just restore original
    bubble.innerHTML = `${escapeHtml(originalText)}<button class="edit-btn" onclick="editMessage(this, '${originalText.replace(/'/g, "\\'")}')">Edit</button>`;
  }
}

// ── Cancel edit ────────────────────────────────────────────────────────────
function cancelEdit(btn, originalText) {
  const bubble = btn.parentElement.parentElement;
  bubble.innerHTML = `${escapeHtml(originalText)}<button class="edit-btn" onclick="editMessage(this, '${originalText.replace(/'/g, "\\'")}')">Edit</button>`;
}

// ── New chat ──────────────────────────────────────────────────────────────
async function newChat() {
  if (currentChat.messages.length > 0) {
    chats.unshift(currentChat);
    renderHistory();
    // Save previous chat to Firebase
    if (currentUser) {
      await saveChatToDatabase();
    }
  }
  currentChat = { id: Date.now(), title: "New conversation", messages: [] };
  history = [];
  
  // Randomly select 4 suggestions
  const shuffled = allSuggestions.sort(() => 0.5 - Math.random());
  const selectedSuggestions = shuffled.slice(0, 4);
  
  document.getElementById("messages").innerHTML = `
    <div class="welcome" id="welcome">
      <div class="welcome-icon">HP</div>
      <h1>Hello, I'm <span>Hyperpixel</span></h1>
      <p>Your private, fully offline AI assistant.<br/>Ask me anything — I'm here to think alongside you.</p>
      <div class="suggestions">
        ${selectedSuggestions.map(s => `<div class="suggestion" onclick="suggest('${s}')">${s}</div>`).join('')}
      </div>
    </div>`;
  document.querySelector(".topbar-title").textContent = "New conversation";
}

function renderHistory() {
  const list = document.getElementById("history-list");
  list.innerHTML = chats.map((c, i) => `
    <div class="history-item" onclick="loadChat(${i})">${c.title}</div>
  `).join("");
}

function loadChat(i) {
  currentChat = chats[i];
  history = currentChat.messages.map(m => ({ role: m.role, content: m.content, image: m.image, imagePrompt: m.imagePrompt }));
  const msgs = document.getElementById("messages");
  msgs.innerHTML = "";
  currentChat.messages.forEach(m => {
    if (m.role === "user") appendUserBubble(m.content);
    else appendAIBubble(m.content, m.image, m.imagePrompt);
  });
  document.querySelector(".topbar-title").textContent = currentChat.title;
}

// ── Send ──────────────────────────────────────────────────────────────────
async function sendMessage() {
  const text = input.value.trim();
  if (!text || isStreaming) return;

  // Hide welcome
  const welcome = document.getElementById("welcome");
  if (welcome) welcome.remove();

  input.value = "";
  input.style.height = "auto";
  isStreaming = true;
  document.getElementById("send-btn").disabled = true;

  // Set title from first message
  if (currentChat.messages.length === 0) {
    currentChat.title = text.slice(0, 40) + (text.length > 40 ? "…" : "");
    document.querySelector(".topbar-title").textContent = currentChat.title;
  }

  history.push({ role: "user", content: text });
  currentChat.messages.push({ role: "user", content: text });
  appendUserBubble(text);

  // AI bubble
  const { row, content } = appendAIBubble("");
  const cursor = document.createElement("span");
  cursor.className = "cursor";
  content.appendChild(cursor);

  document.getElementById("topbar-status").textContent = "Thinking…";

  try {
    // Include uploaded files and learned facts in the request
    const requestData = { messages: history };
    if (uploadedFiles.length > 0) {
      requestData.files = uploadedFiles;
    }
    
    // Add learned facts for personalization
    if (currentUser) {
      const learnedFacts = await getLearnedFacts();
      if (learnedFacts.length > 0) {
        requestData.learned_facts = learnedFacts;
      }
    }

    const resp = await fetch(API + "/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestData),
    });

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const lines = decoder.decode(value).split("\n");
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const raw = line.slice(5).trim();
        if (raw === "[DONE]") break;
        try {
          const chunk = JSON.parse(raw);
          if (chunk.text) {
            fullText += chunk.text;
            cursor.remove();
            content.innerHTML = formatText(fullText);
            content.appendChild(cursor);
            scrollToBottom();
          }
          if (chunk.image) {
            // Image generation detected
            cursor.remove();
            const imageHtml = `
              <div style="margin-top: 12px;">
                <img src="${chunk.image}" alt="Generated image" style="max-width: 100%; border-radius: 8px; border: 1px solid var(--border);" />
                <div style="margin-top: 8px; font-size: 12px; color: var(--text-dim);">Generated: ${escapeHtml(chunk.prompt || 'image')}</div>
              </div>`;
            content.innerHTML = formatText(fullText) + imageHtml;
            scrollToBottom();
            // Store message with image data
            const imageMessage = {
              role: "assistant",
              content: fullText || "Here's your generated image:",
              image: chunk.image,
              imagePrompt: chunk.prompt
            };
            history.push(imageMessage);
            currentChat.messages.push(imageMessage);
            document.getElementById("topbar-status").textContent = "Image ready";
            if (currentUser) {
              await saveChatToDatabase();
            }
            isStreaming = false;
            document.getElementById("send-btn").disabled = false;
            input.focus();
            return; // Exit early since we've handled the complete message
          }
        } catch (_) {}
      }
    }

    cursor.remove();
    history.push({ role: "assistant", content: fullText });
    currentChat.messages.push({ role: "assistant", content: fullText });
    document.getElementById("topbar-status").textContent = "Model ready";
    
    // Extract and learn facts from the conversation
    if (currentUser) {
      await extractAndLearnFacts(text, fullText);
      await saveChatToDatabase();
    }

  } catch (err) {
    cursor.remove();
    content.textContent = "Error: " + err.message;
    document.getElementById("topbar-status").textContent = "Error";
  }

  isStreaming = false;
  document.getElementById("send-btn").disabled = false;
  input.focus();
}

// ── Image Generation ──────────────────────────────────────────────────────
async function generateImage() {
  const text = input.value.trim();
  if (!text) {
    showToast("Enter a prompt to generate an image");
    return;
  }

  // Hide welcome
  const welcome = document.getElementById("welcome");
  if (welcome) welcome.remove();

  input.value = "";
  input.style.height = "auto";
  isStreaming = true;
  document.getElementById("send-btn").disabled = true;
  document.getElementById("image-btn").disabled = true;

  // Add user message
  const userText = `Generate image: ${text}`;
  history.push({ role: "user", content: userText });
  currentChat.messages.push({ role: "user", content: userText });
  appendUserBubble(userText);

  // AI bubble with loading indicator
  const { row, content } = appendAIBubble("Generating image...");
  document.getElementById("topbar-status").textContent = "Generating image...";

  try {
    const response = await fetch("/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: text, width: 1024, height: 1024 }),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    // Display the generated image with download button
    content.innerHTML = formatText("Here's your generated image:") + `
      <div style="margin-top: 12px;">
        <img src="${data.image_data}" alt="Generated image" style="max-width: 100%; border-radius: 8px; border: 1px solid var(--border);" />
        <div style="margin-top: 8px; font-size: 12px; color: var(--text-dim);">Prompt: ${escapeHtml(data.prompt)}</div>
        <button class="download-btn" onclick="downloadImage('${data.image_data}', '${data.prompt.replace(/[^a-z0-9]/gi, '_').substring(0, 50)}.png')" title="Download image">💾 Download Image</button>
      </div>`;

    const imageMessage = {
      role: "assistant",
      content: "Here's your generated image:",
      image: data.image_data,
      imagePrompt: data.prompt
    };
    history.push(imageMessage);
    currentChat.messages.push(imageMessage);
    document.getElementById("topbar-status").textContent = "Image ready";

    if (currentUser) {
      await saveChatToDatabase();
    }

  } catch (err) {
    content.textContent = "Error generating image: " + err.message;
    document.getElementById("topbar-status").textContent = "Error";
  }

  isStreaming = false;
  document.getElementById("send-btn").disabled = false;
  document.getElementById("image-btn").disabled = false;
  input.focus();
}

// ── DOM helpers ───────────────────────────────────────────────────────────
function appendUserBubble(text) {
  const msgs = document.getElementById("messages");
  const row = document.createElement("div");
  row.className = "message-row user";
  const isSearch = text.startsWith('Search: ');
  const displayText = isSearch ? text : text;
  row.innerHTML = `<div class="bubble">${escapeHtml(displayText)}<button class="edit-btn" onclick="editMessage(this, '${displayText.replace(/'/g, "\\'")}')">Edit</button><button style="position:absolute;top:-8px;right:16px;width:20px;height:20px;border-radius:50%;background:var(--surface);border:1px solid var(--border);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--text-muted);opacity:0;transition:all 0.15s;padding:0;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0'" onclick="downloadText('${displayText.replace(/'/g, "\\'")}', 'message.txt')" title="Download">💾</button></div>`;
  msgs.appendChild(row);
  scrollToBottom();
  return row;
}

function appendAIBubble(text, imageData = null, imagePrompt = null) {
  const msgs = document.getElementById("messages");
  const row = document.createElement("div");
  row.className = "ai-row";
  row.innerHTML = `
    <div class="ai-avatar">HP</div>
    <div class="ai-content">
      <div class="ai-name">Hyperpixel</div>
      <div class="ai-text">${formatText(text)}</div>
      ${imageData ? `
      <div style="margin-top: 12px;">
        <img src="${imageData}" alt="Generated image" style="max-width: 100%; border-radius: 8px; border: 1px solid var(--border);" />
        <div style="margin-top: 8px; font-size: 12px; color: var(--text-dim);">Generated: ${escapeHtml(imagePrompt || 'image')}</div>
        <button class="download-btn" onclick="downloadImage('${imageData}', '${(imagePrompt || 'image').replace(/[^a-z0-9]/gi, '_').substring(0, 50)}.png')" title="Download image">💾 Download Image</button>
      </div>` : ''}
    </div>`;
  msgs.appendChild(row);
  scrollToBottom();
  return { row, content: row.querySelector(".ai-text") };
}

// ── Download helpers ───────────────────────────────────────────────────────
function downloadText(text, filename) {
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadImage(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function downloadFile(content, filename, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatText(text) {
  // Code blocks (must be first to avoid conflicts)
  text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
    `<pre><code>${escapeHtml(code.trim())}</code></pre>`);
  
  // Headers
  text = text.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  text = text.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  text = text.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  
  // Blockquotes
  text = text.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');
  
  // Unordered lists
  text = text.replace(/^\* (.*$)/gim, '<li>$1</li>');
  text = text.replace(/^- (.*$)/gim, '<li>$1</li>');
  
  // Ordered lists
  text = text.replace(/^\d+\. (.*$)/gim, '<li>$1</li>');
  
  // Wrap consecutive list items in ul tags
  text = text.replace(/(<li>.*<\/li>\n?)+/g, (match) => {
    return `<ul>${match}</ul>`;
  });
  
  // Links
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  
  // Inline code
  text = text.replace(/`([^`]+)`/g, (_, c) => `<code>${escapeHtml(c)}</code>`);
  
  // Bold
  text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  
  // Italic
  text = text.replace(/\*(.*?)\*/g, "<em>$1</em>");
  text = text.replace(/_(.*?)_/g, "<em>$1</em>");
  
  // Horizontal rules
  text = text.replace(/^---$/gim, '<hr>');
  
  // Newlines (but not inside pre/code blocks)
  text = text.replace(/\n/g, "<br/>");
  
  return text;
}

function escapeHtml(t) {
  return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function scrollToBottom() {
  const msgs = document.getElementById("messages");
  msgs.scrollTop = msgs.scrollHeight;
}
