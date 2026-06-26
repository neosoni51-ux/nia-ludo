const socket = io();
const tg = window.Telegram?.WebApp;

// Expand WebApp viewport parameters for premium feel inside Telegram
if (tg) {
    tg.expand();
    tg.ready();
}

// Generate fallback temporary dynamic ID parameters if run outside Telegram wrapper
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room') || '1001';
const userId = tg?.initDataUnsafe?.user?.id?.toString() || 'usr_' + Math.floor(Math.random() * 10000);
const username = tg?.initDataUnsafe?.user?.first_name || 'Player_' + userId.slice(-4);

document.getElementById('room-id-display').innerText = roomId;

// Procedural Audio Synthesizer Engine (Eliminating external asset dependency tracks)
function triggerAudioPulse(type) {
    const context = new (window.AudioContext || window.webkitAudioContext)();
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.connect(gain); gain.connect(context.destination);

    if (type === 'roll') { osc.frequency.setValueAtTime(220, context.currentTime); osc.type = 'triangle'; }
    else if (type === 'move') { osc.frequency.setValueAtTime(580, context.currentTime); osc.type = 'sine'; }
    
    gain.gain.setValueAtTime(0.15, context.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, context.currentTime + 0.15);
    osc.start(); osc.stop(context.currentTime + 0.15);
}

// Global Authentication Handshake
socket.emit('auth_session', { roomId, userId, username });

// Dynamic Board Visual Construction 
function generateLudoMatrix() {
    const targetBoard = document.getElementById('ludo-grid');
    targetBoard.innerHTML = '';

    for (let r = 0; r < 15; r++) {
        for (let c = 0; c < 15; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.id = `grid-${r}-${c}`;

            if (r < 6 && c < 6) cell.classList.add('red-base');
            else if (r < 6 && c > 8) cell.classList.add('green-base');
            else if (r > 8 && c < 6) cell.classList.add('blue-base');
            else if (r > 8 && c > 8) cell.classList.add('yellow-base');
            else if (r >= 6 && r <= 8 && c >= 6 && c <= 8) cell.classList.add('center-nexus');
            else if (r === 7 && c > 0 && c < 6) cell.classList.add('red-base');
            else if (c === 7 && r > 0 && r < 6) cell.classList.add('green-base');
            else if (r === 7 && c > 8 && c < 14) cell.classList.add('yellow-base');
            else if (c === 7 && r > 8 && r < 14) cell.classList.add('blue-base');
            else if ((r===6 && c===1) || (r===1 && c===8) || (r===8 && c===13) || (r===13 && c===6)) cell.classList.add('star-node');

            targetBoard.appendChild(cell);
        }
    }
}

function requestDiceRoll() {
    triggerAudioPulse('roll');
    document.getElementById('visual-dice').classList.add('rolling-fast');
    socket.emit('roll_dice');
}

// Receive Server State Updates
socket.on('room_update', (room) => {
    document.getElementById('player-count').innerText = room.players.length;
    document.getElementById('spectator-count').innerText = room.spectatorsCount;
    document.getElementById('timer-sec').innerText = room.timeLeft;

    const activePlayer = room.players[room.activeTurn];
    if (activePlayer) {
        const badge = document.getElementById('turn-box');
        badge.innerText = `${activePlayer.name}'s Turn`;
        badge.className = `turn-status ${activePlayer.color.toLowerCase()}-glow`;

        // Toggle action engine locks
        document.getElementById('roll-trigger').disabled = (activePlayer.id !== userId);
    }

    // Refresh Tokens position layout maps
    document.querySelectorAll('.token-entity').forEach(e => e.remove());
    Object.keys(room.tokens).forEach(color => {
        const token = room.tokens[color];
        const hostCell = document.getElementById(`grid-${token.r}-${token.c}`);
        if (hostCell) {
            const tokenEl = document.createElement('div');
            tokenEl.className = `token-entity`;
            tokenEl.style.backgroundColor = color === 'Red' ? '#ff0055' : color === 'Green' ? '#00ff66' : color === 'Yellow' ? '#ffcc00' : '#00f2fe';
            if (activePlayer && activePlayer.color === color) tokenEl.classList.add('pulse-active');
            hostCell.appendChild(tokenEl);
        }
    });
});

socket.on('dice_result', ({ player, color, roll, room }) => {
    const diceBox = document.getElementById('visual-dice');
    const faceSymbols = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    diceBox.classList.remove('rolling-fast');
    diceBox.innerText = faceSymbols[roll - 1];
    triggerAudioPulse('move');

    if (roll === 6) {
        confetti({ particleCount: 40, spread: 60, origin: { y: 0.8 } });
    }
});

// Sync Messaging Components
function dispatchChat() {
    const input = document.getElementById('chat-msg');
    if (!input.value.trim()) return;
    socket.emit('send_message', input.value);
    input.value = '';
}

function handleChatKey(e) { if (e.key === 'Enter') dispatchChat(); }

socket.on('new_message', (msg) => {
    const container = document.getElementById('chat-screen');
    const element = document.createElement('div');
    element.innerHTML = `<strong>${msg.sender}:</strong> ${msg.text}`;
    container.appendChild(element);
    container.scrollTop = container.scrollHeight;
});

socket.on('chat_history', (history) => {
    const container = document.getElementById('chat-screen');
    container.innerHTML = '';
    history.forEach(msg => {
        const element = document.createElement('div');
        element.innerHTML = `<strong>${msg.sender}:</strong> ${msg.text}`;
        container.appendChild(element);
    });
    container.scrollTop = container.scrollHeight;
});

window.onload = () => { generateLudoMatrix(); };
