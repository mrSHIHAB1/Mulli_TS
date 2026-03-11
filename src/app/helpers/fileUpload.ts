import multer, { StorageEngine } from 'multer';
import path from 'path';
import fs from 'fs';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { envVars } from '../config/env';


cloudinary.config({
  cloud_name: envVars.cloudinary.cloud_name,
  api_key: envVars.cloudinary.api_key,
  api_secret: envVars.cloudinary.api_secret
});

// 2. Define Multer storage with Types
const storage: StorageEngine = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(process.cwd(), "/uploads"));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);

    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// 3. Cloudinary upload (Typed with Express.Multer.File)
const uploadToCloudinary = async (
  file: Express.Multer.File
): Promise<UploadApiResponse | null> => {
  const isVideo = file.mimetype.startsWith("video/");

  try {
    const uploadResult = await cloudinary.uploader.upload(file.path, {
      public_id: file.filename,
      resource_type: isVideo ? "video" : "image"
    });

    console.log('Cloudinary upload result:', uploadResult);
    return uploadResult;
  } catch (error) {
    console.error('Cloudinary error:', error);
    return null;
  } finally {
    // --- AUTO-CLEANUP ---
    // This runs whether the upload succeeded or failed
    if (file.path && fs.existsSync(file.path)) {
      fs.unlink(file.path, (err) => {
        if (err) console.error("Error deleting local file:", err);
        else console.log("Temp file deleted from /uploads");
      });
    }
  }
};

// 4. Cloudinary deletion (Strictly typed resource types)
const deleteFromCloudinary = async (
  publicId: string,
  resourceType: "image" | "video" | "raw" = "image"
): Promise<any | null> => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
    console.log("Deleted from Cloudinary:", result);
    return result;
  } catch (err) {
    console.error("Cloudinary deletion error:", err);
    return null;
  }
};
const uploadManyToCloudinary = async (
  files: Express.Multer.File[],
): Promise<{ url: string; type: 'image' | 'video' | 'audio' }[]> => {
  const results = await Promise.all(
    files.map(async (file) => {
      const uploaded = await uploadToCloudinary(file);

      // Determine friendly type for frontend
      let type: 'image' | 'video' | 'audio' = 'image';
      if (file.mimetype.startsWith('video/')) type = 'video';
      else if (file.mimetype.startsWith('audio/')) type = 'audio';

      return {
        url: uploaded?.secure_url || '',
        type,
      };
    }),
  );

  // Filter out any failed uploads
  return results.filter((r) => r.url !== '');
};
export const fileUploader = {
  upload,
  uploadToCloudinary,
  deleteFromCloudinary,
  uploadManyToCloudinary
};