export const frontendHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Random Chat</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            color: #fff;
        }

        .header {
            padding: 1rem 2rem;
            background: rgba(0, 0, 0, 0.3);
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .logo {
            font-size: 1.5rem;
            font-weight: bold;
            color: #00d9ff;
        }

        .status-indicator {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 1rem;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            font-size: 0.9rem;
        }

        .status-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: #ffd700;
            animation: pulse 2s infinite;
        }

        .status-dot.connected {
            background: #00ff88;
        }

        .status-dot.disconnected {
            background: #ff4444;
            animation: none;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }

        .main-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            max-width: 800px;
            width: 100%;
            margin: 0 auto;
            padding: 1rem;
        }

        .waiting-screen {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
        }

        .waiting-screen h2 {
            font-size: 2rem;
            margin-bottom: 1rem;
            color: #00d9ff;
        }

        .waiting-screen p {
            color: rgba(255, 255, 255, 0.7);
            margin-bottom: 2rem;
        }

        .spinner {
            width: 60px;
            height: 60px;
            border: 4px solid rgba(0, 217, 255, 0.3);
            border-top-color: #00d9ff;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 2rem;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        .chat-container {
            flex: 1;
            display: none;
            flex-direction: column;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 16px;
            overflow: hidden;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .chat-container.active {
            display: flex;
        }

        .chat-header {
            padding: 1rem 1.5rem;
            background: rgba(0, 0, 0, 0.3);
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .partner-info {
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }

        .partner-avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: linear-gradient(135deg, #00d9ff, #00ff88);
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 1.2rem;
        }

        .partner-name {
            font-weight: 600;
        }

        .partner-status {
            font-size: 0.8rem;
            color: #00ff88;
        }

        .skip-btn {
            padding: 0.6rem 1.5rem;
            background: linear-gradient(135deg, #ff4444, #ff6b6b);
            border: none;
            border-radius: 25px;
            color: white;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .skip-btn:hover {
            transform: scale(1.05);
            box-shadow: 0 4px 15px rgba(255, 68, 68, 0.4);
        }

        .skip-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
        }

        .messages-container {
            flex: 1;
            overflow-y: auto;
            padding: 1rem;
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
            min-height: 400px;
            max-height: 500px;
        }

        .message {
            max-width: 80%;
            padding: 0.75rem 1rem;
            border-radius: 16px;
            word-wrap: break-word;
            animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .message.sent {
            align-self: flex-end;
            background: linear-gradient(135deg, #00d9ff, #0099cc);
            border-bottom-right-radius: 4px;
        }

        .message.received {
            align-self: flex-start;
            background: rgba(255, 255, 255, 0.1);
            border-bottom-left-radius: 4px;
        }

        .message.system {
            align-self: center;
            background: rgba(255, 215, 0, 0.2);
            color: #ffd700;
            font-size: 0.9rem;
            padding: 0.5rem 1rem;
        }

        .message-time {
            font-size: 0.7rem;
            opacity: 0.7;
            margin-top: 0.25rem;
        }

        .input-container {
            padding: 1rem;
            background: rgba(0, 0, 0, 0.3);
            display: flex;
            gap: 0.75rem;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .message-input {
            flex: 1;
            padding: 0.75rem 1rem;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 25px;
            color: white;
            font-size: 1rem;
            outline: none;
            transition: all 0.3s ease;
        }

        .message-input:focus {
            border-color: #00d9ff;
            box-shadow: 0 0 10px rgba(0, 217, 255, 0.3);
        }

        .message-input::placeholder {
            color: rgba(255, 255, 255, 0.5);
        }

        .send-btn {
            padding: 0.75rem 1.5rem;
            background: linear-gradient(135deg, #00d9ff, #00ff88);
            border: none;
            border-radius: 25px;
            color: #1a1a2e;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .send-btn:hover {
            transform: scale(1.05);
            box-shadow: 0 4px 15px rgba(0, 217, 255, 0.4);
        }

        .send-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
        }

        .name-modal {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        }

        .name-modal.hidden {
            display: none;
        }

        .modal-content {
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            padding: 2rem;
            border-radius: 16px;
            text-align: center;
            max-width: 400px;
            width: 90%;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .modal-content h2 {
            color: #00d9ff;
            margin-bottom: 1rem;
        }

        .modal-content p {
            color: rgba(255, 255, 255, 0.7);
            margin-bottom: 1.5rem;
        }

        .name-input {
            width: 100%;
            padding: 0.75rem 1rem;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 8px;
            color: white;
            font-size: 1rem;
            margin-bottom: 1rem;
            outline: none;
        }

        .name-input:focus {
            border-color: #00d9ff;
        }

        .start-btn {
            width: 100%;
            padding: 0.75rem;
            background: linear-gradient(135deg, #00d9ff, #00ff88);
            border: none;
            border-radius: 8px;
            color: #1a1a2e;
            font-weight: 600;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .start-btn:hover {
            transform: scale(1.02);
            box-shadow: 0 4px 15px rgba(0, 217, 255, 0.4);
        }

        .typing-indicator {
            display: none;
            align-self: flex-start;
            padding: 0.75rem 1rem;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            border-bottom-left-radius: 4px;
        }

        .typing-indicator.active {
            display: flex;
            gap: 4px;
        }

        .typing-indicator span {
            width: 8px;
            height: 8px;
            background: rgba(255, 255, 255, 0.5);
            border-radius: 50%;
            animation: bounce 1.4s infinite ease-in-out;
        }

        .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
        .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }

        @keyframes bounce {
            0%, 80%, 100% { transform: scale(0); }
            40% { transform: scale(1); }
        }
    </style>
</head>
<body>
    <!-- Name Modal -->
    <div class="name-modal" id="nameModal">
        <div class="modal-content">
            <h2>👋 Welcome!</h2>
            <p>Enter a nickname to start chatting with random people</p>
            <input type="text" class="name-input" id="nameInput" placeholder="Your nickname..." maxlength="20">
            <button class="start-btn" id="startBtn">Start Chatting</button>
        </div>
    </div>

    <!-- Header -->
    <header class="header">
        <div class="logo">💬 RandomChat</div>
        <div class="status-indicator">
            <div class="status-dot" id="statusDot"></div>
            <span id="statusText">Connecting...</span>
        </div>
    </header>

    <!-- Main Content -->
    <main class="main-container">
        <!-- Waiting Screen -->
        <div class="waiting-screen" id="waitingScreen">
            <div class="spinner"></div>
            <h2>Looking for someone...</h2>
            <p id="waitingMessage">Please wait while we find you a chat partner</p>
        </div>

        <!-- Chat Container -->
        <div class="chat-container" id="chatContainer">
            <div class="chat-header">
                <div class="partner-info">
                    <div class="partner-avatar" id="partnerAvatar">?</div>
                    <div>
                        <div class="partner-name" id="partnerName">Stranger</div>
                        <div class="partner-status" id="partnerStatus">Online</div>
                    </div>
                </div>
                <button class="skip-btn" id="skipBtn">
                    <span>⏭️</span> Skip
                </button>
            </div>
            <div class="messages-container" id="messagesContainer">
                <div class="typing-indicator" id="typingIndicator">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
            <div class="input-container">
                <input type="text" class="message-input" id="messageInput" placeholder="Type a message..." maxlength="500">
                <button class="send-btn" id="sendBtn">Send</button>
            </div>
        </div>
    </main>

    <script>
        // DOM Elements
        const nameModal = document.getElementById('nameModal');
        const nameInput = document.getElementById('nameInput');
        const startBtn = document.getElementById('startBtn');
        const statusDot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');
        const waitingScreen = document.getElementById('waitingScreen');
        const waitingMessage = document.getElementById('waitingMessage');
        const chatContainer = document.getElementById('chatContainer');
        const partnerAvatar = document.getElementById('partnerAvatar');
        const partnerName = document.getElementById('partnerName');
        const partnerStatus = document.getElementById('partnerStatus');
        const skipBtn = document.getElementById('skipBtn');
        const messagesContainer = document.getElementById('messagesContainer');
        const typingIndicator = document.getElementById('typingIndicator');
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');

        // State
        let ws = null;
        let userName = '';
        let userId = '';
        let currentRoomId = '';
        let currentPartner = '';
        let typingTimeout = null;

        // Initialize
        function init() {
            // Check for saved name
            const savedName = localStorage.getItem('chatUserName');
            if (savedName) {
                nameInput.value = savedName;
            }

            // Event listeners
            startBtn.addEventListener('click', startChat);
            nameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') startChat();
            });
            skipBtn.addEventListener('click', skipChat);
            sendBtn.addEventListener('click', sendMessage);
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            });
            messageInput.addEventListener('input', handleTyping);
        }

        function startChat() {
            userName = nameInput.value.trim() || 'Anonymous';
            localStorage.setItem('chatUserName', userName);
            nameModal.classList.add('hidden');
            connect();
        }

        function connect() {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = \`\${protocol}//\${window.location.host}/v1/chat/connect?userName=\${encodeURIComponent(userName)}\`;
            
            updateStatus('connecting');
            
            ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                console.log('WebSocket connected');
                updateStatus('waiting');
            };

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                handleMessage(data);
            };

            ws.onclose = (event) => {
                console.log('WebSocket closed:', event.code, event.reason);
                updateStatus('disconnected');
                // Auto-reconnect after any disconnection
                setTimeout(connect, 2000);
            };

            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                updateStatus('disconnected');
            };
        }

        function handleMessage(data) {
            console.log('Received:', data);
            
            switch (data.type) {
                case 'status':
                    if (data.userId) {
                        userId = data.userId;
                    }
                    if (data.status === 'waiting') {
                        showWaitingScreen();
                        waitingMessage.textContent = data.message || 'Please wait while we find you a chat partner';
                    }
                    break;

                case 'room_joined':
                    currentRoomId = data.roomId;
                    currentPartner = data.partnerName;
                    showChatScreen();
                    updateStatus('connected');
                    addSystemMessage(\`Connected with \${currentPartner}!\`);
                    break;

                case 'message':
                    if (data.userId !== userId) {
                        addMessage(data.content, false, data.userName);
                        typingIndicator.classList.remove('active');
                    }
                    break;

                case 'typing':
                    if (data.userId !== userId) {
                        typingIndicator.classList.add('active');
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                        clearTimeout(typingTimeout);
                        typingTimeout = setTimeout(() => {
                            typingIndicator.classList.remove('active');
                        }, 2000);
                    }
                    break;

                case 'partner_left':
                case 'partner_disconnected':
                    addSystemMessage(\`\${currentPartner} has left the chat\`);
                    partnerStatus.textContent = 'Disconnected';
                    partnerStatus.style.color = '#ff4444';
                    skipBtn.innerHTML = '<span>🔄</span> Find New';
                    break;

                case 'error':
                    addSystemMessage(\`Error: \${data.message}\`);
                    break;
            }
        }

        function updateStatus(status) {
            statusDot.className = 'status-dot';
            switch (status) {
                case 'connecting':
                    statusText.textContent = 'Connecting...';
                    break;
                case 'waiting':
                    statusText.textContent = 'Looking for match...';
                    break;
                case 'connected':
                    statusDot.classList.add('connected');
                    statusText.textContent = 'Connected';
                    break;
                case 'disconnected':
                    statusDot.classList.add('disconnected');
                    statusText.textContent = 'Disconnected';
                    break;
            }
        }

        function showWaitingScreen() {
            waitingScreen.style.display = 'flex';
            chatContainer.classList.remove('active');
            currentRoomId = '';
            currentPartner = '';
        }

        function showChatScreen() {
            waitingScreen.style.display = 'none';
            chatContainer.classList.add('active');
            partnerName.textContent = currentPartner;
            partnerAvatar.textContent = currentPartner.charAt(0).toUpperCase();
            partnerStatus.textContent = 'Online';
            partnerStatus.style.color = '#00ff88';
            skipBtn.innerHTML = '<span>⏭️</span> Skip';
            messagesContainer.innerHTML = '<div class="typing-indicator" id="typingIndicator"><span></span><span></span><span></span></div>';
            messageInput.focus();
        }

        function addMessage(content, isSent, senderName = '') {
            const messageDiv = document.createElement('div');
            messageDiv.className = \`message \${isSent ? 'sent' : 'received'}\`;
            
            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            messageDiv.innerHTML = \`
                <div>\${escapeHtml(content)}</div>
                <div class="message-time">\${time}</div>
            \`;
            
            // Insert before typing indicator
            messagesContainer.insertBefore(messageDiv, document.getElementById('typingIndicator'));
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        function addSystemMessage(content) {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message system';
            messageDiv.textContent = content;
            messagesContainer.insertBefore(messageDiv, document.getElementById('typingIndicator'));
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        function sendMessage() {
            const content = messageInput.value.trim();
            if (!content || !ws || ws.readyState !== WebSocket.OPEN) return;

            ws.send(JSON.stringify({
                type: 'message',
                content: content
            }));

            addMessage(content, true);
            messageInput.value = '';
        }

        function handleTyping() {
            if (!ws || ws.readyState !== WebSocket.OPEN || !currentRoomId) return;
            
            ws.send(JSON.stringify({
                type: 'typing'
            }));
        }

        function skipChat() {
            if (!ws || ws.readyState !== WebSocket.OPEN) return;
            
            ws.send(JSON.stringify({
                type: 'roll'
            }));
            
            showWaitingScreen();
            updateStatus('waiting');
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // Start the app
        init();
    </script>
</body>
</html>`;
