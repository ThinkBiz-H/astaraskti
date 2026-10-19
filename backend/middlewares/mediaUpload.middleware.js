const multer = require('multer');
const ApiError = require('../utils/ApiError');

const storage = multer.memoryStorage();

const allowedTypes = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
  'video/mp4', 'video/webm', 'video/quicktime',
  'application/pdf',
  // Added for consultation report deliverables (audio consultation
  // recordings) — purely additive, doesn't change any existing caller.
  'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3',
];

const fileFilter = (req, file, cb) => {
  if (allowedTypes.includes(file.mimetype)) return cb(null, true);
  cb(new ApiError(400, `Unsupported file type: ${file.mimetype}`), false);
};

const mediaUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024, files: 20 }, // 25MB/file, up to 20 files per bulk upload
});

// Cloudinary has no distinct "audio" resource_type — audio files upload
// under 'video' just like actual video does, per Cloudinary's own API.
const resourceTypeFor = (mimetype) => {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/') || mimetype.startsWith('audio/')) return 'video';
  return 'raw'; // pdf and everything else
};

// NOTE: this feeds Media.type, whose schema enum is strictly
// ['image','video','raw'] (models/Media.js) — do not add new return values
// here (e.g. a distinct 'audio' or 'pdf' label) without also widening that
// enum, or Media uploads through the admin Media Manager will start
// failing validation. Consumers that need a different label set — e.g.
// ConsultationBooking.deliverables[].type (pdf/image/audio/video) — should
// map mimetype -> their own label locally instead of extending this one.
const typeFor = (mimetype) => {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/') || mimetype.startsWith('audio/')) return 'video';
  return 'raw';
};

module.exports = { mediaUpload, resourceTypeFor, typeFor };
