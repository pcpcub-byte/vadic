import { Elysia } from "elysia";
import CourseModel from "../models/Course";
import { 
    getAllCourses, 
    createCourse, 
    getCourseById, 
    updateCourse, 
    deleteCourse,
    uploadThumbnail
} from "../controlers/courseControler";

const courseRoutes = new Elysia({ prefix: "/api/courses" })
    // Get all courses
    .get("/", getAllCourses)
    
    // Get course by ID
    .get("/:id", async ({ params, set }) => {
        try {
            const course = await CourseModel.findById(params.id);
            if (!course) {
                set.status = 404;
                set.headers['Content-Type'] = 'application/json';
                return { success: false, error: 'Course not found' };
            }
            console.log('Fetched course:', course);
            console.log('Course type:', typeof course);
            
            // Ensure we return a plain object, not a Mongoose document
            const courseData = course.toObject ? course.toObject() : course;
            
            set.headers['Content-Type'] = 'application/json';
            return { success: true, course: courseData };
        } catch (error) {
            console.error('Error fetching course:', error);
            set.status = 500;
            set.headers['Content-Type'] = 'application/json';
            return { success: false, error: 'Failed to fetch course' };
        }
    })
    
    // Create new course (with file upload support)
    .post("/", async ({ body, set }) => {
        try {
            console.log('POST /api/courses - Raw body:', body);
            console.log('Body type:', typeof body);
            
            let mockReq = { body, file: {} };
            
            // Handle multipart form data for file uploads
            if (body && typeof body === 'object') {
                console.log('Processing body object');
                // Check if thumbnail is a File object
                if ((body as any).thumbnail instanceof File) {
                    console.log('Found thumbnail file in body');
                    mockReq.file = { thumbnail: (body as any).thumbnail };
                    // Remove file from body to avoid issues with JSON serialization
                    const { thumbnail, ...restBody } = body as any;
                    mockReq.body = restBody;
                } else if ((body as any).thumbnail) {
                    console.log('Thumbnail exists but is not a File object, type:', typeof (body as any).thumbnail);
                }
            } else {
                console.log('Body is not an object or is null/undefined');
            }
            
            console.log('Final mockReq structure:');
            console.log('mockReq.body:', mockReq.body);
            console.log('mockReq.file:', mockReq.file);
            
            let responseData: any;
            let statusCode = 200;
            
            const mockRes = {
                json: (data: any) => { 
                    responseData = data; 
                    console.log('Response data:', data);
                },
                status: (code: number) => ({ 
                    json: (data: any) => { 
                        statusCode = code; 
                        responseData = data; 
                        console.log('Response status:', code, 'data:', data);
                        return { json: (data: any) => { responseData = data; } }; 
                    } 
                })
            };
            
            await createCourse(mockReq, mockRes);
            set.status = statusCode;
            return responseData;
        } catch (error) {
            console.error('Error in POST /api/courses:', error);
            set.status = 500;
            return { error: "Internal server error", details: error instanceof Error ? error.message : String(error) };
        }
    })

    // Update course (with file upload support)
    .put("/:id", async ({ params, body, set }) => {
        try {
            let mockReq = { params: { id: params.id }, body, file: {} };
            
            // Handle multipart form data for file uploads
            if (body && typeof body === 'object') {
                // Check if thumbnail is a File object
                if ((body as any).thumbnail instanceof File) {
                    mockReq.file = { thumbnail: (body as any).thumbnail };
                    // Remove file from body to avoid issues with JSON serialization
                    const { thumbnail, ...restBody } = body as any;
                    mockReq.body = restBody;
                }
            }
            
            let responseData: any;
            let statusCode = 200;
            
            const mockRes = {
                json: (data: any) => { responseData = data; },
                status: (code: number) => ({ 
                    json: (data: any) => { 
                        statusCode = code; 
                        responseData = data; 
                        return { json: (data: any) => { responseData = data; } }; 
                    } 
                })
            };
            
            await updateCourse(mockReq, mockRes);
            set.status = statusCode;
            return responseData;
        } catch (error) {
            set.status = 500;
            return { error: "Internal server error" };
        }
    })
    
    // Delete course
    .delete("/:id", async ({ params, set }) => {
        try {
            const mockReq = { params: { id: params.id } };
            let responseData: any;
            let statusCode = 200;
            
            const mockRes = {
                json: (data: any) => { responseData = data; },
                status: (code: number) => ({ 
                    json: (data: any) => { 
                        statusCode = code; 
                        responseData = data; 
                        return { json: (data: any) => { responseData = data; } }; 
                    } 
                })
            };
            
            await deleteCourse(mockReq, mockRes);
            set.status = statusCode;
            return responseData;
        } catch (error) {
            set.status = 500;
            return { error: "Internal server error" };
        }
    })
    
    // Upload thumbnail
    .post("/upload/thumbnail", async ({ body, set }) => {
        try {
            let mockReq = { file: {} };
            
            // Handle file upload
            if (body && typeof body === 'object' && (body as any).thumbnail instanceof File) {
                mockReq.file = { thumbnail: (body as any).thumbnail };
            }
            
            let responseData: any;
            let statusCode = 200;
            
            const mockRes = {
                json: (data: any) => { responseData = data; },
                status: (code: number) => ({ 
                    json: (data: any) => { 
                        statusCode = code; 
                        responseData = data; 
                        return { json: (data: any) => { responseData = data; } }; 
                    } 
                })
            };
            
            await uploadThumbnail(mockReq, mockRes);
            set.status = statusCode;
            return responseData;
        } catch (error) {
            set.status = 500;
            return { error: "Internal server error" };
        }
    });

export default courseRoutes;