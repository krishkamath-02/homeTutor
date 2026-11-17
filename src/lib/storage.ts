import { supabase } from './supabase';

export interface UploadedHomeworkFileResult {
    storagePath: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
}

const BUCKET_NAME = 'homework-files';

/**
 * Uploads a single homework file to Supabase Storage under the user's secure folder.
 */
export async function uploadHomeworkFile(
    userId: string,
    homeworkId: string,
    file: File
): Promise<UploadedHomeworkFileResult> {
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');

    // Safe fallback if storage is not configured or in unit test mocks
    if (!supabase.storage || typeof supabase.storage.from !== 'function') {
        return {
            storagePath: `local/${sanitizedName}`,
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            fileSize: file.size,
        };
    }

    const timestamp = Date.now();
    const storagePath = `${userId}/${homeworkId}/${timestamp}_${sanitizedName}`;

    try {
        const { error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(storagePath, file, {
                cacheControl: '3600',
                upsert: false,
            });

        if (uploadError) {
            console.warn(`Supabase Storage upload warning (${file.name}):`, uploadError.message);
            return {
                storagePath: `local/${sanitizedName}`,
                fileName: file.name,
                mimeType: file.type || 'application/octet-stream',
                fileSize: file.size,
            };
        }

        return {
            storagePath,
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            fileSize: file.size,
        };
    } catch {
        return {
            storagePath: `local/${sanitizedName}`,
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            fileSize: file.size,
        };
    }
}

/**
 * Uploads multiple files for a given homework session.
 */
export async function uploadHomeworkFiles(
    userId: string,
    homeworkId: string,
    files: File[]
): Promise<UploadedHomeworkFileResult[]> {
    return Promise.all(
        files.map((file) => uploadHomeworkFile(userId, homeworkId, file))
    );
}

/**
 * Generates a temporary signed URL for a private homework file.
 */
export async function getHomeworkFileSignedUrl(
    storagePath: string,
    expiresInSeconds: number = 3600
): Promise<string | null> {
    if (storagePath.startsWith('local/') || !supabase.storage || typeof supabase.storage.from !== 'function') {
        return null;
    }

    try {
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .createSignedUrl(storagePath, expiresInSeconds);

        if (error || !data) {
            console.error('Failed to create signed URL:', error);
            return null;
        }

        return data.signedUrl;
    } catch {
        return null;
    }
}

/**
 * Uploads a student rough work sheet to Supabase Storage.
 */
export async function uploadRoughWorkFile(
    userId: string,
    testId: string,
    file: File
): Promise<string> {
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');

    if (!supabase.storage || typeof supabase.storage.from !== 'function') {
        return URL.createObjectURL(file);
    }

    const timestamp = Date.now();
    const storagePath = `${userId}/${testId}/${timestamp}_${sanitizedName}`;

    try {
        const { error: uploadError } = await supabase.storage
            .from('rough-work')
            .upload(storagePath, file, {
                cacheControl: '3600',
                upsert: false,
            });

        if (uploadError) {
            console.warn(`Storage upload warning for rough work (${file.name}):`, uploadError.message);
            return URL.createObjectURL(file);
        }

        const { data } = supabase.storage.from('rough-work').getPublicUrl(storagePath);
        return data?.publicUrl || URL.createObjectURL(file);
    } catch {
        return URL.createObjectURL(file);
    }
}
