export const MEETING_MODES = ['Phone Call', 'WhatsApp', 'Google Meet', 'Zoom'];

// Maps a consultation service's backend `type` to which detail form to render.
// See backend models/ConsultationService.js SERVICE_TYPES.
export const SERVICE_TYPE_LABELS = {
  kundli: 'Kundli Reading',
  horoscope_matching: 'Horoscope Matching',
  gemstone: 'Gemstone Consultation',
  vastu: 'Vastu Consultation',
  general: 'Consultation',
};

export const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID;
export const RAZORPAY_CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';
