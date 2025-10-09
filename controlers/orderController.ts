import Order from '../models/Order';
import User from '../models/User';
import Course from '../models/Course';
import type { IOrder } from '../models/Order';
import mongoose from 'mongoose';

// Create a new order
export const createOrder = async (orderData: any) => {
    try {
        const { userId, courses, billingInfo, payment, pricing } = orderData;

        // Verify user exists
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        // Verify all courses exist
        const courseIds = courses.map((c: any) => c.courseId);
        const existingCourses = await Course.find({ _id: { $in: courseIds } });
        
        if (existingCourses.length !== courses.length) {
            throw new Error('One or more courses not found');
        }

        // Generate unique order ID
        const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

        // Create order
        const order = new Order({
            userId,
            orderId,
            courses,
            billingInfo,
            payment,
            pricing,
            status: 'pending',
            orderDate: new Date()
        });

        await order.save();

        return {
            success: true,
            order,
            orderId: order.orderId
        };
    } catch (error: any) {
        console.error('Error creating order:', error);
        throw error;
    }
};

// Complete order after successful payment
export const completeOrder = async (orderId: string, paymentDetails: any) => {
    try {
        const order = await Order.findOne({ orderId });
        
        if (!order) {
            throw new Error('Order not found');
        }

        // Update payment details
        order.payment.status = 'completed';
        order.payment.razorpayPaymentId = paymentDetails.razorpay_payment_id;
        order.payment.razorpayOrderId = paymentDetails.razorpay_order_id;
        order.payment.razorpaySignature = paymentDetails.razorpay_signature;
        order.payment.paidAt = new Date();
        
        // Update order status
        order.status = 'completed';
        order.completedAt = new Date();

        await order.save();

        // Update user's purchased courses
        const user = await User.findById(order.userId);
        if (user) {
            for (const course of order.courses) {
                // Check if course already purchased (avoid duplicates)
                const alreadyPurchased = user.purchasedCourses.some(
                    (pc: any) => pc.courseId.toString() === course.courseId.toString()
                );

                if (!alreadyPurchased) {
                    user.purchasedCourses.push({
                        courseId: course.courseId,
                        purchasedAt: new Date(),
                        orderId: order.orderId
                    } as any);
                }
            }
            await user.save();
        }

        return {
            success: true,
            message: 'Order completed successfully',
            order
        };
    } catch (error: any) {
        console.error('Error completing order:', error);
        throw error;
    }
};

// Get user's orders
export const getUserOrders = async (userId: string) => {
    try {
        const orders = await Order.find({ userId })
            .sort({ orderDate: -1 })
            .populate('courses.courseId', 'title thumbnail price');

        return {
            success: true,
            orders,
            totalOrders: orders.length
        };
    } catch (error: any) {
        console.error('Error fetching user orders:', error);
        throw error;
    }
};

// Get single order by ID
export const getOrderById = async (orderId: string, userId?: string) => {
    try {
        const query: any = { orderId };
        if (userId) {
            query.userId = userId;
        }

        const order = await Order.findOne(query)
            .populate('courses.courseId', 'title thumbnail price category level');

        if (!order) {
            throw new Error('Order not found');
        }

        return {
            success: true,
            order
        };
    } catch (error: any) {
        console.error('Error fetching order:', error);
        throw error;
    }
};

// Get user's purchased courses
export const getUserPurchasedCourses = async (userId: string) => {
    try {
        const user = await User.findById(userId)
            .populate('purchasedCourses.courseId');

        if (!user) {
            throw new Error('User not found');
        }

        return {
            success: true,
            purchasedCourses: user.purchasedCourses,
            totalCourses: user.purchasedCourses.length
        };
    } catch (error: any) {
        console.error('Error fetching purchased courses:', error);
        throw error;
    }
};

// Check if user has purchased a specific course
export const hasUserPurchasedCourse = async (userId: string, courseId: string) => {
    try {
        const user = await User.findById(userId);
        
        if (!user) {
            return { success: true, hasPurchased: false };
        }

        const hasPurchased = user.purchasedCourses.some(
            (pc: any) => pc.courseId.toString() === courseId
        );

        return {
            success: true,
            hasPurchased
        };
    } catch (error: any) {
        console.error('Error checking course purchase:', error);
        throw error;
    }
};

// Mark order as failed
export const markOrderFailed = async (orderId: string, reason?: string) => {
    try {
        const order = await Order.findOne({ orderId });
        
        if (!order) {
            throw new Error('Order not found');
        }

        order.payment.status = 'failed';
        order.status = 'cancelled';
        if (reason) {
            order.notes = reason;
        }

        await order.save();

        return {
            success: true,
            message: 'Order marked as failed',
            order
        };
    } catch (error: any) {
        console.error('Error marking order as failed:', error);
        throw error;
    }
};

// Get all orders (admin)
export const getAllOrders = async (filters?: any) => {
    try {
        const query: any = {};
        
        if (filters?.status) {
            query.status = filters.status;
        }
        
        if (filters?.paymentStatus) {
            query['payment.status'] = filters.paymentStatus;
        }

        const orders = await Order.find(query)
            .sort({ orderDate: -1 })
            .populate('userId', 'username email profile')
            .populate('courses.courseId', 'title thumbnail price');

        return {
            success: true,
            orders,
            totalOrders: orders.length
        };
    } catch (error: any) {
        console.error('Error fetching all orders:', error);
        throw error;
    }
};
