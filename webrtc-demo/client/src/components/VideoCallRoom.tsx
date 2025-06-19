import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface Participant {
    id: string;
    name: string;
}

export default function VideoCall() {
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const peerRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const socketRef = useRef<Socket | null>(null);
    const isInitiatorRef = useRef(false);
    const roomRef = useRef('');

    const [room, setRoom] = useState('');
    const [name, setName] = useState('');
    const [status, setStatus] = useState('Disconnected');
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [joined, setJoined] = useState(false);
    const [connected, setConnected] = useState(false);
    const [micOn, setMicOn] = useState(true);
    const [camOn, setCamOn] = useState(true);
    const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
    const [remoteVideoKey, setRemoteVideoKey] = useState(Date.now());
    const [uploading, setUploading] = useState(false);

    const updateStatus = (text: string) => setStatus(text);

    const cleanupRemoteVideo = () => {
        const remoteVideo = remoteVideoRef.current;
        const remoteStream = remoteVideo?.srcObject as MediaStream | null;
        remoteStream?.getTracks().forEach(track => track.stop());
        if (remoteVideo) {
            remoteVideo.pause();
            remoteVideo.srcObject = null;
            remoteVideo.removeAttribute('src');
            remoteVideo.load();
        }
    };

    const cleanupPeer = () => {
        peerRef.current?.getSenders().forEach(sender => sender.track?.stop());
        peerRef.current?.close();
        peerRef.current = null;
    };

    useEffect(() => {
        const socket = io('http://localhost:3000', { transports: ['websocket'] });
        socketRef.current = socket;

        socket.on('connect', () => console.log('✅ Socket connected:', socket.id));

        socket.on('participants', setParticipants);

        socket.on('peer-joined', () => {
            console.log('👥 Peer joined');
            if (roomRef.current) socket.emit('ready', roomRef.current);
        });

        const handlePeerLeft = () => {
            console.log('👋 Peer disconnected');
            cleanupRemoteVideo();
            cleanupPeer();
            setRemoteVideoKey(Date.now());
            setConnected(false);
            updateStatus('Peer left. Waiting for reconnection...');
        };

        socket.on('left', handlePeerLeft);
        socket.on('peer-disconnected', handlePeerLeft);

        socket.on('room-joined', async ({ initiator }) => {
            isInitiatorRef.current = initiator;
            updateStatus(initiator ? 'Waiting for peer...' : 'Connecting...');
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            localStreamRef.current = stream;
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;
            setJoined(true);
            setMicOn(true);
            setCamOn(true);
            await createPeerConnection();
            if (!initiator) socket.emit('ready', roomRef.current);
        });

        socket.on('ready', async () => {
            if (isInitiatorRef.current && peerRef.current) {
                const offer = await peerRef.current.createOffer();
                await peerRef.current.setLocalDescription(offer);
                socket.emit('offer', { room: roomRef.current, offer });
            }
        });

        socket.on('offer', async ({ offer }) => {
            if (!peerRef.current) await createPeerConnection();
            await peerRef.current!.setRemoteDescription(offer);
            const answer = await peerRef.current!.createAnswer();
            await peerRef.current!.setLocalDescription(answer);
            socket.emit('answer', { room: roomRef.current, answer });
        });

        socket.on('answer', async ({ answer }) => {
            await peerRef.current?.setRemoteDescription(answer);
        });

        socket.on('candidate', ({ candidate }) => {
            peerRef.current?.addIceCandidate(candidate);
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    const createPeerConnection = async () => {
        if (peerRef.current) return;
        const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });

        localStreamRef.current?.getTracks().forEach((track) => {
            pc.addTrack(track, localStreamRef.current!);
        });

        pc.onicecandidate = (e) => {
            if (e.candidate) {
                socketRef.current?.emit('candidate', { room: roomRef.current, candidate: e.candidate });
            }
        };

        pc.ontrack = (e) => {
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
            updateStatus('Connected');
            setConnected(true);
        };

        pc.onconnectionstatechange = () => {
            if (['disconnected', 'failed'].includes(pc.connectionState)) {
                updateStatus('Disconnected');
            }
        };

        peerRef.current = pc;
    };

    const handleJoin = () => {
        if (!room || !name) return alert('Enter name and room');
        roomRef.current = room;
        socketRef.current?.emit('join-room', { room, name });
    };

    const handleLeave = () => {
        socketRef.current?.emit('left', roomRef.current);
        cleanupPeer();
        localStreamRef.current?.getTracks().forEach(track => track.stop());
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

        setJoined(false);
        setConnected(false);
        setMicOn(true);
        setCamOn(true);
        updateStatus('Disconnected');
    };

    const toggleMic = () => {
        const track = localStreamRef.current?.getAudioTracks()[0];
        if (track) {
            track.enabled = !track.enabled;
            setMicOn(track.enabled);
        }
    };

    const toggleCam = () => {
        const track = localStreamRef.current?.getVideoTracks()[0];
        if (track) {
            track.enabled = !track.enabled;
            setCamOn(track.enabled);
        }
    };

    const chunkIndexRef = useRef(0); // ⬅️ Track the chunk index globally

    const startRecording = () => {
        if (!localStreamRef.current) return;

        const recorder = new MediaRecorder(localStreamRef.current, { mimeType: 'video/webm' });
        mediaRecorderRef.current = recorder;
        chunkIndexRef.current = 0; // ⬅️ Reset index when recording starts

        recorder.ondataavailable = async (event) => {
            if (event.data.size > 0) {
                const index = chunkIndexRef.current;
                console.log(`🔹 Got chunk #${index}`);
                await uploadChunk(event.data, index); // ⬅️ Pass the index
                chunkIndexRef.current += 1;
            }
        };

        recorder.start(5000); // 5-second chunks
        setUploading(true);
    };



    const stopRecording = () => {
        mediaRecorderRef.current?.stop();
        setUploading(false);
    };

    const uploadChunk = async (blob: Blob, index: number) => {
        const formData = new FormData();
        formData.append('chunk', blob);
        formData.append('name', name);
        formData.append('index', index.toString());

        try {
            await fetch('http://localhost:3000/upload-chunk', {
                method: 'POST',
                body: formData,
            });
            console.log(`✅ Uploaded ${name}_${index}.webm`);
        } catch (err) {
            console.error(`Failed to upload chunk ${index}:`, err);
        }
    };


    const canControlMicCam = joined;
    const canRecord = joined; // or `connected` if you prefer stricter control
    const canJoin = !joined;
    const canLeave = joined;

    return (
        <div style={{ textAlign: 'center', fontFamily: 'Arial, sans-serif', backgroundColor: '#f5f5f5', minHeight: '100vh', padding: '20px', color: '#000' }}>
            <h1 style={{ marginBottom: '24px' }}>WebRTC Demo</h1>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 40, marginBottom: 20 }}>
                <video ref={localVideoRef} autoPlay muted playsInline style={{ width: 320, height: 240, background: '#e0e0e0', borderRadius: 6, border: '1px solid #ccc' }} />
                <video key={remoteVideoKey} ref={remoteVideoRef} autoPlay playsInline muted={false} style={{ width: 320, height: 240, background: '#e0e0e0', borderRadius: 6, border: '1px solid #ccc' }} />
            </div>

            <div style={{ marginBottom: 16 }}>
                <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your Name"
                    style={{ padding: 6, marginRight: 8, border: '1px solid #ccc', borderRadius: 4 }}
                />
                <input
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    placeholder="Room Name"
                    style={{ padding: 6, marginRight: 8, border: '1px solid #ccc', borderRadius: 4 }}
                />
                <button onClick={handleJoin} disabled={!canJoin} className="button">
                    Join Call
                </button>
                <button onClick={handleLeave} disabled={!canLeave} className="button">
                    Leave Call
                </button>
            </div>

            <button onClick={toggleMic} disabled={!joined} className="button">
                {micOn ? 'Mute Mic' : 'Unmute Mic'}
            </button>
            <button onClick={toggleCam} disabled={!joined} className="button">
                {camOn ? 'Turn Off Camera' : 'Turn On Camera'}
            </button>
            <button onClick={startRecording} disabled={!joined} className="button">
                Start Recording
            </button>
            <button onClick={stopRecording} disabled={!joined} className="button">
                Stop Recording
            </button>



            <p style={{ fontWeight: 500 }}>Status: <span style={{ fontWeight: 'bold' }}>{status}</span></p>

            {joined && (
                <div style={{ marginTop: 16 }}>
                    <h3 style={{ marginBottom: 8, fontSize: '18px' }}>Participants:</h3>
                    <ul style={{
                        listStyleType: 'none',
                        paddingLeft: 0,
                        display: 'inline-block',
                        textAlign: 'left',
                        margin: '0 auto',
                        fontSize: '16px',
                        lineHeight: '1.8',
                        background: '#fff',
                        padding: '10px 16px',
                        borderRadius: '6px',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                    }}>
                        {participants.map((p) => (
                            <li key={p.id}>
                                <span style={{ fontWeight: p.id === socketRef.current?.id ? 'bold' : 500 }}>
                                    {p.id === socketRef.current?.id ? `🟢 You` : `👤 Peer`}
                                </span>{` `}
                                <span style={{ color: '#555' }}>({p.name})</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}



            {recordedChunks.length > 0 && (
                <div style={{ marginTop: 12 }}>
                    <a
                        href={URL.createObjectURL(new Blob(recordedChunks, { type: 'video/webm' }))}
                        download="recording.webm"
                        style={{ color: '#1976d2', textDecoration: 'underline' }}
                    >
                        Download Recording
                    </a>
                </div>
            )}
        </div>
    );
}
