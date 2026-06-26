const socket = io();
const tg = window.Telegram?.WebApp;

if (tg) { tg.expand(); tg.ready(); }

let roomId = null;
const userId = tg?.initDataUnsafe?.user?.id?.toString() || 'usr_' + Math.floor(Math.random() * 10000);
const username = tg?.initDataUnsafe?.user?.first_name || 'Player_' + userId.slice(-4);

const urlParams = new URLSearchParams(window.location.search);
const directRoomId = urlParams.get('room');
if (directRoomId) connectToRoom(directRoomId);

function createNewRoom() {
    const generatedId = Math.floor(1000 + Math.random() * 9000).toString();
    connectToRoom(generatedId);
}

function joinExistingRoom() {
    const inputVal = document.getElementById('join-room-input').value.trim();
    if (inputVal.length < 4) { alert("Enter valid 4 digit code!"); return; }
    connectToRoom(inputVal);
}

function connectToRoom(targetRoomId) {
    roomId = targetRoomId;
    window.history.pushState({}, '', `?room=${roomId}`);
    document.getElementById('room-id-display').innerText = roomId;
    document.getElementById('lobby-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'flex';
    generateLudoMatrix();
    socket.emit('auth_session', { roomId, userId, username });
}

function generateLudoMatrix() {
    const targetBoard = document.getElementById('ludo-grid');
    targetBoard.innerHTML = '';

    // Create Home Base Containers (Spans 6x6 blocks on grid layout)
    const bases = [
        { name: 'red-base', rStart: 1, cStart: 1 },
        { name: 'green-base', rStart: 1, cStart: 10 },
        { name: 'blue-base', rStart: 10, cStart: 1 },
        { name: 'yellow-base', rStart: 10, cStart: 10 }
    ];

    // Build standard 15x15 cell units properly tracking paths
    for (let r = 0; r < 15; r++) {
        for (let c = 0; c < 15; c++) {
            
            // Intercept and skip generating individual cells inside standard bases to structure pockets
            if ((r < 6 && c < 6) || (r < 6 && c > 8) || (r > 8 && c < 6) || (r > 8 && c > 8)) {
                if (r === 0 && c === 0) { createBaseBlock(targetBoard, 'red-base', 1, 1); }
                if (r === 0 && c === 9) { createBaseBlock(targetBoard, 'green-base', 1, 10); }
                if (r === 9 && c === 0) { createBaseBlock(targetBoard, 'blue-base', 10, 1); }
                if (r === 9 && c === 9) { createBaseBlock(targetBoard, 'yellow-base', 10, 10); }
                continue;
            }

            // Center Intersection Nexus Triangles
            if (r >= 6 && r <= 8 && c >= 6 && c <= 8) {
                if (r === 6 && c === 6) {
                    const center = document.createElement('div');
                    center.className = 'nexus-center';
                    center.style.gridColumn = '7 / span 3'; center.style.gridRow = '7 / span 3';
                    center.innerHTML = '<div class="nexus-piece np-top"></div><div class="nexus-piece np-bottom"></div><div class="nexus-piece np-left"></div><div class="nexus-piece np-right"></div>';
                    targetBoard.appendChild(center);
                }
                continue;
            }

            // Normal Track Steps
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.id = `grid-${r}-${c}`;

            // Path Coloration matching visual layouts from 1000052305.png
            if (r === 7 && c > 0 && c < 6) cell.classList.add('classic-red');
            else if (c === 7 && r > 0 && r < 6) cell.classList.add('classic-green');
            else if (r === 7 && c > 8 && c < 14) cell.classList.add('classic-yellow');
            else if (c === 7 && r > 8 && r < 14) cell.classList.add('classic-blue');
            else if (r === 6 && c === 1) { cell.classList.add('classic-red'); cell.innerHTML = '<span class="arrow-mark arrow-red">➔</span>'; }
            else if (r === 1 && c === 8) { cell.classList.add('classic-green'); cell.innerHTML = '<span class="arrow-mark arrow-green">➔</span>'; }
            else if (r === 8 && c === 13) { cell.classList.add('classic-yellow'); cell.innerHTML = '<span class="arrow-mark arrow-yellow">➔</span>'; }
            else if (r === 13 && c === 6) { cell.classList.add('classic-blue'); cell.innerHTML = '<span class="arrow-mark arrow-blue">➔</span>'; }
            
            // Safe Star Coordinates
            if ((r===8 && c===2) || (r===2 && c===6) || (r===6 && c===12) || (r===12 && c===8)) {
                cell.classList.add('star-zone');
            }

            targetBoard.appendChild(cell);
        }
    }
}

function createBaseBlock(parent, className, gRow, gCol) {
    const base = document.createElement('div');
    base.className = `inner-home-pocket ${className}`;
    base.style.gridRow = `${gRow} / span 6`; base.style.gridCol = `${gCol} / span 6`;
    
    // 4 inner spawn spots matching images
    for(let i=0; i<4; i++) {
        const dock = document.createElement('div');
        dock.className = 'pocket-dock';
        base.appendChild(dock);
    }
    parent.appendChild(base);
}

function requestDiceRoll() {
    document.getElementById('visual-dice').classList.add('rolling-fast');
    socket.emit('roll_dice');
}

socket.on('room_update', (room) => {
    document.getElementById('player-count').innerText = room.players.length;
    document.getElementById('spectator-count').innerText = room.spectatorsCount;
    document.getElementById('timer-sec').innerText = room.timeLeft;

    const activePlayer = room.players[room.activeTurn];
    if (activePlayer) {
        const badge = document.getElementById('turn-box');
        badge.innerText = `${activePlayer.name}'s Turn`;
        document.getElementById('roll-trigger').disabled = (activePlayer.id !== userId);
    }

    document.querySelectorAll('.token-entity').forEach(e => e.remove());
    Object.keys(room.tokens).forEach(color => {
        const token = room.tokens[color];
        const hostCell = document.getElementById(`grid-${token.r}-${token.c}`);
        if (hostCell) {
            const tokenEl = document.createElement('div');
            tokenEl.className = `token-entity token-${color.toLowerCase()}`;
            if (activePlayer && activePlayer.color === color) tokenEl.classList.add('pulse-active');
            hostCell.appendChild(tokenEl);
        }
    });
});

socket.on('dice_result', ({ roll }) => {
    const diceBox = document.getElementById('visual-dice');
    const faceSymbols = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    diceBox.classList.remove('rolling-fast');
    diceBox.innerText = faceSymbols[roll - 1];
    if (roll === 6) confetti({ particleCount: 40, spread: 50 });
});

function dispatchChat() {
    const input = document.getElementById('chat-msg');
    if (!input.value.trim()) return;
    socket.emit('send_message', input.value);
    input.value = '';
}
function handleChatKey(e) { if (e.key === 'Enter') dispatchChat(); }

socket.on('new_message', (msg) => {
    const container = document.getElementById('chat-screen');
    container.innerHTML += `<div><strong>${msg.sender}:</strong> ${msg.text}</div>`;
    container.scrollTop = container.scrollHeight;
});
