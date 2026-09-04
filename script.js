/* ---------------- STATE ---------------- */

let ws;
let myClientId = null;
let username;
let userColor;
let replyingTo = null;

let fmtFont = "";
let fmtBold = false;
let fmtItalic = false;
let fmtUnderline = false;
let fmtColor = "";
let currentTheme = "default";

const FONTS = [
  { value: "", name: "System" },
  { value: "Arial, Helvetica, sans-serif", name: "Arial" },
  { value: "'Courier New', monospace", name: "Courier New" },
  { value: "Georgia, 'Times New Roman', serif", name: "Georgia" },
  { value: "'Comic Sans MS', 'Comic Sans', cursive", name: "Comic Sans" },
  { value: "Tahoma, 'MS Sans Serif', sans-serif", name: "Tahoma" },
  { value: "'Times New Roman', Times, serif", name: "Times New Roman" },
  { value: "'Trebuchet MS', sans-serif", name: "Trebuchet MS" },
  { value: "Verdana, Geneva, sans-serif", name: "Verdana" },
  { value: "Impact, 'Arial Black', sans-serif", name: "Impact" },
  { value: "'Lucida Console', Monaco, monospace", name: "Lucida Console" }
];

let missed = 0;
let isAtBottom = true;
const pendingSeen = new Set();
const myFooters = new Map();  // my message id -> .msgStatus element
const lastRead = new Map();   // seer username -> latest of my messages they've seen
const typingUsers = new Map();     // username -> timestamp of last "typing"
let statusHint = "";

let lastTypingSentAt = 0;
let typingIdleTimer = null;

const MAX_TEXT_LENGTH = 2000;

/* NOTE: GIPHY key is intentionally client-side for now (per owner). */
const GIPHY_API_KEY = "vGT7vYYyy7T9iynVwVU3AIJ4rr4V6Phg";

/* Override with window.WS_URL to force a specific backend. */
const DEFAULT_RENDER_URL = "wss://simple-chat-backend-1rop.onrender.com";
const DEFAULT_LOCAL_URL = "ws://localhost:3000";

function backendSetting() {
  if (window.WS_URL) return { mode: "override", url: window.WS_URL, label: "Custom" };

  const saved = STORE.get(STORE.backend);
  if (saved === "local") return { mode: "local", url: DEFAULT_LOCAL_URL, label: "Local" };
  if (saved === "render") return { mode: "render", url: DEFAULT_RENDER_URL, label: "Render" };
  if (saved && /^wss?:\/\//i.test(saved)) return { mode: "custom", url: saved, label: "Custom" };

  const onHttps = location.protocol === "https:";
  return {
    mode: "auto",
    url: onHttps ? DEFAULT_RENDER_URL : DEFAULT_LOCAL_URL,
    label: onHttps ? "Render (auto)" : "Local (auto)"
  };
}

const STORE = {
  name: "cc_username",
  color: "cc_color",
  theme: "cc_theme",
  backend: "cc_backend",
  notify: "cc_notify",
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} }
};

/* ---------------- THEMES ---------------- */

const THEMES = [
  { id: "default", name: "Neon Purple (default)" },
  { id: "retro", name: "Retro Terminal" },
  { id: "cyberpunk", name: "Cyberpunk" },
  { id: "midnight", name: "Midnight" },
  { id: "light", name: "Light" },
  { id: "forest", name: "Forest" },
  { id: "oldschool", name: "Old School Chatroom" }
];

function applyTheme(id) {
  if (id === "hacker") id = "oldschool"; // migrate old id
  currentTheme = id && id !== "default" ? id : "default";
  if (currentTheme !== "default") {
    document.body.setAttribute("data-theme", currentTheme);
  } else {
    document.body.removeAttribute("data-theme");
  }
  STORE.set(STORE.theme, id || "default");
}

function buildThemeSelect() {
  const select = document.getElementById("themeSelect");
  select.innerHTML = "";
  THEMES.forEach(t => {
    const o = document.createElement("option");
    o.value = t.id;
    o.textContent = t.name;
    select.appendChild(o);
  });
  select.value = STORE.get(STORE.theme) || "default";
  select.onchange = () => applyTheme(select.value);
}

/* ---------------- SERVER SELECT ---------------- */

function buildServerSelect() {
  const sel = document.getElementById("serverSelect");
  if (!sel) return;

  const opts = [
    ["auto", "Auto"],
    ["local", "Local (localhost:3000)"],
    ["render", "Render (deployed)"],
    ["custom", "Custom URL…"]
  ];

  sel.innerHTML = "";
  opts.forEach(([v, label]) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = label;
    sel.appendChild(o);
  });

  const current = backendSetting();
  sel.value = current.mode === "auto" || current.mode === "override" ? "auto" : current.mode;

  sel.onchange = () => {
    const v = sel.value;
    if (v === "custom") {
      const u = prompt(
        "WebSocket URL (ws:// or wss://).\nTip: for GitHub Pages you need wss:// from a tunnel like ngrok/cloudflared.",
        current.mode === "custom" ? current.url : ""
      );
      if (u && /^wss?:\/\//i.test(u.trim())) {
        STORE.set(STORE.backend, u.trim());
      } else {
        sel.value = current.mode === "auto" || current.mode === "override" ? "auto" : current.mode;
        return;
      }
    } else {
      STORE.set(STORE.backend, v);
    }
    location.reload();
  };
}

/* ---------------- EMOJI DATA ---------------- */

const EMOJI_CATS = [
  { cat: "Smileys", items: [
    ["😀","grin smile"],["😁","grin teeth"],["😂","joy laugh cries"],["🤣","rofl rolling floor"],["😊","blush smile"],
    ["😍","heart eyes love"],["🥰","smile hearts love"],["😉","wink"],["😎","cool sunglasses"],["🤩","star struck"],
    ["🥳","party celebrating"],["😢","crying tear sad"],["😭","loud crying sobbing"],["😅","sweat smile laugh"],
    ["🤗","hug"],["🤔","thinking hmm"],["🥺","pleading puppy"],["😴","sleeping"],["🤤","drooling"],
    ["😱","scream shocked"],["😳","flushed embarrassed"],["🙃","upside down silly"],["🤪","zany crazy"],
    ["😇","angel innocent"],["😤","angry steam"],["😡","pout mad"],["🤯","mind blown"],["😜","wink tongue"],
    ["🤨","raised eyebrow suspicious"],["🙄","rolling eyes"],["😏","smirk"],["😷","mask sick"],
    ["🤒","thermometer sick"],["🤢","nauseated"],["🤮","vomit"],["🥶","cold freezing"],["🥵","hot sweating"],
    ["😬","grimace awkward"],["😈","smiling devil"],["👻","ghost boo"],["💀","skull dead"],["👽","alien"],
    ["😺","cat smile"],["🙈","see no evil"],["🙉","hear no evil"],["🙊","speak no evil"],["🤝","handshake deal"],
    ["👋","wave hello bye"],["👍","thumbs up yes"],["👎","thumbs down no"],["👌","ok perfect"],
    ["✌️","victory peace"],["🤞","fingers crossed luck"],["👊","punch fist"],["✊","raised fist power"],
    ["🙏","pray thank please"],["👏","clap applause"],["💪","muscle strong"],["👀","eyes look"],
    ["👉","point right"],["👈","point left"],["🖕","middle finger"],["🫡","salute goodbye"]
  ]},
  { cat: "Hearts", items: [
    ["❤️","red heart love"],["🧡","orange heart"],["💛","yellow heart"],["💚","green heart"],["💙","blue heart"],
    ["💜","purple heart"],["🖤","black heart"],["🤍","white heart"],["🤎","brown heart"],
    ["💖","sparkling heart"],["💗","growing heart"],["💓","beating heart"],["💞","revolving hearts"],
    ["💕","two hearts"],["💘","cupid heart arrow"],["💝","heart with ribbon gift"],["💟","heart decoration"],
    ["🫀","heart organ anatomical"],["😻","heart eyes cat"],["💌","love letter"],["💯","hundred perfect"],
    ["💥","collision boom"],["✨","sparkles"],["⭐","star"],["🌟","glowing star"],["⚡","lightning zap"],
    ["🔥","fire hot"],["💫","dizzy"]
  ]},
  { cat: "Animals", items: [
    ["🐶","dog"],["🐱","cat"],["🐭","mouse"],["🐹","hamster"],["🐰","rabbit"],["🦊","fox"],
    ["🐻","bear"],["🐼","panda"],["🐨","koala"],["🐯","tiger"],["🦁","lion"],["🐮","cow"],
    ["🐷","pig"],["🐸","frog"],["🐵","monkey"],["🐔","chicken"],["🐧","penguin"],["🐦","bird"],
    ["🐤","chick"],["🦄","unicorn"],["🐝","bee honey"],["🦋","butterfly"],["🐢","turtle"],
    ["🐍","snake"],["🦖","t rex dinosaur"],["🦕","sauropod"],["🐙","octopus"],["🦑","squid"],
    ["🦀","crab"],["🐳","whale"],["🐬","dolphin"],["🐟","fish"],["🦈","shark"],["🐊","crocodile"],
    ["🦅","eagle"],["🦇","bat"],["🐺","wolf"],["🦓","zebra"],["🐴","horse"],["🐑","sheep"],
    ["🦒","giraffe"],["🐘","elephant"],["🦛","hippo"],["🐪","camel"],["🕷️","spider"],["🦦","otter"]
  ]},
  { cat: "Food & Drink", items: [
    ["🍏","green apple"],["🍎","red apple"],["🍌","banana"],["🍇","grapes"],["🍉","watermelon"],
    ["🍊","orange"],["🍋","lemon"],["🍓","strawberry"],["🫐","blueberries"],["🍒","cherries"],
    ["🍑","peach"],["🥭","mango"],["🍍","pineapple"],["🥝","kiwi"],["🍕","pizza"],["🍔","burger hamburger"],
    ["🍟","fries"],["🌭","hot dog"],["🥓","bacon"],["🥐","croissant"],["🍞","bread"],["🧀","cheese"],
    ["🥚","egg"],["🍳","cooking"],["🥞","pancakes"],["🧇","waffle"],["🍩","donut"],["🍪","cookie"],
    ["🎂","birthday cake"],["🍰","shortcake"],["🧁","cupcake"],["🍫","chocolate"],["🍬","candy"],
    ["🍭","lollipop"],["🍦","ice cream"],["🍧","shaved ice"],["☕","coffee"],["🍵","tea"],
    ["🥤","soda"],["🧋","boba"],["🍺","beer"],["🥂","cheers clink"],["🍹","cocktail"],["🍷","wine"]
  ]},
  { cat: "Activities", items: [
    ["⚽","soccer football"],["🏀","basketball"],["🏈","american football"],["⚾","baseball"],
    ["🏐","volleyball"],["🎾","tennis"],["🏓","table tennis ping pong"],["🥊","boxing punch"],
    ["🥋","martial arts karate"],["🎮","video game controller"],["🎲","dice"],["🎯","dart target"],
    ["♟️","chess"],["🎳","bowling"],["🎤","mic sing karaoke"],["🎧","headphones music"],
    ["🎵","music note"],["🎶","music notes"],["🎹","keyboard piano"],["🎸","guitar"],["🥁","drum"],
    ["🎻","violin"],["🎺","trumpet"],["🎨","art palette"],["🎭","theater masks"],["🎬","movie clapper"],
    ["📸","camera flash"],["🥇","gold medal"],["🥈","silver medal"],["🥉","bronze medal"],
    ["🏆","trophy win"],["🎫","ticket"],["🎪","circus tent"],["🎢","rollercoaster"],["🎠","carousel"],
    ["🛹","skateboard"],["🚴","bicycle cycling"],["🏊","swimming"],["🧗","climbing"],["🏂","skiing snowboard"]
  ]},
  { cat: "Objects & Tech", items: [
    ["📱","phone smartphone"],["💻","laptop computer"],["🖥️","desktop pc"],["⌨️","keyboard"],
    ["🖱️","mouse"],["🖨️","printer"],["📷","camera"],["🎥","video camera"],["📺","tv television"],
    ["📻","radio"],["🔋","battery"],["🔌","plug"],["💡","bulb idea"],["🔦","flashlight"],
    ["📅","calendar"],["📖","book"],["📚","books"],["📝","memo note"],["✏️","pencil"],
    ["📌","pin"],["📍","map pin"],["✂️","scissors"],["🔑","key"],["🔒","lock closed"],
    ["🔓","unlock open"],["🧲","magnet"],["🔔","bell"],["📢","loudspeaker"],["📣","megaphone"],
    ["⏰","alarm clock"],["⌚","watch"],["💎","gem diamond"],["💰","money bag"],["💵","dollar cash"],
    ["💶","euro"],["💷","pound"],["💴","yen"],["🪙","coin"],["🏦","bank"],["🛒","cart shopping"],
    ["🛍️","bags shopping"],["🧰","toolbox"],["🔨","hammer"],["🧱","brick"],["👑","crown king queen"],
    ["🎩","top hat"],["🧢","cap"],["👒","hat"],["🧣","scarf"],["🧤","gloves"],["👗","dress"],
    ["👕","shirt tshirt"],["👖","jeans pants"],["👟","sneaker shoe"],["👠","high heel"],["👢","boot"],
    ["🕶️","sunglasses"],["🎒","backpack"],["🧠","brain mind"],["🦴","bone"],["👁️","eye"],
    ["👄","lips mouth"],["🦠","germ bacteria virus"]
  ]},
  { cat: "Symbols & Nature", items: [
    ["✅","check yes done"],["❌","cross no x"],["❗","exclamation"],["❓","question"],
    ["⚠️","warning"],["🚫","prohibited forbidden"],["🔞","adults only"],["🆗","ok button"],
    ["🆕","new button"],["🎉","party popper"],["🎊","confetti"],["🔮","crystal ball"],
    ["🌙","moon night"],["☀️","sun"],["🌈","rainbow"],["☁️","cloud"],["⛈️","thunder storm"],
    ["❄️","snowflake cold"],["☃️","snowman"],["🌊","wave ocean"],["💧","drop water"],["🍀","clover luck"],
    ["🌹","rose"],["🌸","cherry blossom"],["🌻","sunflower"],["🌷","tulip"],["🌵","cactus"],
    ["🎄","christmas tree"],["🎃","halloween pumpkin"],["🎁","gift wrapped"],["🦃","turkey"],
    ["🚀","rocket launch"],["🛸","ufo alien"],["✈️","airplane"],["🚗","car"],["🚕","taxi"],
    ["🚌","bus"],["🚂","train"],["🚁","helicopter"],["⛵","sailboat"],["🚢","ship"],["⚓","anchor"],
    ["💀","skull"],["⚰️","coffin"],["🔫","gun water"]
  ]}
];

/* ---------------- UTILITY ---------------- */

function uid() {
  return (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

function isValidColor(c) {
  return typeof c === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(c);
}

function sendPayload(payload) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  ws.send(JSON.stringify(payload));
  return true;
}

function escAttr(s) {
  return (window.CSS && CSS.escape) ? CSS.escape(String(s)) : String(s).replace(/["\\]/g, "\\$&");
}

function nearBottom() {
  const m = document.getElementById("messages");
  const threshold = window.visualViewport ? window.visualViewport.height * 0.2 : 60;
  return m.scrollHeight - m.scrollTop - m.clientHeight < threshold;
}

function scrollToBottom() {
  const m = document.getElementById("messages");
  m.scrollTop = m.scrollHeight;
}

function addSystemLine(text) {
  const el = document.createElement("div");
  el.className = "system";
  el.textContent = text;
  document.getElementById("messages").appendChild(el);
  if (isAtBottom) scrollToBottom();
}

function updateTitle() {
  document.title = missed > 0 ? `(${missed}) Chatroom` : "Chatroom";
}

/* ---------------- LOGIN / PERSISTENCE ---------------- */

function enterChat() {
  username = document.getElementById("username").value.trim().slice(0, 32);
  userColor = document.getElementById("color").value;

  if (!username) {
    alert("Enter username");
    return;
  }

  STORE.set(STORE.name, username);
  STORE.set(STORE.color, userColor);

  document.getElementById("login").classList.add("hidden");
  document.getElementById("chat").classList.remove("hidden");

  buildSidePanel();
  setupEventListeners();
  setProfile();
  connect();

  if (pushEnabled()) requestPushPermission();
}

function logout() {
  if (ws) { try { ws.close(); } catch {} }
  username = "";
  myClientId = null;
  document.getElementById("chat").classList.add("hidden");
  document.getElementById("login").classList.remove("hidden");
  const hint = document.getElementById("loginHint");
  hint.textContent = (STORE.get(STORE.name) ? `Welcome back, ${STORE.get(STORE.name)}` : "") + " — choose a new name to switch user.";
  hint.classList.remove("hidden");
}

function setProfile() {
  const el = document.getElementById("profileName");
  el.textContent = username || "";
  el.style.color = isValidColor(userColor) ? userColor : "";
}

/* ---------------- CONNECTION ---------------- */

let reconnectDelay = 2000;
let reconnectTimer = null;

function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  const setting = backendSetting();

  if (location.protocol === "https:" && /^ws:\/\//i.test(setting.url)) {
    setStatusHint("That backend isn't reachable from https (mixed content) — pick Render or a wss tunnel");
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, 15000);
    return;
  }

  setStatusHint(`Connecting to ${setting.label}…`);
  ws = new WebSocket(setting.url);

  ws.onopen = () => {
    reconnectDelay = 2000;
    setStatusHint("");
    sendPayload({ type: "join", username, color: userColor });
    if (pendingPushSub) sendPayload({ type: "subscribe", subscription: pendingPushSub });
  };

  ws.onmessage = e => {
    let data;
    try { data = JSON.parse(e.data); } catch { return; }
    if (!data || typeof data !== "object") return;

    switch (data.type) {
      case "welcome":
        myClientId = data.clientId;
        renderOnline(data.users || []);
        if (Array.isArray(data.history)) {
          data.history.forEach(m => renderMessage(m, m.senderId === data.clientId));
        }
        break;
      case "online":
        renderOnline(data.users || []);
        break;
      case "join":
        addSystemLine(`» ${data.username} joined`);
        break;
      case "leave":
        addSystemLine(`» ${data.username} left`);
        break;
      case "rename":
        addSystemLine(`» ${data.from} is now ${data.username}`);
        if (data.username === username) setProfile();
        break;
      case "message":
      case "image":
      case "gif":
        receiveChat(data);
        break;
      case "typing":
        handleTyping(data);
        break;
      case "status":
        handleSentStatus(data);
        break;
    }
  };

  ws.onerror = () => setStatusHint("Connection error");

  ws.onclose = () => scheduleReconnect();
}

function scheduleReconnect() {
  clearTimeout(reconnectTimer);

  if (document.hidden) {
    setStatusHint("Disconnected — will reconnect when you return");
    return;
  }

  setStatusHint("Disconnected — reconnecting…");
  reconnectTimer = setTimeout(connect, reconnectDelay);
  reconnectDelay = Math.min(reconnectDelay * 2, 30000);
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden || !ws || ws.readyState !== WebSocket.CLOSED) return;
  reconnectDelay = 2000;
  connect();
});

function setStatusHint(text) {
  statusHint = text;
  refreshTypingLine();
}

/* ---------------- ONLINE ROSTER ---------------- */

function renderOnline(users) {
  const box = document.getElementById("onlineList");
  box.innerHTML = "";
  if (!users || users.length === 0) {
    box.textContent = "No one is online";
    return;
  }
  users.forEach(name => {
    const item = document.createElement("div");
    item.className = "onlineItem" + (name === username ? " onlineMe" : "");
    item.textContent = name === username ? name + " (you)" : name;
    box.appendChild(item);
  });
}

/* ---------------- TYPING ---------------- */

function notifyTyping() {
  clearTimeout(typingIdleTimer);
  typingIdleTimer = setTimeout(() => sendTyping(false), 1500);

  const now = Date.now();
  if (now - lastTypingSentAt >= 800) {
    lastTypingSentAt = now;
    sendTyping(true);
  }
}

function sendTyping(value) {
  sendPayload({ type: "typing", username, typing: value });
}

function handleTyping(d) {
  if (!d.username || d.username === username) return;
  if (d.typing) {
    typingUsers.set(d.username, Date.now());
  } else {
    typingUsers.delete(d.username);
  }
  refreshTypingLine();
}

function pruneTyping() {
  let changed = false;
  const now = Date.now();
  for (const [name, ts] of typingUsers) {
    if (now - ts > 2500) {
      typingUsers.delete(name);
      changed = true;
    }
  }
  if (changed) refreshTypingLine();
}

function typingText() {
  const names = [...typingUsers.keys()];
  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]} are typing…`;
}

function refreshTypingLine() {
  const el = document.getElementById("typing");
  if (!el) return;
  el.textContent = statusHint ? statusHint + (typingUsers.size ? " — " + typingText() : "") : typingText();
}

setInterval(pruneTyping, 500);

/* ---------------- UNREAD / SEEN ---------------- */

function flushPendingSeen() {
  if (pendingSeen.size === 0) return;
  for (const id of pendingSeen) {
    sendPayload({ type: "seen", id });
  }
  pendingSeen.clear();
}

function onUserActive() {
  flushPendingSeen();
  if (missed > 0) {
    missed = 0;
    updateTitle();
  }
}

/* ---------------- EVENT LISTENERS ---------------- */

function setupEventListeners() {
  const messageInput = document.getElementById("messageInput");

  messageInput.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
      return;
    }
    notifyTyping();
  });
  messageInput.addEventListener("blur", () => sendTyping(false));

  document.getElementById("sendButton").onclick = sendMessage;

  // Formatting bar
  const fmtFontBtn = document.getElementById("fmtFont");
  const fmtBoldBtn = document.getElementById("fmtBold");
  const fmtItalicBtn = document.getElementById("fmtItalic");
  const fmtUnderBtn = document.getElementById("fmtUnderline");
  const fmtColorInput = document.getElementById("fmtColor");
  const fontMenu = document.getElementById("fontMenu");

  buildFontMenu(fontMenu);
  fmtFontBtn.addEventListener("click", (e) => { e.stopPropagation(); toggleFontMenu(fontMenu, fmtFontBtn); });
  fmtBoldBtn.addEventListener("click", () => { fmtBold = !fmtBold; syncFmtButtons(); });
  fmtItalicBtn.addEventListener("click", () => { fmtItalic = !fmtItalic; syncFmtButtons(); });
  fmtUnderBtn.addEventListener("click", () => { fmtUnderline = !fmtUnderline; syncFmtButtons(); });
  fmtColorInput.addEventListener("input", () => {
    fmtColor = fmtColorInput.value || "";
    syncFmtButtons();
  });
  fmtColorInput.addEventListener("change", () => { syncFmtButtons(); });

  document.addEventListener("click", () => closeFontMenu(fontMenu, fmtFontBtn));

  // Prevent mobile browser from stealing focus on touch (keeps keyboard open)
  document.getElementById("sendButton").addEventListener("touchend", (e) => {
    e.preventDefault();
    sendMessage();
  }, { passive: false });

  const gifSearch = document.getElementById("gifSearch");
  gifSearch.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      searchGifs();
    }
  });

  document.getElementById("imageUpload").onchange = e => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const id = uid();
      renderMessage({ type: "image", id, senderId: myClientId, username, image: reader.result }, true);
      sendPayload({ type: "image", id, username, image: reader.result });
    };
    reader.readAsDataURL(file);
  };

  const messages = document.getElementById("messages");
  messages.addEventListener("scroll", () => {
    isAtBottom = nearBottom();
    if (isAtBottom && document.hasFocus()) onUserActive();
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && document.hasFocus()) onUserActive();
  });
  window.addEventListener("focus", onUserActive);

  const emojiSearch = document.getElementById("emojiSearch");
  emojiSearch.addEventListener("input", renderEmojiPicker);
}

/* ---------------- SEND MESSAGE ---------------- */

function buildFontMenu(menu) {
  menu.innerHTML = "";
  FONTS.forEach(f => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fontOpt";
    btn.dataset.font = f.value;
    btn.textContent = f.name;
    if (f.value) btn.style.fontFamily = f.value;
    btn.onclick = () => {
      fmtFont = f.value;
      syncFmtButtons();
      closeFontMenu(menu, document.getElementById("fmtFont"));
    };
    menu.appendChild(btn);
  });
}

function toggleFontMenu(menu, button) {
  const open = !menu.classList.contains("hidden");
  if (open) {
    closeFontMenu(menu, button);
  } else {
    menu.classList.remove("hidden");
    button.setAttribute("aria-expanded", "true");
  }
}

function closeFontMenu(menu, button) {
  menu.classList.add("hidden");
  if (button) button.setAttribute("aria-expanded", "false");
}

function syncFmtButtons() {
  const f = document.getElementById("fmtFont");
  const b = document.getElementById("fmtBold");
  const i = document.getElementById("fmtItalic");
  const u = document.getElementById("fmtUnderline");
  const c = document.getElementById("fmtColorWrap");
  const ci = document.getElementById("fmtColor");
  if (f) f.classList.toggle("active", !!fmtFont);
  if (b) b.classList.toggle("active", fmtBold);
  if (i) i.classList.toggle("active", fmtItalic);
  if (u) u.classList.toggle("active", fmtUnderline);
  if (c) c.classList.toggle("active", !!fmtColor);
  if (ci) ci.value = fmtColor || "#000000";

  const menu = document.getElementById("fontMenu");
  if (menu) {
    menu.querySelectorAll(".fontOpt").forEach(o => {
      o.classList.toggle("selected", o.dataset.font === fmtFont);
    });
  }
}

function currentFormat() {
  const f = {};
  if (fmtFont) f.font = fmtFont;
  if (fmtBold) f.bold = true;
  if (fmtItalic) f.italic = true;
  if (fmtUnderline) f.underline = true;
  if (fmtColor && isValidColor(fmtColor)) f.color = fmtColor;
  return f;
}

function sendMessage() {
  if (!username) return;

  const input = document.getElementById("messageInput");
  const text = input.value.trim().slice(0, MAX_TEXT_LENGTH);
  if (!text) return;

  const id = uid();
  const fmt = currentFormat();
  const reply = replyingTo;
  input.value = "";
  sendTyping(false);
  clearReply();

  renderMessage({ type: "message", id, senderId: myClientId, username, color: userColor, text, fmt, reply }, true);

  if (!sendPayload({ type: "message", id, username, color: userColor, text, fmt, reply })) {
    setStatusHint("Not connected — message was not sent");
  }

  // Keep the keyboard open on mobile: delay focus until after DOM settles and
  // the browser finishes its blur cycle. requestAnimationFrame is too fast.
  setTimeout(() => input.focus(), 150);
}

/* ---------------- MESSAGES ---------------- */

function receiveChat(d) {
  const isMine = d.senderId === myClientId;
  renderMessage(d, isMine);

  if (isMine) return;

  if (lastRead.delete(d.username)) refreshSeenMarkers();

  if (document.hasFocus() && nearBottom()) {
    sendPayload({ type: "seen", id: d.id });
  } else {
    pendingSeen.add(d.id);
    missed++;
    updateTitle();
  }
}

function renderMessage(d, isMine) {
  if (!d || !d.id) return;

  if (document.querySelector(`[data-mid="${escAttr(d.id)}"]`)) return; // dedupe optimistic + echo

  const el = document.createElement("div");
  el.className = "message " + (isMine ? "mine" : "theirs");

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.dataset.mid = d.id;

  if (d.type === "message") {
    const name = document.createElement("strong");
    name.style.color = isValidColor(d.color) ? d.color : "var(--status)";
    name.textContent = d.username;
    bubble.appendChild(name);

    {
      const time = document.createElement("span");
      time.className = "msgTime";
      time.textContent = formatTime(d.ts || Date.now());
      bubble.insertBefore(time, name);
    }

    if (d.reply) {
      const reply = document.createElement("div");
      reply.className = "reply";
      reply.textContent = d.reply;
      bubble.appendChild(reply);
    }

    const body = document.createElement("span");
    body.className = "fmtBody";
    body.textContent = d.text;
    if (d.fmt) applyFmt(body, d.fmt);
    bubble.appendChild(body);

    bubble.onclick = () => setReply(d.username, d.text);
  } else if (d.type === "image") {
    const name = document.createElement("strong");
    name.textContent = d.username;
    bubble.appendChild(name);
    bubble.appendChild(makeImg(d.image, { alt: "Shared image", label: "image" }));
    bubble.onclick = () => setReply(d.username, "[Image]");
  } else if (d.type === "gif") {
    const name = document.createElement("strong");
    name.textContent = d.username;
    bubble.appendChild(name);
    bubble.appendChild(makeImg(d.gif, { alt: "Shared GIF", label: "GIF", cls: "chatImage gif", width: "200px" }));
    bubble.onclick = () => setReply(d.username, "[GIF]");
  }

  bubble.style.cursor = "pointer";

  el.appendChild(bubble);

  if (isMine) {
    const footer = document.createElement("div");
    footer.className = "msgStatus";
    el.appendChild(footer);
    myFooters.set(d.id, footer);
  }

  document.getElementById("messages").appendChild(el);

  if (nearBottom()) scrollToBottom();
}

function formatTime(ts) {
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, "0");
  return `(${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())})`;
}

function applyFmt(el, fmt) {
  if (!fmt) return;
  if (fmt.font) el.style.fontFamily = fmt.font;
  if (fmt.bold) el.style.fontWeight = "bold";
  if (fmt.italic) el.style.fontStyle = "italic";
  if (fmt.underline) el.style.textDecoration = "underline";
  if (fmt.color && isValidColor(fmt.color)) el.style.color = fmt.color;
}

function makeImg(src, opts = {}) {
  const img = document.createElement("img");
  img.className = opts.cls || "chatImage";
  img.alt = opts.alt || "image";
  img.referrerPolicy = "no-referrer";
  img.decoding = "async";
  img.loading = "eager";

  if (opts.width) {
    img.style.width = opts.width;
    img.style.height = "auto";
  }

  img.onerror = () => {
    img.onerror = null;
    const a = document.createElement("a");
    a.className = "imgFallback";
    a.href = src || "#";
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = src
      ? `Couldn't display — open ${opts.label || "image"} ↗`
      : `${opts.label || "Image"} could not be loaded`;
    img.replaceWith(a);
  };

  img.src = src || "";

  // Wrap in a container with an expand button
  const wrap = document.createElement("div");
  wrap.className = "imgWrap";
  wrap.appendChild(img);

  const btn = document.createElement("button");
  btn.className = "imgExpand";
  btn.type = "button";
  btn.textContent = "⤢";
  btn.title = "Expand";
  btn.setAttribute("aria-label", "Expand image");
  btn.onclick = (e) => {
    e.stopPropagation();
    openLightbox(src);
  };
  wrap.appendChild(btn);

  return wrap;
}

/* ---------------- LIGHTBOX ---------------- */

function openLightbox(src) {
  if (!src) return;
  let box = document.getElementById("imgLightbox");
  if (!box) {
    box = document.createElement("div");
    box.id = "imgLightbox";
    box.className = "imgLightbox";
    box.tabIndex = -1;
    box.onclick = () => closeLightbox();

    const img = document.createElement("img");
    img.className = "imgLightboxImg";
    box.appendChild(img);

    const closeBtn = document.createElement("button");
    closeBtn.className = "imgLightboxClose";
    closeBtn.type = "button";
    closeBtn.textContent = "✕";
    closeBtn.title = "Close";
    closeBtn.setAttribute("aria-label", "Close expanded image");
    closeBtn.onclick = (e) => { e.stopPropagation(); closeLightbox(); };
    box.appendChild(closeBtn);

    document.body.appendChild(box);
  }
  box.querySelector(".imgLightboxImg").src = src;
  box.classList.add("open");
  box.focus();
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  const box = document.getElementById("imgLightbox");
  if (box) {
    box.classList.remove("open");
    document.body.style.overflow = "";
  }
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeLightbox();
});

/* ---------------- SEEN / DELIVERED STATUS ---------------- */

function handleSentStatus(d) {
  if (!d || d.status !== "seen" || !d.username || !myFooters.has(d.id)) return;
  lastRead.set(d.username, d.id);
  refreshSeenMarkers();
}

function refreshSeenMarkers() {
  for (const [id, footer] of myFooters) {
    const names = [...lastRead.entries()]
      .filter(([, rid]) => rid === id)
      .map(([name]) => name);
    footer.textContent = names.length ? "Seen by " + names.join(", ") : "";
  }
}

/* ---------------- IMAGE UPLOAD ---------------- */

function triggerImageUpload() {
  document.getElementById("imageUpload").click();
}

/* ---------------- GIF ---------------- */

async function searchGifs() {
  const query = document.getElementById("gifSearch").value.trim();

  const url = query
    ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query.slice(0, 100))}&limit=9`
    : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=9`;

  try {
    const res = await fetch(url);
    const json = await res.json();

    const box = document.getElementById("gifResults");
    box.innerHTML = "";

    if (!json.data || json.data.length === 0) {
      box.innerHTML = "<p class='gifError'>No GIFs found</p>";
      return;
    }

    json.data.forEach(gif => {
      const img = document.createElement("img");
      img.src = gif.images.fixed_height_small.url;
      img.className = "gifThumb";
      img.alt = "GIF result";
      img.referrerPolicy = "no-referrer";

      img.onclick = () => {
        const id = uid();
        const url = gif.images.fixed_height.url;
        renderMessage({ type: "gif", id, senderId: myClientId, username, gif: url }, true);
        if (!sendPayload({ type: "gif", id, username, gif: url })) return;

        document.getElementById("gifPicker").classList.add("hidden");
        document.getElementById("gifSearch").value = "";
      };

      box.appendChild(img);
    });
  } catch (error) {
    console.error("Error fetching GIFs:", error);
    const box = document.getElementById("gifResults");
    box.innerHTML = "<p class='gifError'>Error loading GIFs</p>";
  }
}

function toggleGifPicker() {
  const emoji = document.getElementById("emojiPicker");
  if (emoji && !emoji.classList.contains("hidden")) emoji.classList.add("hidden");

  const el = document.getElementById("gifPicker");
  el.classList.toggle("hidden");

  if (!el.classList.contains("hidden")) {
    document.getElementById("gifSearch").value = "";
    searchGifs();
  }
}

/* ---------------- SIDE PANEL ---------------- */

function buildSidePanel() {
  const emoBox = document.getElementById("emoticonList");
  const reactionBox = document.getElementById("reactionList");
  emoBox.innerHTML = "";
  reactionBox.innerHTML = "";

  sideEmoticons.forEach(e => {
    const b = document.createElement("button");
    b.textContent = e;
    b.onclick = () => insertText(e);
    emoBox.appendChild(b);
  });

  sideReactions.forEach(r => {
    const b = document.createElement("button");
    b.textContent = r.id;
    b.onclick = () => {
      const id = uid();
      const url = new URL(r.url, location.href).href; // absolute so other hosts can load it
      renderMessage({ type: "image", id, senderId: myClientId, username, image: url }, true);
      sendPayload({ type: "image", id, username, image: url });
    };
    reactionBox.appendChild(b);
  });
}

const sideEmoticons = [
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

const sideReactions = [
  { id: "iguess", url: "images/befr.jpg" },
  { id: "eagle", url: "images/eagle.jpg" },
  { id: "gasp", url: "images/gasp.jpg" },
  { id: "imcrine", url: "images/imcrine.jpg" },
  { id: "reallybru", url: "images/reallybru.jpg" },
  { id: "whyutryingnottolaugh", url: "images/whyutryingnottolaugh.jpg" }
];

function insertText(text) {
  const input = document.getElementById("messageInput");
  input.value += text;
  input.focus();
}

/* ---------------- EMOJI PICKER ---------------- */

const RECENT_EMOJI_KEY = "cc_emoji";

function getRecentEmojis() {
  try {
    const raw = STORE.get(RECENT_EMOJI_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter(e => typeof e === "string") : [];
  } catch {
    return [];
  }
}

function addRecentEmoji(e) {
  const list = getRecentEmojis().filter(x => x !== e);
  list.unshift(e);
  STORE.set(RECENT_EMOJI_KEY, JSON.stringify(list.slice(0, 30)));
}

function renderEmojiPicker() {
  const q = document.getElementById("emojiSearch").value.trim().toLowerCase();
  const box = document.getElementById("emojiPickerBody");
  box.innerHTML = "";

  if (q) {
    const shown = new Map();
    EMOJI_CATS.forEach(cat => {
      cat.items.forEach(([e, k]) => {
        if ((e + " " + k + " " + cat.cat).toLowerCase().includes(q) && !shown.has(e)) {
          shown.set(e, true);
          box.appendChild(emojiButton(e));
        }
      });
    });

    if (!shown.size) {
      const p = document.createElement("p");
      p.style.fontSize = "12px";
      p.style.opacity = "0.6";
      p.textContent = "No emoji found";
      box.appendChild(p);
    }
    return;
  }

  const recents = getRecentEmojis();
  if (recents.length) {
    box.appendChild(sectionHeader("Recently used"));
    recents.forEach(e => box.appendChild(emojiButton(e)));
  }

  EMOJI_CATS.forEach(cat => {
    box.appendChild(sectionHeader(cat.cat));
    cat.items.forEach(([e]) => box.appendChild(emojiButton(e)));
  });
}

function sectionHeader(text) {
  const label = document.createElement("div");
  label.className = "emojiCat";
  label.textContent = text;
  return label;
}

function emojiButton(e) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = e;
  b.title = e;
  b.onmousedown = ev => ev.preventDefault(); // keep message input focused/caret intact
  b.onclick = () => {
    insertText(e);
    addRecentEmoji(e);
    // Refresh only when browsing (not searching) so the recents row updates
    if (!document.getElementById("emojiSearch").value.trim()) {
      renderEmojiPicker();
      const box = document.getElementById("emojiPickerBody");
      box.scrollTop = 0;
    }
  };
  return b;
}

function toggleEmojiPicker() {
  const gif = document.getElementById("gifPicker");
  if (gif && !gif.classList.contains("hidden")) gif.classList.add("hidden");

  const picker = document.getElementById("emojiPicker");
  picker.classList.toggle("hidden");
  if (!picker.classList.contains("hidden")) {
    document.getElementById("emojiSearch").value = "";
    renderEmojiPicker();
    document.getElementById("emojiSearch").focus();
  }
}

/* ---------------- RENAME ---------------- */

function toggleRename() {
  const box = document.getElementById("renameBox");
  box.classList.toggle("hidden");
  if (!box.classList.contains("hidden")) {
    document.getElementById("renameInput").value = username;
    document.getElementById("renameColor").value = userColor;
    document.getElementById("renameInput").focus();
  }
}

function saveRename() {
  const input = document.getElementById("renameInput");
  const newName = input.value.trim().slice(0, 32);
  const newColor = document.getElementById("renameColor").value;
  if (!newName) {
    alert("Enter a username");
    return;
  }

  const nameChanged = newName !== username;
  const colorChanged = newColor !== userColor;

  if (nameChanged || colorChanged) {
    sendPayload({ type: "rename", username: newName, color: newColor });
  }

  username = newName;
  userColor = newColor;
  STORE.set(STORE.name, newName);
  STORE.set(STORE.color, newColor);
  setProfile();
  toggleRename();
}

/* ---------------- REPLY ---------------- */

function setReply(user, text) {
  replyingTo = `${user}: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`;

  const replyBar = document.getElementById("replyBar");
  const replyText = document.getElementById("replyText");

  replyText.textContent = `Replying to ${replyingTo}`;
  replyBar.classList.remove("hidden");
  document.getElementById("messageInput").focus();
}

function clearReply() {
  replyingTo = null;
  const replyBar = document.getElementById("replyBar");
  if (replyBar) replyBar.classList.add("hidden");
}

/* ---------------- MOBILE PANEL ---------------- */

function togglePanel() {
  const open = document.body.classList.toggle("panel-open");
  const backdrop = document.getElementById("sideBackdrop");
  if (backdrop) backdrop.classList.toggle("hidden", !open);
}

function closePanel() {
  document.body.classList.remove("panel-open");
  const backdrop = document.getElementById("sideBackdrop");
  if (backdrop) backdrop.classList.add("hidden");
}

/* ---------------- INIT ---------------- */

(function init() {
  buildThemeSelect();
  buildServerSelect();
  applyTheme(STORE.get(STORE.theme) || "default");

  const mq = window.matchMedia("(min-width: 769px)");
  const mqSync = () => { if (mq.matches) closePanel(); };
  if (mq.addEventListener) mq.addEventListener("change", mqSync);
  else mq.addListener(mqSync);

  const savedName = STORE.get(STORE.name);
  const savedColor = STORE.get(STORE.color);

  if (savedName) {
    document.getElementById("username").value = savedName;
    if (savedColor && isValidColor(savedColor)) document.getElementById("color").value = savedColor;
  }

  if (savedName) {
    enterChat();
  }

  // Mobile keyboard: keep chat sized to the visual viewport (not the full document)
  if (window.visualViewport) {
    const applyVH = () => {
      document.documentElement.style.setProperty("--app-h", window.visualViewport.height + "px");
      // Re-anchor scroll after keyboard resize so the latest message stays visible
      const m = document.getElementById("messages");
      if (m && nearBottom()) scrollToBottom();
    };
    window.visualViewport.addEventListener("resize", applyVH);
    applyVH();
  }
})();

/* ---------------- PWA ---------------- */

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then(registration => registration.update())
      .catch(() => {});
  });
}

/* ---------------- PUSH NOTIFICATIONS ---------------- */

let pendingPushSub = null;
let vapidCache = { origin: "", key: null };

function pushEnabled() {
  return STORE.get(STORE.notify) === "1";
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function pushBackendOrigin() {
  const raw = backendSetting().url;
  const protocol = /^wss:/i.test(raw) ? "https:" : /^ws:/i.test(raw) ? "http:" : "https:";
  return protocol + "//" + raw.replace(/^wss?:\/\//i, "").split("/")[0];
}

async function fetchVapidKey() {
  const origin = pushBackendOrigin();
  if (vapidCache.origin === origin && vapidCache.key) return vapidCache.key;
  try {
    const res = await fetch(origin + "/vapid-public", { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json || typeof json.key !== "string" || !json.key) return null;
    vapidCache = { origin, key: json.key };
    return json.key;
  } catch {
    return null;
  }
}

async function sendPushSubscription(sub) {
  if (!sub || !sub.endpoint) return;
  let keys = {};
  try { keys = sub.toJSON().keys || {}; } catch {}
  pendingPushSub = { endpoint: sub.endpoint, keys };
  sendPayload({ type: "subscribe", subscription: pendingPushSub });
}

async function ensurePushSubscription() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    let registration = await navigator.serviceWorker.getRegistration();
    if (!registration) registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      await sendPushSubscription(existing);
      return;
    }
    const key = await fetchVapidKey();
    if (!key) return;
    const sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key)
    });
    await sendPushSubscription(sub);
  } catch {}
}

async function disablePush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    pendingPushSub = null;
    return;
  }
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const sub = registration && await registration.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe().catch(() => {});
      sendPayload({ type: "unsubscribe", endpoint });
    }
    pendingPushSub = null;
  } catch {}
}

async function requestPushPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    try { await Notification.requestPermission(); } catch {}
  }
  if (Notification.permission === "granted") ensurePushSubscription();
}

function wireNotifyToggle() {
  const toggle = document.getElementById("notifyToggle");
  if (!toggle) return;
  toggle.checked = pushEnabled();
  toggle.onchange = () => {
    if (toggle.checked) {
      STORE.set(STORE.notify, "1");
      requestPushPermission();
    } else {
      STORE.set(STORE.notify, "");
      disablePush();
    }
  };
}

if ("Notification" in window &&
    navigator.permissions &&
    navigator.permissions.query) {
  navigator.permissions.query({ name: "notifications" })
    .then(status => {
      status.addEventListener("change", () => {
        if (Notification.permission === "granted" && pushEnabled()) ensurePushSubscription();
        else if (Notification.permission === "denied") disablePush();
      });
    })
    .catch(() => {});
}

wireNotifyToggle();

if (pushEnabled() && ("Notification" in window) && Notification.permission === "granted") {
  ensurePushSubscription();
}