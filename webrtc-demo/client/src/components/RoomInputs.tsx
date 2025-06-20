interface RoomInputsProps {
    name: string;
    room: string;
    setName: (val: string) => void;
    setRoom: (val: string) => void;
    onJoin: () => void;
    onLeave: () => void;
    canJoin: boolean;
    canLeave: boolean;
}

export default function RoomInputs({
    name,
    room,
    setName,
    setRoom,
    onJoin,
    onLeave,
    canJoin,
    canLeave,
}: RoomInputsProps) {
    return (
        <div className="room-inputs">
            <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your Name"
                className="input-field"
                aria-label="Your Name"
            />
            <input
                type="text"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="Room Name"
                className="input-field"
                aria-label="Room Name"
            />
            <button onClick={onJoin} disabled={!canJoin} className="button">
                Join Call
            </button>
            <button onClick={onLeave} disabled={!canLeave} className="button">
                Leave Call
            </button>
        </div>
    );
}
