import { config } from 'dotenv';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import Server from './models/Server.js';
import RoomController from './controllers/RoomController.js';
import GameController from './controllers/GameController.js';

config();
const app = express();

app.get('/login', (_req, res) => {
    res.sendStatus(200);
});

const socketServer = createServer(app);
socketServer.listen(process.env.PORT);
const io = new SocketServer(socketServer, {
    cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    },
});

const activeSessions = new Map<string, string>();
const server = new Server(io, activeSessions);
const roomController = new RoomController(server, io);
const gameController = new GameController(server, io);

io.on('connection', (socket: Socket) => {
    socket.on('register-session', (sessionId: string) => {
        activeSessions.set(sessionId, socket.id);
        socket.emit('server-info', server.getServerInfo());
    });

    socket.on('disconnect', () => {
        for (const [sessionId, socketId] of activeSessions) {
            if (socketId === socket.id) {
                activeSessions.delete(sessionId);
                break;
            }
        }
        const disconnectedRoom = server.findRoomBySocketId(socket.id);
        if (disconnectedRoom) gameController.handlePlayerLeave(disconnectedRoom.id, socket.id);
        roomController.handleDisconnect(socket);
    });

    socket.on('create-room', (payload) => roomController.createRoom(socket, payload));
    socket.on('join-room', (payload) => roomController.joinRoom(socket, payload));
    socket.on('left-room', (payload) => {
        gameController.handlePlayerLeave(payload.id, socket.id);
        roomController.leaveRoom(socket, payload.id);
    });

    socket.on('game-start', (payload) => gameController.startGame(socket, payload));
    socket.on('bluff-intent', (payload) => gameController.bluffIntent(socket, payload));
    socket.on('drop-cards', (payload) => gameController.dropCards(socket, payload));

    if (process.env.NODE_ENV !== 'production') {
        socket.on('dev-sandbox', (payload) => gameController.devSandbox(socket, payload));
    }

    socket.on('webrtc-join', ({ roomId }: { roomId: string }) =>
        socket.to(roomId).emit('webrtc-user-joined', { from: socket.id })
    );
    socket.on('webrtc-offer', ({ to, offer }: { to: string; offer: unknown }) =>
        io.to(to).emit('webrtc-offer', { from: socket.id, offer })
    );
    socket.on('webrtc-answer', ({ to, answer }: { to: string; answer: unknown }) =>
        io.to(to).emit('webrtc-answer', { from: socket.id, answer })
    );
    socket.on('webrtc-ice', ({ to, candidate }: { to: string; candidate: unknown }) =>
        io.to(to).emit('webrtc-ice', { from: socket.id, candidate })
    );
    socket.on('webrtc-leave', ({ roomId }: { roomId: string }) =>
        socket.to(roomId).emit('webrtc-user-left', { from: socket.id })
    );

    socket.on('room-chat-message', ({ roomId, message }: { roomId: string; message: Record<string, unknown> }) => {
        const msg = { ...message, id: Date.now() };
        io.to(roomId).emit('room-chat-message', msg);
    });

    socket.on('ping-check', (timestamp: number) => socket.emit('pong-check', timestamp));
});
