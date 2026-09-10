import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { env } from "@/env";

export type S3Config = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  uploadPrefix: string;
  backupPrefix: string;
};

let cachedClient: S3Client | null = null;

export function getS3ConfigFromEnv(): S3Config | null {
  if (
    !env.S3_BUCKET ||
    !env.S3_ACCESS_KEY_ID ||
    !env.S3_SECRET_ACCESS_KEY ||
    !env.S3_ENDPOINT
  ) {
    return null;
  }

  return {
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    bucket: env.S3_BUCKET,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    uploadPrefix: env.S3_UPLOAD_PREFIX,
    backupPrefix: env.S3_BACKUP_PREFIX,
  };
}

export function isS3Configured(): boolean {
  return getS3ConfigFromEnv() !== null;
}

export function getS3Client(): S3Client {
  const config = getS3ConfigFromEnv();
  if (!config) {
    throw new Error("S3/R2 is not configured");
  }

  if (!cachedClient) {
    cachedClient = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true,
    });
  }

  return cachedClient;
}

export function maskBucketName(bucket: string): string {
  if (bucket.length <= 4) return "****";
  return `${bucket.slice(0, 2)}***${bucket.slice(-2)}`;
}

export async function uploadLocalFileToS3(
  localPath: string,
  objectKey: string,
  contentType = "application/octet-stream"
): Promise<number> {
  const client = getS3Client();
  const config = getS3ConfigFromEnv()!;
  const fileStat = await stat(localPath);
  const body = createReadStream(localPath);

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
      Body: body,
      ContentType: contentType,
    })
  );

  return fileStat.size;
}

export async function uploadBufferToS3(
  buffer: Buffer,
  objectKey: string,
  contentType: string
): Promise<void> {
  const client = getS3Client();
  const config = getS3ConfigFromEnv()!;

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
      Body: buffer,
      ContentType: contentType,
    })
  );
}

export async function getS3ObjectStream(
  objectKey: string
): Promise<{ stream: Readable; contentType: string | undefined }> {
  const client = getS3Client();
  const config = getS3ConfigFromEnv()!;
  const response = await client.send(
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
    })
  );

  if (!response.Body) {
    throw new Error("Empty S3 object body");
  }

  return {
    stream: response.Body as Readable,
    contentType: response.ContentType,
  };
}

export async function deleteS3Object(objectKey: string): Promise<void> {
  const client = getS3Client();
  const config = getS3ConfigFromEnv()!;

  await client.send(
    new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
    })
  );
}

export async function s3ObjectExists(objectKey: string): Promise<boolean> {
  const client = getS3Client();
  const config = getS3ConfigFromEnv()!;

  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: config.bucket,
        Key: objectKey,
      })
    );
    return true;
  } catch {
    return false;
  }
}
