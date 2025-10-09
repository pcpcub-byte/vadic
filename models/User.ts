import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
    username: string;
    email: string;
    password: string;
    userType: 'regular' | 'dummy' | 'test' | 'admin';
    status: 'active' | 'inactive' | 'suspended' | 'flagged';
    loginAttempts: number;
    lastLogin: Date;
    accountCreated: Date;
    isVerified: boolean;
    suspiciousActivity: {
        count: number;
        lastActivity: Date;
        reasons: string[];
    };
    profile: {
        firstName?: string;
        lastName?: string;
        phoneNumber?: string;
        avatar?: string;
        bio?: string;
        gender?: string;
        dateOfBirth?: string;
    };
    metadata: {
        ipAddress?: string;
        userAgent?: string;
        location?: string;
    };
    purchasedCourses: {
        courseId: mongoose.Types.ObjectId;
        purchasedAt: Date;
        orderId: string;
    }[];
}

const UserSchema: Schema = new Schema({
    username: {
        type: String,
        required: true,
        trim: true,
        minlength: 3,
        maxlength: 30
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    userType: {
        type: String,
        enum: ['regular', 'dummy', 'test', 'admin'],
        default: 'regular'
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'suspended', 'flagged'],
        default: 'active'
    },
    loginAttempts: {
        type: Number,
        default: 0
    },
    lastLogin: {
        type: Date,
        default: null
    },
    accountCreated: {
        type: Date,
        default: Date.now
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    suspiciousActivity: {
        count: {
            type: Number,
            default: 0
        },
        lastActivity: {
            type: Date,
            default: null
        },
        reasons: [{
            type: String
        }]
    },
    profile: {
        firstName: { type: String, trim: true },
        lastName: { type: String, trim: true },
        phoneNumber: { type: String, trim: true },
        avatar: { type: String },
        bio: { type: String, trim: true },
        gender: { type: String, trim: true },
        dateOfBirth: { type: String }
    },
    metadata: {
        ipAddress: { type: String },
        userAgent: { type: String },
        location: { type: String }
    },
    purchasedCourses: [{
        courseId: {
            type: Schema.Types.ObjectId,
            ref: 'Course'
        },
        purchasedAt: {
            type: Date,
            default: Date.now
        },
        orderId: {
            type: String
        }
    }]
}, {
    timestamps: true
});

// Index for performance
UserSchema.index({ email: 1 });
UserSchema.index({ username: 1 });
UserSchema.index({ userType: 1, status: 1 });

// Pre-save middleware to handle dummy/test users
UserSchema.pre('save', function(next) {
    if (this.userType === 'dummy' || this.userType === 'test') {
        this.isVerified = true; // Auto-verify dummy/test users
    }
    next();
});

// Method to check if user is suspicious
UserSchema.methods.isSuspicious = function(): boolean {
    return this.suspiciousActivity.count >= 5 || 
           this.loginAttempts >= 10 || 
           this.status === 'flagged';
};

// Method to flag suspicious activity
UserSchema.methods.flagSuspiciousActivity = function(reason: string) {
    this.suspiciousActivity.count += 1;
    this.suspiciousActivity.lastActivity = new Date();
    this.suspiciousActivity.reasons.push(reason);
    
    if (this.suspiciousActivity.count >= 5) {
        this.status = 'flagged';
    }
};

export default mongoose.model<IUser>('User', UserSchema);
