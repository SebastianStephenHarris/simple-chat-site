let ws;
let username;
let userColor;
let replyingTo = null;
let isTabActive = true;

const GIPHY_API_KEY = "YOUR_GIPHY_API_KEY";

/* ---------------- REAL OLD-SCHOOL EMOTICONS ---------------- */
const emojis = [
  "😀","😂","😍","😭","😎","🔥","👍","🙏","🎉","💖"
];

const emoticons = [
  "¯\\_(ツ)_/¯",
  "(╯°□°）╯︵ ┻━┻",
  "┬─┬ ノ( ゜-゜ノ)",
  "( ͡° ͜ʖ ͡°)",
  "(•_•)",
  "(•_•)>⌐■-■",
  "(⌐■_■)",
  "(ಥ﹏ಥ)",
  "(ʘ‿ʘ)",
  "(ง'̀-'́)ง",
  "(╥﹏╥)",
  "(¬_¬)",
  "(✿◠‿◠)",
  "(◕‿◕)",
  "(☞ﾟヮﾟ)☞",
  "☜(ﾟヮﾟ☜)",
  "(ノಠ益ಠ)ノ彡┻━┻",
  "(づ｡◕‿‿◕｡)づ"
];

/* ---------------- TAB NOTIFICATIONS ---------------- */

document.addEventListener("visibilitychange", () => {
  isTabActive = !document.hidden;
  if (isTabActive) document.title = "Simple Web Chat";
});

/* ---------------- ENTER CHAT ---------------- */

function enterChat() {
  username = document.getElementById("username").value.trim();
  userColor = document.getElementById("color").value;

  if (!username) return alert("Enter username");

  document.getElementById("login").style.display = "none";
  document.getElementById("chat").style.display = "block";

  buildEmojiPopup();

  ws = new WebSocket("wss://simple-chat-backend-1rop.onrender.com");

  ws.onmessage = event => {
    const data = JSON.parse(event.data);

    if (data.type === "message") {
      addMessage(data);
      notify(data);
    }

    if (data.type === "image") {
      addImage(data);
      notify(data);
    }

    if (data.type === "gif") {
      addGif(data);
      notify(data);
    }

    if (data.type === "typing" && data.username !== username) {
      showTyping(data.username);
    }
  };
}

/* ---------------- SEND MESSAGE ---------------- */

document.getElementById("messageInput").addEventListener("keydown", e => {
  if (e.key === "Enter") sendMessage();
});

document.getElementById("sendButton").onclick = sendMessage;

function sendMessage() {
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
}

/* ---------------- TYPING (FIXED, NO SPAM) ---------------- */

let typingTimeout;

document.getElementById("messageInput").addEventListener("input", () => {
  if (!ws) return;

  ws.send(JSON.stringify({
    type: "typing",
    username
  }));

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {}, 2000);
});

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

  if (users.length === 0) {
    div.textContent = "";
  } else if (users.length === 1) {
    div.textContent = `${users[0]} is typing...`;
  } else {
    div.textContent = `${users.join(", ")} are typing...`;
  }
}

/* ---------------- MESSAGES ---------------- */

function addMessage(data) {
  const el = document.createElement("div");
  el.className = "message " + (data.username === username ? "mine" : "theirs");

  el.innerHTML = `
    <div class="bubble">
      <strong style="color:${data.color}">${data.username}</strong>
      ${data.reply ? `<div class="reply">Reply: ${data.reply}</div>` : ""}
      <div>${data.text}</div>
      <button onclick="setReply('${data.text}')">Reply</button>
    </div>
  `;

  document.getElementById("messages").appendChild(el);
  scrollDown();
}

/* ---------------- IMAGES ---------------- */

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
      color: userColor,
      image: reader.result,
      reply: replyingTo
    }));
  };

  reader.readAsDataURL(file);
};

function addImage(data) {
  const el = document.createElement("div");
  el.className = "message " + (data.username === username ? "mine" : "theirs");

  el.innerHTML = `
    <div class="bubble">
      <strong>${data.username}</strong>
      <img class="chatImage" src="${data.image}">
      <button onclick="setReply('[image]')">Reply</button>
    </div>
  `;

  document.getElementById("messages").appendChild(el);
  scrollDown();
}

/* ---------------- GIFS ---------------- */

function addGif(data) {
  const el = document.createElement("div");
  el.className = "message " + (data.username === username ? "mine" : "theirs");

  el.innerHTML = `
    <div class="bubble">
      <strong>${data.username}</strong>
      <img class="gifThumb" src="${data.gif}">
      <button onclick="setReply('[gif]')">Reply</button>
    </div>
  `;

  document.getElementById("messages").appendChild(el);
  scrollDown();
}

/* ---------------- REPLY ---------------- */

function setReply(text) {
  replyingTo = text;
  document.getElementById("replyBar").style.display = "flex";
  document.getElementById("replyText").textContent = "Replying to: " + text;
}

function clearReply() {
  replyingTo = null;
  document.getElementById("replyBar").style.display = "none";
}

/* ---------------- EMOJI POPUP ---------------- */

function buildEmojiPopup() {
  const popup = document.getElementById("emojiPopup");
  if (popup.dataset.built) return;

  [...emojis, ...emoticons].forEach(e => {
    const btn = document.createElement("button");
    btn.textContent = e;

    btn.onclick = () => {
      document.getElementById("messageInput").value += e;
      popup.classList.add("hidden");
    };

    popup.appendChild(btn);
  });

  popup.dataset.built = "true";
}

function toggleEmojiPopup() {
  document.getElementById("emojiPopup").classList.toggle("hidden");
}

/* ---------------- GIF API ---------------- */

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

function toggleGifPicker() {
  document.getElementById("gifPicker").classList.toggle("hidden");
}

/* ---------------- UTIL ---------------- */

function scrollDown() {
  const m = document.getElementById("messages");
  m.scrollTop = m.scrollHeight;
}

function notify(data) {
  if (!isTabActive && data.username !== username) {
    document.title = "(New Message) Simple Web Chat";
  }
}
