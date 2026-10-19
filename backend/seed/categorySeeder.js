const Category = require('../models/Category');
const logger = require('../utils/logger');

/**
 * Demonstrates the unlimited-depth hierarchy with the business's own domain
 * (resin art). Each root entry's `children` array may itself contain
 * `children`, to any depth — nothing here is hardcoded into the schema or
 * controllers, this is just sample data shaped like a real catalog.
 */
const tree = [
  {
    name: 'Resin',
    description: 'Epoxy resin systems by mix ratio and grade',
    children: [
      {
        name: 'Ratio 2:1',
        children: [{ name: 'Super Plus' }],
      },
      {
        name: 'Ratio 3:1',
        children: [{ name: 'Super Plus Premium' }],
      },
    ],
  },
  {
    name: 'Accessories',
    description: 'Tools and supplies for resin art',
    children: [{ name: 'Gloves' }, { name: 'Metal Stand' }, { name: 'Ring Hoop' }],
  },
  {
    name: 'Frames',
    description: 'Frames and mounts for finished resin pieces',
    children: [{ name: 'Wooden' }, { name: 'Metal' }],
  },
];

/**
 * Recursively creates a node and its children, returning every created
 * document as a flat array (so callers can distinguish leaves from parents).
 */
const createNode = async (node, parent) => {
  const category = await Category.create({
    name: node.name,
    description: node.description || '',
    parent: parent ? parent._id : null,
    ancestors: parent ? [...parent.ancestors, parent._id] : [],
    level: parent ? parent.ancestors.length + 1 : 0,
  });

  let created = [category];
  if (node.children && node.children.length) {
    for (const child of node.children) {
      // eslint-disable-next-line no-await-in-loop
      const childCreated = await createNode(child, category);
      created = created.concat(childCreated);
    }
  }
  return created;
};

const seedCategories = async () => {
  const existingCount = await Category.countDocuments();
  if (existingCount > 0) {
    logger.info('Categories already exist, skipping category seeding');
    const all = await Category.find();
    return all.filter((c) => !all.some((other) => String(other.parent) === String(c._id)));
  }

  let allCreated = [];
  for (const root of tree) {
    // eslint-disable-next-line no-await-in-loop
    const created = await createNode(root, null);
    allCreated = allCreated.concat(created);
  }

  logger.info(`${allCreated.length} categories seeded across ${tree.length} root categories`);

  // Only leaf categories (no children) should get products assigned —
  // matches "products only reference the final selected category".
  const leaves = allCreated.filter((c) => !allCreated.some((other) => String(other.parent) === String(c._id)));
  return leaves;
};

module.exports = seedCategories;
