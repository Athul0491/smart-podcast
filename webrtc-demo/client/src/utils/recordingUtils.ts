import { supabase } from '../lib/supabaseClient';

/**
 * Fetch all video chunks for a given user and session.
 */
export async function fetchChunkFiles(userId: string, sessionName: string): Promise<{ name: string; url: string }[]> {
    const pathPrefix = `${userId}/${sessionName}/`;

    const { data, error } = await supabase
        .storage
        .from('recordings')
        .list(pathPrefix, { limit: 100 });

    if (error || !data) {
        console.error('Error listing chunk files:', error?.message);
        return [];
    }

    const filtered = data
        .filter(file => file.name.endsWith('.webm') && file.name.startsWith('part_'))
        .sort((a, b) => {
            const indexA = parseInt(a.name.split('_')[1]);
            const indexB = parseInt(b.name.split('_')[1]);
            return indexA - indexB;
        });

    const signedUrls = await Promise.all(filtered.map(async file => {
        const { data, error } = await supabase
            .storage
            .from('recordings')
            .createSignedUrl(pathPrefix + file.name, 60);

        if (error || !data?.signedUrl) {
            console.warn(`Failed to sign URL for ${file.name}`);
            return { name: file.name, url: '' };
        }

        return { name: file.name, url: data.signedUrl };
    }));

    return signedUrls.filter(f => f.url);
}

/**
 * Combine all fetched video chunks into one Blob.
 */
export async function combineChunksToBlob(files: { url: string }[]): Promise<Blob | null> {
    try {
        const chunks = await Promise.all(files.map(f => fetch(f.url).then(res => res.blob())));
        return new Blob(chunks, { type: 'video/webm' });
    } catch (err) {
        console.error('Error combining chunks:', err);
        return null;
    }
}

/**
 * Upload the combined blob back to Supabase.
 */
export async function uploadCombinedBlob(
    userId: string,
    sessionName: string,
    blob: Blob,
    name?: string // optional: participant's name
): Promise<boolean> {
    const safeName = name?.replace(/[^a-zA-Z0-9]/g, '_') || 'user';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${userId}/${sessionName}/combined_${safeName}_${timestamp}.webm`;

    const { error } = await supabase.storage
        .from('recordings')
        .upload(filename, blob, {
            upsert: true,
            contentType: 'video/webm',
        });

    if (error) {
        console.error('Error uploading combined file:', error.message);
        return false;
    }

    return true;
}


/**
 * Delete all original chunk files after combining.
 */
export async function deleteOriginalChunks(userId: string, sessionName: string): Promise<void> {
    const pathPrefix = `${userId}/${sessionName}/`;

    const { data, error } = await supabase
        .storage
        .from('recordings')
        .list(pathPrefix);

    if (error || !data) {
        console.error('Error listing files for deletion:', error?.message);
        return;
    }

    const chunkNames = data
        .filter(file => file.name.startsWith('part_'))
        .map(file => `${pathPrefix}${file.name}`);

    if (chunkNames.length === 0) {
        console.log('No chunk files to delete.');
        return;
    }

    const { error: deleteError } = await supabase
        .storage
        .from('recordings')
        .remove(chunkNames);

    if (deleteError) {
        console.error('Error deleting chunks:', deleteError.message);
    } else {
        console.log('✅ Deleted original chunks');
    }
}

export async function listCombinedRecordings(userId: string): Promise<{ name: string; url: string }[]> {
  const { data: folders, error: folderError } = await supabase
    .storage
    .from('recordings')
    .list(userId, { limit: 100 });

  if (folderError || !folders) {
    console.error('Error listing user session folders:', folderError?.message);
    return [];
  }

  const recordings: { name: string; url: string }[] = [];

  for (const folder of folders) {
    if (folder.metadata?.size !== undefined) continue; // Skip if not a folder

    const sessionPath = `${userId}/${folder.name}`;
    const { data: files, error: fileError } = await supabase
      .storage
      .from('recordings')
      .list(sessionPath);

    if (fileError || !files) continue;

    const combinedFile = files.find(file => file.name.startsWith('combined_') && file.name.endsWith('.webm'));
    if (combinedFile) {
      const fullPath = `${sessionPath}/${combinedFile.name}`;
      const { data: urlData, error: urlError } = await supabase
        .storage
        .from('recordings')
        .createSignedUrl(fullPath, 3600);

      if (urlData?.signedUrl) {
        recordings.push({
          name: combinedFile.name,
          url: urlData.signedUrl,
        });
      } else {
        console.warn(`Could not get signed URL for ${fullPath}: ${urlError?.message}`);
      }
    }
  }

  return recordings;
}
