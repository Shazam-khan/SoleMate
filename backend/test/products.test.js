import supertest from 'supertest';
import express from 'express';
import http from 'http';

// Mock modules before importing any modules that use them
jest.mock('../DB/connect.js', () => {
  const dbMock = {
    connect: jest.fn(() => Promise.resolve()),
    query: jest.fn(() => Promise.resolve({ rows: [] })),
    end: jest.fn(() => Promise.resolve()),
  };
  return { db: dbMock };
});

// Mock middleware before importing router
jest.mock('../middleware/Products', () => ({
  checkProductId: jest.fn((req, res, next) => {
    req.product = { p_id: req.params.id, p_name: 'Mock Product', brand: 'Mock', price: 99.99 };
    next();
  }),
  CheckImageId: jest.fn((req, res, next) => {
    req.image = { id: req.params.iId, image_url: 'http://mock-url.com/mock-image.jpg', product_id: req.params.id };
    next();
  }),
  checkSizeId: jest.fn((req, res, next) => {
    req.size = { id: req.params.sId, size: 'M', stock: 10, product_id: req.params.id };
    next();
  }),
}));

// Mock admin guard so write routes are reachable in unit tests
jest.mock('../middleware/user', () => ({
  verifyAdmin: jest.fn((req, res, next) => next()),
  ValidateUserId: jest.fn((req, res, next) => next()),
}));

// Mock Multer
jest.mock('multer', () => {
  const multerMock = () => ({
    single: () => (req, res, next) => {
      req.file = { buffer: Buffer.from('mock-image'), mimetype: 'image/jpeg' };
      next();
    },
  });
  multerMock.memoryStorage = () => ({});
  return multerMock;
});

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(() => ({ data: { path: 'public/mock-image.jpg' }, error: null })),
        getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'http://mock-url.com/mock-image.jpg' } })),
      })),
    },
  })),
}));

// Now import modules that use the mocks
import { db } from '../DB/connect.js';
import productRouter from '../routes/productRoutes.js';

describe('Product Routes', () => {
  let app;
  let server;
  let request;

  beforeEach(() => {
    // Create a fresh express app for each test
    app = express();
    app.use(express.json());
    app.use('/api/products', productRouter);
    
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

  // Test GET /api/products
  test('GET /api/products should return all products', async () => {
    const mockProducts = [
      { p_id: '1', p_name: 'Sneaker', brand: 'Nike', price: 99.99 },
      { p_id: '2', p_name: 'Boots', brand: 'Adidas', price: 149.99 },
    ];
    db.query.mockResolvedValueOnce({ rows: mockProducts });

    const response = await request.get('/api/products');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      message: null,
      Products: mockProducts,
      error: false,
    });
    expect(db.query).toHaveBeenCalledWith('SELECT * FROM Product');
  });

  // Test POST /api/products
  test('POST /api/products should create a new product', async () => {
    const newProduct = { pName: 'Sandals', brand: 'Puma', price: 59.99 };
    const createdProduct = { p_id: '3', p_name: 'Sandals', brand: 'Puma', price: 59.99 };
    db.query.mockResolvedValueOnce({ rows: [createdProduct] });

    const response = await request
      .post('/api/products')
      .send(newProduct);
    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      message: 'Product created successfully',
      id: createdProduct,
      error: false,
    });
    expect(db.query).toHaveBeenCalledWith(
      'INSERT INTO Product (p_id,p_name,brand,price) VALUES ($1,$2,$3,$4) RETURNING *',
      expect.any(Array)
    );
  });

  // Test GET /api/products/:id
  test('GET /api/products/:id should return a product by ID', async () => {
    const mockProduct = { p_id: '1', p_name: 'Sneaker', brand: 'Nike', price: 99.99 };
    const response = await request.get('/api/products/1');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      message: 'Product Found',
      Product: expect.objectContaining({ p_id: '1' }),
      error: false,
    });
    expect(require('../middleware/Products').checkProductId).toHaveBeenCalled();
  });

  // Test PUT /api/products/:id
  test('PUT /api/products/:id should update a product', async () => {
    const updatedProductInput = { pName: 'Updated Sneaker', brand: 'Nike', price: 109.99 };
    const mockExistingProduct = { p_id: '1', p_name: 'Sneaker', brand: 'Nike', price: 99.99 };
    const mockUpdatedProduct = { p_id: '1', p_name: 'Updated Sneaker', brand: 'Nike', price: 109.99 };
    
    db.query
      .mockResolvedValueOnce({ rows: [mockExistingProduct] })
      .mockResolvedValueOnce({ rows: [mockUpdatedProduct] });

    const response = await request
      .put('/api/products/1')
      .send(updatedProductInput);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      message: 'Product updated successfully',
      Product: mockUpdatedProduct,
      error: false,
    });
    expect(db.query).toHaveBeenCalledWith(
      'SELECT * FROM Product WHERE p_id = $1',
      ['1']
    );
    expect(db.query).toHaveBeenCalledWith(
      'UPDATE Product SET p_name = $1, brand = $2, price = $3 WHERE p_id = $4 RETURNING *',
      ['Updated Sneaker', 'Nike', 109.99, '1']
    );
  });
});