interface RecordingDownloadProps {
    recordedChunks: Blob[];
}

export default function RecordingDownload({ recordedChunks }: RecordingDownloadProps) {
    if (recordedChunks.length === 0) return null;

    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);

    return (
        <div className="recording-download">
            <a
                href={url}
                download="recording.webm"
                className="recording-link"
                aria-label="Download your WebM recording"
            >
                Download Recording
            </a>
        </div>
    );
}
