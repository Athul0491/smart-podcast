import { useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Session } from '@supabase/supabase-js';

interface Props {
  session: Session;
  localStreamRef: React.RefObject<MediaStream | null>;
  name: string;
}

export default function useRecording({ session, localStreamRef, name }: Props) {
  const [uploading, setUploading] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunkIndexRef = useRef(0);

  const startRecording = () => {
    const stream = localStreamRef.current;
    if (!stream) {
      console.warn('No local stream available to record.');
      return;
    }

    const userId = session.user.id;
    chunkIndexRef.current = 0;

    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = async (event: BlobEvent) => {
      if (event.data.size === 0) return;

      const chunk = event.data;
      const currentIndex = chunkIndexRef.current;
      const filename = `${userId}/${name}_${currentIndex}.webm`;

      setRecordedChunks(prevChunks => [...prevChunks, chunk]);
      await uploadChunk(filename, chunk);

      chunkIndexRef.current += 1;
    };

    recorder.start(5000); // Collect 5-second chunks
    setUploading(true);
    console.log('🎥 Recording started');
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder?.state === 'recording') {
      recorder.stop();
      setUploading(false);
      console.log('🛑 Recording stopped');
    }
  };

  const uploadChunk = async (filename: string, data: Blob) => {
    const { error } = await supabase.storage
      .from('recordings')
      .upload(filename, data, {
        upsert: true,
        contentType: 'video/webm',
      });

    if (error) {
      console.error(`❌ Upload failed for ${filename}:`, error.message);
    } else {
      console.log(`✅ Uploaded: ${filename}`);
    }
  };

  return {
    startRecording,
    stopRecording,
    uploading,
    recordedChunks,
  };
}
