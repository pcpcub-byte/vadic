import { Elysia } from 'elysia';
import {
    createOrder,
    completeOrder,
    getUserOrders,
    getOrderById,
    getUserPurchasedCourses,
    hasUserPurchasedCourse,
    markOrderFailed,
    getAllOrders
} from '../controlers/orderController';

const orderRoutes = new Elysia({ prefix: '/api/orders' })
    // Create new order
    .post('/', async ({ body, set }) => {
        try {
            const result = await createOrder(body);
            return result;
        } catch (error: any) {
            set.status = 400;
            return {
                success: false,
                message: error.message || 'Failed to create order'
            };
        }
    })

    // Complete order after payment
    .post('/complete', async ({ body, set }) => {
        try {
            const { orderId, paymentDetails } = body as {
                orderId: string;
                paymentDetails: any;
            };

            if (!orderId || !paymentDetails) {
                set.status = 400;
                return {
                    success: false,
                    message: 'Order ID and payment details are required'
                };
            }

            const result = await completeOrder(orderId, paymentDetails);
            return result;
        } catch (error: any) {
            set.status = 400;
            return {
                success: false,
                message: error.message || 'Failed to complete order'
            };
        }
    })

    // Get user's orders
    .get('/user/:userId', async ({ params, set }) => {
        try {
            const { userId } = params;
            const result = await getUserOrders(userId);
            return result;
        } catch (error: any) {
            set.status = 400;
            return {
                success: false,
                message: error.message || 'Failed to fetch orders'
            };
        }
    })

    // Get single order
    .get('/:orderId', async ({ params, query, set }) => {
        try {
            const { orderId } = params;
            const userId = query.userId as string | undefined;
            const result = await getOrderById(orderId, userId);
            return result;
        } catch (error: any) {
            set.status = 404;
            return {
                success: false,
                message: error.message || 'Order not found'
            };
        }
    })

    // Get user's purchased courses
    .get('/user/:userId/courses', async ({ params, set }) => {
        try {
            const { userId } = params;
            const result = await getUserPurchasedCourses(userId);
            return result;
        } catch (error: any) {
            set.status = 400;
            return {
                success: false,
                message: error.message || 'Failed to fetch purchased courses'
            };
        }
    })

    // Check if user purchased a course
    .get('/user/:userId/course/:courseId', async ({ params, set }) => {
        try {
            const { userId, courseId } = params;
            const result = await hasUserPurchasedCourse(userId, courseId);
            return result;
        } catch (error: any) {
            set.status = 400;
            return {
                success: false,
                message: error.message || 'Failed to check course purchase'
            };
        }
    })

    // Mark order as failed
    .post('/:orderId/failed', async ({ params, body, set }) => {
        try {
            const { orderId } = params;
            const { reason } = body as { reason?: string };
            const result = await markOrderFailed(orderId, reason);
            return result;
        } catch (error: any) {
            set.status = 400;
            return {
                success: false,
                message: error.message || 'Failed to mark order as failed'
            };
        }
    })

    // Get all orders (admin)
    .get('/', async ({ query, set }) => {
        try {
            const result = await getAllOrders(query);
            return result;
        } catch (error: any) {
            set.status = 400;
            return {
                success: false,
                message: error.message || 'Failed to fetch orders'
            };
        }
    });

export default orderRoutes;
