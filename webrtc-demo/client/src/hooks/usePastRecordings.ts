import { useEffect, useState } from 'react';
import { listCombinedRecordings } from '../utils/recordingUtils';

export function usePastRecordings(userId: string) {
    const [recordings, setRecordings] = useState<{ name: string; url: string }[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchRecordings() {
            const files = await listCombinedRecordings(userId);
            setRecordings(files);
            setLoading(false);
        }

        if (userId) fetchRecordings();
    }, [userId]);

    return { recordings, loading };
}
