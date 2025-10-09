import { Elysia, t } from 'elysia';
import Certificate from '../models/Certificate';
import Progress from '../models/Progress';
import Course from '../models/Course';
import User from '../models/User';

// Generate unique certificate number
const generateCertificateNumber = () => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `CERT-${timestamp}-${random}`;
};

export const certificateController = new Elysia({ prefix: '/api/certificates' })
    
    // Issue certificate for completed course
    .post('/issue', async ({ body, headers }) => {
        try {
            const token = headers.authorization?.replace('Bearer ', '');
            if (!token || token === 'undefined' || token === 'null') {
                return { success: false, message: 'Authentication required' };
            }

            const userId = token;
            const { courseId } = body as any;

            // Verify user exists
            const user = await User.findById(userId);
            if (!user) {
                return { success: false, message: 'User not found' };
            }

            // Check if course is purchased
            const hasPurchased = user.purchasedCourses?.some(
                (purchase: any) => {
                    const purchasedId = purchase.courseId?.toString() || purchase.toString();
                    return purchasedId === courseId;
                }
            );

            if (!hasPurchased) {
                return { success: false, message: 'Course not purchased' };
            }

            // Get course details
            const course = await Course.findById(courseId);
            if (!course) {
                return { success: false, message: 'Course not found' };
            }

            // Get progress and verify completion
            const progress = await Progress.findOne({ userId, courseId });
            if (!progress) {
                return { success: false, message: 'No progress found for this course' };
            }

            // Check if course is 100% complete
            if (progress.progressPercentage < 100) {
                return { 
                    success: false, 
                    message: `Course is only ${progress.progressPercentage}% complete. Complete all lessons to get certificate.` 
                };
            }

            // Check if certificate already issued
            let certificate = await Certificate.findOne({ userId, courseId });
            if (certificate) {
                return { 
                    success: true, 
                    message: 'Certificate already issued',
                    certificate 
                };
            }

            // Calculate total lessons
            const totalLessons = course.curriculum.reduce(
                (sum, topic) => sum + topic.lessons.length,
                0
            );

            // Calculate total watch time
            let totalWatchTime = 0;
            progress.watchTime.forEach((time) => {
                totalWatchTime += time;
            });

            // Create certificate
            certificate = new Certificate({
                userId,
                courseId,
                courseName: course.title,
                studentName: user.profile?.firstName && user.profile?.lastName 
                    ? `${user.profile.firstName} ${user.profile.lastName}` 
                    : user.username,
                instructorName: course.instructor,
                certificateNumber: generateCertificateNumber(),
                completionDate: new Date(),
                totalLessons,
                completedLessons: progress.completedLessons.length,
                totalWatchTime
            });

            await certificate.save();

            // Update progress to mark certificate as issued
            progress.certificateIssued = true;
            await progress.save();

            return {
                success: true,
                message: 'Certificate issued successfully',
                certificate
            };
        } catch (error) {
            console.error('Error issuing certificate:', error);
            return { 
                success: false, 
                message: error instanceof Error ? error.message : 'Error issuing certificate' 
            };
        }
    })

    // Get all certificates for a user
    .get('/my-certificates', async ({ headers }) => {
        try {
            const token = headers.authorization?.replace('Bearer ', '');
            if (!token || token === 'undefined' || token === 'null') {
                return { success: false, message: 'Authentication required' };
            }

            const userId = token;

            const certificates = await Certificate.find({ userId }).sort({ issueDate: -1 });

            return {
                success: true,
                certificates
            };
        } catch (error) {
            console.error('Error fetching certificates:', error);
            return { 
                success: false, 
                message: 'Error fetching certificates' 
            };
        }
    })

    // Get certificate by ID
    .get('/:certificateId', async ({ params, headers }) => {
        try {
            const { certificateId } = params;
            const token = headers.authorization?.replace('Bearer ', '');
            
            if (!token || token === 'undefined' || token === 'null') {
                return { success: false, message: 'Authentication required' };
            }

            const userId = token;
            
            const certificate = await Certificate.findById(certificateId);
            if (!certificate) {
                return { success: false, message: 'Certificate not found' };
            }

            // Verify ownership
            if (certificate.userId !== userId) {
                return { success: false, message: 'Access denied' };
            }

            return {
                success: true,
                certificate
            };
        } catch (error) {
            console.error('Error fetching certificate:', error);
            return { 
                success: false, 
                message: 'Error fetching certificate' 
            };
        }
    })

    // Get certificate for a specific course
    .get('/course/:courseId', async ({ params, headers }) => {
        try {
            const { courseId } = params;
            const token = headers.authorization?.replace('Bearer ', '');
            
            if (!token || token === 'undefined' || token === 'null') {
                return { success: false, message: 'Authentication required' };
            }

            const userId = token;
            
            const certificate = await Certificate.findOne({ userId, courseId });
            
            if (!certificate) {
                return { 
                    success: false, 
                    message: 'Certificate not found for this course' 
                };
            }

            return {
                success: true,
                certificate
            };
        } catch (error) {
            console.error('Error fetching certificate:', error);
            return { 
                success: false, 
                message: 'Error fetching certificate' 
            };
        }
    })

    // Verify certificate by certificate number (public endpoint)
    .get('/verify/:certificateNumber', async ({ params }) => {
        try {
            const { certificateNumber } = params;
            
            const certificate = await Certificate.findOne({ certificateNumber });
            
            if (!certificate) {
                return { 
                    success: false, 
                    valid: false,
                    message: 'Certificate not found' 
                };
            }

            return {
                success: true,
                valid: true,
                certificate: {
                    certificateNumber: certificate.certificateNumber,
                    studentName: certificate.studentName,
                    courseName: certificate.courseName,
                    issueDate: certificate.issueDate,
                    completionDate: certificate.completionDate
                }
            };
        } catch (error) {
            console.error('Error verifying certificate:', error);
            return { 
                success: false, 
                valid: false,
                message: 'Error verifying certificate' 
            };
        }
    })

    // Admin: Get all certificates (admin only)
    .get('/admin/all', async ({ headers }) => {
        try {
            const token = headers.authorization?.replace('Bearer ', '');
            if (!token || token === 'undefined' || token === 'null') {
                return { success: false, message: 'Authentication required' };
            }

            const userId = token;

            // Verify user is admin
            const user = await User.findById(userId);
            if (!user || user.userType !== 'admin') {
                return { success: false, message: 'Access denied. Admin only.' };
            }

            // Get all certificates with user and course info
            const certificates = await Certificate.find()
                .populate('userId', 'username email profile')
                .populate('courseId', 'title instructor')
                .sort({ issueDate: -1 });

            return {
                success: true,
                certificates,
                count: certificates.length
            };
        } catch (error) {
            console.error('Error fetching all certificates:', error);
            return { 
                success: false, 
                message: 'Error fetching certificates' 
            };
        }
    });
