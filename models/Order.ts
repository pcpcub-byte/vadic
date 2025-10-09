import mongoose, { Document, Schema } from 'mongoose';

export interface IOrder extends Document {
    userId: mongoose.Types.ObjectId;
    orderId: string;
    courses: {
        courseId: mongoose.Types.ObjectId;
        title: string;
        price: number;
        thumbnail: string;
    }[];
    billingInfo: {
        firstName: string;
        lastName: string;
        email: string;
        phoneNumber: string;
        country: string;
        state: string;
        city: string;
        zipCode: string;
    };
    payment: {
        method: 'razorpay' | 'card' | 'paypal' | 'stripe';
        status: 'pending' | 'completed' | 'failed' | 'refunded';
        razorpayOrderId?: string;
        razorpayPaymentId?: string;
        razorpaySignature?: string;
        transactionId?: string;
        paidAt?: Date;
    };
    pricing: {
        subtotal: number;
        discount: number;
        total: number;
        currency: string;
    };
    status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'refunded';
    orderDate: Date;
    completedAt?: Date;
    notes?: string;
}

const OrderSchema: Schema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    orderId: {
        type: String,
        required: true,
        unique: true
    },
    courses: [{
        courseId: {
            type: Schema.Types.ObjectId,
            ref: 'Course',
            required: true
        },
        title: {
            type: String,
            required: true
        },
        price: {
            type: Number,
            required: true
        },
        thumbnail: {
            type: String
        }
    }],
    billingInfo: {
        firstName: { type: String, required: true },
        lastName: { type: String, required: true },
        email: { type: String, required: true },
        phoneNumber: { type: String, required: true },
        country: { type: String, required: true },
        state: { type: String, required: true },
        city: { type: String, required: true },
        zipCode: { type: String, required: true }
    },
    payment: {
        method: {
            type: String,
            enum: ['razorpay', 'card', 'paypal', 'stripe'],
            required: true
        },
        status: {
            type: String,
            enum: ['pending', 'completed', 'failed', 'refunded'],
            default: 'pending'
        },
        razorpayOrderId: { type: String },
        razorpayPaymentId: { type: String },
        razorpaySignature: { type: String },
        transactionId: { type: String },
        paidAt: { type: Date }
    },
    pricing: {
        subtotal: { type: Number, required: true },
        discount: { type: Number, default: 0 },
        total: { type: Number, required: true },
        currency: { type: String, default: 'INR' }
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'cancelled', 'refunded'],
        default: 'pending'
    },
    orderDate: {
        type: Date,
        default: Date.now
    },
    completedAt: {
        type: Date
    },
    notes: {
        type: String
    }
}, {
    timestamps: true
});

// Indexes for better query performance
OrderSchema.index({ userId: 1, orderDate: -1 });
OrderSchema.index({ 'payment.status': 1 });
OrderSchema.index({ status: 1 });

// Method to mark order as completed
OrderSchema.methods.markCompleted = function() {
    this.status = 'completed';
    this.payment.status = 'completed';
    this.completedAt = new Date();
};

// Method to mark payment as failed
OrderSchema.methods.markFailed = function() {
    this.payment.status = 'failed';
    this.status = 'cancelled';
};

export default mongoose.model<IOrder>('Order', OrderSchema);
