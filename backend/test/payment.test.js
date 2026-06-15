import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

// Mock modules before importing dependencies
jest.mock('../DB/connect.js', () => {
  const mockDb = {
    query: jest.fn(),
  };
  return { db: mockDb };
});

jest.mock('uuid', () => ({
  v4: jest.fn()
}));

// Import dependencies after mocking
import { db } from '../DB/connect.js';
import { v4 as uuid } from 'uuid';
import {
  createPayment,
  updatePaymentStatus,
  getAllPayments,
  getPaymentById
} from '../controller/paymentController.js';

// Setup express app for testing
const app = express();
app.use(express.json());
app.post('/api/order/:orderId/payments', createPayment);
app.put('/api/order/:orderId/payments/:paymentId', updatePaymentStatus);
app.get('/api/order/:orderId/payments', getAllPayments);
app.get('/api/order/:orderId/payments/:paymentId', getPaymentById);

describe('Payment Controller', () => {
  const mockOrderId = 'order-123';
  const mockPaymentId = 'payment-123';
  const mockPaymentAmount = 150.99;
  const mockPaymentMethod = 'CREDIT_CARD';
  const mockPaymentDate = '2025-04-29T12:00:00.000Z';

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock Date
    jest.spyOn(global, 'Date').mockImplementation(() => ({
      toISOString: () => mockPaymentDate
    }));
    // Set uuid mock return value
    uuid.mockReturnValue(mockPaymentId);
    
    // Reset db.query mock for each test
    db.query.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createPayment', () => {
    it('should create a new payment successfully', async () => {
      // Mock database response for checking order
      db.query.mockResolvedValueOnce({
        rows: [{ o_id: mockOrderId, is_complete: false }]
      });

      // Mock database response for creating payment
      db.query.mockResolvedValueOnce({
        rows: [{
          payment_id: mockPaymentId,
          payment_amount: mockPaymentAmount,
          payment_date: mockPaymentDate,
          payment_method: mockPaymentMethod,
          order_o_id: mockOrderId,
          status: 'PENDING'
        }]
      });

      const response = await request(app)
        .post(`/api/order/${mockOrderId}/payments`)
        .send({
          paymentAmount: mockPaymentAmount,
          paymentMethod: mockPaymentMethod
        });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        message: 'Payment created successfully.',
        error: false,
        Payment: {
          payment_id: mockPaymentId,
          payment_amount: mockPaymentAmount,
          payment_date: mockPaymentDate,
          payment_method: mockPaymentMethod,
          order_o_id: mockOrderId,
          status: 'PENDING'
        }
      });

      expect(db.query).toHaveBeenCalledTimes(2);
      expect(db.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('SELECT * FROM "Order" WHERE o_id = $1'),
        [mockOrderId]
      );
      expect(db.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO payment'),
        [mockPaymentId, mockPaymentAmount, mockPaymentDate, mockPaymentMethod, mockOrderId, 'PENDING']
      );
    });

    it('should return 400 if payment details are missing', async () => {
      const response = await request(app)
        .post(`/api/order/${mockOrderId}/payments`)
        .send({ 
          // Missing paymentAmount and paymentMethod
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        message: 'Payment amount and method are required.',
        error: true
      });
      expect(db.query).not.toHaveBeenCalled();
    });

    it('should return 404 if order does not exist or is already completed', async () => {
      // Mock database response for checking order - empty result
      db.query.mockResolvedValueOnce({
        rows: []
      });

      const response = await request(app)
        .post(`/api/order/${mockOrderId}/payments`)
        .send({
          paymentAmount: mockPaymentAmount,
          paymentMethod: mockPaymentMethod
        });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        message: 'Order not found or already completed.',
        error: true
      });
      expect(db.query).toHaveBeenCalledTimes(1);
    });

    it('should handle database errors when creating a payment', async () => {
      // Mock database error
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .post(`/api/order/${mockOrderId}/payments`)
        .send({
          paymentAmount: mockPaymentAmount,
          paymentMethod: mockPaymentMethod
        });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        message: 'Error creating payment.',
        error: true
      });
    });
  });

  describe('updatePaymentStatus', () => {
    it('should update payment status successfully to PENDING', async () => {
      // Mock BEGIN transaction
      db.query.mockResolvedValueOnce({});

      // Mock update payment query
      db.query.mockResolvedValueOnce({
        rows: [{
          payment_id: mockPaymentId,
          status: 'PENDING',
          order_o_id: mockOrderId
        }]
      });

      // Mock COMMIT transaction
      db.query.mockResolvedValueOnce({});

      const response = await request(app)
        .put(`/api/order/${mockOrderId}/payments/${mockPaymentId}`)
        .send({ paymentStatus: 'PENDING' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'Payment status updated successfully.',
        error: false,
        Payment: {
          payment_id: mockPaymentId,
          status: 'PENDING',
          order_o_id: mockOrderId
        }
      });

      expect(db.query).toHaveBeenCalledTimes(3);
      expect(db.query).toHaveBeenNthCalledWith(1, 'BEGIN');
      expect(db.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('UPDATE payment'),
        ['PENDING', mockPaymentId]
      );
      expect(db.query).toHaveBeenNthCalledWith(3, 'COMMIT');
    });

    it('should update payment status to COMPLETED and mark order as complete', async () => {
      // Mock BEGIN transaction
      db.query.mockResolvedValueOnce({});

      // Mock update payment query
      db.query.mockResolvedValueOnce({
        rows: [{
          payment_id: mockPaymentId,
          status: 'COMPLETED',
          order_o_id: mockOrderId
        }]
      });

      // Mock update order query (returns the completed order)
      db.query.mockResolvedValueOnce({
        rows: [{ o_id: mockOrderId, is_complete: true, user_u_id: 'user-1', total_amount: '100.00' }]
      });

      // Mock COMMIT transaction
      db.query.mockResolvedValueOnce({});

      // Mock the post-commit lookup of the user's email (for the confirmation email)
      db.query.mockResolvedValueOnce({ rows: [{ email: 'buyer@example.com' }] });

      const response = await request(app)
        .put(`/api/order/${mockOrderId}/payments/${mockPaymentId}`)
        .send({ paymentStatus: 'COMPLETED' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'Payment status updated successfully.',
        error: false,
        Payment: {
          payment_id: mockPaymentId,
          status: 'COMPLETED',
          order_o_id: mockOrderId
        }
      });

      // BEGIN, UPDATE payment, UPDATE Order, COMMIT, SELECT user email
      expect(db.query).toHaveBeenCalledTimes(5);
      expect(db.query).toHaveBeenNthCalledWith(1, 'BEGIN');
      expect(db.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('UPDATE payment'),
        ['COMPLETED', mockPaymentId]
      );
      expect(db.query).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('UPDATE "Order"'),
        [mockOrderId]
      );
      expect(db.query).toHaveBeenNthCalledWith(4, 'COMMIT');
      expect(db.query).toHaveBeenNthCalledWith(
        5,
        expect.stringContaining('SELECT email'),
        ['user-1']
      );
    });

    it('should return 404 if payment is not found', async () => {
      // Mock BEGIN transaction
      db.query.mockResolvedValueOnce({});

      // Mock update payment query - empty result
      db.query.mockResolvedValueOnce({ rows: [] });

      // Mock ROLLBACK transaction
      db.query.mockResolvedValueOnce({});

      const response = await request(app)
        .put(`/api/order/${mockOrderId}/payments/${mockPaymentId}`)
        .send({ paymentStatus: 'COMPLETED' });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        message: 'Payment not found.',
        error: true
      });

      expect(db.query).toHaveBeenCalledTimes(3);
      expect(db.query).toHaveBeenNthCalledWith(1, 'BEGIN');
      expect(db.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('UPDATE payment'),
        ['COMPLETED', mockPaymentId]
      );
      expect(db.query).toHaveBeenNthCalledWith(3, 'ROLLBACK');
    });

    it('should return 400 if payment status is missing', async () => {
      const response = await request(app)
        .put(`/api/order/${mockOrderId}/payments/${mockPaymentId}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        message: 'Payment status is required.',
        error: true
      });
      expect(db.query).not.toHaveBeenCalled();
    });

    it('should handle database errors when updating payment status', async () => {
      // Mock BEGIN transaction
      db.query.mockResolvedValueOnce({});

      // Mock database error
      db.query.mockRejectedValueOnce(new Error('Database error'));

      // Mock ROLLBACK transaction
      db.query.mockResolvedValueOnce({});

      const response = await request(app)
        .put(`/api/order/${mockOrderId}/payments/${mockPaymentId}`)
        .send({ paymentStatus: 'COMPLETED' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        message: 'Error updating payment status.',
        error: true
      });
      expect(db.query).toHaveBeenCalledTimes(3);
      expect(db.query).toHaveBeenNthCalledWith(3, 'ROLLBACK');
    });
  });

  describe('getAllPayments', () => {
    it('should retrieve all payments for an order', async () => {
      const mockPayments = [
        {
          payment_id: mockPaymentId,
          payment_amount: mockPaymentAmount,
          payment_date: mockPaymentDate,
          payment_method: mockPaymentMethod,
          order_o_id: mockOrderId,
          status: 'COMPLETED'
        },
        {
          payment_id: 'payment-456',
          payment_amount: 50,
          payment_date: mockPaymentDate,
          payment_method: 'PAYPAL',
          order_o_id: mockOrderId,
          status: 'PENDING'
        }
      ];

      db.query.mockResolvedValueOnce({
        rows: mockPayments
      });

      const response = await request(app)
        .get(`/api/order/${mockOrderId}/payments`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'Payments fetched successfully.',
        error: false,
        Payments: mockPayments
      });

      expect(db.query).toHaveBeenCalledTimes(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM payment WHERE order_o_id = $1'),
        [mockOrderId]
      );
    });

    it('should return empty array if no payments exist for the order', async () => {
      db.query.mockResolvedValueOnce({
        rows: []
      });

      const response = await request(app)
        .get(`/api/order/${mockOrderId}/payments`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'Payments fetched successfully.',
        error: false,
        Payments: []
      });
    });

    it('should handle database errors when fetching payments', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .get(`/api/order/${mockOrderId}/payments`);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        message: 'Error fetching payments.',
        error: true
      });
    });
  });

  describe('getPaymentById', () => {
    it('should retrieve a specific payment by ID', async () => {
      const mockPayment = {
        payment_id: mockPaymentId,
        payment_amount: mockPaymentAmount,
        payment_date: mockPaymentDate,
        payment_method: mockPaymentMethod,
        order_o_id: mockOrderId,
        status: 'COMPLETED'
      };

      db.query.mockResolvedValueOnce({
        rows: [mockPayment]
      });

      const response = await request(app)
        .get(`/api/order/${mockOrderId}/payments/${mockPaymentId}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'Payment fetched successfully.',
        error: false,
        Payment: mockPayment
      });

      expect(db.query).toHaveBeenCalledTimes(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM payment WHERE payment_id = $1'),
        [mockPaymentId]
      );
    });

    it('should return 404 if payment does not exist', async () => {
      db.query.mockImplementationOnce(() => Promise.resolve({
        rows: []
      }));

      const response = await request(app)
        .get(`/api/order/${mockOrderId}/payments/${mockPaymentId}`);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        message: 'Payment not found.',
        error: true,
        Payment: null
      });
    });

    it('should handle database errors when fetching a payment', async () => {
      db.query.mockImplementationOnce(() => Promise.reject(new Error('Database error')));

      const response = await request(app)
        .get(`/api/order/${mockOrderId}/payments/${mockPaymentId}`);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        message: 'Error fetching payment.',
        error: true
      });
    });
  });
});