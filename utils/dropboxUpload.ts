/**
 * Dropbox Video Upload Utility
 * 
 * This utility handles video uploads to Dropbox cloud storage.
 * To use this, you need to:
 * 1. Install dropbox package: bun add dropbox
 * 2. Get Dropbox access token from https://www.dropbox.com/developers/apps
 * 3. Add token to .env: DROPBOX_ACCESS_TOKEN=your_token_here
 */

// @ts-ignore: 'dropbox' has no type declarations in this environment
import { Dropbox } from 'dropbox';
import fs from 'fs';
import path from 'path';

const DROPBOX_ACCESS_TOKEN = process.env.DROPBOX_ACCESS_TOKEN || '';

/**
 * Upload a video file to Dropbox
 * @param localFilePath - Path to the video file on local server
 * @param filename - Name for the file in Dropbox
 * @returns Direct link to the video file
 */
export const uploadToDropbox = async (
  localFilePath: string,
  filename: string
): Promise<string> => {
  if (!DROPBOX_ACCESS_TOKEN) {
    throw new Error('Dropbox access token not configured. Add DROPBOX_ACCESS_TOKEN to .env file.');
  }

  try {
    const dbx = new Dropbox({ accessToken: DROPBOX_ACCESS_TOKEN });

    // Read the video file
    const fileContent = fs.readFileSync(localFilePath);

    // Upload to Dropbox (in /LMS-Videos folder)
    const uploadPath = `/LMS-Videos/${filename}`;
    console.log(`Uploading to Dropbox: ${uploadPath}`);

    const response = await dbx.filesUpload({
      path: uploadPath,
      contents: fileContent,
      mode: { '.tag': 'add' },
      autorename: true, // Rename if file exists
      mute: false,
    });

    console.log('Upload successful:', response.result.path_display);

    // Create a shared link for the uploaded file
    const sharedLinkResponse = await dbx.sharingCreateSharedLinkWithSettings({
      path: response.result.path_display!,
      settings: {
        requested_visibility: { '.tag': 'public' },
      },
    });

    // Convert Dropbox share link to direct download link
    let shareUrl = sharedLinkResponse.result.url;
    
    // Transform: www.dropbox.com → dl.dropboxusercontent.com
    // Remove: ?dl=0 parameter
    shareUrl = shareUrl
      .replace('www.dropbox.com', 'dl.dropboxusercontent.com')
      .replace('?dl=0', '');

    console.log('Dropbox direct link:', shareUrl);
    return shareUrl;

  } catch (error: any) {
    console.error('Dropbox upload error:', error);
    
    // Handle common errors
    if (error.status === 401) {
      throw new Error('Invalid Dropbox access token. Please check your credentials.');
    } else if (error.status === 507) {
      throw new Error('Dropbox storage quota exceeded. Upgrade your plan or free up space.');
    } else if (error.status === 429) {
      throw new Error('Too many requests. Please try again later.');
    }
    
    throw new Error(`Dropbox upload failed: ${error.message || 'Unknown error'}`);
  }
};

/**
 * Upload large video files to Dropbox using chunked upload
 * Use this for files larger than 150MB
 * @param localFilePath - Path to the video file
 * @param filename - Name for the file in Dropbox
 * @returns Direct link to the video file
 */
export const uploadLargeFileToDropbox = async (
  localFilePath: string,
  filename: string
): Promise<string> => {
  if (!DROPBOX_ACCESS_TOKEN) {
    throw new Error('Dropbox access token not configured.');
  }

  try {
    const dbx = new Dropbox({ accessToken: DROPBOX_ACCESS_TOKEN });
    const fileContent = fs.readFileSync(localFilePath);
    const fileSize = fileContent.length;
    
    const CHUNK_SIZE = 8 * 1024 * 1024; // 8MB chunks
    let offset = 0;
    let sessionId = '';

    console.log(`Uploading large file: ${filename} (${(fileSize / (1024 * 1024)).toFixed(2)} MB)`);

    // Start upload session
    const startResponse = await dbx.filesUploadSessionStart({
      contents: fileContent.slice(0, CHUNK_SIZE),
      close: false,
    });
    sessionId = startResponse.result.session_id;
    offset += CHUNK_SIZE;

    console.log(`Upload session started: ${sessionId}`);

    // Upload remaining chunks
    while (offset < fileSize) {
      const chunk = fileContent.slice(offset, offset + CHUNK_SIZE);
      const cursor = {
        session_id: sessionId,
        offset: offset,
      };

      if (offset + CHUNK_SIZE >= fileSize) {
        // Last chunk - finish upload
        console.log('Uploading final chunk...');
        
        const finishResponse = await dbx.filesUploadSessionFinish({
          cursor: cursor,
          commit: {
            path: `/LMS-Videos/${filename}`,
            mode: { '.tag': 'add' },
            autorename: true,
          },
          contents: chunk,
        });

        console.log('Upload complete:', finishResponse.result.path_display);

        // Create shared link
        const sharedLinkResponse = await dbx.sharingCreateSharedLinkWithSettings({
          path: finishResponse.result.path_display!,
          settings: {
            requested_visibility: { '.tag': 'public' },
          },
        });

        let shareUrl = sharedLinkResponse.result.url
          .replace('www.dropbox.com', 'dl.dropboxusercontent.com')
          .replace('?dl=0', '');

        return shareUrl;

      } else {
        // Continue upload
        const progress = Math.round((offset / fileSize) * 100);
        console.log(`Upload progress: ${progress}%`);

        await dbx.filesUploadSessionAppendV2({
          cursor: cursor,
          contents: chunk,
        });
      }
      
      offset += CHUNK_SIZE;
    }

    throw new Error('Upload completed without finishing session (unexpected state)');

  } catch (error: any) {
    console.error('Large file upload error:', error);
    throw new Error(`Large file upload failed: ${error.message || 'Unknown error'}`);
  }
};

/**
 * Delete a file from Dropbox
 * @param dropboxPath - Path of the file in Dropbox (e.g., /LMS-Videos/video.mp4)
 */
export const deleteFromDropbox = async (dropboxPath: string): Promise<void> => {
  if (!DROPBOX_ACCESS_TOKEN) {
    throw new Error('Dropbox access token not configured.');
  }

  try {
    const dbx = new Dropbox({ accessToken: DROPBOX_ACCESS_TOKEN });
    await dbx.filesDeleteV2({ path: dropboxPath });
    console.log('Deleted from Dropbox:', dropboxPath);
  } catch (error: any) {
    console.error('Dropbox delete error:', error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
};

/**
 * Get Dropbox account storage info
 * @returns Storage usage information
 */
export const getDropboxStorageInfo = async () => {
  if (!DROPBOX_ACCESS_TOKEN) {
    throw new Error('Dropbox access token not configured.');
  }

  try {
    const dbx = new Dropbox({ accessToken: DROPBOX_ACCESS_TOKEN });
    const response = await dbx.usersGetSpaceUsage();
    
    const used = response.result.used;
    const allocated = response.result.allocation['.tag'] === 'individual' 
      ? response.result.allocation.allocated 
      : 0;

    return {
      used: used,
      allocated: allocated,
      usedMB: (used / (1024 * 1024)).toFixed(2),
      allocatedMB: (allocated / (1024 * 1024)).toFixed(2),
      percentUsed: allocated > 0 ? ((used / allocated) * 100).toFixed(2) : '0',
    };
  } catch (error: any) {
    console.error('Storage info error:', error);
    throw new Error(`Failed to get storage info: ${error.message}`);
  }
};

// Example usage:
/*
import { uploadToDropbox, uploadLargeFileToDropbox } from './utils/dropboxUpload';

// For files < 150MB
const videoUrl = await uploadToDropbox('/tmp/video.mp4', 'lesson-01.mp4');

// For files > 150MB
const largeVideoUrl = await uploadLargeFileToDropbox('/tmp/large-video.mp4', 'lecture-01.mp4');

// Check storage
const storage = await getDropboxStorageInfo();
console.log(`Storage used: ${storage.usedMB} MB / ${storage.allocatedMB} MB (${storage.percentUsed}%)`);
*/

export default {
  uploadToDropbox,
  uploadLargeFileToDropbox,
  deleteFromDropbox,
  getDropboxStorageInfo,
};
