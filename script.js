let ws;
let username;
let userColor;
let replyingTo = null;
let isTabActive = true;

const GIPHY_API_KEY = "YOUR_GIPHY_API_KEY";

/* ---------------- OLD SCHOOL DATA ---------------- */

const emojis = ["😀","😂","😍","😭","😎","🔥","👍","🙏","🎉","💖"];

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

/* ---------------- INIT ---------------- */

function enterChat() {
  username = document.getElementById("username").value.trim();
  userColor = document.getElementById("color").value;

  if (!username) return alert("Enter username");

  document.getElementById("login").style.display = "none";
  document.getElementById("chat").style.display = "flex";

  buildSidePanel();

  ws = new WebSocket("wss://simple-chat-backend-1rop.onrender.com");

  ws.onmessage = e => {
    const data = JSON.parse(e.data);

    if (data.type === "message") addMessage(data);
    if (data.type === "image") addImage(data);
    if (data.type === "gif") addGif(data);

    if (data.type === "typing" && data.username !== username) {
      showTyping(data.username);
    }
  };
}

/* ---------------- SIDE PANEL (EMOJIS ALWAYS VISIBLE) ---------------- */

function buildSidePanel() {
  const emojiBox = document.getElementById("emojiList");
  const emoBox = document.getElementById("emoticonList");

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
}

function insertText(text) {
  const input = document.getElementById("messageInput");
  input.value += text;
  input.focus();
}

/* ---------------- SEND MESSAGE ---------------- */

document.getElementById("sendButton").onclick = send;

function send() {
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

/* ---------------- INPUT TYPING ---------------- */

document.getElementById("messageInput").addEventListener("input", () => {
  ws.send(JSON.stringify({
    type: "typing",
    username
  }));
});

/* ---------------- MESSAGES ---------------- */

function addMessage(d) {
  const el = document.createElement("div");
  el.className = "message " + (d.username === username ? "mine" : "theirs");

  el.innerHTML = `
    <div class="bubble">
      <strong style="color:${d.color}">${d.username}</strong>
      ${d.reply ? `<div>${d.reply}</div>` : ""}
      <div>${d.text}</div>
    </div>
  `;

  document.getElementById("messages").appendChild(el);
}

/* ---------------- IMAGE ---------------- */

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
}

/* ---------------- GIF ---------------- */

async function searchGifs() {
  const res = await fetch(
    `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=9`
  );

  const json = await res.json();
  const box = document.getElementById("gifResults");

  box.innerHTML = "";

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
    };

    box.appendChild(img);
  });
}

/* ---------------- GIF TOGGLE ---------------- */

function toggleGifPicker() {
  document.getElementById("gifPicker").classList.toggle("hidden");
}

/* ---------------- REPLY ---------------- */

function clearReply() {
  replyingTo = null;
}

/* ---------------- TYPING ---------------- */

let typingUsers = {};
let typingTimers = {};

function showTyping(user) {
  typingUsers[user] = true;

  clearTimeout(typingTimers[user]);
  typingTimers[user] = setTimeout(() => {
    delete typingUsers[user];
    updateTyping();
  }, 2000);

  updateTyping();
}

function updateTyping() {
  const div = document.getElementById("typing");
  const users = Object.keys(typingUsers);

  div.textContent =
    users.length === 0
      ? ""
      : users.length === 1
      ? `${users[0]} is typing...`
      : `${users.join(", ")} are typing...`;
}
