
// Cấu hình hệ thống
const deviceIP = "192.168.1.4"; // Thay bằng IP của ESP32
// Cấu hình hệ thống
const config = {
    deviceIP: '192.168.1.4', // Thay bằng IP thực của ESP32
    port: 81,
    ttsSettings: {
        lang: 'vi-VN',
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0
    }
};

// Biến toàn cục
let websocket = null;
let voicesLoaded = false;

// Hàm khởi tạo WebSocket
function initWebSocket() {
    websocket = new WebSocket(`ws://${config.deviceIP}:${config.port}`);
    
    websocket.onopen = () => {
        console.log('✅ Kết nối WebSocket thành công');
        updateConnectionStatus(true);
        sendWebSocketMessage({ type: 'get_status' });
    };
    
    websocket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            console.log('Nhận dữ liệu:', data);
            
            if (data.type === 'ai_response') {
                addBotMessage(data.message);
                speak(data.message);
            } else if (data.type === 'led_status') {
                updateLEDState(data.value);
            }
        } catch (error) {
            console.error('Lỗi phân tích tin nhắn:', error);
        }
    };
    
    websocket.onclose = () => {
        console.log('❌ Mất kết nối, thử lại sau 5s...');
        updateConnectionStatus(false);
        setTimeout(initWebSocket, 5000);
    };
    
    websocket.onerror = (error) => {
        console.error('Lỗi WebSocket:', error);
        updateConnectionStatus(false);
    };
}

// Hàm phát giọng nói
function speak(text) {
    if (!voicesLoaded) {
        console.warn('Giọng nói chưa sẵn sàng');
        return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = config.ttsSettings.lang;
    utterance.rate = config.ttsSettings.rate;
    utterance.pitch = config.ttsSettings.pitch;
    utterance.volume = config.ttsSettings.volume;

    // Tìm giọng tiếng Việt (ưu tiên giọng nữ)
    const voices = window.speechSynthesis.getVoices();
    const vietnameseVoice = voices.find(voice => 
        voice.lang.includes('vi') && 
        (voice.name.toLowerCase().includes('female') || voice.name.includes('Google'))
    );
    
    if (vietnameseVoice) {
        utterance.voice = vietnameseVoice;
    }

    // Highlight tin nhắn đang được đọc
    const messages = document.querySelectorAll('.bot-message');
    const lastMessage = messages[messages.length - 1];
    if (lastMessage) {
        lastMessage.classList.add('speaking');
        utterance.onend = () => lastMessage.classList.remove('speaking');
        utterance.onerror = () => lastMessage.classList.remove('speaking');
    }

    window.speechSynthesis.speak(utterance);
}

// Khởi tạo Text-to-Speech
function initTTS() {
    if (!('speechSynthesis' in window)) {
        console.warn('Trình duyệt không hỗ trợ Text-to-Speech');
        return;
    }

    // Load danh sách giọng nói
    speechSynthesis.onvoiceschanged = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
            voicesLoaded = true;
            console.log('Đã tải giọng nói:', voices.map(v => `${v.name} (${v.lang})`));
        }
    };

    // Thử load voices ngay lập tức
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
        voicesLoaded = true;
    }
}

// Cập nhật trạng thái kết nối
function updateConnectionStatus(connected) {
    const statusElement = document.getElementById('connection-status');
    if (!statusElement) return;

    if (connected) {
        statusElement.textContent = `✅ Đã kết nối với ${config.deviceIP}`;
        statusElement.className = 'connection-status connected';
    } else {
        statusElement.textContent = '❌ Mất kết nối, đang thử kết nối lại...';
        statusElement.className = 'connection-status disconnected';
    }
}

// Thêm tin nhắn vào khung chat
function addUserMessage(message) {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;

    const messageElement = document.createElement('div');
    messageElement.className = 'message user-message';
    messageElement.textContent = message;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addBotMessage(message) {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;

    const messageElement = document.createElement('div');
    messageElement.className = 'message bot-message';
    messageElement.textContent = message;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Cập nhật trạng thái LED
function updateLEDState(state) {
    const ledIndicator = document.getElementById('led-indicator');
    const ledText = document.getElementById('led-text');
    if (ledIndicator && ledText) {
        ledIndicator.classList.toggle('on', state);
        ledText.textContent = state ? 'Đèn đang BẬT' : 'Đèn đang TẮT';
    }
}

// Gửi tin nhắn chat
function sendChatMessage() {
    const input = document.getElementById('user-input');
    const message = input.value.trim();
    if (!message) return;

    addUserMessage(message);
    sendWebSocketMessage({ type: 'ai_chat', message });
    input.value = '';
}

// Gửi tin nhắn qua WebSocket
function sendWebSocketMessage(message) {
    if (websocket?.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify(message));
    } else {
        console.warn('Chưa kết nối WebSocket');
        addBotMessage("Xin lỗi, tôi chưa kết nối được với thiết bị. Vui lòng thử lại sau.");
    }
}

// Khởi động ứng dụng
document.addEventListener('DOMContentLoaded', () => {
    initTTS();
    initWebSocket();

    // Xử lý nút điều khiển
    document.getElementById('btn-on')?.addEventListener('click', () => {
        sendWebSocketMessage({ type: 'led_control', command: 'on' });
        addUserMessage('bật đèn');
    });

    document.getElementById('btn-off')?.addEventListener('click', () => {
        sendWebSocketMessage({ type: 'led_control', command: 'off' });
        addUserMessage('tắt đèn');
    });

    // Xử lý chat
    document.getElementById('send-btn')?.addEventListener('click', sendChatMessage);
    document.getElementById('user-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });

    // Xử lý nhận diện giọng nói
    document.getElementById('btn-voice')?.addEventListener('click', handleVoiceCommand);
});

// Xử lý nhận diện giọng nói
function handleVoiceCommand() {
    if (!('webkitSpeechRecognition' in window)) {
        alert('Trình duyệt không hỗ trợ nhận diện giọng nói');
        return;
    }

    const recognition = new webkitSpeechRecognition();
    recognition.lang = 'vi-VN';
    recognition.interimResults = false;

    recognition.onstart = () => {
        document.getElementById('btn-voice').textContent = 'Đang nghe...';
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        document.getElementById('user-input').value = transcript;
        sendChatMessage();
    };

    recognition.onerror = (event) => {
        console.error('Lỗi nhận diện giọng nói:', event.error);
        document.getElementById('btn-voice').textContent = 'NÓI VỚI AI';
    };

    recognition.onend = () => {
        document.getElementById('btn-voice').textContent = 'NÓI VỚI AI';
    };

    recognition.start();
}