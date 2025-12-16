import { Client } from "minio";

// 🔧 Tolère MINIO_ENDPOINT sous forme "host" ou "host:port"
const rawEndpoint = process.env.MINIO_ENDPOINT;
const defaultPort = Number(process.env.MINIO_PORT || 9000);

if (!rawEndpoint) {
  throw new Error(
    'ENV manquante: MINIO_ENDPOINT. Exemple: "localhost" ou "localhost:9000".'
  );
}

let endPoint = rawEndpoint;
let port = defaultPort;

if (rawEndpoint.includes(":")) {
  const [host, p] = rawEndpoint.split(":");
  endPoint = host || "localhost";
  port = Number(p || defaultPort);
}

const useSSL = process.env.MINIO_USE_SSL === "true";
const accessKey = process.env.MINIO_ACCESS_KEY!;
const secretKey = process.env.MINIO_SECRET_KEY!;
export const BUCKET = process.env.MINIO_BUCKET || "media";

// Petit log pour debug (sans secrets)
console.log(
  `[minio] endpoint=${endPoint} port=${port} ssl=${useSSL} bucket=${BUCKET}`
);

export const minio = new Client({
  endPoint,
  port,
  useSSL,
  accessKey,
  secretKey,
});

export async function ensureBucket(bucket: string) {
  const exists = await minio.bucketExists(bucket).catch(() => false);
  if (!exists) {
    await minio.makeBucket(bucket, "");
    console.log(`[minio] bucket créé: ${bucket}`);
  }
}