const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const rooms = {}; // { roomName: Map<socketId, userName> }

// Serve static files
app.use(express.static(path.join(__dirname,'..', 'public')));

// Serve homepage
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Socket handling
io.on("connection", (socket) => {
    socket.on("join-room", ({ room, name }) => {
        socket.join(room);
        socket.roomName = room;
        socket.userName = name;

        if (!rooms[room]) rooms[room] = new Map();
        rooms[room].set(socket.id, name);

        socket.emit("room-joined", { initiator: rooms[room].size === 1 });

        // Send participant list
        const participants = Array.from(rooms[room]).map(([id, name]) => ({ id, name }));
        io.in(room).emit("participants", participants);

        if (rooms[room].size === 2) {
            socket.to(room).emit("peer-joined");
        }
    });

    socket.on("disconnect", () => {
        const room = socket.roomName;
        if (room && rooms[room]) {
            rooms[room].delete(socket.id);

            const participants = Array.from(rooms[room]).map(([id, name]) => ({ id, name }));
            io.in(room).emit("participants", participants);

            if (rooms[room].size === 0) delete rooms[room];
        }
    });
    
    socket.on("ready", (room) => {
        socket.to(room).emit("ready");
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
