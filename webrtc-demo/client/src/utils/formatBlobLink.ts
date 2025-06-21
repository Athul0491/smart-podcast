export default function formatRecordingName(rawName: string): string {
    // Example: combined_Athul_2025-06-21T14-00-16-967Z.webm
    const regex = /^combined_(.+)_(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})/;
    const match = regex.exec(rawName);
    if (!match) return rawName;

    const [, user, date, hour, minute] = match;
    const [yyyy, mm, dd] = date.split('-');
    return `${user}_${mm}-${dd}-${yyyy}_${hour}-${minute}.webm`;
}
