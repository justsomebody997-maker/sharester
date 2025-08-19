const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // allow all (we’ll restrict later)
    methods: ["GET", "POST"]
  }
});

// Handle socket connections
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  socket.on("create", (room) => {
    socket.join(room);
    console.log(`Room created: ${room}`);
  });

  socket.on("join", (room) => {
    socket.join(room);
    io.to(room).emit("ready", room);
    console.log(`Client joined room: ${room}`);
  });

  socket.on("signal", ({ room, data }) => {
    socket.to(room).emit("signal", data);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// Port for local testing
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
