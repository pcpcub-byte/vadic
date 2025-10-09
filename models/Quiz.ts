import { Schema, model, Document } from 'mongoose';

interface QuizQuestion {
    id: string;
    question: string;
    type: 'multiple-choice' | 'true-false' | 'short-answer';
    options?: string[]; // For multiple choice
    correctAnswer: string | string[]; // Can be index for MC, "true"/"false" for T/F, or text for short answer
    explanation?: string;
    points: number;
}

export interface Quiz extends Document {
    courseId: string;
    moduleId?: string; // Optional: for module-specific quizzes
    title: string;
    description: string;
    instructions?: string;
    questions: QuizQuestion[];
    duration: number; // in minutes
    passingScore: number; // percentage
    totalPoints: number;
    attempts: number; // number of attempts allowed, -1 for unlimited
    showResults: boolean; // show results immediately after submission
    showCorrectAnswers: boolean;
    randomizeQuestions: boolean;
    isPublished: boolean;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}

const QuizSchema = new Schema<Quiz>({
    courseId: {
        type: String,
        required: true,
        ref: 'Course'
    },
    moduleId: {
        type: String,
        required: false // Optional field for module-specific quizzes
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    instructions: {
        type: String
    },
    questions: [{
        id: {
            type: String,
            required: true
        },
        question: {
            type: String,
            required: true
        },
        type: {
            type: String,
            enum: ['multiple-choice', 'true-false', 'short-answer'],
            required: true
        },
        options: [{
            type: String
        }],
        correctAnswer: {
            type: Schema.Types.Mixed,
            required: true
        },
        explanation: {
            type: String
        },
        points: {
            type: Number,
            required: true,
            default: 1
        }
    }],
    duration: {
        type: Number,
        required: true,
        default: 30 // 30 minutes default
    },
    passingScore: {
        type: Number,
        required: true,
        default: 70 // 70% passing score
    },
    totalPoints: {
        type: Number,
        required: true
    },
    attempts: {
        type: Number,
        default: 3 // 3 attempts by default, -1 for unlimited
    },
    showResults: {
        type: Boolean,
        default: true
    },
    showCorrectAnswers: {
        type: Boolean,
        default: true
    },
    randomizeQuestions: {
        type: Boolean,
        default: false
    },
    isPublished: {
        type: Boolean,
        default: false
    },
    createdBy: {
        type: String,
        required: true,
        ref: 'User'
    }
}, { 
    timestamps: true 
});

// Index for faster queries
QuizSchema.index({ courseId: 1 });
QuizSchema.index({ createdBy: 1 });

export default model<Quiz>('Quiz', QuizSchema);
