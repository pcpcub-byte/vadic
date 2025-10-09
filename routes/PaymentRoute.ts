import { Elysia } from 'elysia';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { completeOrder, markOrderFailed } from '../controlers/orderController';

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || '',
  key_secret: process.env.RAZORPAY_KEY_SECRET || '',
});

const paymentRoutes = new Elysia({ prefix: '/api/payment' })
  // Create Razorpay order
  .post('/create-order', async ({ body, set }) => {
    try {
      const { amount, currency = 'INR' } = body as { amount: number; currency?: string };

      if (!amount || amount <= 0) {
        set.status = 400;
        return {
          success: false,
          message: 'Invalid amount provided',
        };
      }

      // Create order on Razorpay
      const options = {
        amount: Math.round(amount * 100), // Convert to paise
        currency,
        receipt: `receipt_${Date.now()}`,
      };

      const order = await razorpay.orders.create(options);

      return {
        success: true,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
      };
    } catch (error: any) {
      console.error('Error creating Razorpay order:', error);
      set.status = 500;
      return {
        success: false,
        message: error.message || 'Failed to create order',
      };
    }
  })

  // Verify payment signature
  .post('/verify', async ({ body, set }) => {
    try {
      const { 
        razorpay_order_id, 
        razorpay_payment_id, 
        razorpay_signature,
        orderId // Our internal order ID
      } = body as {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
        orderId: string;
      };

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        set.status = 400;
        return {
          success: false,
          message: 'Missing payment verification details',
        };
      }

      // Generate signature for verification
      const generatedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      // Compare signatures
      if (generatedSignature === razorpay_signature) {
        // Payment is verified - complete the order
        if (orderId) {
          try {
            await completeOrder(orderId, {
              razorpay_order_id,
              razorpay_payment_id,
              razorpay_signature
            });
          } catch (orderError) {
            console.error('Error completing order:', orderError);
          }
        }
        
        return {
          success: true,
          message: 'Payment verified successfully',
          paymentId: razorpay_payment_id,
          orderId: razorpay_order_id,
        };
      } else {
        // Payment verification failed - mark order as failed
        if (orderId) {
          try {
            await markOrderFailed(orderId, 'Payment verification failed - invalid signature');
          } catch (orderError) {
            console.error('Error marking order as failed:', orderError);
          }
        }
        
        set.status = 400;
        return {
          success: false,
          message: 'Payment verification failed - invalid signature',
        };
      }
    } catch (error: any) {
      console.error('Error verifying payment:', error);
      set.status = 500;
      return {
        success: false,
        message: error.message || 'Payment verification failed',
      };
    }
  })

  // Get payment details (optional - for checking payment status)
  .get('/status/:paymentId', async ({ params, set }) => {
    try {
      const { paymentId } = params;
      
      const payment = await razorpay.payments.fetch(paymentId);
      
      return {
        success: true,
        payment: {
          id: payment.id,
          amount: Number(payment.amount) / 100, // Convert from paise to rupees
          currency: payment.currency,
          status: payment.status,
          method: payment.method,
          email: payment.email,
          contact: payment.contact,
          created_at: payment.created_at,
        },
      };
    } catch (error: any) {
      console.error('Error fetching payment status:', error);
      set.status = 500;
      return {
        success: false,
        message: error.message || 'Failed to fetch payment status',
      };
    }
  });

export default paymentRoutes;
