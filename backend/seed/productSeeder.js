const Product = require('../models/Product');
const Variant = require('../models/Variant');
const logger = require('../utils/logger');

const sampleProductTemplates = [
  {
    title: 'Wireless Bluetooth Headphones',
    shortDescription: 'Over-ear wireless headphones with active noise cancellation',
    description:
      'Experience immersive sound quality with these wireless over-ear headphones. Featuring active noise cancellation, 30-hour battery life, and a comfortable memory foam ear cushion for extended listening sessions.',
    price: 4999,
    salePrice: 3999,
    stock: 50,
    tags: ['audio', 'headphones', 'wireless'],
    colors: ['Black', 'White', 'Blue'],
    featured: true,
    unitName: 'Piece',
    variantAttr: 'Color',
    variantValues: ['Black', 'White', 'Blue'],
  },
  {
    title: 'Running Shoes - Air Max Series',
    shortDescription: 'Lightweight running shoes with responsive cushioning',
    description:
      'Engineered for performance and comfort, these running shoes feature a breathable mesh upper and responsive air cushioning for a smooth, energized stride on every run.',
    price: 5999,
    salePrice: 4499,
    stock: 80,
    tags: ['shoes', 'running', 'sports'],
    sizes: ['7', '8', '9', '10', '11'],
    colors: ['Black', 'Red', 'Grey'],
    featured: true,
    unitName: 'Pair',
    variantAttr: 'Size',
    variantValues: ['7', '8', '9', '10', '11'],
  },
  {
    title: 'Smart Fitness Watch',
    shortDescription: 'Track your health and fitness with this smart watch',
    description:
      'Monitor your heart rate, sleep quality, and daily activity with this water-resistant smart fitness watch. Includes GPS tracking, 7-day battery life, and smartphone notifications.',
    price: 7999,
    salePrice: 6499,
    stock: 40,
    tags: ['wearable', 'fitness', 'smartwatch'],
    colors: ['Black', 'Silver'],
    featured: false,
    unitName: 'Piece',
  },
  {
    title: '4K Ultra HD Smart LED TV - 55 inch',
    shortDescription: 'Cinematic 4K experience with built-in streaming apps',
    description:
      'Bring the theater home with this 55-inch 4K Ultra HD Smart LED TV. Enjoy vivid colors, deep contrast, and access to all your favorite streaming apps built right in.',
    price: 45999,
    salePrice: 39999,
    stock: 15,
    tags: ['tv', 'electronics', 'entertainment'],
    featured: true,
    unitName: 'Piece',
  },
  {
    title: 'Stainless Steel Cookware Set (10-Piece)',
    shortDescription: 'Durable, induction-compatible cookware set for everyday cooking',
    description:
      'This 10-piece stainless steel cookware set includes everything you need for everyday cooking. Induction compatible, dishwasher safe, and built to last with a tri-ply construction for even heat distribution.',
    price: 8999,
    salePrice: 7499,
    stock: 25,
    tags: ['kitchen', 'cookware', 'home'],
    featured: false,
    unitName: 'Set',
  },
  {
    title: "Men's Slim Fit Cotton T-Shirt (Pack of 3)",
    shortDescription: 'Breathable, everyday cotton t-shirts in essential colors',
    description:
      'Upgrade your everyday wardrobe with this pack of 3 slim-fit cotton t-shirts. Made from 100% breathable cotton, they are soft, durable, and perfect for casual or layered outfits.',
    price: 1499,
    salePrice: 1199,
    stock: 100,
    tags: ['clothing', 'fashion', 'menswear'],
    sizes: ['S', 'M', 'L', 'XL'],
    colors: ['Black', 'White', 'Grey'],
    featured: false,
    unitName: 'Pack',
    variantAttr: 'Size',
    variantValues: ['S', 'M', 'L', 'XL'],
  },
];

const seedProducts = async (categories, brands, units = []) => {
  const existingCount = await Product.countDocuments();
  if (existingCount > 0) {
    logger.info('Products already exist, skipping product seeding');
    return;
  }

  const unitByName = new Map(units.map((u) => [u.name, u]));
  const created = [];

  for (let index = 0; index < sampleProductTemplates.length; index += 1) {
    const { unitName, variantAttr, variantValues, ...template } = sampleProductTemplates[index];
    const unit = unitByName.get(unitName);

    const product = await Product.create({
      ...template,
      SKU: `SKU-${1000 + index}`,
      category: categories[index % categories.length]._id,
      brand: brands[index % brands.length]._id,
      unit: unit ? unit._id : undefined,
      unitValue: 1,
      status: 'active',
      images: [],
      thumbnail: { url: '', publicId: '' },
    });

    // Demonstrate the variant engine on the two products that naturally have
    // one (color for headphones, size for shoes/t-shirts) rather than
    // forcing variants onto every seeded product.
    if (variantAttr && variantValues?.length) {
      const variants = variantValues.map((value, i) => ({
        product: product._id,
        attributes: [{ key: variantAttr, value }],
        sku: `${product.SKU}-${value.toString().toUpperCase().slice(0, 3)}`,
        price: product.price,
        salePrice: product.salePrice,
        stock: Math.max(5, Math.floor(product.stock / variantValues.length)),
        status: 'active',
        isDefault: i === 0,
      }));
      await Variant.insertMany(variants);
      product.hasVariants = true;
      await product.save();
    }

    created.push(product);
  }

  logger.info(`${created.length} sample products seeded (with variants on ${created.filter((p) => p.hasVariants).length})`);
  return created;
};

module.exports = seedProducts;
