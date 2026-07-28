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
    bucketReady = true;
    return;
  } catch (headErr) {
    // Bucket no existe o no accesible: intentar crearlo.
    // Si el create también falla, propagar el error (así el POST devuelve un
    // mensaje claro en vez de romper adentro con un 500 genérico).
    try {
      await client.send(new CreateBucketCommand({ Bucket: BUCKET }));
      bucketReady = true;
    } catch (createErr) {
      // Si el bucket YA existía y HeadBucket falló solo por permisos, seguimos.
      const code = (createErr as { name?: string })?.name ?? "";
      if (code === "BucketAlreadyOwnedByYou" || code === "BucketAlreadyExists") {
        bucketReady = true;
        return;
      }
      // eslint-disable-next-line no-console
      console.error("[s3] No se pudo asegurar el bucket:", code, createErr, "(head:", (headErr as { name?: string })?.name, ")");
      throw new Error(
        `Almacenamiento no disponible (bucket ${BUCKET}): ${code || (createErr as Error).message}`,
      );
    }
  }
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
