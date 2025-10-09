import { Schema, model, Document } from 'mongoose';

export interface Progress extends Document {
    userId: string;
    courseId: string;
    completedLessons: string[];
    currentLesson?: string;
    watchTime: Map<string, number>; // lessonId -> seconds watched
    lastAccessed: Date;
    progressPercentage: number;
    certificateIssued: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const ProgressSchema = new Schema<Progress>({
    userId: {
        type: String,
        required: true,
        ref: 'User'
    },
    courseId: {
        type: String,
        required: true,
        ref: 'Course'
    },
    completedLessons: [{
        type: String
    }],
    currentLesson: {
        type: String
    },
    watchTime: {
        type: Map,
        of: Number,
        default: new Map()
    },
    lastAccessed: {
        type: Date,
        default: Date.now
    },
    progressPercentage: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    certificateIssued: {
        type: Boolean,
        default: false
    }
}, { 
    timestamps: true 
});

// Compound index for fast user + course lookups
ProgressSchema.index({ userId: 1, courseId: 1 }, { unique: true });

export default model<Progress>('Progress', ProgressSchema);
