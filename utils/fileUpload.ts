import path from "path";
import { existsSync, mkdirSync } from "fs";

export interface UploadResult {
    success: boolean;
    filename?: string;
    url?: string;
    error?: string;
}

export async function saveUploadedFile(file: File, uploadDir: string = "thumbnails", customFilename?: string): Promise<UploadResult> {
    try {
        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
            return {
                success: false,
                error: 'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.'
            };
        }

        // Validate file size (5MB max)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            return {
                success: false,
                error: 'File size too large. Maximum size is 5MB.'
            };
        }

        // Create upload directory if it doesn't exist
        const uploadsPath = path.join(process.cwd(), "uploads", uploadDir);
        if (!existsSync(uploadsPath)) {
            mkdirSync(uploadsPath, { recursive: true });
        }

        // Generate filename
        const fileExtension = path.extname(file.name);
        let filename: string;
        
        if (customFilename) {
            // Sanitize custom filename - remove special characters and spaces
            const sanitizedName = customFilename
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
            filename = `${sanitizedName}${fileExtension}`;
        } else {
            // Generate unique filename
            const timestamp = Date.now();
            const randomString = Math.random().toString(36).substring(2, 15);
            filename = `${timestamp}_${randomString}${fileExtension}`;
        }
        
        const filePath = path.join(uploadsPath, filename);

        // Save the file
        const arrayBuffer = await file.arrayBuffer();
        await Bun.write(filePath, arrayBuffer);

        const url = `/uploads/${uploadDir}/${filename}`;
        console.log('File saved successfully:', url);
        return {
            success: true,
            filename,
            url
        };
    } catch (error) {
        console.error('Error saving file:', error);
        return {
            success: false,
            error: 'Failed to save file'
        };
    }
}

export function deleteFile(filename: string, uploadDir: string = "thumbnails"): boolean {
    try {
        const filePath = path.join(process.cwd(), "uploads", uploadDir, filename);
        if (existsSync(filePath)) {
            const fs = require('fs');
            fs.unlinkSync(filePath);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error deleting file:', error);
        return false;
    }
}
