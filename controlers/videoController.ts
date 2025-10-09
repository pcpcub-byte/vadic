import { Elysia, t } from 'elysia';
import Course from '../models/Course';
import Progress from '../models/Progress';
import User from '../models/User';
import path from 'path';
import fs from 'fs';
import { uploadToDropbox, uploadLargeFileToDropbox } from '../utils/dropboxUpload';

export const videoController = new Elysia({ prefix: '/api/video' })
  
  // Upload video to Dropbox
  .post('/upload', async ({ body }) => {
    try {
      const formData = body as any;
      const videoFile = formData.video;
      const provider = formData.provider || 'dropbox';

      if (!videoFile) {
        return { success: false, message: 'No video file provided' };
      }

      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(process.cwd(), 'uploads', 'videos');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // Generate unique filename
      const timestamp = Date.now();
      const originalName = videoFile.name || 'video.mp4';
      const extension = path.extname(originalName);
      const filename = `video-${timestamp}${extension}`;
      const filepath = path.join(uploadsDir, filename);

      // Save video file locally (temporary storage)
      const buffer = await videoFile.arrayBuffer();
      await Bun.write(filepath, buffer);

      // Check if Dropbox is configured
      const dropboxEnabled = process.env.DROPBOX_ACCESS_TOKEN ? true : false;

      if (dropboxEnabled && provider === 'dropbox') {
        try {
          // Get file size to determine upload method
          const stats = fs.statSync(filepath);
          const fileSizeMB = stats.size / (1024 * 1024);

          console.log(`Uploading video to Dropbox: ${filename} (${fileSizeMB.toFixed(2)} MB)`);

          // Use chunked upload for files larger than 150MB
          const dropboxUrl = fileSizeMB > 150 
            ? await uploadLargeFileToDropbox(filepath, filename)
            : await uploadToDropbox(filepath, filename);
          
          // Clean up local file after successful upload
          fs.unlinkSync(filepath);
          
          console.log(`Video uploaded successfully to Dropbox: ${dropboxUrl}`);

          return {
            success: true,
            videoUrl: dropboxUrl,
            provider,
            filename,
            storage: 'dropbox',
            message: 'Video uploaded successfully to Dropbox'
          };
        } catch (dropboxError) {
          console.error('Dropbox upload failed:', dropboxError);
          
          // Fallback to local storage if Dropbox fails
          const localUrl = `http://localhost:8080/uploads/videos/${filename}`;
          console.log(`Falling back to local storage: ${localUrl}`);
          
          return {
            success: true,
            videoUrl: localUrl,
            provider,
            filename,
            storage: 'local',
            message: 'Dropbox upload failed. Video saved locally.',
            error: dropboxError instanceof Error ? dropboxError.message : 'Unknown error'
          };
        }
      } else {
        // Use local storage (Dropbox not configured or different provider)
        const videoUrl = `http://localhost:8080/uploads/videos/${filename}`;
        
        return {
          success: true,
          videoUrl,
          provider,
          filename,
          storage: 'local',
          message: dropboxEnabled 
            ? 'Video uploaded to local storage' 
            : 'Video uploaded locally. Configure DROPBOX_ACCESS_TOKEN for cloud storage.'
        };
      }
    } catch (error) {
      console.error('Error uploading video:', error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Error uploading video' 
      };
    }
  })
  
  // Get course content with progress
  .get('/course/:courseId', async ({ params, headers }) => {
    try {
      const { courseId } = params;
      const token = headers.authorization?.replace('Bearer ', '');
      
      console.log('Course request - courseId:', courseId, 'token:', token);
      
      if (!token || token === 'undefined' || token === 'null') {
        console.log('No valid token provided');
        return { success: false, message: 'Authentication required. Please log in.' };
      }

      // Verify JWT and get user ID (simplified - you should use proper JWT verification)
      const userId = token; // Replace with actual JWT decode
      
      console.log('Looking up user with ID:', userId);
      
      // Check if user owns this course
      const user = await User.findById(userId);
      if (!user) {
        console.log('User not found:', userId);
        return { success: false, message: 'User not found' };
      }

      console.log('User found:', user.email, 'purchasedCourses:', user.purchasedCourses);

      const hasPurchased = user.purchasedCourses?.some(
        (purchase: any) => {
          const purchasedId = purchase.courseId?.toString() || purchase.toString();
          console.log('Comparing:', purchasedId, 'with', courseId);
          return purchasedId === courseId;
        }
      );

      console.log('Has purchased course:', hasPurchased);

      if (!hasPurchased) {
        return { success: false, message: 'Course not purchased' };
      }
      
      // Get course content
      const course = await Course.findById(courseId);
      if (!course) {
        console.log('Course not found:', courseId);
        return { success: false, message: 'Course not found' };
      }

      console.log('Course found:', course.title);

      // Get progress
      let progress = await Progress.findOne({ userId, courseId });
      if (!progress) {
        console.log('Creating new progress record');
        // Create new progress record
        progress = new Progress({
          userId,
          courseId,
          completedLessons: [],
          watchTime: new Map(),
          progressPercentage: 0
        });
        await progress.save();
      }
      
      return {
        success: true,
        course: {
          _id: course._id,
          title: course.title,
          description: course.description,
          instructor: course.instructor,
          thumbnail: course.thumbnail,
          curriculum: course.curriculum
        },
        progress: {
          percentage: progress.progressPercentage,
          completedLessons: progress.completedLessons,
          currentLesson: progress.currentLesson,
          watchTime: Object.fromEntries(progress.watchTime), // Convert Map to Object
          lastAccessed: progress.lastAccessed
        }
      };
    } catch (error) {
      console.error('Error loading course:', error);
      return { success: false, message: 'Error loading course' };
    }
  })
  
  // Update progress
  .post('/progress', async ({ body, headers }) => {
    try {
      const token = headers.authorization?.replace('Bearer ', '');
      if (!token || token === 'undefined' || token === 'null') {
        return { success: false, message: 'Authentication required' };
      }

      const userId = token; // Replace with actual JWT decode
      const { courseId, lessonId, watchTime, completed } = body as any;
      
      console.log('Progress update - userId:', userId, 'courseId:', courseId, 'lessonId:', lessonId, 'watchTime:', watchTime);
      
      let progress = await Progress.findOne({ userId, courseId });
      
      if (!progress) {
        progress = new Progress({
          userId,
          courseId,
          completedLessons: [],
          watchTime: new Map(),
          progressPercentage: 0
        });
      }
      
      // Update watch time for this lesson
      if (watchTime !== undefined) {
        const currentWatchTime = progress.watchTime.get(lessonId) || 0;
        // Only update if new watch time is greater (prevents backwards seeking from reducing time)
        if (watchTime > currentWatchTime) {
          progress.watchTime.set(lessonId, Math.floor(watchTime));
          console.log(`Updated watch time for lesson ${lessonId}: ${Math.floor(watchTime)}s`);
        }
      }
      
      // Mark as completed if specified
      if (completed && !progress.completedLessons.includes(lessonId)) {
        progress.completedLessons.push(lessonId);
        console.log(`Lesson ${lessonId} marked as completed`);
      }
      
      // Calculate progress percentage based on completed lessons
      const course = await Course.findById(courseId);
      if (course) {
        const totalLessons = course.curriculum.reduce(
          (sum, topic) => sum + topic.lessons.length, 
          0
        );
        progress.progressPercentage = totalLessons > 0 
          ? Math.round((progress.completedLessons.length / totalLessons) * 100)
          : 0;
      }
      
      progress.currentLesson = lessonId;
      progress.lastAccessed = new Date();
      await progress.save();
      
      // Calculate total watch time across all lessons
      let totalWatchTime = 0;
      progress.watchTime.forEach((time) => {
        totalWatchTime += time;
      });
      
      return { 
        success: true, 
        progress: {
          percentage: progress.progressPercentage,
          completedLessons: progress.completedLessons,
          currentLesson: progress.currentLesson,
          watchTime: Object.fromEntries(progress.watchTime), // Convert Map to Object for JSON
          totalWatchTime: totalWatchTime,
          lastAccessed: progress.lastAccessed
        }
      };
    } catch (error) {
      console.error('Error updating progress:', error);
      return { success: false, message: 'Error updating progress' };
    }
  })
  
  // Get video URL (for Dropbox direct links)
  .get('/url/:courseId/:lessonId', async ({ params, headers }) => {
    try {
      const { courseId, lessonId } = params;
      const token = headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return { success: false, message: 'Authentication required' };
      }

      const userId = token;
      
      // Verify access
      const user = await User.findById(userId);
      const hasPurchased = user?.purchasedCourses?.some(
        (id: any) => id.toString() === courseId
      );

      if (!hasPurchased) {
        return { success: false, message: 'Access denied' };
      }
      
      // Get lesson
      const course = await Course.findById(courseId);
      if (!course) {
        return { success: false, message: 'Course not found' };
      }

      let lesson: any = null;
      for (const topic of course.curriculum) {
        const found = topic.lessons.find(l => l.id === lessonId);
        if (found) {
          lesson = found;
          break;
        }
      }

      if (!lesson) {
        return { success: false, message: 'Lesson not found' };
      }
      
      // Return video URL based on provider
      return {
        success: true,
        videoUrl: lesson.videoUrl,
        videoProvider: lesson.videoProvider,
        videoId: lesson.videoId,
        lesson: {
          title: lesson.title,
          description: lesson.description,
          duration: lesson.duration,
          resources: lesson.resources
        }
      };
    } catch (error) {
      console.error('Error getting video URL:', error);
      return { success: false, message: 'Error getting video URL' };
    }
  })
  
  // Check if user has access to course
  .get('/check-access/:courseId', async ({ params, headers }) => {
    try {
      const { courseId } = params;
      const token = headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return { success: false, hasAccess: false };
      }

      const userId = token;
      const user = await User.findById(userId);
      
      const hasAccess = user?.purchasedCourses?.some(
        (id: any) => id.toString() === courseId
      );

      return { success: true, hasAccess: !!hasAccess };
    } catch (error) {
      return { success: false, hasAccess: false };
    }
  });
