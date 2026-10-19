const transporter = require("../config/mailer");
const logger = require("./logger");

/**
 * Sends an email using the configured SMTP transporter.
 * @param {Object} options - { to, subject, html, text, attachments }
 * @param {Array} [options.attachments] - nodemailer attachment objects,
 *   e.g. [{ filename, content: Buffer }] or [{ filename, path: url }].
 *   Optional and additive — every existing call site that omits it is
 *   completely unaffected.
 */
const sendEmail = async ({ to, subject, html, text, attachments }) => {
  const mailOptions = {
    from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
    to,
    subject,
    html,
    text,
    ...(attachments?.length ? { attachments } : {}),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (error) {
    logger.error(`Failed to send email to ${to}: ${error.message}`);
    throw error;
  }
};

const templates = {
  otp: (name, otp) => `
    <div style="font-family: Arial, sans-serif; max-width:600px; margin:auto;">
      <h2>Hi ${name},</h2>
      <p>Your One-Time Password (OTP) is:</p>
      <h1 style="letter-spacing:4px;">${otp}</h1>
      <p>This OTP is valid for 10 minutes. Do not share it with anyone.</p>
    </div>`,

  welcome: (name) => `
    <div style="font-family: Arial, sans-serif; max-width:600px; margin:auto;">
      <h2>Welcome, ${name}!</h2>
      <p>Thank you for creating an account with us. We're excited to have you on board.</p>
    </div>`,

  resetPassword: (name, resetUrl) => `
    <div style="font-family: Arial, sans-serif; max-width:600px; margin:auto;">
      <h2>Hi ${name},</h2>
      <p>You requested a password reset. Click the link below to reset your password:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>This link expires in 15 minutes. If you didn't request this, please ignore this email.</p>
    </div>`,

  orderConfirmation: (name, order) => `
    <div style="font-family: Arial, sans-serif; max-width:600px; margin:auto;">
      <h2>Hi ${name},</h2>
      <p>Thank you for your order! Your order <strong>#${order.orderNumber}</strong> has been placed successfully.</p>
      <p>Grand Total: <strong>${order.grandTotal}</strong></p>
      <p>We will notify you once your order is shipped.</p>
    </div>`,

  orderDelivered: (name, order) => `
    <div style="font-family: Arial, sans-serif; max-width:600px; margin:auto;">
      <h2>Hi ${name},</h2>
      <p>Your order <strong>#${order.orderNumber}</strong> has been delivered. We hope you enjoy your purchase!</p>
    </div>`,

  paymentSuccess: (name, order) => `
    <div style="font-family: Arial, sans-serif; max-width:600px; margin:auto;">
      <h2>Hi ${name},</h2>
      <p>We've received your payment of <strong>₹${order.grandTotal}</strong> for order <strong>#${order.orderNumber}</strong>.</p>
      <p>Your order is now being processed.</p>
    </div>`,

  paymentFailed: (name, order, reason) => `
  <div style="font-family: Arial, sans-serif; max-width:600px; margin:auto;">
    <h2>Hi ${name},</h2>
    <p>
      Unfortunately, your payment for order
      <strong>#${order.orderNumber}</strong>
      could not be processed
      ${reason ? ` (${reason})` : ""}.
    </p>
    <p>
      You can retry the payment from your orders page,
      or choose Cash on Delivery instead.
    </p>
  </div>
`,

  shipmentDispatched: (name, order) => `
  <div style="font-family: Arial, sans-serif; max-width:600px; margin:auto;">
    <h2>Hi ${name},</h2>

    <p>
      Good news! Your order
      <strong>#${order.orderNumber}</strong>
      has been shipped
      ${
        order.tracking?.number
          ? `— tracking number <strong>${order.tracking.number}</strong>`
          : ""
      }.
    </p>

    ${
      order.tracking?.url
        ? `<p><a href="${order.tracking.url}">Track your shipment</a></p>`
        : ""
    }

  </div>
`,

  orderCancelled: (name, order, reason) => `
  <div style="font-family: Arial, sans-serif; max-width:600px; margin:auto;">
    <h2>Hi ${name},</h2>

    <p>
      Your order
      <strong>#${order.orderNumber}</strong>
      has been cancelled
      ${reason ? ` (${reason})` : ""}.
    </p>

    <p>
      If you already paid, any applicable refund will be processed shortly.
    </p>

  </div>
`,

  returnApproved: (name, order) => `
  <div style="font-family: Arial, sans-serif; max-width:600px; margin:auto;">
    <h2>Hi ${name},</h2>

    <p>
      Your return request for order
      <strong>#${order.orderNumber}</strong>
      has been approved.
    </p>

    <p>
      Our courier partner will arrange a pickup shortly.
    </p>

  </div>
`,
  refundProcessed: (name, order, amount) => `
  <div style="font-family: Arial, sans-serif; max-width:600px; margin:auto;">
    <h2>Hi ${name},</h2>

    <p>
      A refund of
      <strong>₹${amount}</strong>
      for order
      <strong>#${order.orderNumber}</strong>
      has been processed.
    </p>

    <p>
      It should reflect in your original payment method
      within 5–7 business days.
    </p>

  </div>
`,

  contactConfirmation: (name) => `
  <div style="font-family: Arial, sans-serif; max-width:600px; margin:auto;">
    <h2>Hi ${name},</h2>
    <p>Thank you for reaching out to us!</p>
    <p>We have received your message and our team will get back to you shortly.</p>
    <p>We appreciate your inquiry and look forward to assisting you.</p>
  </div>
`,

  contactAdminNotification: (enquiry) => `
  <div style="font-family: Arial, sans-serif; max-width:600px; margin:auto;">
    <h2>New Contact Enquiry</h2>
    <p><strong>From:</strong> ${enquiry.name}</p>
    <p><strong>Email:</strong> ${enquiry.email}</p>
    <p><strong>Mobile:</strong> ${enquiry.mobile || 'Not provided'}</p>
    <p><strong>Subject:</strong> ${enquiry.subject}</p>
    <p><strong>Message:</strong></p>
    <p>${enquiry.message}</p>
  </div>
`,

  newsletterSubscription: (name, unsubscribeUrl) => `
  <div style="font-family: Arial, sans-serif; max-width:600px; margin:auto;">
    <h2>Welcome to our Newsletter!</h2>
    <p>Hi ${name},</p>
    <p>Thank you for subscribing to our newsletter. You'll now receive updates about our latest products, offers, and news.</p>
    <p style="margin-top: 30px; font-size: 12px; color: #666;">
      <a href="${unsubscribeUrl}">Unsubscribe from newsletter</a>
    </p>
  </div>
`,

  // Sent right after payment verification (guest or logged-in — this is a
  // full guest-checkout flow, no account required) since a guest has no
  // in-app notification inbox at all; email is their only confirmation.
  premiumKundliOrderConfirmation: (name, order) => `
    <div style="font-family: Arial, sans-serif; max-width:600px; margin:auto;">
      <h2>Hi ${name},</h2>
      <p>Thank you! We've received your payment for Premium Kundli order <strong>#${order.orderNumber}</strong>.</p>
      <p>We're preparing your report now — you'll get another email the moment it's ready to download.</p>
    </div>`,

  // Future-ready per the Premium Kundli spec — fires automatically the
  // moment an order's pdfUrl is actually set (see updateStatus in
  // premiumKundli.controller.js), whether that's an admin uploading it now
  // or the real generation API setting it later.
  premiumKundliReady: (name, order) => `
    <div style="font-family: Arial, sans-serif; max-width:600px; margin:auto;">
      <h2>Hi ${name},</h2>
      <p>Great news — your Premium Kundli report for order <strong>#${order.orderNumber}</strong> is ready!</p>
      <p>You can download it anytime from your account dashboard under "My Premium Kundli".</p>
    </div>`,

  // Premium Horoscope module — mirrors the two Premium Kundli templates
  // above exactly, just separately named/branded so Horoscope copy can
  // change independently without touching Kundli's.
  premiumHoroscopeOrderConfirmation: (name, order) => `
    <div style="font-family: Arial, sans-serif; max-width:600px; margin:auto;">
      <h2>Hi ${name},</h2>
      <p>Thank you! We've received your payment for Premium Horoscope order <strong>#${order.orderNumber}</strong>.</p>
      <p>We're preparing your report now — you'll get another email the moment it's ready to download.</p>
    </div>`,

  premiumHoroscopeReady: (name, order) => `
    <div style="font-family: Arial, sans-serif; max-width:600px; margin:auto;">
      <h2>Hi ${name},</h2>
      <p>Great news — your Premium Horoscope report for order <strong>#${order.orderNumber}</strong> is ready!</p>
      <p>It's attached to this email as a PDF.</p>
    </div>`,
};

module.exports = { sendEmail, templates };
