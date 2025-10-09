import CourseModel, { type Course } from '../models/Course';
import { saveUploadedFile, deleteFile } from '../utils/fileUpload';

// Get all courses
export async function getAllCourses(ctx: any) {
    try {
        const courses = await CourseModel.find();
        console.log('Fetched courses count:', courses.length);
        ctx.set.status = 200;
        ctx.set.headers['Content-Type'] = 'application/json';
        return { success: true, courses };
    } catch (error) {
        console.error('Error fetching courses:', error);
        ctx.set.status = 500;
        return { success: false, error: 'Failed to fetch courses' };
    }
}

// Create a new course
export async function createCourse(req: any, res: any) {
    console.log('Creating course with data:');
    console.log('req.file:', req.file);
    console.log('req.body:', req.body);
    
    try {
        // Validate that req.body exists
        if (!req.body) {
            console.error('No request body provided');
            return res.status(400).json({ error: 'No request body provided' });
        }

        // Validate required fields
        const { title, description, shortDescription, category, level, language, price } = req.body;
        
        console.log('Validating required fields:', {
            title: !!title,
            description: !!description,
            shortDescription: !!shortDescription,
            category: !!category,
            level: !!level,
            language: !!language,
        });
        
        if (!title || !description || !shortDescription || !category || !level || !language ) {
            const missingFields = [];
            if (!title) missingFields.push('title');
            if (!description) missingFields.push('description');
            if (!shortDescription) missingFields.push('shortDescription');
            if (!category) missingFields.push('category');
            if (!level) missingFields.push('level');
            if (!language) missingFields.push('language');
            console.error('Missing required fields:', missingFields);
            return res.status(400).json({ 
                error: `Missing required fields: ${missingFields.join(', ')}` 
            });
        }

        // Validate level enum
        if (!['beginner', 'intermediate', 'advanced'].includes(level)) {
            return res.status(400).json({ error: 'Invalid level. Must be beginner, intermediate, or advanced' });
        }

        // Validate price
        if (price !== undefined && price < 0) {
            return res.status(400).json({ error: 'Price cannot be negative' });
        }

        // Handle thumbnail upload if provided
        let thumbnailUrl = req.body?.thumbnail;
        
        if (req.file && req.file.thumbnail) {
            console.log('Processing file upload for thumbnail');
            console.log('File type:', typeof req.file.thumbnail);
            console.log('Is File instance:', req.file.thumbnail instanceof File);
            
            // Use course title as filename for the thumbnail
            const uploadResult = await saveUploadedFile(req.file.thumbnail, "thumbnails", title);
            if (!uploadResult.success) {
                console.error('File upload failed:', uploadResult.error);
                return res.status(400).json({ error: uploadResult.error });
            }
            thumbnailUrl = uploadResult.url;
            console.log('File uploaded successfully:', thumbnailUrl);
        }

        // Parse curriculum if it's a JSON string (from FormData)
        let curriculum = [];
        if (req.body.curriculum) {
            try {
                curriculum = typeof req.body.curriculum === 'string' 
                    ? JSON.parse(req.body.curriculum) 
                    : req.body.curriculum;
            } catch (error) {
                console.error('Error parsing curriculum:', error);
                return res.status(400).json({ error: 'Invalid curriculum format' });
            }
        }

        // Convert string booleans to actual booleans (FormData sends everything as strings)
        const convertToBoolean = (value: any) => {
            if (typeof value === 'string') {
                return value === 'true';
            }
            return Boolean(value);
        };

        const price_num = parseFloat(price) || 0;
        const discountPrice_num = req.body.discountPrice ? parseFloat(req.body.discountPrice) : undefined;

        // Create course data with uploaded thumbnail URL
        const courseData = {
            ...req.body,
            thumbnail: thumbnailUrl || '', // Set empty string if no thumbnail provided
            price: price_num,
            discountPrice: discountPrice_num,
            maxStudents: req.body.maxStudents ? parseInt(req.body.maxStudents) : undefined,
            expiryMonths: req.body.expiryMonths ? parseInt(req.body.expiryMonths) : undefined,
            isFree: convertToBoolean(req.body.isFree),
            hasDiscount: convertToBoolean(req.body.hasDiscount),
            isFeatured: convertToBoolean(req.body.isFeatured),
            curriculum: curriculum
        };

        const course = new CourseModel(courseData);
        await course.save();
        res.status(201).json(course);
    } catch (error: any) {
        console.error('Error creating course:', error);
        if (error.name === 'ValidationError') {
            res.status(400).json({ error: error.message });
        } else {
            res.status(400).json({ error: 'Failed to create course' });
        }
    }
}

// Get a course by ID
export async function getCourseById(req: any, res: any) {
    try {
        const course = await CourseModel.findById(req.params.id);
        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }
        console.log(typeof course)
        return course;
    } catch (error) {
        console.error('Error fetching course:', error);
        res.status(500).json({ error: 'Failed to fetch course' });
    }
}

// Update a course
export async function updateCourse(req: any, res: any) {
    try {
        // Find the existing course first
        const existingCourse = await CourseModel.findById(req.params.id);
        if (!existingCourse) {
            return res.status(404).json({ error: 'Course not found' });
        }

        let updateData = { ...req.body };

        // Handle thumbnail upload if provided
        if (req.file && req.file.thumbnail) {
            console.log('Processing file upload for thumbnail update');
            console.log('File type:', typeof req.file.thumbnail);
            
            // Use the course title (either new or existing) for the filename
            const courseTitle = updateData.title || existingCourse.title;
            const uploadResult = await saveUploadedFile(req.file.thumbnail, "thumbnails", courseTitle);
            if (!uploadResult.success) {
                return res.status(400).json({ error: uploadResult.error });
            }
            
            // Delete old thumbnail if it exists and is a local file
            if (existingCourse.thumbnail && existingCourse.thumbnail.startsWith('/uploads/')) {
                const oldFilename = existingCourse.thumbnail.split('/').pop();
                if (oldFilename) {
                    deleteFile(oldFilename, "thumbnails");
                }
            }
            
            updateData.thumbnail = uploadResult.url;
            console.log('File uploaded successfully:', uploadResult.url);
        }

        const course = await CourseModel.findByIdAndUpdate(req.params.id, updateData, { new: true });
        res.json(course);
    } catch (error) {
        console.error('Error updating course:', error);
        res.status(400).json({ error: 'Failed to update course' });
    }
}

// Delete a course
export async function deleteCourse(req: any, res: any) {
    try {
        const course = await CourseModel.findById(req.params.id);
        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }

        // Delete thumbnail file if it's a local file
        if (course.thumbnail && course.thumbnail.startsWith('/uploads/')) {
            const filename = course.thumbnail.split('/').pop();
            if (filename) {
                deleteFile(filename, "thumbnails");
            }
        }

        await CourseModel.findByIdAndDelete(req.params.id);
        res.json({ message: 'Course deleted successfully' });
    } catch (error) {
        console.error('Error deleting course:', error);
        res.status(500).json({ error: 'Failed to delete course' });
    }
}

// Upload thumbnail image
export async function uploadThumbnail(req: any, res: any) {
    try {
        if (!req.file || !req.file.thumbnail) {
            return res.status(400).json({ error: 'No file provided' });
        }

        // Get custom filename from request body if provided
        const customFilename = req.body?.filename;
        console.log('Upload thumbnail with custom filename:', customFilename);

        const uploadResult = await saveUploadedFile(req.file.thumbnail, "thumbnails", customFilename);
        
        if (!uploadResult.success) {
            return res.status(400).json({ error: uploadResult.error });
        }

        res.json({
            message: 'File uploaded successfully',
            url: uploadResult.url,
            filename: uploadResult.filename
        });
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({ error: 'Failed to upload file' });
    }
}