const cloudinary = require('../config/cloudinary');
const streamifier = require('stream');

/**
 * Uploads a file buffer (from multer memoryStorage) to Cloudinary.
 *
 * `options` is new (Phase 12) and fully optional — every existing call
 * site across the app calls this with just (buffer, folder) and destructures
 * only {url, publicId} from the result, so none of it changes behavior for
 * them. The extra returned fields (width/height/format/bytes/resourceType)
 * are additive, used by the new Media Manager for metadata.
 *
 * @param {Buffer} buffer
 * @param {String} folder
 * @param {Object} [options]
 * @param {'image'|'video'|'raw'|'auto'} [options.resourceType='image']
 * @param {Boolean} [options.optimize=true] - applies Cloudinary's automatic
 *   quality + format optimization (q_auto/f_auto) for images — this IS the
 *   "image compression/optimization" feature: real, Cloudinary-side
 *   transformation, not a custom compression pipeline reimplemented here.
 */
const uploadToCloudinary = (buffer, folder = 'ecommerce', options = {}) => {
  const { resourceType = 'image', optimize = true } = options;

  return new Promise((resolve, reject) => {
    const uploadOptions = { folder, resource_type: resourceType };
    if (resourceType === 'image' && optimize) {
      uploadOptions.quality = 'auto';
      uploadOptions.fetch_format = 'auto';
    }

    const uploadStream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
      if (error) return reject(error);
      resolve({
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
        resourceType: result.resource_type,
      });
    });

    const bufferStream = new streamifier.Readable();
    bufferStream.push(buffer);
    bufferStream.push(null);
    bufferStream.pipe(uploadStream);
  });
};

const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  if (!publicId) return null;
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
};

module.exports = { uploadToCloudinary, deleteFromCloudinary };
