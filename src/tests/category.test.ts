import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../app';
import User from '../models/User';
import Category from '../models/Category';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/constants';

let mongoServer: MongoMemoryServer;
let authToken: string;
let userId: string;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  
  // Create a test user for authentication
  const user = new User({
    email: 'test@example.com',
    password: 'password123'
  });
  await user.save();
  userId = user._id.toString();
  
  // Create token for authenticated requests
  authToken = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '1h' });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  // Clear categories collection before each test
  await Category.deleteMany({});
});

describe('Category Controller', () => {
  describe('POST /api/category', () => {
    it('should create a category when authenticated', async () => {
      const categoryData = {
        name: 'Electronics',
        status: 'active'
      };

      const response = await request(app)
        .post('/api/category')
        .set('Authorization', `Bearer ${authToken}`)
        .send(categoryData);

      expect(response.status).toBe(201);
      expect(response.body.category).toHaveProperty('_id');
      expect(response.body.category.name).toBe(categoryData.name);
      expect(response.body.category.status).toBe(categoryData.status);
    });

    it('should return 401 when not authenticated', async () => {
      const categoryData = {
        name: 'Electronics',
        status: 'active'
      };

      const response = await request(app)
        .post('/api/category')
        .send(categoryData);

      expect(response.status).toBe(401);
    });

    it('should create a subcategory with valid parent', async () => {
      // Create parent category first
      const parentCategory = new Category({
        name: 'Electronics',
        status: 'active'
      });
      await parentCategory.save();
      
      const categoryData = {
        name: 'Laptops',
        parent: parentCategory._id,
        status: 'active'
      };

      const response = await request(app)
        .post('/api/category')
        .set('Authorization', `Bearer ${authToken}`)
        .send(categoryData);

      expect(response.status).toBe(201);
      expect(response.body.category.name).toBe(categoryData.name);
      expect(response.body.category.parent.toString()).toBe(parentCategory._id.toString());
    });

    it('should return 400 for invalid parent id', async () => {
      const categoryData = {
        name: 'Laptops',
        parent: new mongoose.Types.ObjectId(), // Non-existent parent
        status: 'active'
      };

      const response = await request(app)
        .post('/api/category')
        .set('Authorization', `Bearer ${authToken}`)
        .send(categoryData);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Parent category not found');
    });
  });

  describe('GET /api/category', () => {
    it('should get categories in tree structure', async () => {
      // Create parent category
      const parentCategory = new Category({
        name: 'Electronics',
        status: 'active'
      });
      await parentCategory.save();
      
      // Create subcategories
      const subCategory1 = new Category({
        name: 'Laptops',
        parent: parentCategory._id,
        status: 'active'
      });
      await subCategory1.save();
      
      const subCategory2 = new Category({
        name: 'Desktops',
        parent: parentCategory._id,
        status: 'active'
      });
      await subCategory2.save();
      
      // Create sub-subcategory
      const subSubCategory = new Category({
        name: 'Gaming Laptops',
        parent: subCategory1._id,
        status: 'active'
      });
      await subSubCategory.save();

      const response = await request(app)
        .get('/api/category')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('categories');
      
      // Check tree structure
      const tree = response.body.categories;
      expect(tree.length).toBe(1); // One root category (Electronics)
      expect(tree[0].name).toBe('Electronics');
      expect(tree[0].children.length).toBe(2); // Two subcategories
      
      // Find Laptops subcategory
      const laptopsCategory = tree[0].children.find((c: any) => c.name === 'Laptops');
      expect(laptopsCategory).toBeTruthy();
      expect(laptopsCategory.children.length).toBe(1); // One sub-subcategory
      expect(laptopsCategory.children[0].name).toBe('Gaming Laptops');
    });

    it('should return empty array when no categories exist', async () => {
      const response = await request(app)
        .get('/api/category')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.categories).toEqual([]);
    });
  });

  describe('PUT /api/category/:id', () => {
    it('should update category name', async () => {
      // Create category
      const category = new Category({
        name: 'Electronics',
        status: 'active'
      });
      await category.save();
      
      const updateData = {
        name: 'Updated Electronics'
      };

      const response = await request(app)
        .put(`/api/category/${category._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.category.name).toBe(updateData.name);
      
      // Verify DB update
      const updatedCategory = await Category.findById(category._id);
      expect(updatedCategory?.name).toBe(updateData.name);
    });

    it('should update status and cascade to children if set to inactive', async () => {
      // Create parent category
      const parentCategory = new Category({
        name: 'Electronics',
        status: 'active'
      });
      await parentCategory.save();
      
      // Create subcategories
      const subCategory = new Category({
        name: 'Laptops',
        parent: parentCategory._id,
        status: 'active'
      });
      await subCategory.save();
      
      // Create sub-subcategory
      const subSubCategory = new Category({
        name: 'Gaming Laptops',
        parent: subCategory._id,
        status: 'active'
      });
      await subSubCategory.save();

      const updateData = {
        status: 'inactive'
      };

      // Update parent category status
      const response = await request(app)
        .put(`/api/category/${parentCategory._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      
      // Verify cascading updates in DB
      const updatedSubCategory = await Category.findById(subCategory._id);
      const updatedSubSubCategory = await Category.findById(subSubCategory._id);
      
      expect(updatedSubCategory?.status).toBe('inactive');
      expect(updatedSubSubCategory?.status).toBe('inactive');
    });

    it('should return 404 for non-existent category', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .put(`/api/category/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated Category' });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Category not found');
    });
  });

  describe('DELETE /api/category/:id', () => {
    it('should delete category and reassign subcategories to its parent', async () => {
      // Create grandparent category
      const grandparentCategory = new Category({
        name: 'Electronics',
        status: 'active'
      });
      await grandparentCategory.save();
      
      // Create parent category
      const parentCategory = new Category({
        name: 'Computers',
        parent: grandparentCategory._id,
        status: 'active'
      });
      await parentCategory.save();
      
      // Create subcategories
      const subCategory1 = new Category({
        name: 'Laptops',
        parent: parentCategory._id,
        status: 'active'
      });
      await subCategory1.save();
      
      const subCategory2 = new Category({
        name: 'Desktops',
        parent: parentCategory._id,
        status: 'active'
      });
      await subCategory2.save();

      // Delete parent category
      const response = await request(app)
        .delete(`/api/category/${parentCategory._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      
      // Verify parent category is deleted
      const deletedCategory = await Category.findById(parentCategory._id);
      expect(deletedCategory).toBeNull();
      
      // Verify subcategories are reassigned to grandparent
      const updatedSubCategory1 = await Category.findById(subCategory1._id);
      const updatedSubCategory2 = await Category.findById(subCategory2._id);
      
      expect(updatedSubCategory1?.parent?.toString()).toBe(grandparentCategory._id.toString());
      expect(updatedSubCategory2?.parent?.toString()).toBe(grandparentCategory._id.toString());
    });

    it('should delete root category and make subcategories root categories', async () => {
      // Create root category
      const rootCategory = new Category({
        name: 'Electronics',
        status: 'active'
      });
      await rootCategory.save();
      
      // Create subcategory
      const subCategory = new Category({
        name: 'Laptops',
        parent: rootCategory._id,
        status: 'active'
      });
      await subCategory.save();

      // Delete root category
      const response = await request(app)
        .delete(`/api/category/${rootCategory._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      
      // Verify subcategory becomes a root category (parent is null)
      const updatedSubCategory = await Category.findById(subCategory._id);
      expect(updatedSubCategory?.parent).toBeUndefined();
    });

    it('should return 404 for non-existent category', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .delete(`/api/category/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Category not found');
    });
  });
});