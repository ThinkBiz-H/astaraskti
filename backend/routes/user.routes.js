const express = require("express");
const router = express.Router();

const {
  getProfile,
  updateProfile,
  uploadProfileImage,
  deleteAccount,
  addAddress,
  updateAddress,
  deleteAddress,
  getAddresses,
} = require("../controllers/user.controller");

const { protect } = require("../middlewares/auth.middleware");
const upload = require("../middlewares/upload.middleware");

router.use(protect);
router.get("/profile", getProfile);
router.put("/profile", updateProfile);
router.post("/profile/image", upload.single("image"), uploadProfileImage);
router.delete("/account", deleteAccount);

router.route("/address").get(getAddresses).post(addAddress);
router.route("/address/:addressId").put(updateAddress).delete(deleteAddress);

module.exports = router;
