import { Request, Response } from 'express';
import mongoose from 'mongoose';

import Category, { ICategory } from '../models/Category';

// Helper function to build category tree
const buildCategoryTree = async (categories: ICategory[]) => {
    const categoryMap = new Map();
    const rootCategories: any[] = [];

    // First, create a map of categories by id
    categories.forEach(category => {
        categoryMap.set(category._id.toString(), {
            _id: category._id,
            name: category.name,
            status: category.status,
            children: []
        });
    });

    // Then, build the tree structure
    categories.forEach(category => {
        const mappedCat = categoryMap.get(category._id.toString());

        if (category.parent) {
            const parent = categoryMap.get(category.parent.toString());
            if (parent) {
                parent.children.push(mappedCat);
            }
        } else {
            rootCategories.push(mappedCat);
        }
    });

    return rootCategories;
};

// Create a new category
export const createCategory = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, parent, status } = req.body;

        // Validate parent if provided
        if (parent) {
            const parentCategory = await Category.findById(parent);
            if (!parentCategory) {
                res.status(400).json({ message: 'Parent category not found' });
            }
        }

        const category = new Category({
            name,
            parent: parent || null,
            status: status || 'active'
        });

        await category.save();

        res.status(201).json({
            message: 'Category created successfully',
            category
        });
    } catch (error) {
        res.status(500).json({ message: 'Failed to create category', error: (error as Error).message });
    }
};

// Get all categories in tree structure
export const getAllCategories = async (_req: Request, res: Response): Promise<void> => {
    try {
        const categories = await Category.find().lean();

        const categoryTree = await buildCategoryTree(categories as ICategory[]);

        res.json({
            categories: categoryTree
        });
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch categories', error: (error as Error).message });
    }
};

// Update a category
export const updateCategory = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { name, status } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            res.status(400).json({ message: 'Invalid category ID' });
            return; // <--- add return
        }

        const category = await Category.findById(id);
        if (!category) {
            res.status(404).json({ message: 'Category not found' });
            return; // <--- add return
        }

        // Update the category
        category.name = name || category.name;

        // Handle status change and propagate to children if needed
        if (status && status !== category.status && status === 'inactive') {
            category.status = status;

            // Update all descendants to inactive (recursive)
            await updateDescendantStatus(id, 'inactive');
        } else if (status) {
            category.status = status;
        }

        await category.save();

        res.json({
            message: 'Category updated successfully',
            category
        });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update category', error: (error as Error).message });
    }
};

// Helper function to update all descendants' status
const updateDescendantStatus = async (parentId: string, status: 'active' | 'inactive') => {
    const children = await Category.find({ parent: parentId });

    // Bulk write to update all children at once
    if (children.length > 0) {
        const bulkOps = children.map(child => ({
            updateOne: {
                filter: { _id: child._id },
                update: { $set: { status } }
            }
        }));

        await Category.bulkWrite(bulkOps);

        // Recursively update their children
        for (const child of children) {
            await updateDescendantStatus(child._id.toString(), status);
        }
    }
};

// Delete a category and reassign subcategories
export const deleteCategory = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            res.status(400).json({ message: 'Invalid category ID' });
        }

        const category = await Category.findById(id);
        if (!category) {
            res.status(404).json({ message: 'Category not found' });
            return; // <--- add return
        }

        // Get the parent of the category to be deleted
        const parentId = category.parent;

        // Find all subcategories
        const subcategories = await Category.find({ parent: id });

        // Reassign subcategories to the deleted category's parent
        if (subcategories.length > 0) {
            const bulkOps = subcategories.map(subcat => ({
                updateOne: {
                    filter: { _id: subcat._id },
                    update: { $set: { parent: parentId || null } }
                }
            }));

            await Category.bulkWrite(bulkOps);
        }

        // Delete the category
        await Category.findByIdAndDelete(id);

        res.json({
            message: 'Category deleted successfully and subcategories reassigned'
        });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete category', error: (error as Error).message });
    }
};