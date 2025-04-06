import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../app';
import User from '../models/User';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/constants';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  // Clear users collection before each test
  await User.deleteMany({});
});

describe('Authentication Controller', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('userId');
      expect(response.body.message).toBe('User registered successfully');

      // Verify user was created in DB
      const user = await User.findOne({ email: userData.email });
      expect(user).toBeTruthy();
    });

    it('should return error for duplicate email', async () => {
      // Create a user first
      const userData = {
        email: 'existing@example.com',
        password: 'password123'
      };
      
      await User.create(userData);
      
      // Try to register with the same email
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('User with this email already exists');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      // Create a user first
      const userData = {
        email: 'login@example.com',
        password: 'password123'
      };
      
      const user = new User(userData);
      await user.save();
      
      // Try to login
      const response = await request(app)
        .post('/api/auth/login')
        .send(userData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('userId');
      expect(response.body.message).toBe('Login successful');
      
      // Verify token is valid
      const token = response.body.token;
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      expect(decoded).toHaveProperty('userId');
      expect(decoded.userId).toBe(user._id.toString());
    });

    it('should return error for invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid email or password');
    });

    it('should return error for invalid password', async () => {
      // Create a user first
      const userData = {
        email: 'valid@example.com',
        password: 'correctpassword'
      };
      
      const user = new User(userData);
      await user.save();
      
      // Try to login with wrong password
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid email or password');
    });
  });
});