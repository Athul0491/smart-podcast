import MediaToggleButton from './MediaToggleButton';
import RecordControlButton from './RecordControlButton';
import LogoutButton from './LogoutButton';

interface CallControlsProps {
  joined: boolean;
  micOn: boolean;
  camOn: boolean;
  toggleMic: () => void;
  toggleCam: () => void;
  startRecording: () => void;
  stopRecording: () => void;
  onLogout: () => void;
}

export default function CallControls({
  joined,
  micOn,
  camOn,
  toggleMic,
  toggleCam,
  startRecording,
  stopRecording,
  onLogout,
}: CallControlsProps) {
  return (
    <div style={{ marginBottom: 16 }}>
      <MediaToggleButton
        labelOn="Mute Mic"
        labelOff="Unmute Mic"
        isOn={micOn}
        onClick={toggleMic}
        disabled={!joined}
      />
      <MediaToggleButton
        labelOn="Turn Off Camera"
        labelOff="Turn On Camera"
        isOn={camOn}
        onClick={toggleCam}
        disabled={!joined}
      />
      <RecordControlButton
        label="Start Recording"
        onClick={startRecording}
        disabled={!joined}
      />
      <RecordControlButton
        label="Stop Recording"
        onClick={stopRecording}
        disabled={!joined}
      />
      <LogoutButton onClick={onLogout} />
    </div>
  );
}
