import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const BUCKET = process.env.AWS_S3_BUCKET_NAME!;

const globalForS3 = globalThis as unknown as { s3Client?: S3Client };

const s3 = globalForS3.s3Client ??= new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function uploadToS3(key: string, body: Buffer, contentType: string): Promise<void> {
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }));
}

export async function deleteFromS3(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

// The bucket is private — stored file references (RECRUIT_T_User.signatureUrl,
// RECRUIT_T_Document.fileUrl) hold the bare S3 object key (e.g.
// "Recruitment/signature/<userId>Signature.png",
// "Recruitment/MRF/<referenceNumber>/<file>"), not a browsable URL. A signed
// URL is generated fresh on every read (short expiry) rather than stored,
// since a saved signed URL would itself go stale.
//
// Files uploaded before this S3 migration have a local path already
// (starting with "/", e.g. "/uploads/signatures/...") — those still resolve
// via the old public/ static route, so pass them through unsigned rather
// than treating them as an S3 key. They keep working until re-uploaded.
export async function getSignedFileUrl(key: string | null | undefined, expiresInSeconds = 3600): Promise<string | null> {
  if (!key) return null;
  if (key.startsWith("/")) return key;
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: expiresInSeconds });
}
