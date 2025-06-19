import express, { Request, Response } from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';

// Directory where chunks will be saved
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

// Configure multer storage with custom filename
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const { name, index } = req.body;
        const filename = `${name}_${index}.webm`;
        cb(null, filename);
    }
});

const upload = multer({ storage });
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
app.use(express.urlencoded({ extended: true }));

app.get('/', (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.post('/upload-chunk', upload.fields([
    { name: 'chunk', maxCount: 1 },
    { name: 'name' },
    { name: 'index' }
]), (req: Request, res: Response) => {
    const file = (req as any).files?.chunk?.[0];
    const name = (req as any).body?.name;
    const index = (req as any).body?.index;

    if (!file || !name || !index) {
        return res.status(400).send('Missing fields or file');
    }

    const desiredFilename = `${name}_${index}.webm`;
    const newPath = path.join(UPLOAD_DIR, desiredFilename);

    fs.renameSync(file.path, newPath);
    console.log(`✅ Saved as ${desiredFilename}`);
    res.status(200).send('Chunk received');
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
