let ws;
let username;
let userColor;
let replyingTo = null;

const GIPHY_API_KEY = "vGT7vYYyy7T9iynVwVU3AIJ4rr4V6Phg";

/* ---------------- DATA ---------------- */

const emojis = [
  "😀","😂","😍","😭","😎","🔥","👍","🙏","🎉","💖"
];

const emoticons = [
  "¯\\_(ツ)_/¯",
  "(╯°□°）╯︵ ┻━┻",
  "┬─┬ ノ( ゜-゜ノ)",
  "( ͡° ͜ʖ ͡°)",
  "(•_•)",
  "(⌐■_■)",
  "(ಥ﹏ಥ)",
  "(¬_¬)",
  "(✿◠‿◠)",
  "(ノಠ益ಠ)ノ彡┻━┻"
];

const reactionImages = [
  { id: "iguess", url: "images/befr.jpg" },
  { id: "eagle", url: "images/eagle.jpg" },
  { id: "gasp", url: "images/gasp.jpg" },
  { id: "imcrine", url: "images/imcrine.jpg" },
  { id: "reallybru", url: "images/reallybru.jpg" },
  { id: "whyutryingnottolaugh", url: "images/whyutryingnottolaugh.jpg" }
];

/* ---------------- LOGIN ---------------- */

function enterChat() {
  username = document.getElementById("username").value.trim();
  userColor = document.getElementById("color").value;

  if (!username) return alert("Enter username");

  document.getElementById("login").classList.add("hidden");
  document.getElementById("chat").classList.remove("hidden");

  buildSidePanel();
  setupEventListeners();

  ws = new WebSocket("wss://simple-chat-backend-1rop.onrender.com");

  ws.onmessage = e => {
    const data = JSON.parse(e.data);

    if (data.type === "message") addMessage(data);
    if (data.type === "image") addImage(data);
    if (data.type === "gif") addGif(data);
  };
}

/* ---------------- EVENT LISTENERS ---------------- */

function setupEventListeners() {
  // Message input - Enter to send
  const messageInput = document.getElementById("messageInput");
  messageInput.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault(); // Prevent any default behavior
      sendMessage();
    }
  });

  // GIF search - Enter to search
  const gifSearch = document.getElementById("gifSearch");
  gifSearch.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      searchGifs();
    }
  });

  // Send button click
  document.getElementById("sendButton").onclick = sendMessage;
}

/* ---------------- SIDE PANEL ---------------- */

function buildSidePanel() {
  const emojiBox = document.getElementById("emojiList");
  const emoBox = document.getElementById("emoticonList");
  const reactionBox = document.getElementById("reactionList");

  emojiBox.innerHTML = "";
  emoBox.innerHTML = "";
  reactionBox.innerHTML = "";

  emojis.forEach(e => {
    const b = document.createElement("button");
    b.textContent = e;
    b.onclick = () => insertText(e);
    emojiBox.appendChild(b);
  });

  emoticons.forEach(e => {
    const b = document.createElement("button");
    b.textContent = e;
    b.onclick = () => insertText(e);
    emoBox.appendChild(b);
  });

  reactionImages.forEach(r => {
    const b = document.createElement("button");
    b.textContent = r.id;

    b.onclick = () => {
      ws.send(JSON.stringify({
        type: "image",
        username,
        image: r.url
      }));
    };

    reactionBox.appendChild(b);
  });
}

function insertText(text) {
  const input = document.getElementById("messageInput");
  input.value += text;
  input.focus();
}

/* ---------------- SEND MESSAGE ---------------- */

function sendMessage() {
  const input = document.getElementById("messageInput");
  if (!input.value.trim()) return;

  ws.send(JSON.stringify({
    type: "message",
    username,
    color: userColor,
    text: input.value,
    reply: replyingTo
  }));

  input.value = "";
  clearReply();
}

/* ---------------- MESSAGES ---------------- */

function addMessage(d) {
  const el = document.createElement("div");
  el.className = "message " + (d.username === username ? "mine" : "theirs");

  el.innerHTML = `
    <div class="bubble">
      <strong style="color:${d.color}">${d.username}</strong>
      ${d.reply ? `<div class="reply">${d.reply}</div>` : ""}
      <div>${d.text}</div>
    </div>
  `;

  document.getElementById("messages").appendChild(el);
  scrollToBottom();
}

/* ---------------- IMAGE UPLOAD ---------------- */

function triggerImageUpload() {
  document.getElementById("imageUpload").click();
}

document.getElementById("imageUpload").onchange = e => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    ws.send(JSON.stringify({
      type: "image",
      username,
      image: reader.result
    }));
  };

  reader.readAsDataURL(file);
};

function addImage(d) {
  const el = document.createElement("div");
  el.className = "message " + (d.username === username ? "mine" : "theirs");

  el.innerHTML = `
    <div class="bubble">
      <strong>${d.username}</strong>
      <img class="chatImage" src="${d.image}">
    </div>
  `;

  document.getElementById("messages").appendChild(el);
  scrollToBottom();
}

/* ---------------- GIF (FIXED) ---------------- */

async function searchGifs() {
  const query = document.getElementById("gifSearch").value.trim();

  const url = query
    ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=9`
    : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=9`;

  try {
    const res = await fetch(url);
    const json = await res.json();

    const box = document.getElementById("gifResults");
    box.innerHTML = "";

    if (!json.data || json.data.length === 0) {
      box.innerHTML = "<p style='color: #ff99ff; padding: 10px;'>No GIFs found</p>";
      return;
    }

    json.data.forEach(gif => {
      const img = document.createElement("img");
      img.src = gif.images.fixed_height_small.url;
      img.className = "gifThumb";

      img.onclick = () => {
        ws.send(JSON.stringify({
          type: "gif",
          username,
          gif: gif.images.fixed_height.url
        }));

        document.getElementById("gifPicker").classList.add("hidden");
        document.getElementById("gifSearch").value = ""; // Clear search
      };

      box.appendChild(img);
    });
  } catch (error) {
    console.error("Error fetching GIFs:", error);
    const box = document.getElementById("gifResults");
    box.innerHTML = "<p style='color: #ff99ff; padding: 10px;'>Error loading GIFs</p>";
  }
}

function toggleGifPicker() {
  const el = document.getElementById("gifPicker");
  el.classList.toggle("hidden");

  if (!el.classList.contains("hidden")) {
    // Load trending GIFs when opening
    document.getElementById("gifSearch").value = "";
    searchGifs();
  }
}

function addGif(d) {
  const el = document.createElement("div");
  el.className = "message " + (d.username === username ? "mine" : "theirs");

  el.innerHTML = `
    <div class="bubble">
      <strong>${d.username}</strong>
      <img class="chatImage" src="${d.gif}" style="width: 200px; height: auto;">
    </div>
  `;

  document.getElementById("messages").appendChild(el);
  scrollToBottom();
}

/* ---------------- REPLY ---------------- */

function clearReply() {
  replyingTo = null;
  const replyBar = document.getElementById("replyBar");
  if (replyBar) {
    replyBar.classList.add("hidden");
  }
}

/* ---------------- UTILITY ---------------- */

function scrollToBottom() {
  const messages = document.getElementById("messages");
  messages.scrollTop = messages.scrollHeight;
}
