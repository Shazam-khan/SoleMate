import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import sharp from "sharp";

/**
 * Image processor. Triggered by S3 ObjectCreated under uploads/. Generates a
 * 400px-wide thumbnail and writes it to thumbnails/ in the same bucket.
 */
const s3 = new S3Client({});

const streamToBuffer = async (stream) => {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
};

export const handler = async (event) => {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

    // Skip anything that isn't an upload (avoid reprocessing thumbnails).
    if (!key.startsWith("uploads/")) continue;

    const original = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: key })
    );
    const buffer = await streamToBuffer(original.Body);

    const thumbnail = await sharp(buffer)
      .resize({ width: 400, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    const thumbKey = key.replace(/^uploads\//, "thumbnails/").replace(/\.\w+$/, ".webp");
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: thumbKey,
        Body: thumbnail,
        ContentType: "image/webp",
      })
    );
    console.log(`Generated thumbnail ${thumbKey}`);
  }

  return { ok: true };
};
