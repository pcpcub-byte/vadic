import { Schema, model, Document } from 'mongoose';

// Lesson interface for curriculum
interface Lesson {
    id: string;
    title: string;
    description: string;
    videoUrl?: string;
    videoProvider?: 'youtube' | 'dropbox' | 'none';
    videoId?: string;
    duration?: string; // e.g., "15:30"
    durationSeconds?: number;
    isFree?: boolean; // Allow free preview
    order?: number;
    resources?: {
        title: string;
        url: string;
        type: 'pdf' | 'code' | 'document' | 'other';
    }[];
}

// Topic interface for curriculum
interface Topic {
    id: string;
    title: string;
    lessons: Lesson[];
}

export interface Course extends Document {
    title: string;
    description: string;
    shortDescription: string;
    category: string;
    level: 'beginner' | 'intermediate' | 'advanced';
    language: string;
    maxStudents?: number;

    // Media
    thumbnail: string;

    // Pricing
    price: number;
    discountPrice?: number;
    isFree: boolean;
    hasDiscount: boolean;

    // Course settings
    isFeatured: boolean;
    expiryType: string;
    expiryMonths?: number;

    // Curriculum
    curriculum: Topic[];

    // Additional fields
    instructor: string;
    duration?: number;
    message?: string;

    // Timestamps
    createdAt: Date;
    updatedAt: Date;
}

// Lesson schema
const LessonSchema = new Schema({
    id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    videoUrl: { type: String },
    videoProvider: { 
        type: String, 
        enum: ['youtube', 'dropbox', 'none'],
        default: 'none'
    },
    videoId: { type: String },
    duration: { type: String },
    durationSeconds: { type: Number },
    isFree: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    resources: [{
        title: { type: String },
        url: { type: String },
        type: { 
            type: String, 
            enum: ['pdf', 'code', 'document', 'other'],
            default: 'other'
        }
    }]
});

// Topic schema
const TopicSchema = new Schema({
    id: { type: String, required: true },
    title: { type: String, required: true },
    lessons: [LessonSchema]
});

const CourseSchema = new Schema<Course>({
    title: { type: String, required: true },
    description: { type: String, required: true },
    shortDescription: { type: String, required: true },
    category: { type: String, required: true },
    level: {
        type: String,
        required: true,
        enum: ['beginner', 'intermediate', 'advanced']
    },
    language: { type: String, required: true },
    maxStudents: { type: Number },

    // Media
    thumbnail: { type: String, default: '' },

    // Pricing
    price: { type: Number, required: true, min: 0 },
    discountPrice: { type: Number, min: 0 },
    isFree: { type: Boolean, default: false },
    hasDiscount: { type: Boolean, default: false },

    // Course settings
    isFeatured: { type: Boolean, default: false },
    expiryType: { type: String, default: 'lifetime' },
    expiryMonths: { type: Number },

    // Curriculum
    curriculum: [TopicSchema],

    // Additional fields
    instructor: { type: String ,default: '' },
    duration: { type: Number },
    message: { type: String },

    // Timestamps
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt field before saving
CourseSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

export default model<Course>('Course', CourseSchema);