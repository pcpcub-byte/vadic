import { Schema, model, Document } from 'mongoose';

interface UserAnswer {
    questionId: string;
    userAnswer: string | string[];
    isCorrect: boolean;
    pointsEarned: number;
}

export interface QuizAttempt extends Document {
    quizId: string;
    userId: string;
    courseId: string;
    answers: UserAnswer[];
    score: number;
    totalPoints: number;
    percentage: number;
    passed: boolean;
    timeSpent: number; // in seconds
    startedAt: Date;
    submittedAt: Date;
    attemptNumber: number;
}

const QuizAttemptSchema = new Schema<QuizAttempt>({
    quizId: {
        type: String,
        required: true,
        ref: 'Quiz'
    },
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
    answers: [{
        questionId: {
            type: String,
            required: true
        },
        userAnswer: {
            type: Schema.Types.Mixed,
            required: true
        },
        isCorrect: {
            type: Boolean,
            required: true
        },
        pointsEarned: {
            type: Number,
            required: true,
            default: 0
        }
    }],
    score: {
        type: Number,
        required: true,
        default: 0
    },
    totalPoints: {
        type: Number,
        required: true
    },
    percentage: {
        type: Number,
        required: true,
        default: 0
    },
    passed: {
        type: Boolean,
        required: true,
        default: false
    },
    timeSpent: {
        type: Number,
        default: 0
    },
    startedAt: {
        type: Date,
        required: true,
        default: Date.now
    },
    submittedAt: {
        type: Date,
        required: true,
        default: Date.now
    },
    attemptNumber: {
        type: Number,
        required: true,
        default: 1
    }
}, { 
    timestamps: true 
});

// Indexes for faster queries
QuizAttemptSchema.index({ quizId: 1, userId: 1 });
QuizAttemptSchema.index({ userId: 1, courseId: 1 });

export default model<QuizAttempt>('QuizAttempt', QuizAttemptSchema);
