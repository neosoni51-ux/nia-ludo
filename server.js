const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.static(path.join(__dirname, 'public')));

// In-Memory Storage for High Performance Rooms & Session Recovery
const rooms = {}; 
const activeSessions = {}; // Maps unique userId to room and player configuration

io.on('connection', (socket) => {
    let currentRoomId = null;
    let currentUserId = null;

    // Authentication and Session Reconnect System
    socket.on('auth_session', ({ roomId, userId, username, avatar }) => {
        currentRoomId = roomId;
        currentUserId = userId;
        socket.userId = userId;

        // If room doesn't exist, initialize it
        if (!rooms[roomId]) {
            rooms[roomId] = {
                id: roomId,
                players: [],
                spectators: [],
                activeTurn: 0,
                lastRoll: 1,
                turnTimer: null,
                timeLeft: 30,
                gameStarted: false,
                tokens: {
                    'Red': { pos: 0, r: 2, c: 2 },
                    'Green': { pos: 0, r: 2, c: 12 },
                    'Yellow': { pos: 0, r: 12, c: 12 },
                    'Blue': { pos: 0, r: 12, c: 2 }
                },
                messages: []
            };
        }

        const room = rooms[roomId];
        socket.join(roomId);

        // Check if player is reconnecting from a minimized state
        const existingPlayer = room.players.find(p => p.id === userId);
        if (existingPlayer) {
            existingPlayer.socketId = socket.id;
            existingPlayer.online = true;
        } else if (room.players.length < 4 && !room.gameStarted) {
            // Assign designated color bases
            const colors = ['Red', 'Green', 'Yellow', 'Blue'];
            const assignedColor = colors[room.players.length];
            room.players.push({
                id: userId,
                name: username || `Player ${room.players.length + 1}`,
                color: assignedColor,
                socketId: socket.id,
                online: true,
                afkCount: 0
            });
        } else {
            // Join as Spectator if room full or match started
            room.spectators.push({ id: userId, name: username || 'Spectator', socketId: socket.id });
        }

        activeSessions[userId] = { roomId, socketId: socket.id };
        
        // Broadcast structural updates
        io.to(roomId).emit('room_update', sanitizeRoomData(room));
        socket.emit('chat_history', room.messages);
    });

    // Handle Dice Roll Sync
    socket.on('roll_dice', () => {
        const room = rooms[currentRoomId];
        if (!room) return;

        const activePlayer = room.players[room.activeTurn];
        if (!activePlayer || activePlayer.id !== currentUserId) return;

        clearInterval(room.turnTimer);
        const rolledValue = Math.floor(Math.random() * 6) + 1;
        room.lastRoll = rolledValue;

        // Server authoritative rule math
        let tokenData = room.tokens[activePlayer.color];
        tokenData.pos += rolledValue;
        if (tokenData.pos > 57) tokenData.pos = 57; // Victory CAP limit

        // Interpolate paths dynamically for matrix tracking
        if (activePlayer.color === 'Red') { tokenData.c = 6; tokenData.r = 6 + (rolledValue % 3); }
        else if (activePlayer.color === 'Green') { tokenData.r = 6; tokenData.c = 8 - (rolledValue % 3); }
        else if (activePlayer.color === 'Yellow') { tokenData.c = 8; vector.r = 8 - (rolledValue % 3); }
        else if (activePlayer.color === 'Blue') { tokenData.r = 8; tokenData.c = 6 + (rolledValue % 3); }

        // Switch loop sequence safely
        room.activeTurn = (room.activeTurn + 1) % room.players.length;
        startRoomTimer(currentRoomId);

        io.to(currentRoomId).emit('dice_result', {
            player: activePlayer.name,
            color: activePlayer.color,
            roll: rolledValue,
            room: sanitizeRoomData(room)
        });
    });

    // Real-Time Chat Engine with Emojis
    socket.on('send_message', (text) => {
        const room = rooms[currentRoomId];
        if (!room) return;

        const sender = room.players.find(p => p.id === currentUserId) || room.spectators.find(s => s.id === currentUserId);
        if (!sender) return;

        const messagePacket = { sender: sender.name, text: text, timestamp: Date.now() };
        room.messages.push(messagePacket);
        if (room.messages.length > 50) room.messages.shift();

        io.to(currentRoomId).emit('new_message', messagePacket);
    });

    // Minimize and Disconnect Protection Engine
    socket.on('disconnect', () => {
        const room = rooms[currentRoomId];
        if (!room) return;

        const dynamicPlayer = room.players.find(p => p.id === currentUserId);
        if (dynamicPlayer) {
            dynamicPlayer.online = false; // Mark offline but do NOT remove from room array
            setTimeout(() => {
                // Verify if still offline after grace window (minimization handling)
                const verifyRoom = rooms[currentRoomId];
                if (verifyRoom) {
                    const checkP = verifyRoom.players.find(p => p.id === currentUserId);
                    if (checkP && !checkP.online) {
                        io.to(currentRoomId).emit('system_alert', `${checkP.name} is idling in the background.`);
                    }
                }
            }, 8000);
        } else {
            room.spectators = room.spectators.filter(s => s.id !== currentUserId);
        }
        io.to(currentRoomId).emit('room_update', sanitizeRoomData(room));
    });
});

function startRoomTimer(roomId) {
    const room = rooms[roomId];
    if (!room) return;
    room.timeLeft = 30;
    room.turnTimer = setInterval(() => {
        room.timeLeft--;
        if (room.timeLeft <= 0) {
            clearInterval(room.turnTimer);
            room.activeTurn = (room.activeTurn + 1) % room.players.length;
            io.to(roomId).emit('room_update', sanitizeRoomData(room));
            startRoomTimer(roomId);
        } else {
            io.to(roomId).emit('timer_tick', room.timeLeft);
        }
    }, 1000);
}

function sanitizeRoomData(room) {
    return {
        id: room.id,
        players: room.players.map(p => ({ name: p.name, color: p.color, online: p.online, id: p.id })),
        spectatorsCount: room.spectators.length,
        activeTurn: room.activeTurn,
        tokens: room.tokens,
        timeLeft: room.timeLeft
    };
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Cyber Server active on port ${PORT}`));
