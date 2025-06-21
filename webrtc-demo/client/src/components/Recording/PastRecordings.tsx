import { usePastRecordings } from '../../hooks/usePastRecordings';
import formatRecordingName from '../../utils/formatBlobLink';

export default function PastRecordings({ userId }: { userId: string }) {
    const { recordings, loading } = usePastRecordings(userId);

    if (loading) return <p>Loading past recordings...</p>;
    if (recordings.length === 0) return <p>No past recordings found.</p>;

    return (
        <div>
            <h2>Your Past Recordings</h2>
            <ul>
                {recordings.map(rec => (
                    <li key={rec.name}>
                        <a href={rec.url} target="_blank" rel="noopener noreferrer">
                            {formatRecordingName(rec.name)}
                        </a>
                    </li>
                ))}
            </ul>
        </div>
    );
}
