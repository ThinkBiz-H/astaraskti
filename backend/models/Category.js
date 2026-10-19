const mongoose = require("mongoose");
const slugify = require("slugify");

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, lowercase: true, index: true },
    image: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },
    description: { type: String, default: "" },
    status: { type: String, enum: ["active", "inactive"], default: "active" },

    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    ancestors: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
    level: { type: Number, default: 0, min: 0 },

    // Admin-controlled ordering among siblings (lower first). Not enforced
    // as unique — ties just fall back to name order.
    sortOrder: { type: Number, default: 0 },

    attributeTemplate: [
      {
        key: { type: String, required: true, trim: true }, // machine key, matches Product.attributes[].key
        label: { type: String, required: true, trim: true }, // human label for the admin/storefront form
        type: {
          type: String,
          enum: ["text", "number", "select"],
          default: "text",
        },
        options: [{ type: String }], // choices, only used when type = 'select'
        unit: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Unit",
          default: null,
        }, // e.g. "Mix Time" -> minutes
        required: { type: Boolean, default: false },
      },
    ],
  },
  { timestamps: true },
);

categorySchema.index({ parent: 1, name: 1 }, { unique: true });
categorySchema.index({ ancestors: 1 });
categorySchema.index({ parent: 1, sortOrder: 1 });

// Virtual populate — direct children only. Use with .populate('children').
categorySchema.virtual("children", {
  ref: "Category",
  localField: "_id",
  foreignField: "parent",
});

categorySchema.set("toJSON", { virtuals: true });
categorySchema.set("toObject", { virtuals: true });

categorySchema.pre("save", async function () {
  if (this.isModified("name") || !this.slug) {
    const base = slugify(this.name, { lower: true, strict: true });

    let candidate = base;
    let suffix = 1;

    // Ensure global slug uniqueness
    while (
      await this.constructor.exists({
        slug: candidate,
        _id: { $ne: this._id },
      })
    ) {
      suffix++;
      candidate = `${base}-${suffix}`;
    }

    this.slug = candidate;
  }
});

/** All descendant category ids (any depth) of the given category, NOT including itself. */
categorySchema.statics.getDescendantIds = async function (categoryId) {
  const descendants = await this.find({ ancestors: categoryId })
    .select("_id")
    .lean();
  return descendants.map((d) => d._id);
};

/**
 * A category id plus every id beneath it — the set to use when filtering
 * products "in this category", since a product tagged with a subcategory
 * should still show up when browsing the parent category.
 */
categorySchema.statics.getSelfAndDescendantIds = async function (categoryId) {
  const descendantIds = await this.getDescendantIds(categoryId);
  return [categoryId, ...descendantIds];
};

/** Builds the full nested tree in a single query (O(n) in memory, not O(depth) round-trips). */
categorySchema.statics.getTree = async function (filter = {}) {
  const flat = await this.find(filter)
    .sort({ level: 1, sortOrder: 1, name: 1 })
    .lean();
  const byId = new Map(
    flat.map((c) => [String(c._id), { ...c, children: [] }]),
  );
  const roots = [];
  byId.forEach((node) => {
    if (node.parent && byId.has(String(node.parent))) {
      byId.get(String(node.parent)).children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
};

module.exports = mongoose.model("Category", categorySchema);
