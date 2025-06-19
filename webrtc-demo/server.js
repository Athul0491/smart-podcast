const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Serve homepage
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket handling
io.on("connection", (socket) => {
    socket.on("join-room", (roomName) => {
        const room = io.sockets.adapter.rooms.get(roomName);
        const numClients = room ? room.size : 0;

        socket.join(roomName);

        if (numClients === 0) {
            socket.emit("room-joined", { initiator: true });
        } else if (numClients === 1) {
            socket.emit("room-joined", { initiator: false });
            socket.to(roomName).emit("peer-joined");
        } else {
            socket.emit("room-full");
        }
    });

    socket.on("offer", ({ room, offer }) => {
        socket.to(room).emit("offer", { offer });
    });

    socket.on("answer", ({ room, answer }) => {
        socket.to(room).emit("answer", { answer });
    });

    socket.on("candidate", ({ room, candidate }) => {
        socket.to(room).emit("candidate", { candidate });
    });

    socket.on("disconnecting", () => {
        for (const room of socket.rooms) {
            if (room !== socket.id) {
                socket.to(room).emit("peer-disconnected");
            }
        }
    });
});

// Start server
server.listen(3000, () => {
    console.log('Server running at http://localhost:3000');
});
