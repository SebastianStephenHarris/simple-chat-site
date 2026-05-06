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
  { id: "reactionimage1", url: "images/reaction1.png" },
  { id: "reactionimage2", url: "images/reaction2.png" },
  { id: "reactionimage3", url: "images/reaction3.png" }
];

/* ---------------- LOGIN ---------------- */

function enterChat() {
  username = document.getElementById("username").value.trim();
  userColor = document.getElementById("color").value;

  if (!username) return alert("Enter username");

  document.getElementById("login").classList.add("hidden");
  document.getElementById("chat").classList.remove("hidden");

  buildSidePanel();

  ws = new WebSocket("wss://simple-chat-backend-1rop.onrender.com");

  ws.onmessage = e => {
    const data = JSON.parse(e.data);

    if (data.type === "message") addMessage(data);
    if (data.type === "image") addImage(data);
    if (data.type === "gif") addGif(data);
  };
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

document.getElementById("sendButton").onclick = sendMessage;

document.getElementById("messageInput").addEventListener("keydown", e => {
  if (e.key === "Enter") sendMessage();
});

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
}

/* ---------------- GIF (FIXED) ---------------- */

async function searchGifs() {
  const query = document.getElementById("gifSearch").value.trim();

  const url = query
    ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=9`
    : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=9`;

  const res = await fetch(url);
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

      document.getElementById("gifPicker").classList.add("hidden");
    };

    box.appendChild(img);
  });
}

function toggleGifPicker() {
  const el = document.getElementById("gifPicker");
  el.classList.toggle("hidden");

  if (!el.classList.contains("hidden")) {
    searchGifs();
  }
}

/* ---------------- REPLY ---------------- */

function clearReply() {
  replyingTo = null;
}
