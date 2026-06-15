import supertest from 'supertest';
import express from 'express';
import http from 'http';

// Force mock for database connection - BEFORE importing anything else
jest.mock('../DB/connect.js', () => {
  const dbMock = {
    connect: jest.fn(() => Promise.resolve()),
    query: jest.fn(() => Promise.resolve({ rows: [] })),
    end: jest.fn(() => Promise.resolve()),
  };
  return { db: dbMock };
});

// Mock middleware - BEFORE importing routes
jest.mock('../middleware/user.js', () => ({
  ValidateUserId: jest.fn((req, res, next) => {
    req.targetUser = {
      u_id: req.params.userId,
      first_name: 'MockFirst',
      last_name: 'MockLast',
      email: 'mock@example.com',
      password: 'mockpassword',
      phone_number: '1234567890',
    };
    next();
  }),
  verifyAdmin: jest.fn((req, res, next) => {
    req.isAdmin = true; // Mock admin access
    next();
  }),
}));

// Mock nested routers - BEFORE importing router that uses them
jest.mock('../routes/orderRoutes.js', () => ({
  __esModule: true,
  default: jest.fn((req, res) => res.status(200).json({ message: 'Mock order route' })),
}));

jest.mock('../routes/orderDetailRoutes.js', () => ({
  __esModule: true,
  default: jest.fn((req, res) => res.status(200).json({ message: 'Mock order details route' })),
}));

jest.mock('../routes/paymentRoutes.js', () => ({
  __esModule: true,
  default: jest.fn((req, res) => res.status(200).json({ message: 'Mock payment route' })),
}));

// NOW import modules that use the mocks
import { db } from '../DB/connect.js';
import userRouter from '../routes/userRoutes.js';

describe('User Routes', () => {
  let app;
  let server;
  let request;

  beforeEach(() => {
    // Create a fresh express app for each test
    app = express();
    app.use(express.json());
    app.use('/api/users', userRouter);
    
    // Create server for supertest
    server = http.createServer(app);
    request = supertest(server);
    
    // Clear mocks before each test
    jest.clearAllMocks();
  });

  afterEach((done) => {
    // Close the server after each test
    if (server && server.listening) {
      server.close(done);
    } else {
      done();
    }
  });

  // Test GET /api/users
  test('GET /api/users should return all users (admin)', async () => {
    const mockUsers = [
      { u_id: '1', first_name: 'User1', last_name: 'Last1', email: 'user1@example.com', password: 'pass1', phone_number: '1234567890' },
      { u_id: '2', first_name: 'User2', last_name: 'Last2', email: 'user2@example.com', password: 'pass2', phone_number: '0987654321' },
    ];
    db.query.mockResolvedValueOnce({ rows: mockUsers });

    const response = await request.get('/api/users');
    expect(response.status).toBe(200);
    // Passwords must be stripped from the response.
    const expectedUsers = mockUsers.map(({ password, ...rest }) => rest);
    expect(response.body).toEqual({
      message: 'Users Found',
      Users: expectedUsers,
      error: false,
    });
    expect(JSON.stringify(response.body)).not.toContain('pass1');
    expect(db.query).toHaveBeenCalledWith('SELECT * FROM "Users"');
    expect(require('../middleware/user.js').verifyAdmin).toHaveBeenCalled();
  });

  // Test GET /api/users/:userId
  test('GET /api/users/:userId should return a user by ID (admin)', async () => {
    const mockUser = {
      u_id: '1',
      first_name: 'MockFirst',
      last_name: 'MockLast',
      email: 'mock@example.com',
      phone_number: '1234567890',
    };
    const response = await request.get('/api/users/1');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      message: 'User found',
      User: mockUser, // password stripped by the controller
      error: false,
    });
    expect(require('../middleware/user.js').ValidateUserId).toHaveBeenCalled();
    expect(require('../middleware/user.js').verifyAdmin).toHaveBeenCalled();
  });

  // Test DELETE /api/users/:userId
  test('DELETE /api/users/:userId should delete a user (admin)', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const response = await request.delete('/api/users/1');
    expect(response.status).toBe(204);
    expect(response.body).toEqual({}); // 204 typically has no body
    expect(db.query).toHaveBeenCalledWith(
      'DELETE FROM "Users" WHERE u_id = $1',
      ['1']
    );
    expect(require('../middleware/user.js').ValidateUserId).toHaveBeenCalled();
    expect(require('../middleware/user.js').verifyAdmin).toHaveBeenCalled();
  });
});