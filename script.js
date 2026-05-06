let ws;
let username;
let userColor;
let replyingTo = null;
let isTabActive = true;

let typingUsers = {};
let typingTimers = {};

const GIPHY_API_KEY = "YOUR_GIPHY_API_KEY";

const emojis = [
  "😀", "😂", "😍", "😭", "😎",
  "😡", "👍", "🙏", "🔥", "🎉",
  "💖", "🥳", "😊", "😅", "🙌",
  "🥺", "✨", "🤍", "😴", "😇"
];

document.addEventListener("visibilitychange", () => {
  isTabActive = !document.hidden;
  if (isTabActive) {
    document.title = "Simple Web Chat";
  }
});

window.addEventListener("focus", () => {
  isTabActive = true;
  document.title = "Simple Web Chat";
});

function enterChat() {
  username = document.getElementById("username").value.trim();
  userColor = document.getElementById("color").value;

  if (!username) return alert("Enter a username!");

  document.getElementById("login").style.display = "none";
  document.getElementById("chat").style.display = "block";

  buildEmojiPicker();

  ws = new WebSocket("wss://simple-chat-backend-1rop.onrender.com");

  ws.onmessage = event => {
    let data;

    try {
      data = JSON.parse(event.data);
    } catch {
      return;
    }

    if (data.type === "typing") {
      if (data.username !== username) {
        showTyping(data.username);
      }
      return;
    }

    if (data.type === "message") {
      addMessage(data);
      notifyIfNeeded(data);
      return;
    }

    if (data.type === "image") {
      addImage(data);
      notifyIfNeeded(data);
      return;
    }

    if (data.type === "gif") {
      addGif(data);
      notifyIfNeeded(data);
    }
  };
}

function notifyIfNeeded(data) {
  if (!isTabActive && data.username !== username) {
    document.title = "(New Message) Simple Web Chat";
  }
}

document.getElementById("messageInput").addEventListener("keydown", e => {
  if (e.key === "Enter") {
    sendMessage();
  }
});

document.getElementById("sendButton").addEventListener("click", () => {
  sendMessage();
});

document.getElementById("messageInput").addEventListener("input", () => {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  const currentText = document.getElementById("messageInput").value.trim();
  if (!currentText) return;

  ws.send(JSON.stringify({
    type: "typing",
    username
  }));
});

document.getElementById("imageUpload").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file || !ws || ws.readyState !== WebSocket.OPEN) return;

  const reader = new FileReader();

  reader.onload = () => {
    ws.send(JSON.stringify({
      type: "image",
      username,
      color: userColor,
      image: reader.result,
      reply: replyingTo
    }));

    clearReply();
    e.target.value = "";
  };

  reader.readAsDataURL(file);
});

function sendMessage() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  const input = document.getElementById("messageInput");
  const text = input.value.trim();

  if (!text) return;

  ws.send(JSON.stringify({
    type: "message",
    username,
    color: userColor,
    text,
    reply: replyingTo
  }));

  input.value = "";
  clearReply();
  input.focus();
}

function addMessage(data) {
  const messages = document.getElementById("messages");

  const wrapper = document.createElement("div");
  wrapper.className = `message ${data.username === username ? "mine" : "theirs"}`;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.style.borderColor = data.color || "#0066ff";

  if (data.reply) {
    const reply = document.createElement("div");
    reply.className = "reply";
    reply.textContent = `Replying to: ${data.reply}`;
    bubble.appendChild(reply);
  }

  const name = document.createElement("strong");
  name.textContent = data.username;
  name.style.color = data.color || "#0066ff";

  const text = document.createElement("div");
  text.textContent = data.text;

  const replyBtn = document.createElement("button");
  replyBtn.type = "button";
  replyBtn.className = "replyButton";
  replyBtn.textContent = "Reply";
  replyBtn.onclick = () => setReply(data.text);

  bubble.appendChild(name);
  bubble.appendChild(text);
  bubble.appendChild(replyBtn);

  wrapper.appendChild(bubble);
  messages.appendChild(wrapper);
  messages.scrollTop = messages.scrollHeight;
}

function addImage(data) {
  const messages = document.getElementById("messages");

  const wrapper = document.createElement("div");
  wrapper.className = `message ${data.username === username ? "mine" : "theirs"}`;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.style.borderColor = data.color || "#0066ff";

  if (data.reply) {
    const reply = document.createElement("div");
    reply.className = "reply";
    reply.textContent = `Replying to: ${data.reply}`;
    bubble.appendChild(reply);
  }

  const name = document.createElement("strong");
  name.textContent = data.username;
  name.style.color = data.color || "#0066ff";

  const img = document.createElement("img");
  img.src = data.image;
  img.alt = "uploaded image";
  img.className = "chatImage";

  const replyBtn = document.createElement("button");
  replyBtn.type = "button";
  replyBtn.className = "replyButton";
  replyBtn.textContent = "Reply";
  replyBtn.onclick = () => setReply("[image]");

  bubble.appendChild(name);
  bubble.appendChild(img);
  bubble.appendChild(replyBtn);

  wrapper.appendChild(bubble);
  messages.appendChild(wrapper);
  messages.scrollTop = messages.scrollHeight;
}

function addGif(data) {
  const messages = document.getElementById("messages");

  const wrapper = document.createElement("div");
  wrapper.className = `message ${data.username === username ? "mine" : "theirs"}`;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.style.borderColor = data.color || "#0066ff";

  if (data.reply) {
    const reply = document.createElement("div");
    reply.className = "reply";
    reply.textContent = `Replying to: ${data.reply}`;
    bubble.appendChild(reply);
  }

  const name = document.createElement("strong");
  name.textContent = data.username;
  name.style.color = data.color || "#0066ff";

  const img = document.createElement("img");
  img.src = data.gif;
  img.alt = "gif";
  img.className = "chatImage";

  const replyBtn = document.createElement("button");
  replyBtn.type = "button";
  replyBtn.className = "replyButton";
  replyBtn.textContent = "Reply";
  replyBtn.onclick = () => setReply("[gif]");

  bubble.appendChild(name);
  bubble.appendChild(img);
  bubble.appendChild(replyBtn);

  wrapper.appendChild(bubble);
  messages.appendChild(wrapper);
  messages.scrollTop = messages.scrollHeight;
}

function setReply(text) {
  replyingTo = text;
  document.getElementById("replyText").textContent = `Replying to: ${text}`;
  document.getElementById("replyBar").style.display = "flex";
}

function clearReply() {
  replyingTo = null;
  document.getElementById("replyText").textContent = "";
  document.getElementById("replyBar").style.display = "none";
}

function triggerImageUpload() {
  document.getElementById("imageUpload").click();
}

function buildEmojiPicker() {
  const picker = document.getElementById("emojiPicker");
  if (picker.dataset.built === "true") return;

  picker.innerHTML = "";
  emojis.forEach(emoji => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "emojiButton";
    btn.textContent = emoji;
    btn.onclick = () => {
      const input = document.getElementById("messageInput");
      input.value += emoji;
      input.focus();
    };
    picker.appendChild(btn);
  });

  picker.dataset.built = "true";
}

function toggleEmojiPicker() {
  const picker = document.getElementById("emojiPicker");
  const gifPicker = document.getElementById("gifPicker");

  gifPicker.style.display = "none";
  picker.style.display = picker.style.display === "none" ? "grid" : "none";
}

function toggleGifPicker() {
  const picker = document.getElementById("gifPicker");
  const emojiPicker = document.getElementById("emojiPicker");

  emojiPicker.style.display = "none";
  picker.style.display = picker.style.display === "none" ? "block" : "none";

  if (picker.style.display === "block" && !picker.dataset.loaded) {
    searchGifs(true);
  }
}

async function searchGifs(isInitialLoad = false) {
  const results = document.getElementById("gifResults");
  const query = document.getElementById("gifSearch").value.trim();

  if (!GIPHY_API_KEY || GIPHY_API_KEY === "YOUR_GIPHY_API_KEY") {
    results.innerHTML = "<div class='pickerHint'>Add your GIPHY API key in script.js.</div>";
    return;
  }

  const endpoint = query
    ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=12&rating=g`
    : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=12&rating=g`;

  results.innerHTML = "<div class='pickerHint'>Loading...</div>";

  try {
    const res = await fetch(endpoint);
    const json = await res.json();

    results.innerHTML = "";

    json.data.forEach(gif => {
      const img = document.createElement("img");
      img.src = gif.images.fixed_height_small.url;
      img.alt = "gif";
      img.className = "gifThumb";
      img.onclick = () => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;

        ws.send(JSON.stringify({
          type: "gif",
          username,
          color: userColor,
          gif: gif.images.fixed_height.url,
          reply: replyingTo
        }));

        clearReply();
      };

      results.appendChild(img);
    });

    if (isInitialLoad) {
      document.getElementById("gifPicker").dataset.loaded = "true";
    }
  } catch {
    results.innerHTML = "<div class='pickerHint'>Could not load GIFs.</div>";
  }
}

document.getElementById("gifSearch").addEventListener("keydown", e => {
  if (e.key === "Enter") {
    searchGifs();
  }
});

let typingUsersList = {};
let typingTimersList = {};

function showTyping(user) {
  typingUsersList[user] = true;

  clearTimeout(typingTimersList[user]);
  typingTimersList[user] = setTimeout(() => {
    delete typingUsersList[user];
    updateTypingDisplay();
  }, 2000);

  updateTypingDisplay();
}

function updateTypingDisplay() {
  const typingDiv = document.getElementById("typing");
  const users = Object.keys(typingUsersList);

  if (users.length === 0) {
    typingDiv.textContent = "";
    return;
  }

  if (users.length === 1) {
    typingDiv.textContent = `${users[0]} is typing...`;
    return;
  }

  typingDiv.textContent = `${users.join(", ")} are typing...`;
}
