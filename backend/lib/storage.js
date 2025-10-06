const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const s3Config = {
  region: process.env.AWS_REGION,
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  } : undefined
};

const s3Client = (process.env.AWS_S3_BUCKET && s3Config.credentials) ? new S3Client(s3Config) : null;

async function saveFile({ bufferPath, originalName, userId }) {
  // originalName includes extension
  const ext = path.extname(originalName) || '.png';
  const filename = `avatar_${userId}_${Date.now()}${ext}`;

  if (s3Client && process.env.AWS_S3_BUCKET) {
    // upload to s3
    const fileStream = fs.createReadStream(bufferPath);
    const key = `avatars/${filename}`;
    const cmd = new PutObjectCommand({ Bucket: process.env.AWS_S3_BUCKET, Key: key, Body: fileStream, ContentType: 'image/*' });
    await s3Client.send(cmd);
    // return public url (assuming bucket is public or behind CDN)
    const url = `${process.env.AWS_S3_PUBLIC_URL || ''}/avatars/${filename}`;
    return { url, storage: 's3' };
  }

  // fallback to local disk
  const uploadDir = path.join(__dirname, '..', 'uploads', 'avatars');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  const destPath = path.join(uploadDir, filename);
  fs.renameSync(bufferPath, destPath);
  const publicUrl = `/uploads/avatars/${filename}`;
  return { url: publicUrl, storage: 'disk' };
}

module.exports = { saveFile };
