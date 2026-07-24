import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";

// Cliente S3 apuntando a MinIO (o cualquier almacenamiento compatible).
const client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? "us-east-1",
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? "",
    secretAccessKey: process.env.S3_SECRET_KEY ?? "",
  },
});

const BUCKET = process.env.S3_BUCKET ?? "clazz-uploads";

let bucketReady = false;
async function ensureBucket() {
  if (bucketReady) return;
  try {
    await client.send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: BUCKET })).catch(() => {});
  }
  bucketReady = true;
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  await ensureBucket();
  await client.send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }),
  );
}

export async function getObject(key: string) {
  await ensureBucket();
  const res = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  return {
    body: res.Body as ReadableStream,
    contentType: res.ContentType ?? "application/octet-stream",
    contentLength: res.ContentLength,
  };
}

export async function deleteObject(key: string) {
  await ensureBucket();
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key })).catch(() => {});
}
