const mongoose = require("mongoose");
const slugify = require("slugify");

/**
 * One model for every content page (About, Contact, Privacy Policy, Terms,
 * FAQ landing copy, Home's own SEO meta, and any future page) — deliberately
 * NOT a separate hardcoded model per page, so the admin can create/rename/
 * remove pages without a code change.
 */
const seoSchema = new mongoose.Schema(
  {
    metaTitle: { type: String, default: "" },
    metaDescription: { type: String, default: "" },
    metaKeywords: { type: String, default: "" },
    canonicalUrl: { type: String, default: "" },
    ogTitle: { type: String, default: "" },
    ogDescription: { type: String, default: "" },
    ogImage: { type: String, default: "" },
    robots: { type: String, default: "index, follow" },
  },
  { _id: false },
);

const pageSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },
    content: { type: String, default: "" }, // rich HTML/markdown body
    excerpt: { type: String, default: "" },
    featuredImage: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },
    status: {
      type: String,
      enum: ["draft", "published", "unpublished"],
      default: "draft",
    },
    publishedAt: { type: Date, default: null },
    sortOrder: { type: Number, default: 0 },
    seo: { type: seoSchema, default: () => ({}) },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

pageSchema.index({ status: 1 });

pageSchema.pre("save", function () {
  if ((this.isModified("title") || !this.slug) && this.title) {
    this.slug = slugify(this.title, {
      lower: true,
      strict: true,
      trim: true,
    });
  }

  if (
    this.isModified("status") &&
    this.status === "published" &&
    !this.publishedAt
  ) {
    this.publishedAt = new Date();
  }
});

module.exports = mongoose.model("Page", pageSchema);
