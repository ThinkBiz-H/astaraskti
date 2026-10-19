const mongoose = require('mongoose');

const newsletterSubscriberSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    name: {
      type: String,
      trim: true,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    unsubscribedAt: {
      type: Date,
      default: null,
    },
    unsubscribeToken: {
      type: String,
      default: null,
    },
    subscriptionSource: {
      type: String,
      enum: ['website', 'admin', 'import'],
      default: 'website',
    },
  },
  { timestamps: true }
);

newsletterSubscriberSchema.index({ email: 1 });
newsletterSubscriberSchema.index({ isActive: 1 });
newsletterSubscriberSchema.index({ createdAt: -1 });

module.exports = mongoose.model('NewsletterSubscriber', newsletterSubscriberSchema);
