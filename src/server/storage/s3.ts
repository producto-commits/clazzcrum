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
  // Desde @aws-sdk/client-s3 3.729 el SDK añade checksums (CRC32/CRC64NVME,
  // aws-chunked con trailers) a todas las escrituras. MinIO y otros
  // almacenamientos compatibles los rechazan con "InvalidRequest". Solo
  // calcular/validar checksums cuando la operación lo exige.
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

// Nombre + código HTTP de un error del SDK, para diagnósticos legibles.
function describeErr(err: unknown): string {
  const e = err as { name?: string; message?: string; $metadata?: { httpStatusCode?: number } };
  const status = e?.$metadata?.httpStatusCode;
  return `${e?.name ?? "Error"}${status ? ` (HTTP ${status})` : ""}${e?.message ? `: ${e.message}` : ""}`;
}

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
      console.error(
        `[s3] No se pudo asegurar el bucket "${BUCKET}" en ${process.env.S3_ENDPOINT ?? "(sin S3_ENDPOINT)"}` +
          ` — HeadBucket: ${describeErr(headErr)} — CreateBucket: ${describeErr(createErr)}`,
      );
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
