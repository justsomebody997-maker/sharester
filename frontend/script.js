// Connect to backend (replace with your Render URL)
const socket = io("https://sharester-backend.onrender.com");

// UI elements
const initiatorBox = document.querySelector(".initiator");
const receiverBox = document.querySelector(".receiver");

// Generate random room code for initiator
const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();

// Display room code for initiator
initiatorBox.innerHTML = `
  <h2>Initiator</h2>
  <p>Share this code with your partner:</p>
  <div id="roomCode" style="font-size:20px; font-weight:bold;">${roomCode}</div>
`;

// Receiver UI
receiverBox.innerHTML = `
  <h2>Receiver</h2>
  <input id="joinCode" type="text" placeholder="Enter code" />
  <button id="joinBtn">Join</button>
`;

let peer;

// --- Initiator Flow ---
function setupInitiator() {
  socket.emit("create", roomCode);

  peer = new SimplePeer({ initiator: true, trickle: false });

  peer.on("signal", (data) => {
    socket.emit("signal", { room: roomCode, data });
  });

  socket.on("signal", ({ data }) => {
    if (peer) {
      peer.signal(data);
    }
  });


  peer.on("connect", () => {
    console.log("✅ Peer connected (Initiator)!");
    document.body.innerHTML = `<h1 style="text-align:center;">Connected! 🎉</h1>`;
  });
}

// --- Receiver Flow ---
document.getElementById("joinBtn").addEventListener("click", () => {
  const joinCode = document.getElementById("joinCode").value.trim();
  if (!joinCode) return alert("Please enter a code");

  socket.emit("join", joinCode);

  peer = new SimplePeer({ initiator: false, trickle: false });

  peer.on("signal", (data) => {
    socket.emit("signal", { room: joinCode, data });
  });

  socket.on("signal", (data) => {
    peer.signal(data);
  });

  peer.on("connect", () => {
    console.log("✅ Peer connected (Receiver)!");
    document.body.innerHTML = `<h1 style="text-align:center;">Connected! 🎉</h1>`;
  });
});

// Start initiator automatically
setupInitiator();
