import User from '../models/User';
import type { IUser } from '../models/User';
import type { Context } from 'elysia';

// Dummy users for testing
const DUMMY_USERS = [
    {
        username: 'dummy_student',
        email: 'dummy.student@example.com',
        password: 'password123',
        userType: 'dummy' as const,
        profile: {
            firstName: 'Dummy',
            lastName: 'Student'
        }
    },
    {
        username: 'test_instructor',
        email: 'test.instructor@example.com', 
        password: 'password123',
        userType: 'test' as const,
        profile: {
            firstName: 'Test',
            lastName: 'Instructor'
        }
    },
    {
        username: 'admin_demo',
        email: 'admin.demo@example.com',
        password: 'admin123',
        userType: 'admin' as const,
        profile: {
            firstName: 'Admin',
            lastName: 'Demo'
        }
    }
];

// Utility function to detect suspicious patterns
const detectSuspiciousActivity = (email: string, userAgent?: string, ipAddress?: string): string[] => {
    const reasons: string[] = [];
    
    // Check for temporary email patterns
    const tempEmailPatterns = [
        '10minutemail', 'guerrillamail', 'mailinator', 'throwaway',
        'tempmail', 'disposable', 'fake', 'test123', 'spam'
    ];
    
    if (tempEmailPatterns.some(pattern => email.toLowerCase().includes(pattern))) {
        reasons.push('Temporary/disposable email detected');
    }
    
    // Check for bot-like user agents
    if (userAgent && (userAgent.includes('bot') || userAgent.includes('crawler') || userAgent.includes('spider'))) {
        reasons.push('Bot-like user agent detected');
    }
    
    // Check for suspicious email patterns
    if (/^\w+\d{4,}@/.test(email)) {
        reasons.push('Suspicious email pattern (random numbers)');
    }
    
    return reasons;
};

// Initialize dummy users in database
export const initializeDummyUsers = async () => {
    try {
        for (const dummyUser of DUMMY_USERS) {
            const existingUser = await User.findOne({ email: dummyUser.email });
            if (!existingUser) {
                const user = new User(dummyUser);
                await user.save();
                console.log(`Created dummy user: ${dummyUser.email}`);
            }
        }
    } catch (error) {
        console.error('Error initializing dummy users:', error);
    }
};

// Register new user
export const registerUser = async ({ body, request }: Context) => {
    try {
        const { username, email, password, userType = 'regular', profile = {} } = body as any;
        
        // Get metadata
        const userAgent = request.headers.get('user-agent') || '';
        const ipAddress = request.headers.get('x-forwarded-for') || 
                         request.headers.get('x-real-ip') || 
                         'unknown';
        
        // Check for existing user
        const existingUser = await User.findOne({
            $or: [{ email }, { username }]
        });
        
        if (existingUser) {
            return { 
                success: false, 
                message: 'User already exists with this email or username',
                status: 400
            };
        }
        
        // Detect suspicious activity
        const suspiciousReasons = detectSuspiciousActivity(email, userAgent, ipAddress);
        
        // Create new user
        const user = new User({
            username,
            email,
            password, // In production, hash this password
            userType,
            profile: {
                firstName: profile.firstName,
                lastName: profile.lastName,
                phoneNumber: profile.phoneNumber
            },
            metadata: {
                userAgent,
                ipAddress
            }
        });
        
        // Flag suspicious users
        if (suspiciousReasons.length > 0) {
            user.status = 'flagged';
            user.suspiciousActivity.count = suspiciousReasons.length;
            user.suspiciousActivity.reasons = suspiciousReasons;
            user.suspiciousActivity.lastActivity = new Date();
        }
        
        await user.save();
        
        return {
            success: true,
            message: 'User registered successfully',
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                userType: user.userType,
                status: user.status,
                isVerified: user.isVerified,
                profile: user.profile,
                purchasedCourses: user.purchasedCourses
            },
            warnings: suspiciousReasons.length > 0 ? 'Account flagged for review' : null
        };
        
    } catch (error: any) {
        return {
            success: false,
            message: 'Registration failed',
            error: error.message,
            status: 500
        };
    }
};

// Login user
export const loginUser = async ({ body, request }: Context) => {
    try {
        const { email, password } = body as any;
        
        // Get metadata
        const userAgent = request.headers.get('user-agent') || '';
        const ipAddress = request.headers.get('x-forwarded-for') || 
                         request.headers.get('x-real-ip') || 
                         'unknown';
        
        // Find user
        const user = await User.findOne({ email });
        
        if (!user) {
            return {
                success: false,
                message: 'Invalid credentials',
                status: 401
            };
        }
        
        // Check if account is suspended or flagged
        if (user.status === 'suspended') {
            return {
                success: false,
                message: 'Account suspended. Please contact support.',
                status: 403
            };
        }
        
        if (user.status === 'flagged') {
            return {
                success: false,
                message: 'Account under review. Please contact support.',
                status: 403
            };
        }
        
        // Check password (in production, use proper password hashing)
        if (user.password !== password) {
            user.loginAttempts += 1;
            
            // Flag after too many failed attempts
            if (user.loginAttempts >= 5) {
                user.suspiciousActivity.count += 1;
                user.suspiciousActivity.lastActivity = new Date();
                user.suspiciousActivity.reasons.push('Multiple failed login attempts');
                if (user.suspiciousActivity.count >= 5) {
                    user.status = 'flagged';
                }
            }
            
            await user.save();
            
            return {
                success: false,
                message: 'Invalid credentials',
                status: 401
            };
        }
        
        // Successful login
        user.lastLogin = new Date();
        user.loginAttempts = 0; // Reset failed attempts
        user.metadata.ipAddress = ipAddress;
        user.metadata.userAgent = userAgent;
        
        await user.save();
        
        return {
            success: true,
            message: 'Login successful',
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                userType: user.userType,
                status: user.status,
                isVerified: user.isVerified,
                profile: user.profile,
                lastLogin: user.lastLogin,
                purchasedCourses: user.purchasedCourses
            },
            isDummy: user.userType === 'dummy' || user.userType === 'test'
        };
        
    } catch (error: any) {
        return {
            success: false,
            message: 'Login failed',
            error: error.message,
            status: 500
        };
    }
};

// Get all users (admin only)
export const getAllUsers = async ({ query }: Context) => {
    try {
        const { userType, status, page = 1, limit = 10 } = query as any;
        
        const filter: any = {};
        if (userType) filter.userType = userType;
        if (status) filter.status = status;
        
        const users = await User.find(filter)
            .select('-password')
            .sort({ accountCreated: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));
            
        const total = await User.countDocuments(filter);
        
        return {
            success: true,
            users,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        };
        
    } catch (error: any) {
        return {
            success: false,
            message: 'Failed to fetch users',
            error: error.message,
            status: 500
        };
    }
};

// Update user status (admin function)
export const updateUserStatus = async ({ body, params }: Context) => {
    try {
        const { userId } = params as any;
        const { status, reason } = body as any;
        
        const user = await User.findById(userId);
        if (!user) {
            return {
                success: false,
                message: 'User not found',
                status: 404
            };
        }
        
        user.status = status;
        
        if (status === 'flagged' && reason) {
            user.suspiciousActivity.count += 1;
            user.suspiciousActivity.lastActivity = new Date();
            user.suspiciousActivity.reasons.push(reason);
            if (user.suspiciousActivity.count >= 5) {
                user.status = 'flagged';
            }
        }
        
        await user.save();
        
        return {
            success: true,
            message: 'User status updated successfully',
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                status: user.status
            }
        };
        
    } catch (error: any) {
        return {
            success: false,
            message: 'Failed to update user status',
            error: error.message,
            status: 500
        };
    }
};

// Clean up dummy/test users (utility function)
export const cleanupTestUsers = async () => {
    try {
        const result = await User.deleteMany({
            userType: { $in: ['dummy', 'test'] },
            accountCreated: { 
                $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) // Older than 24 hours
            }
        });
        
        return {
            success: true,
            message: `Cleaned up ${result.deletedCount} test users`,
            deletedCount: result.deletedCount
        };
        
    } catch (error: any) {
        return {
            success: false,
            message: 'Failed to cleanup test users',
            error: error.message
        };
    }
};

// Get user analytics
export const getUserAnalytics = async () => {
    try {
        const analytics = await User.aggregate([
            {
                $group: {
                    _id: '$userType',
                    count: { $sum: 1 },
                    activeUsers: {
                        $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
                    },
                    flaggedUsers: {
                        $sum: { $cond: [{ $eq: ['$status', 'flagged'] }, 1, 0] }
                    }
                }
            }
        ]);
        
        const suspiciousUsers = await User.countDocuments({
            'suspiciousActivity.count': { $gte: 3 }
        });
        
        return {
            success: true,
            analytics: {
                byType: analytics,
                suspiciousUsers,
                totalUsers: await User.countDocuments()
            }
        };
        
    } catch (error: any) {
        return {
            success: false,
            message: 'Failed to get analytics',
            error: error.message
        };
    }
};

// Update user profile
export const updateUserProfile = async ({ body }: Context) => {
    try {
        const { userId, profile } = body as any;
        
        if (!userId) {
            return {
                success: false,
                message: 'User ID is required',
                status: 400
            };
        }
        
        const user = await User.findById(userId);
        if (!user) {
            return {
                success: false,
                message: 'User not found',
                status: 404
            };
        }
        
        // Update profile fields
        if (profile.firstName !== undefined) user.profile.firstName = profile.firstName;
        if (profile.lastName !== undefined) user.profile.lastName = profile.lastName;
        if (profile.phoneNumber !== undefined) user.profile.phoneNumber = profile.phoneNumber;
        if (profile.bio !== undefined) user.profile.bio = profile.bio;
        if (profile.gender !== undefined) user.profile.gender = profile.gender;
        if (profile.dateOfBirth !== undefined) user.profile.dateOfBirth = profile.dateOfBirth;
        if (profile.avatar !== undefined) user.profile.avatar = profile.avatar;
        
        await user.save();
        
        return {
            success: true,
            message: 'Profile updated successfully',
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                userType: user.userType,
                status: user.status,
                profile: user.profile,
                purchasedCourses: user.purchasedCourses,
                createdAt: user.accountCreated
            }
        };
        
    } catch (error: any) {
        return {
            success: false,
            message: 'Failed to update profile',
            error: error.message,
            status: 500
        };
    }
};
