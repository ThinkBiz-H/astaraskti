const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendResponse } = require('../utils/ApiResponse');
const Media = require('../models/Media');
const MediaFolder = require('../models/MediaFolder');
const { uploadToCloudinary, deleteFromCloudinary } = require('../services/cloudinary.service');
const { resourceTypeFor, typeFor } = require('../middlewares/mediaUpload.middleware');

// ---------- Folders ----------

// @desc    Create a folder
// @route   POST /api/v1/admin/media/folders
// @access  Private/Admin
const createFolder = asyncHandler(async (req, res) => {
  const { name, parent } = req.body;
  const folder = await MediaFolder.create({ name, parent: parent || null });
  sendResponse(res, 201, { folder }, 'Folder created successfully');
});

// @desc    List folders (flat, with parent ref — small enough not to need a tree endpoint)
// @route   GET /api/v1/admin/media/folders
// @access  Private/Admin
const getFolders = asyncHandler(async (req, res) => {
  const folders = await MediaFolder.find().sort('name');
  sendResponse(res, 200, { folders, count: folders.length }, 'Folders fetched successfully');
});

// @desc    Rename a folder
// @route   PUT /api/v1/admin/media/folders/:id
// @access  Private/Admin
const updateFolder = asyncHandler(async (req, res) => {
  const folder = await MediaFolder.findById(req.params.id);
  if (!folder) throw new ApiError(404, 'Folder not found');

  if (req.body.name !== undefined) folder.name = req.body.name;
  if (req.body.parent !== undefined) folder.parent = req.body.parent || null;

  await folder.save();
  sendResponse(res, 200, { folder }, 'Folder updated successfully');
});

// @desc    Delete a folder (blocked if it still has media or subfolders — no orphaning/cascade surprises)
// @route   DELETE /api/v1/admin/media/folders/:id
// @access  Private/Admin
const deleteFolder = asyncHandler(async (req, res) => {
  const folder = await MediaFolder.findById(req.params.id);
  if (!folder) throw new ApiError(404, 'Folder not found');

  const [mediaCount, subfolderCount] = await Promise.all([
    Media.countDocuments({ folder: folder._id }),
    MediaFolder.countDocuments({ parent: folder._id }),
  ]);
  if (mediaCount > 0) throw new ApiError(400, `Cannot delete: this folder still has ${mediaCount} file(s). Move or delete them first.`);
  if (subfolderCount > 0) throw new ApiError(400, `Cannot delete: this folder still has ${subfolderCount} subfolder(s). Delete those first.`);

  await folder.deleteOne();
  sendResponse(res, 200, {}, 'Folder deleted successfully');
});

// ---------- Media ----------

// @desc    Bulk (or single) upload — accepts multiple files in one call
// @route   POST /api/v1/admin/media/upload
// @access  Private/Admin
const uploadMedia = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) throw new ApiError(400, 'At least one file is required');

  const folder = req.body.folderId || null;
  if (folder) {
    const exists = await MediaFolder.exists({ _id: folder });
    if (!exists) throw new ApiError(404, 'Target folder not found');
  }

  const uploaded = await Promise.all(
    req.files.map(async (file) => {
      const resourceType = resourceTypeFor(file.mimetype);
      const result = await uploadToCloudinary(file.buffer, 'ecommerce/media', { resourceType });
      return Media.create({
        url: result.url,
        publicId: result.publicId,
        folder,
        type: typeFor(file.mimetype),
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: result.bytes || file.size,
        width: result.width || null,
        height: result.height || null,
        format: result.format || '',
        uploadedBy: req.user._id,
      });
    })
  );

  sendResponse(res, 201, { media: uploaded, count: uploaded.length }, `${uploaded.length} file(s) uploaded successfully`);
});

// @desc    List/search media — by folder, type, tag, or filename, paginated
// @route   GET /api/v1/admin/media?folderId=&type=&keyword=&page=&limit=
// @access  Private/Admin
const getMedia = asyncHandler(async (req, res) => {
  const { folderId, type, keyword, page = 1, limit = 24 } = req.query;
  const filter = {};
  if (folderId !== undefined) filter.folder = folderId || null;
  if (type) filter.type = type;
  if (keyword) filter.$or = [{ originalName: { $regex: keyword, $options: 'i' } }, { tags: { $regex: keyword, $options: 'i' } }];

  const skip = (Number(page) - 1) * Number(limit);
  const [media, total] = await Promise.all([
    Media.find(filter).sort('-createdAt').skip(skip).limit(Number(limit)),
    Media.countDocuments(filter),
  ]);

  sendResponse(res, 200, { media, total, page: Number(page), totalPages: Math.ceil(total / limit) }, 'Media fetched successfully');
});

// @desc    Update tags / move to a different folder
// @route   PUT /api/v1/admin/media/:id
// @access  Private/Admin
const updateMedia = asyncHandler(async (req, res) => {
  const media = await Media.findById(req.params.id);
  if (!media) throw new ApiError(404, 'Media not found');

  if (req.body.tags !== undefined) media.tags = Array.isArray(req.body.tags) ? req.body.tags : String(req.body.tags).split(',').map((t) => t.trim());
  if (req.body.folderId !== undefined) media.folder = req.body.folderId || null;

  await media.save();
  sendResponse(res, 200, { media }, 'Media updated successfully');
});

// @desc    Replace the underlying file while KEEPING the same Media document
//          id — so anything already referencing this media (a Page's
//          featuredImage, a Product image, etc. by publicId/url) can be
//          re-pointed by the admin without hunting down every reference.
// @route   PUT /api/v1/admin/media/:id/replace
// @access  Private/Admin
const replaceMedia = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'A replacement file is required');

  const media = await Media.findById(req.params.id);
  if (!media) throw new ApiError(404, 'Media not found');

  await deleteFromCloudinary(media.publicId, media.type === 'image' ? 'image' : media.type);

  const resourceType = resourceTypeFor(req.file.mimetype);
  const result = await uploadToCloudinary(req.file.buffer, 'ecommerce/media', { resourceType });

  media.url = result.url;
  media.publicId = result.publicId;
  media.type = typeFor(req.file.mimetype);
  media.originalName = req.file.originalname;
  media.mimeType = req.file.mimetype;
  media.size = result.bytes || req.file.size;
  media.width = result.width || null;
  media.height = result.height || null;
  media.format = result.format || '';

  await media.save();
  sendResponse(res, 200, { media }, 'Media replaced successfully — same reference, new file');
});

// @desc    Delete a media asset
// @route   DELETE /api/v1/admin/media/:id
// @access  Private/Admin
const deleteMedia = asyncHandler(async (req, res) => {
  const media = await Media.findById(req.params.id);
  if (!media) throw new ApiError(404, 'Media not found');

  await deleteFromCloudinary(media.publicId, media.type === 'image' ? 'image' : media.type);
  await media.deleteOne();

  sendResponse(res, 200, {}, 'Media deleted successfully');
});

module.exports = {
  createFolder,
  getFolders,
  updateFolder,
  deleteFolder,
  uploadMedia,
  getMedia,
  updateMedia,
  replaceMedia,
  deleteMedia,
};
