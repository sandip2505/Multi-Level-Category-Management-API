import { ICategory } from '../models/Category';

interface CategoryTreeNode {
  _id: string;
  name: string;
  status: string;
  children: CategoryTreeNode[];
}

/**
 * Builds a hierarchical tree structure from flat category data
 * @param categories - Array of category documents from database
 * @returns Array of root categories with nested children
 */
export const buildCategoryTree = (categories: ICategory[]): CategoryTreeNode[] => {
  const categoryMap = new Map<string, CategoryTreeNode>();
  const rootCategories: CategoryTreeNode[] = [];

  // First, create a map of categories by id with empty children arrays
  categories.forEach(category => {
    categoryMap.set(category._id.toString(), {
      _id: category._id.toString(),
      name: category.name,
      status: category.status,
      children: []
    });
  });

  // Then, build the tree structure by adding each category to its parent's children
  categories.forEach(category => {
    const categoryId = category._id.toString();
    const mappedCat = categoryMap.get(categoryId);
    
    if (!mappedCat) return; // Skip if not found (shouldn't happen)
    
    if (category.parent) {
      const parentId = category.parent.toString();
      const parent = categoryMap.get(parentId);
      
      if (parent) {
        parent.children.push(mappedCat);
      } else {
        // If parent not found (possibly deleted), treat as root
        rootCategories.push(mappedCat);
      }
    } else {
      // No parent means this is a root category
      rootCategories.push(mappedCat);
    }
  });

  return rootCategories;
};

/**
 * Get all descendant category IDs for a given parent category
 * @param categoryId - The parent category ID
 * @param categories - All categories in the system
 * @returns Array of descendant category IDs
 */
export const getAllDescendantIds = (
  categoryId: string, 
  categories: ICategory[]
): string[] => {
  const descendants: string[] = [];
  const children = categories.filter(cat => 
    cat.parent && cat.parent.toString() === categoryId
  );
  
  // Add direct children
  children.forEach(child => {
    const childId = child._id.toString();
    descendants.push(childId);
    
    // Recursively add children's descendants
    const childDescendants = getAllDescendantIds(childId, categories);
    descendants.push(...childDescendants);
  });
  
  return descendants;
};