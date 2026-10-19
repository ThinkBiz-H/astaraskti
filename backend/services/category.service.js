const Category = require('../models/Category');
const Product = require('../models/Product');
const ApiError = require('../utils/ApiError');

/**
 * Normalizes the raw `parent` value coming from a (possibly multipart/
 * form-data) request body into either `null` (root category) or a string id.
 */
const normalizeParentInput = (raw) => {
  if (raw === undefined) return undefined; // field not sent at all — leave untouched
  if (raw === null || raw === '' || raw === 'null' || raw === 'root') return null;
  return raw;
};

/**
 * Validates a proposed parent for a category (on create or move) and
 * returns the parent document (or null for root).
 * Throws if the parent doesn't exist, is inactive-deleted, or would create
 * a cycle (parent is the category itself or one of its own descendants).
 */
const resolveParent = async (parentId, categoryId = null) => {
  if (parentId === null) return null;

  const parent = await Category.findById(parentId);
  if (!parent) throw new ApiError(404, 'Parent category not found');

  if (categoryId) {
    if (String(parent._id) === String(categoryId)) {
      throw new ApiError(400, 'A category cannot be its own parent');
    }
    if (parent.ancestors.some((a) => String(a) === String(categoryId))) {
      throw new ApiError(400, 'Cannot move a category under one of its own descendants');
    }
  }

  return parent;
};

/**
 * Re-parents `category` under `newParent` (or to root if null), and cascades
 * the resulting ancestors/level change to every descendant in one pass.
 * Call this AFTER resolveParent() has already validated there's no cycle.
 */
const reparentCategory = async (category, newParent) => {
  const oldLevel = category.level;
  const newAncestors = newParent ? [...newParent.ancestors, newParent._id] : [];

  category.parent = newParent ? newParent._id : null;
  category.ancestors = newAncestors;
  category.level = newAncestors.length;
  await category.save();

  const descendants = await Category.find({ ancestors: category._id });
  if (descendants.length === 0) return category;

  const bulkOps = descendants.map((d) => {
    const tail = d.ancestors.slice(oldLevel + 1); // portion of the path below `category`
    const updatedAncestors = [...newAncestors, category._id, ...tail];
    return {
      updateOne: {
        filter: { _id: d._id },
        update: { $set: { ancestors: updatedAncestors, level: updatedAncestors.length } },
      },
    };
  });
  await Category.bulkWrite(bulkOps);

  return category;
};

/**
 * Guards against deleting a category that would orphan subcategories or
 * leave products pointing at a category id that no longer exists.
 */
const assertDeletable = async (categoryId) => {
  const [childCount, productCount] = await Promise.all([
    Category.countDocuments({ parent: categoryId }),
    Product.countDocuments({ category: categoryId, isDeleted: false }),
  ]);

  if (childCount > 0) {
    throw new ApiError(
      400,
      `Cannot delete: this category has ${childCount} subcategor${childCount === 1 ? 'y' : 'ies'}. Delete or move them first.`
    );
  }
  if (productCount > 0) {
    throw new ApiError(
      400,
      `Cannot delete: ${productCount} product${productCount === 1 ? ' is' : 's are'} assigned to this category. Reassign them first.`
    );
  }
};

/**
 * Phase 4 — resolves the EFFECTIVE attribute template for a category by
 * merging its own template with every ancestor's, root-first. A leaf like
 * "Super Plus" (under Resin -> Ratio 2:1) inherits fields defined up at
 * "Resin" without the admin having to redefine them on every leaf; a
 * more specific level can still add its own fields, or override an
 * inherited one by reusing the same `key`.
 */
const getEffectiveAttributeTemplate = async (categoryId) => {
  const category = await Category.findById(categoryId);
  if (!category) throw new ApiError(404, 'Category not found');

  const chainIds = [...category.ancestors, category._id];
  const chain = await Category.find({ _id: { $in: chainIds } }).select('attributeTemplate');
  const byId = new Map(chain.map((c) => [String(c._id), c]));

  const merged = new Map(); // key -> field definition, later (more specific) wins
  chainIds.forEach((id) => {
    const cat = byId.get(String(id));
    (cat?.attributeTemplate || []).forEach((field) => merged.set(field.key, field));
  });

  return Array.from(merged.values());
};

module.exports = {
  normalizeParentInput,
  resolveParent,
  reparentCategory,
  assertDeletable,
  getEffectiveAttributeTemplate,
};
