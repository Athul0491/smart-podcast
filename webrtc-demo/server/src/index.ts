import express, { Request, Response } from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import cors from 'cors';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST'],
  credentials: true
}));

// Define a type for rooms
type RoomMap = Map<string, string>; // socketId => userName
const rooms: Record<string, RoomMap> = {};

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

io.on("connection", (socket) => {
  socket.on("join-room", ({ room, name }: { room: string, name: string }) => {
    socket.join(room);
    (socket as any).roomName = room;
    (socket as any).userName = name;

    if (!rooms[room]) rooms[room] = new Map();
    rooms[room].set(socket.id, name);

    socket.emit("room-joined", { initiator: rooms[room].size === 1 });

    const participants = Array.from(rooms[room]).map(([id, name]) => ({ id, name }));
    io.in(room).emit("participants", participants);

    if (rooms[room].size === 2) {
      socket.to(room).emit("peer-joined");
    }
  });

  socket.on("disconnect", () => {
    const room = (socket as any).roomName;
    if (room && rooms[room]) {
      rooms[room].delete(socket.id);

      const participants = Array.from(rooms[room]).map(([id, name]) => ({ id, name }));
      io.in(room).emit("participants", participants);
      socket.to(room).emit("peer-disconnected");

      if (rooms[room].size === 0) delete rooms[room];
    }
  });

  socket.on("ready", (room: string) => {
    socket.to(room).emit("ready");
  });

  socket.on("offer", ({ room, offer }: { room: string, offer: any }) => {
    socket.to(room).emit("offer", { offer });
  });

  socket.on("answer", ({ room, answer }: { room: string, answer: any }) => {
    socket.to(room).emit("answer", { answer });
  });

  socket.on("candidate", ({ room, candidate }: { room: string, candidate: any }) => {
    socket.to(room).emit("candidate", { candidate });
  });
});

server.listen(3000, () => {
  console.log('🚀 Server running at http://localhost:3000');
});
