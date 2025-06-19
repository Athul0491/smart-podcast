const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const joinBtn = document.getElementById('joinBtn');
const leaveBtn = document.getElementById('leaveBtn');

const socket = io();
let localStream;
let peerConnection;
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

let room;
let isInitiator = false;

// Join Call
joinBtn.onclick = async () => {
  room = document.getElementById("roomInput").value.trim();
  if (!room) {
    alert("Please enter a room name.");
    return;
  }

  socket.emit("join-room", room);
};

socket.on("room-joined", async () => {
  joinBtn.disabled = true;
  leaveBtn.disabled = false;
  isInitiator = true;

  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;

  await createPeerConnection();

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit("offer", { room, offer });
});

socket.on("room-joined-second", async () => {
  joinBtn.disabled = true;
  leaveBtn.disabled = false;

  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;

  await createPeerConnection();
});

// Leave Call
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

  joinBtn.disabled = false;
  leaveBtn.disabled = true;
  console.log("Call ended");
};

async function createPeerConnection() {
  peerConnection = new RTCPeerConnection(config);

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.onicecandidate = e => {
    if (e.candidate) {
      socket.emit('candidate', e.candidate);
    }
  };

  peerConnection.ontrack = e => {
    remoteVideo.srcObject = e.streams[0];
  };
}

// Handle socket events
socket.on("offer", async ({ offer }) => {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit("answer", { room, answer });
});

socket.on("answer", async ({ answer }) => {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on("candidate", ({ candidate }) => {
  peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
});
