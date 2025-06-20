interface Participant {
    id: string;
    name: string;
}

interface ParticipantsListProps {
    participants: Participant[];
    socketId?: string;
}

export default function ParticipantsList({
    participants,
    socketId,
}: ParticipantsListProps) {
    if (participants.length === 0) return null;

    return (
        <section className="participants-container">
            <h3 className="participants-title">Participants:</h3>
            <ul className="participants-list">
                {participants.map(({ id, name }) => (
                    <li key={id} className="participant-item">
                        <span className="participant-label" style={{ fontWeight: id === socketId ? 'bold' : 500 }}>
                            {id === socketId ? '🟢 You' : '👤 Peer'}
                        </span>{' '}
                        <span className="participant-name">({name})</span>
                    </li>
                ))}
            </ul>
        </section>
    );
}
