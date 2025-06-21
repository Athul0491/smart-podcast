import { useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Session } from '@supabase/supabase-js';
import {
  fetchChunkFiles,
  combineChunksToBlob,
  uploadCombinedBlob,
  deleteOriginalChunks,
} from '../utils/recordingUtils';

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
  const sessionFolderRef = useRef('');
  const sessionId = useRef(`session_${new Date().toISOString()}`);


  const startRecording = () => {
    const stream = localStreamRef.current;
    if (!stream) {
      console.warn('No local stream available to record.');
      return;
    }

    const userId = session.user.id;
    // const userEmail = session.user.email?.replace(/[^a-zA-Z0-9]/g, '_') || session.user.id;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sessionFolder = `${userId}/session_${timestamp}`;
    sessionFolderRef.current = sessionFolder;
    chunkIndexRef.current = 0;

    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = async (event: BlobEvent) => {
      if (event.data.size === 0) return;

      const chunk = event.data;
      const index = chunkIndexRef.current;
      const filename = `${sessionFolderRef.current}/part_${index}.webm`;

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

    setTimeout(async () => {
      const userId = session.user.id;
      const sessionFolder = sessionFolderRef.current;
      const sessionName = sessionFolder.split('/')[1];

      console.log('📥 Fetching chunk files...');
      const files = await fetchChunkFiles(userId, sessionName); // sessionName only

      if (files.length === 0) {
        console.warn('⚠️ No chunk files found to combine.');
        return;
      }

      console.log('🔗 Combining chunks...');
      const blob = await combineChunksToBlob(files);
      if (!blob) {
        console.error('❌ Failed to create combined blob.');
        return;
      }

      console.log('⬆️ Uploading combined video...');
      const uploadSuccess = await uploadCombinedBlob(userId, sessionName, blob, name);

      if (uploadSuccess) {
        console.log('✅ Combined video uploaded successfully.');
        await deleteOriginalChunks(userId, sessionName);
      }
    }, 3000); // wait 3s to ensure last chunk uploads

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
    sessionId: sessionId.current,
  };
}
