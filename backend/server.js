const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const rooms = new Map(); // Track active rooms

// Handle socket connections
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  // Handle room creation (initiator)
  socket.on("create-room", (roomCode) => {
    socket.join(roomCode);
    rooms.set(roomCode, { initiator: socket.id, receiver: null });
    console.log(`Room created: ${roomCode} by ${socket.id}`);
    
    // Confirm room creation
    socket.emit("room-created", roomCode);
  });

  // Handle joining room (receiver)
  socket.on("join-room", (roomCode) => {
    const room = rooms.get(roomCode);
    
    if (!room) {
      socket.emit("join-error", "Room not found");
      return;
    }
    
    if (room.receiver) {
      socket.emit("join-error", "Room is full");
      return;
    }

    socket.join(roomCode);
    room.receiver = socket.id;
    console.log(`Client ${socket.id} joined room: ${roomCode}`);
    
    // Notify both peers that connection can begin
    socket.emit("joined-room", roomCode);
    socket.to(roomCode).emit("peer-joined", roomCode);
  });

  // Handle WebRTC signaling
  socket.on("signal", ({ room, data }) => {
    console.log(`Signaling in room ${room}`);
    socket.to(room).emit("signal", { data });
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    
    // Clean up rooms where this socket was involved
    for (const [roomCode, room] of rooms.entries()) {
      if (room.initiator === socket.id || room.receiver === socket.id) {
        // Notify other peer about disconnection
        socket.to(roomCode).emit("peer-disconnected");
        rooms.delete(roomCode);
        console.log(`Room ${roomCode} cleaned up`);
      }
    }
  });
});

// Port for deployment
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
