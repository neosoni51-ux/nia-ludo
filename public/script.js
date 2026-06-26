// REPLACE THIS WITH YOUR DEPLOYED RENDER/RAILWAY SERVER URL
const SERVER_URL = "http://localhost:3000"; 
const socket = io(SERVER_URL);

// --- TELEGRAM WEB APP INTEGRATION ---
const tg = window.Telegram.WebApp;

// Anti-Leave Protection: User ko galti se game minimize/close karne par warning dega
tg.expand();
tg.enableClosingConfirmation(); 
tg.ready();

// User Data Extract karein
const user = tg.initDataUnsafe?.user;
const myName = user ? (user.first_name + (user.last_name ? " " + user.last_name : "")) : "Guest_" + Math.floor(Math.random()*1000);
const myDp = user ? user.photo_url : "https://cdn-icons-png.flaticon.com/512/149/149071.png";

document.getElementById('user-name').innerText = myName;
document.getElementById('user-dp').src = myDp;

let currentRoom = "";

// --- URL SE AUTO JOIN LOGIC (Agar Nia bot ne startapp bheja hai) ---
const startParam = tg.initDataUnsafe?.start_param;
if (startParam) {
    document.getElementById('join-code').value = startParam;
    setTimeout(() => {
        document.getElementById('join-btn').click();
    }, 1000); // 1 sec delay takki socket connect ho jaye
}

// --- BUTTON CLICKS ---
document.getElementById('create-btn').addEventListener('click', () => {
    socket.emit('createRoom', { name: myName, dp: myDp });
});

document.getElementById('join-btn').addEventListener('click', () => {
    const code = document.getElementById('join-code').value.toUpperCase();
    if (code) {
        socket.emit('joinRoom', { roomCode: code, userData: { name: myName, dp: myDp } });
    }
});

// --- SOCKET EVENTS ---
socket.on('roomCreated', (code) => {
    currentRoom = code;
    document.getElementById('display-room-code').innerText = code;
    document.getElementById('menu-screen').style.display = 'none';
    document.getElementById('ludo-board').style.display = 'block';
});

socket.on('updateLobby', (roomData) => {
    currentRoom = roomData.roomCode || document.getElementById('display-room-code').innerText;
    document.getElementById('display-room-code').innerText = currentRoom;
    document.getElementById('spectator-count').innerText = roomData.spectators.length;
    document.getElementById('menu-screen').style.display = 'none';
    document.getElementById('ludo-board').style.display = 'block';
    
    // Yahan aap players ke DPs board ke kone me draw karne ka function call karenge
});

socket.on('spectatorMode', (msg) => {
    alert(msg);
});

// --- DICE ROLL (Sound & Animation) ---
const rollSound = new Audio('https://www.soundjay.com/misc/sounds/dice-roll-1.mp3'); // Smooth sound

document.getElementById('roll-dice-btn').addEventListener('click', () => {
    if(!currentRoom) return;
    rollSound.play();
    socket.emit('rollDice', { roomCode: currentRoom, playerColor: 'red' }); // Dynamic color aayega DB se
});

socket.on('diceRolled', (data) => {
    const diceDiv = document.getElementById('dice-result');
    diceDiv.innerText = "🎲 Rolling...";
    setTimeout(() => {
        diceDiv.innerText = data.diceValue;
    }, 500); // Fake smooth delay
});

// --- LIVE CHAT SYSTEM ---
document.getElementById('send-msg-btn').addEventListener('click', sendMessage);
document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if(e.key === 'Enter') sendMessage();
});

function sendMessage() {
    const msgInput = document.getElementById('chat-input');
    const msg = msgInput.value.trim();
    if(msg && currentRoom) {
        socket.emit('sendMessage', { roomCode: currentRoom, message: msg, senderName: myName });
        msgInput.value = '';
    }
}

socket.on('receiveMessage', ({ senderName, message }) => {
    const chatBox = document.getElementById('chat-messages');
    const msgDiv = document.createElement('div');
    msgDiv.className = 'msg';
    msgDiv.innerHTML = `<strong>${senderName}:</strong> ${message}`;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight; // Auto-scroll
});

// --- WINNER CONFETTI FUNCTION ---
function triggerWin() {
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
}
