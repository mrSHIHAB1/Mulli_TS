import multer from "multer";
import path from "path";
import { v2 as cloudinary } from "cloudinary";
import { envVars } from "../config/env";

// Multer disk storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(process.cwd(), "/uploads"));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix);
  },
});

const upload = multer({ storage });

// Added memory storage for in-memory file uploads
const memoryStorage = multer.memoryStorage();
const memoryUpload = multer({ storage: memoryStorage });

// Cloudinary config function
const cloudinaryConfig = () => {
  cloudinary.config({
    cloud_name: envVars.cloudinary.cloud_name,
    api_key: envVars.cloudinary.api_key,
    api_secret: envVars.cloudinary.api_secret,
  });
};

// Upload file to Cloudinary
const uploadToCloudinary = async (file: Express.Multer.File) => {
  cloudinaryConfig();
  try {
    const uploadResult = await cloudinary.uploader.upload(file.path, {
      public_id: file.filename,
      folder: "trucks", // optional folder in Cloudinary
    });
    return uploadResult;
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw error;
  }
};

// Delete file from Cloudinary by public_id
const deleteFromCloudinary = async (publicId: string) => {
  cloudinaryConfig();
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result; // returns { result: "ok" } if deleted successfully
  } catch (error) {
    console.error("Cloudinary delete error:", error);
    throw error;
  }
};

// Upload multiple files to Cloudinary
const uploadMultipleToCloudinary = async (files: Express.Multer.File[]) => {
  cloudinaryConfig();
  try {
    const uploadPromises = files.map((file) =>
      cloudinary.uploader.upload(file.path, {
        public_id: file.filename,
        folder: "trucks", // optional folder in Cloudinary
      })
    );
    const uploadResults = await Promise.all(uploadPromises);
    return uploadResults.map((result) => result.secure_url);
  } catch (error) {
    console.error("Cloudinary multiple upload error:", error);
    throw error;
  }
};

export const fileUploader = {
  upload,
  memoryUpload, // Added memory upload for in-memory file handling
  uploadToCloudinary,
  deleteFromCloudinary,
  uploadMultipleToCloudinary,
};
