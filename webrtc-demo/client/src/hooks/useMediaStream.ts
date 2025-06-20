import { useRef, useState } from 'react';

export default function useMediaStream() {
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const localStreamRef = useRef<MediaStream | null>(null);

    const [remoteVideoKey, setRemoteVideoKey] = useState(Date.now());
    const [micOn, setMicOn] = useState(true);
    const [camOn, setCamOn] = useState(true);

    /**
     * Requests camera/microphone permissions and attaches the stream to local video
     */
    const startMedia = async (): Promise<MediaStream> => {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
        }
        return stream;
    };

    /**
     * Stops all media tracks and clears local and remote video refs
     */
    const stopMedia = (): void => {
        localStreamRef.current?.getTracks().forEach(track => track.stop());
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = null;
        }

        const remoteStream = remoteVideoRef.current?.srcObject as MediaStream | null;
        remoteStream?.getTracks().forEach(track => track.stop());
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
            setRemoteVideoKey(Date.now()); // force re-render
        }
    };

    /**
     * Toggles microphone state
     */
    const toggleMic = (): void => {
        const track = localStreamRef.current?.getAudioTracks()[0];
        if (track) {
            track.enabled = !track.enabled;
            setMicOn(track.enabled);
        }
    };

    /**
     * Toggles camera state
     */
    const toggleCam = (): void => {
        const track = localStreamRef.current?.getVideoTracks()[0];
        if (track) {
            track.enabled = !track.enabled;
            setCamOn(track.enabled);
        }
    };

    return {
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
    };
}
