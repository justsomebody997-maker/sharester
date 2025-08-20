const socket = io("https://sharester-backend.onrender.com");
let peer;
let roomCode;

// ---------------- INITIATOR ----------------
function createRoom() {
  roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
  document.getElementById("room-code").innerText = roomCode;

  socket.emit("create-room", roomCode);

  peer = new SimplePeer({ initiator: true, trickle: false });

  peer.on("signal", (data) => {
    socket.emit("signal", { room: roomCode, data });
  });

  socket.on("signal", ({ data }) => {
    if (peer) peer.signal(data);
  });

  peer.on("connect", () => {
    console.log("✅ Peer connected (initiator)!");
    document.getElementById("setup-screen").classList.add("hidden");
    document.getElementById("interchange-screen").classList.remove("hidden");
  });

  peer.on("data", (data) => {
    console.log("📩 Message:", data.toString());
    addMessage("Peer", data.toString());
  });
}

// ---------------- RECEIVER ----------------
document.getElementById("join-btn").addEventListener("click", () => {
  const joinCode = document.getElementById("join-input").value.trim().toUpperCase();
  if (!joinCode) return;

  socket.emit("join-room", joinCode);

  peer = new SimplePeer({ initiator: false, trickle: false });

  peer.on("signal", (data) => {
    socket.emit("signal", { room: joinCode, data });
  });

  socket.on("signal", ({ data }) => {
    if (peer) peer.signal(data);
  });

  peer.on("connect", () => {
    console.log("✅ Peer connected (receiver)!");
    document.getElementById("setup-screen").classList.add("hidden");
    document.getElementById("interchange-screen").classList.remove("hidden");
  });

  peer.on("data", (data) => {
    console.log("📩 Message:", data.toString());
    addMessage("Peer", data.toString());
  });
});

// ---------------- CHAT ----------------
document.getElementById("send-message-btn").addEventListener("click", () => {
  const input = document.getElementById("chat-input");
  const message = input.value;
  if (!message) return;

  peer.send(message);
  addMessage("You", message);
  input.value = "";
});

function addMessage(sender, text) {
  const chat = document.getElementById("chat-messages");
  const div = document.createElement("div");
  div.textContent = `${sender}: ${text}`;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

// ---------------- AUTO CREATE ROOM (Initiator) ----------------
createRoom();
