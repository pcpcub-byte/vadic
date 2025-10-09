import { Elysia } from 'elysia';
import {
    registerUser,
    loginUser,
    getAllUsers,
    updateUserStatus,
    cleanupTestUsers,
    getUserAnalytics,
    initializeDummyUsers,
    updateUserProfile
} from '../controlers/authController';

// Initialize dummy users when routes are loaded
initializeDummyUsers();

const authRoutes = new Elysia({ prefix: '/api/auth' })
    // User registration
    .post('/register', registerUser)
    
    // User login
    .post('/login', loginUser)
    
    // Get all users (with filtering)
    .get('/users', getAllUsers)
    
    // Update user status (admin function)
    .patch('/users/:userId/status', updateUserStatus)
    
    // Cleanup test/dummy users
    .delete('/cleanup', cleanupTestUsers)
    
    // Get user analytics
    .get('/analytics', getUserAnalytics)
    
    // Update user profile
    .put('/update-profile', updateUserProfile)
    
    // Get user by ID
    .get('/user/:id', async ({ params }) => {
        try {
            const User = (await import('../models/User')).default;
            const user = await User.findById(params.id).select('-password');
            
            if (!user) {
                return {
                    success: false,
                    message: 'User not found'
                };
            }
            
            return {
                success: true,
                user: user
            };
        } catch (error: any) {
            return {
                success: false,
                message: error.message || 'Error fetching user'
            };
        }
    })
    
    // Health check for auth service
    .get('/health', () => ({
        status: 'ok',
        service: 'auth',
        timestamp: new Date().toISOString()
    }));

export default authRoutes;
