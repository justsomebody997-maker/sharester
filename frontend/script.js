const socket = io("https://sharester-backend.onrender.com");
let peer;
let roomCode;
let isInitiator = false;

// ---------------- UTILITY FUNCTIONS ----------------
function updateStatus(element, message, type = "") {
  element.textContent = message;
  element.className = `connection-status ${type}`;
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ---------------- SOCKET EVENTS ----------------
socket.on("connect", () => {
  console.log("Connected to server");
  createRoom(); // Auto-create room on connection
});

socket.on("disconnect", () => {
  console.log("Disconnected from server");
  updateStatus(document.getElementById("initiator-status"), "Disconnected from server", "error");
});

socket.on("room-created", (code) => {
  console.log("Room created:", code);
  document.getElementById("room-code").textContent = code;
  updateStatus(document.getElementById("initiator-status"), "Waiting for peer...", "connecting");
});

socket.on("peer-joined", () => {
  console.log("Peer joined room - initiator creating offer");
  updateStatus(document.getElementById("initiator-status"), "Peer joined! Creating connection...", "connecting");
  
  // Initiator creates the peer connection when receiver joins
  if (!peer || peer.destroyed) {
    peer = new SimplePeer({ 
      initiator: true, 
      trickle: false,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });
    setupPeerEvents();
  }
});

socket.on("joined-room", (code) => {
  console.log("Successfully joined room:", code);
  updateStatus(document.getElementById("receiver-status"), "Connected! Starting WebRTC...", "connecting");
  
  // Receiver creates the peer connection when successfully joined
  peer = new SimplePeer({ 
    initiator: false, 
    trickle: false,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    }
  });
  setupPeerEvents();
});

socket.on("join-error", (error) => {
  console.log("Join error:", error);
  updateStatus(document.getElementById("receiver-status"), `Error: ${error}`, "error");
});

socket.on("signal", ({ data }) => {
  if (peer && !peer.destroyed) {
    console.log("Received signal:", data.type);
    try {
      peer.signal(data);
    } catch (error) {
      console.error("Error processing signal:", error);
    }
  } else {
    console.warn("Received signal but peer not ready");
  }
});

socket.on("peer-disconnected", () => {
  console.log("Peer disconnected");
  if (peer && !peer.destroyed) {
    peer.destroy();
  }
  // Return to setup screen
  document.getElementById("setup-screen").classList.remove("hidden");
  document.getElementById("interchange-screen").classList.add("hidden");
  createRoom(); // Create new room
});

// ---------------- INITIATOR FUNCTIONS ----------------
function createRoom() {
  roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
  isInitiator = true;
  
  // Reset UI
  document.getElementById("room-code").textContent = "----";
  updateStatus(document.getElementById("initiator-status"), "Creating room...", "connecting");
  
  socket.emit("create-room", roomCode);
  
  // Don't create peer here - wait for peer-joined event
}

// ---------------- RECEIVER FUNCTIONS ----------------
document.getElementById("join-btn").addEventListener("click", () => {
  const joinCode = document.getElementById("join-input").value.trim().toUpperCase();
  if (!joinCode || joinCode.length !== 5) {
    updateStatus(document.getElementById("receiver-status"), "Please enter a valid 5-character code", "error");
    return;
  }

  updateStatus(document.getElementById("receiver-status"), "Joining room...", "connecting");
  isInitiator = false;
  roomCode = joinCode;
  
  socket.emit("join-room", joinCode);
});

// Allow Enter key to join
document.getElementById("join-input").addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    document.getElementById("join-btn").click();
  }
});

// ---------------- PEER CONNECTION SETUP ----------------
function setupPeerEvents() {
  if (!peer) return;
  
  peer.on("signal", (data) => {
    console.log("Sending signal:", data.type);
    socket.emit("signal", { room: roomCode, data });
  });

  peer.on("connect", () => {
    console.log("✅ Peer connected successfully!");
    document.getElementById("setup-screen").classList.add("hidden");
    document.getElementById("interchange-screen").classList.remove("hidden");
    
    // Send welcome message
    const welcomeMsg = isInitiator ? "Initiator connected!" : "Receiver connected!";
    addMessage("System", welcomeMsg, "system");
  });

  peer.on("data", (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.type === "chat") {
        addMessage("Peer", message.content);
      } else if (message.type === "file") {
        handleFileReceive(message);
      }
    } catch (error) {
      console.error("Error parsing received data:", error);
      // Fallback: treat as plain text message
      addMessage("Peer", data.toString());
    }
  });

  peer.on("error", (err) => {
    console.error("Peer error:", err);
    const statusElement = isInitiator ? 
      document.getElementById("initiator-status") : 
      document.getElementById("receiver-status");
    updateStatus(statusElement, `Connection error: ${err.message}`, "error");
  });

  peer.on("close", () => {
    console.log("Peer connection closed");
    document.getElementById("setup-screen").classList.remove("hidden");
    document.getElementById("interchange-screen").classList.add("hidden");
    if (isInitiator) {
      createRoom(); // Auto-create new room if initiator
    }
  });
}

// ---------------- CHAT FUNCTIONALITY ----------------
document.getElementById("send-message-btn").addEventListener("click", sendMessage);

document.getElementById("chat-input").addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    sendMessage();
  }
});

function sendMessage() {
  const input = document.getElementById("chat-input");
  const message = input.value.trim();
  if (!message || !peer || peer.destroyed) return;

  try {
    const messageData = {
      type: "chat",
      content: message,
      timestamp: new Date().toISOString()
    };
    
    peer.send(JSON.stringify(messageData));
    addMessage("You", message);
    input.value = "";
  } catch (error) {
    console.error("Error sending message:", error);
    addMessage("System", "Failed to send message", "error");
  }
}

function addMessage(sender, text, type = "") {
  const chat = document.getElementById("chat-messages");
  const div = document.createElement("div");
  div.className = `message ${type}`;
  
  if (sender === "You") {
    div.classList.add("self");
  } else if (sender === "Peer") {
    div.classList.add("peer");
  } else {
    div.classList.add("system");
  }
  
  const content = document.createElement("span");
  content.className = "message-content";
  content.textContent = `${sender}: ${text}`;
  
  const timestamp = document.createElement("span");
  timestamp.className = "timestamp";
  timestamp.textContent = new Date().toLocaleTimeString();
  
  div.appendChild(content);
  div.appendChild(timestamp);
  
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

// ---------------- FILE TRANSFER FUNCTIONALITY ----------------
document.getElementById("send-file-btn").addEventListener("click", () => {
  const fileInput = document.getElementById("file-input");
  const files = fileInput.files;
  
  if (!files.length || !peer || peer.destroyed) {
    updateProgress("Please select files first", "error");
    return;
  }
  
  Array.from(files).forEach((file, index) => {
    setTimeout(() => sendFile(file), index * 100); // Slight delay between files
  });
  
  fileInput.value = ""; // Clear selection
});

function sendFile(file) {
  if (!peer || peer.destroyed) {
    updateProgress("Connection lost", "error");
    return;
  }

  updateProgress(`Sending: ${file.name}...`, "sending");
  
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const fileData = {
        type: "file",
        name: file.name,
        size: file.size,
        data: e.target.result,
        timestamp: new Date().toISOString()
      };
      
      peer.send(JSON.stringify(fileData));
      updateProgress(`✅ Sent: ${file.name}`, "success");
      
      // Clear progress after 3 seconds
      setTimeout(() => {
        document.getElementById("send-progress").innerHTML = "";
      }, 3000);
      
    } catch (error) {
      console.error("Error sending file:", error);
      updateProgress(`❌ Failed to send: ${file.name}`, "error");
    }
  };
  
  reader.onerror = () => {
    updateProgress(`❌ Error reading: ${file.name}`, "error");
  };
  
  reader.readAsDataURL(file);
}

function handleFileReceive(fileMessage) {
  const { name, size, data, timestamp } = fileMessage;
  
  updateProgress(`📁 Received: ${name}`, "success");
  
  // Add to received files list
  const filesList = document.getElementById("received-files-list");
  const fileDiv = document.createElement("div");
  fileDiv.className = "received-file";
  
  const fileInfo = document.createElement("div");
  fileInfo.className = "file-info";
  
  const fileName = document.createElement("span");
  fileName.className = "file-name";
  fileName.textContent = name;
  
  const fileSize = document.createElement("span");
  fileSize.className = "file-size";
  fileSize.textContent = `${formatFileSize(size)} • ${new Date(timestamp).toLocaleTimeString()}`;
  
  fileInfo.appendChild(fileName);
  fileInfo.appendChild(fileSize);
  
  const downloadBtn = document.createElement("a");
  downloadBtn.className = "download-btn";
  downloadBtn.href = data;
  downloadBtn.download = name;
  downloadBtn.textContent = "Download";
  
  fileDiv.appendChild(fileInfo);
  fileDiv.appendChild(downloadBtn);
  
  filesList.appendChild(fileDiv);
  filesList.scrollTop = filesList.scrollHeight;
  
  // Also add chat message
  addMessage("System", `📁 File received: ${name}`, "system");
}

function updateProgress(message, type) {
  const progressDiv = document.getElementById("send-progress");
  progressDiv.textContent = message;
  progressDiv.className = `progress ${type}`;
}

// ---------------- INITIALIZE ----------------
// Auto-start room creation when page loads
if (socket.connected) {
  createRoom();
}
