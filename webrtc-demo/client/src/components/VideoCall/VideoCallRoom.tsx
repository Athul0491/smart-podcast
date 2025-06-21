import { useState } from 'react';
import type { Session } from '@supabase/supabase-js';

import AppHeader from '../Header/AppHeader';
import ParticipantsList from '../RoomAccess/ParticipantsList';
import RoomInputs from '../RoomAccess/RoomInputs';
import CallControls from '../CallControls/CallControls';
import RecordingDownload from '../Recording/RecordingDownload';
import PastRecordings from '../Recording/PastRecordings';

import useMediaStream from '../../hooks/useMediaStream';
import usePeerConnection from '../../hooks/usePeerConnection';
import useRecording from '../../hooks/useRecording';

interface VideoCallRoomProps {
    session: Session;
    onLogout: () => void;
}

export default function VideoCallRoom({ session, onLogout }: VideoCallRoomProps) {
    const [room, setRoom] = useState('');
    const [name, setName] = useState('');
    const [status, setStatus] = useState('Disconnected');

    const {
        localVideoRef,
        remoteVideoRef,
        localStreamRef,
        remoteVideoKey,
        micOn,
        camOn,
        toggleMic,
        toggleCam,
        startMedia,
        stopMedia,
    } = useMediaStream();

    const {
        participants,
        joined,
        connected,
        joinRoom,
        leaveRoom,
        socketRef,
    } = usePeerConnection({
        room,
        name,
        localVideoRef,
        remoteVideoRef,
        remoteVideoKey,
        startMedia,
        stopMedia,
        setStatus,
    });

    const {
        startRecording,
        stopRecording,
        uploading,
        recordedChunks,
    } = useRecording({
        session,
        localStreamRef,
        name,
    });

    return (
        <main className="videocall-container">
            <AppHeader session={session} onLogout={onLogout} />

            <section className="video-section">
                <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="video-box"
                />
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video
                    key={remoteVideoKey}
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    muted={false}
                    className="video-box"
                />
            </section>

            <RoomInputs
                name={name}
                room={room}
                setName={setName}
                setRoom={setRoom}
                onJoin={joinRoom}
                onLeave={leaveRoom}
                canJoin={!!room && !!name && !joined}
                canLeave={joined}
            />

            <CallControls
                joined={joined}
                micOn={micOn}
                camOn={camOn}
                toggleMic={toggleMic}
                toggleCam={toggleCam}
                startRecording={startRecording}
                stopRecording={stopRecording}
                onLogout={onLogout}
            />

            <p className="status-text">
                Status: <strong>{status}</strong>
            </p>

            {joined && (
                <ParticipantsList
                    participants={participants}
                    socketId={socketRef.current?.id}
                />
            )}
            <PastRecordings userId={session.user.id} />

            <RecordingDownload recordedChunks={recordedChunks} />
        </main>
    );
}
