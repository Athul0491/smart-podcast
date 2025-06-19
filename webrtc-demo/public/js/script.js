const socket = io();

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const roomInput = document.getElementById("roomInput");
const nameInput = document.getElementById("nameInput");

const joinBtn = document.getElementById("joinBtn");
const leaveBtn = document.getElementById("leaveBtn");

const micBtn = document.getElementById("micBtn");
const camBtn = document.getElementById("camBtn");

const startRecordingBtn = document.getElementById("startBtn");
const stopRecordingBtn = document.getElementById("stopBtn");

const statusText = document.getElementById("statusText");
const participantList = document.getElementById("participantList");

let peerConnection;
let localStream;
let room;
let displayName;
let isInitiator = false;
let mediaRecorder;
let recordedChunks = [];

const config = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

function updateStatus(text, color = "gray") {
  statusText.textContent = "Status: " + text;
  statusText.className = "";
  if (color === "green") statusText.classList.add("status-connected");
  else if (color === "orange") statusText.classList.add("status-waiting");
  else if (color === "red") statusText.classList.add("status-disconnected");
}

function setCallUI({ joined, connected }) {
  joinBtn.disabled = joined;
  leaveBtn.disabled = !joined;
  micBtn.disabled = !joined;
  camBtn.disabled = !joined;
  startRecordingBtn.disabled = !connected;
  stopRecordingBtn.disabled = true;
}

joinBtn.onclick = async () => {
  room = roomInput.value.trim();
  displayName = nameInput.value.trim() || `User-${Math.floor(Math.random() * 1000)}`;
  if (!room) return alert("Please enter a room name");

  socket.emit("join-room", { room, name: displayName });
};

leaveBtn.onclick = () => {
  if (peerConnection) peerConnection.close();
  peerConnection = null;

  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localVideo.srcObject = null;
  }

  remoteVideo.srcObject = null;
  updateStatus("Disconnected", "gray");
  setCallUI({ joined: false, connected: false });
  micBtn.textContent = "Mute Mic";
  camBtn.textContent = "Turn Off Camera";
};

socket.on("room-joined", async ({ initiator }) => {
  isInitiator = initiator;
  updateStatus(initiator ? "Waiting for peer..." : "Connecting...", "orange");

  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;

  setCallUI({ joined: true, connected: false });
  micBtn.textContent = "Mute Mic";
  camBtn.textContent = "Turn Off Camera";

  await createPeerConnection();

  if (!initiator) {
    socket.emit("ready", room);
  }
});

socket.on("ready", async () => {
  if (isInitiator && peerConnection) {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit("offer", { room, offer });
  }
});

socket.on("offer", async ({ offer }) => {
  if (!peerConnection) await createPeerConnection();
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit("answer", { room, answer });
});

socket.on("answer", async ({ answer }) => {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on("candidate", ({ candidate }) => {
  if (peerConnection) {
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }
});

socket.on("participants", (list) => {
  participantList.innerHTML = "";
  list.forEach(({ id, name }) => {
    const label = id === socket.id ? "You" : "Peer";
    const li = document.createElement("li");
    li.textContent = `${label} (${name})`;
    participantList.appendChild(li);
  });
});

async function createPeerConnection() {
  peerConnection = new RTCPeerConnection(config);

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.onicecandidate = e => {
    if (e.candidate) {
      socket.emit("candidate", { room, candidate: e.candidate });
    }
  };

  peerConnection.ontrack = e => {
    remoteVideo.srcObject = e.streams[0];
  };

  peerConnection.onconnectionstatechange = () => {
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
        updateStatus("Call Ended", "gray");
        break;
    }
  };
}

// Mic / Camera Toggles
micBtn.onclick = () => {
  const audio = localStream.getAudioTracks()[0];
  if (!audio) return;
  audio.enabled = !audio.enabled;
  micBtn.textContent = audio.enabled ? "Mute Mic" : "Unmute Mic";
};

camBtn.onclick = () => {
  const video = localStream.getVideoTracks()[0];
  if (!video) return;
  video.enabled = !video.enabled;
  camBtn.textContent = video.enabled ? "Turn Off Camera" : "Turn On Camera";
};

// MediaRecorder (optional)
startRecordingBtn.onclick = () => {
  recordedChunks = [];
  mediaRecorder = new MediaRecorder(localStream, { mimeType: 'video/webm' });

  mediaRecorder.ondataavailable = e => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };

  mediaRecorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const link = document.getElementById("downloadLink");
    link.href = url;
    link.style.display = 'inline';
  };

  mediaRecorder.start();
  startRecordingBtn.disabled = true;
  stopRecordingBtn.disabled = false;
};

stopRecordingBtn.onclick = () => {
  mediaRecorder.stop();
  startRecordingBtn.disabled = false;
  stopRecordingBtn.disabled = true;
};
