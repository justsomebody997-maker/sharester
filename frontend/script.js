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

// Simple-Peer instance
let peer;

// Handle Initiator setup
socket.emit("create", roomCode);
peer = new SimplePeer({ initiator: true, trickle: false });

// When initiator generates signaling data
peer.on("signal", (data) => {
  socket.emit("signal", { room: roomCode, data });
});

// When initiator receives signaling data
socket.on("signal", (data) => {
  peer.signal(data);
});

// Log when connected
peer.on("connect", () => {
  console.log("✅ Peer connected!");
  document.body.innerHTML = `<h1 style="text-align:center;">Connected! 🎉</h1>`;
});

// Receiver join button
document.getElementById("joinBtn").addEventListener("click", () => {
  const joinCode = document.getElementById("joinCode").value.trim();
  if (!joinCode) return alert("Please enter a code");

  // Join the room
  socket.emit("join", joinCode);

  // Receiver peer instance
  peer = new SimplePeer({ initiator: false, trickle: false });

  // When receiver generates signaling data
  peer.on("signal", (data) => {
    socket.emit("signal", { room: joinCode, data });
  });

  // When receiver gets signaling data
  socket.on("signal", (data) => {
    peer.signal(data);
  });

  // Log when connected
  peer.on("connect", () => {
    console.log("✅ Peer connected!");
    document.body.innerHTML = `<h1 style="text-align:center;">Connected! 🎉</h1>`;
  });
});
