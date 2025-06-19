const socket = io();
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// UI Elements
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const joinBtn = document.getElementById('joinBtn');
const leaveBtn = document.getElementById('leaveBtn');
const startRecordingBtn = document.getElementById('startBtn');
const stopRecordingBtn = document.getElementById('stopBtn');
const statusText = document.getElementById("statusText");

let localStream, peerConnection, room;
let isInitiator = false;

// UI Updates
const updateStatus = (text, color = "gray") => {
    statusText.textContent = "Status: " + text;
    statusText.style.color = color;
};

const setCallUI = ({ joined, connected }) => {
    joinBtn.disabled = joined;
    leaveBtn.disabled = !joined;
    startRecordingBtn.disabled = !connected;
    stopRecordingBtn.disabled = true; // Enabled only while recording
};

// Socket Events
socket.on("connect", () => console.log("Socket connected"));
socket.on("disconnect", () => updateStatus("Server disconnected", "red"));

// Join Room
joinBtn.onclick = async () => {
    room = document.getElementById("roomInput").value.trim();
    if (!room) return alert("Enter a room name");
    socket.emit("join-room", room);
};

socket.on("room-joined", async ({ initiator }) => {
    isInitiator = initiator;

    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;

    await createPeerConnection();
    setCallUI({ joined: true, connected: false });

    if (isInitiator) {
        updateStatus("Waiting for peer...", "orange");
    } else {
        updateStatus("Connecting...", "orange");
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit("offer", { room, offer });
    }
});

socket.on("peer-disconnected", () => {
    updateStatus("Peer left — waiting...", "orange");
    remoteVideo.srcObject = null;
    if (peerConnection) peerConnection.close();
});

leaveBtn.onclick = () => {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localVideo.srcObject = null;
    }
    remoteVideo.srcObject = null;
    setCallUI({ joined: false, connected: false });
    updateStatus("Disconnected", "gray");
    console.log("Call ended");
};

// WebRTC
async function createPeerConnection() {
    peerConnection = new RTCPeerConnection(config);

    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    peerConnection.ontrack = e => {
        remoteVideo.srcObject = e.streams[0];
    };

    peerConnection.onicecandidate = e => {
        if (e.candidate) socket.emit('candidate', { room, candidate: e.candidate });
    };

    peerConnection.onconnectionstatechange = () => {
        console.log("WebRTC state:", peerConnection.connectionState);
        switch (peerConnection.connectionState) {
            case "connected":
                updateStatus("Connected", "green");
                setCallUI({ joined: true, connected: true });
                break;
            case "disconnected":
            case "failed":
                updateStatus("Disconnected", "red");
                break;
            case "closed":
                updateStatus("Call ended", "gray");
                break;
            default:
                updateStatus("Connecting...", "orange");
        }
    };
}

// Signaling
socket.on("offer", async ({ offer }) => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    updateStatus("Connecting...", "orange");

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit("answer", { room, answer });
});

socket.on("answer", async ({ answer }) => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    updateStatus("Connecting...", "orange");
});

socket.on("candidate", ({ candidate }) => {
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
});
