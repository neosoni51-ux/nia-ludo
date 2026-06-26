const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// Database (In-Memory for fast scaling, can be moved to Redis later)
const rooms = {};

io.on('connection', (socket) => {
    console.log(`[+] User connected: ${socket.id}`);

    // Create Room
    socket.on('createRoom', (userData) => {
        const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        rooms[roomCode] = {
            players: [{ id: socket.id, name: userData.name, dp: userData.dp, color: 'red' }],
            spectators: [],
            gameState: 'waiting' // waiting, playing, finished
        };
        socket.join(roomCode);
        socket.emit('roomCreated', roomCode);
        io.to(roomCode).emit('updateLobby', rooms[roomCode]);
    });

    // Join Room
    socket.on('joinRoom', ({ roomCode, userData }) => {
        const room = rooms[roomCode];
        if (!room) {
            socket.emit('error', 'Room not found!');
            return;
        }

        if (room.players.length < 4 && room.gameState === 'waiting') {
            const colors = ['red', 'blue', 'green', 'yellow'];
            const pColor = colors[room.players.length];
            room.players.push({ id: socket.id, name: userData.name, dp: userData.dp, color: pColor });
            socket.join(roomCode);
        } else {
            // Spectator Mode
            room.spectators.push({ id: socket.id, name: userData.name });
            socket.join(roomCode);
            socket.emit('spectatorMode', 'Match has started. You are spectating 👀');
        }
        io.to(roomCode).emit('updateLobby', room);
    });

    // Live Chat System
    socket.on('sendMessage', ({ roomCode, message, senderName }) => {
        io.to(roomCode).emit('receiveMessage', { senderName, message });
    });

    // Roll Dice
    socket.on('rollDice', ({ roomCode, playerColor }) => {
        const diceValue = Math.floor(Math.random() * 6) + 1;
        io.to(roomCode).emit('diceRolled', { playerColor, diceValue });
    });

    // Disconnect handling (AFK / Telegram Background)
    socket.on('disconnect', () => {
        console.log(`[-] User disconnected: ${socket.id}`);
        // Real-world app needs a 30s reconnect buffer here before kicking player
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Ludo Server running on port ${PORT}`);
});
