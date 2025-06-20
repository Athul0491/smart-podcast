import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface Props {
    room: string;
    name: string;
    localVideoRef: React.RefObject<HTMLVideoElement | null>;
    remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
    remoteVideoKey: number;
    startMedia: () => Promise<MediaStream>;
    stopMedia: () => void;
    setStatus: (text: string) => void;
}

interface Participant {
    id: string;
    name: string;
}

export default function usePeerConnection({
    room,
    name,
    localVideoRef,
    remoteVideoRef,
    remoteVideoKey,
    startMedia,
    stopMedia,
    setStatus,
}: Props) {
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [joined, setJoined] = useState(false);
    const [connected, setConnected] = useState(false);

    const socketRef = useRef<Socket | null>(null);
    const peerRef = useRef<RTCPeerConnection | null>(null);
    const roomRef = useRef<string>('');
    const isInitiatorRef = useRef<boolean>(false);
    const streamRef = useRef<MediaStream | null>(null);

    useEffect(() => {
        const socket = io('http://localhost:3000', { transports: ['websocket'] });
        socketRef.current = socket;

        socket.on('connect', () => console.log('✅ Connected:', socket.id));
        socket.on('participants', setParticipants);

        socket.on('peer-joined', () => {
            console.log('👥 Peer joined');
            if (roomRef.current) socket.emit('ready', roomRef.current);
        });

        socket.on('room-joined', async ({ initiator }) => {
            isInitiatorRef.current = initiator;
            setStatus(initiator ? 'Waiting for peer...' : 'Connecting...');
            const stream = await startMedia();
            streamRef.current = stream;
            await createPeerConnection();
            if (!initiator) socket.emit('ready', roomRef.current);
            setJoined(true);
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

        socket.on('peer-disconnected', handlePeerLeft);
        socket.on('left', handlePeerLeft);

        return () => {
            socket.disconnect();
        };
    }, []);

    const handlePeerLeft = () => {
        console.log('👋 Peer left');
        cleanupPeer();
        setConnected(false);
        setStatus('Peer left');
    };

    const createPeerConnection = async () => {
        if (peerRef.current) return;

        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        });

        // Attach local stream tracks to connection
        streamRef.current?.getTracks().forEach(track => {
            pc.addTrack(track, streamRef.current!);
        });

        // ICE candidate exchange
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socketRef.current?.emit('candidate', {
                    room: roomRef.current,
                    candidate: event.candidate,
                });
            }
        };

        // Handle incoming remote media
        pc.ontrack = (event) => {
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = event.streams[0];
                setConnected(true);
                setStatus('Connected');
            }
        };

        peerRef.current = pc;
    };

    const cleanupPeer = () => {
        peerRef.current?.getSenders().forEach(sender => sender.track?.stop());
        peerRef.current?.close();
        peerRef.current = null;
        stopMedia();
    };

    const joinRoom = () => {
        if (!room || !name) {
            alert('Enter name and room');
            return;
        }
        roomRef.current = room;
        socketRef.current?.emit('join-room', { room, name });
    };

    const leaveRoom = () => {
        socketRef.current?.emit('left', roomRef.current);
        cleanupPeer();
        setJoined(false);
        setConnected(false);
        setStatus('Disconnected');
    };

    return {
        participants,
        joined,
        connected,
        joinRoom,
        leaveRoom,
        socketRef,
    };
}
