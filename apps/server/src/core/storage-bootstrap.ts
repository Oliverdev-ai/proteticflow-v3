import { CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { env } from '../env.js';
import { logger } from '../logger.js';
import { s3 } from './storage.js';

const BUCKET = env.MINIO_BUCKET ?? 'proteticflow';

export async function ensureBucket(): Promise<void> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
    logger.info({ bucket: BUCKET }, 'Storage bucket exists');
  } catch {
    try {
      await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
      logger.info({ bucket: BUCKET }, 'Storage bucket created');
    } catch (createErr) {
      logger.error({ err: createErr, bucket: BUCKET }, 'Failed to create storage bucket');
    }
  }
}
