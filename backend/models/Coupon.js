const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    // Additive (astrology add-on): which order types this coupon may be
    // redeemed against. Defaults to ['product'] so every existing coupon
    // keeps behaving exactly as it did before this field existed.
    appliesTo: {
      type: [{ type: String, enum: ['product', 'consultation'] }],
      default: ['product'],
    },
    description: { type: String, default: '', trim: true },
    discount: { type: Number, required: true, min: 0 },
    type: { type: String, enum: ['percentage', 'flat'], default: 'percentage' },
    expiry: { type: Date, required: true },
    minimumOrder: { type: Number, default: 0 },
    maximumDiscount: { type: Number, default: null },
    usageLimit: { type: Number, default: 1 }, // total number of redemptions allowed, across all users
    usedCount: { type: Number, default: 0 },
    perUserLimit: { type: Number, default: 1, min: 1 }, // how many times a single user may redeem this coupon
    usedBy: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        count: { type: Number, default: 0 },
      },
    ],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

couponSchema.methods.isValid = function (orderAmount, userId) {
  if (!this.isActive) return { valid: false, reason: 'Coupon is inactive' };
  if (new Date() > this.expiry) return { valid: false, reason: 'Coupon has expired' };
  if (this.usedCount >= this.usageLimit) return { valid: false, reason: 'Coupon usage limit reached' };
  if (orderAmount < this.minimumOrder)
    return { valid: false, reason: `Minimum order amount of ${this.minimumOrder} required` };

  if (userId) {
    const entry = this.usedBy.find((u) => u.user.toString() === userId.toString());
    const usedByUser = entry ? entry.count : 0;
    if (usedByUser >= this.perUserLimit) {
      return { valid: false, reason: 'You have already used this coupon the maximum number of times' };
    }
  }

  return { valid: true };
};

// Records a redemption for a given user: bumps the global counter and the
// per-user counter together so both limits stay in sync. Accepts an
// optional mongoose session so it can participate in a transaction (e.g.
// the Razorpay webhook flow).
couponSchema.methods.recordUsage = async function (userId, session) {
  this.usedCount += 1;
  const entry = this.usedBy.find((u) => u.user.toString() === userId.toString());
  if (entry) {
    entry.count += 1;
  } else {
    this.usedBy.push({ user: userId, count: 1 });
  }
  await this.save(session ? { session } : undefined);
};

couponSchema.methods.calculateDiscount = function (orderAmount) {
  let discountAmount =
    this.type === 'percentage' ? (orderAmount * this.discount) / 100 : this.discount;

  if (this.maximumDiscount && discountAmount > this.maximumDiscount) {
    discountAmount = this.maximumDiscount;
  }
  return Math.round(discountAmount * 100) / 100;
};

module.exports = mongoose.model('Coupon', couponSchema);
