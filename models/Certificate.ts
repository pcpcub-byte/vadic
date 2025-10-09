import { Schema, model, Document } from 'mongoose';

export interface Certificate extends Document {
    userId: string;
    courseId: string;
    courseName: string;
    studentName: string;
    instructorName: string;
    issueDate: Date;
    certificateNumber: string;
    completionDate: Date;
    totalLessons: number;
    completedLessons: number;
    totalWatchTime: number; // in seconds
    createdAt: Date;
    updatedAt: Date;
}

const CertificateSchema = new Schema<Certificate>({
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
    courseName: {
        type: String,
        required: true
    },
    studentName: {
        type: String,
        required: true
    },
    instructorName: {
        type: String,
        required: true
    },
    issueDate: {
        type: Date,
        default: Date.now
    },
    certificateNumber: {
        type: String,
        required: true,
        unique: true
    },
    completionDate: {
        type: Date,
        required: true
    },
    totalLessons: {
        type: Number,
        required: true
    },
    completedLessons: {
        type: Number,
        required: true
    },
    totalWatchTime: {
        type: Number,
        default: 0
    }
}, { 
    timestamps: true 
});

// Compound index for fast user + course lookups
CertificateSchema.index({ userId: 1, courseId: 1 }, { unique: true });

export default model<Certificate>('Certificate', CertificateSchema);
