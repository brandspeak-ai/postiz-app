import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import 'multer';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import mime from 'mime-types';
// @ts-ignore
import { getExtension } from 'mime';
import { IUploadProvider } from './upload.interface';

/**
 * AWS S3 Storage Provider
 *
 * Stores uploaded files in an S3 bucket and returns CDN URLs.
 * Used for profile pictures, media uploads, etc.
 */
class S3Storage implements IUploadProvider {
  private _client: S3Client;

  constructor(
    private _region: string,
    private _bucketName: string,
    private _cdnUrl: string,
    private _prefix: string = '',
    accessKey?: string,
    secretKey?: string
  ) {
    const config: any = {
      region: _region,
    };

    // Use explicit credentials if provided, otherwise fall back to IAM role/env
    if (accessKey && secretKey) {
      config.credentials = {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      };
    }

    this._client = new S3Client(config);
  }

  private _getKey(filename: string): string {
    return this._prefix ? `${this._prefix}/${filename}` : filename;
  }

  async uploadSimple(path: string): Promise<string> {
    const loadImage = await fetch(path);
    const contentType =
      loadImage?.headers?.get('content-type') ||
      loadImage?.headers?.get('Content-Type');
    const extension = getExtension(contentType)!;
    const id = makeId(10);
    const key = this._getKey(`${id}.${extension}`);

    const params = {
      Bucket: this._bucketName,
      Key: key,
      Body: Buffer.from(await loadImage.arrayBuffer()),
      ContentType: contentType,
    };

    const command = new PutObjectCommand(params);
    await this._client.send(command);

    return `${this._cdnUrl}/${key}`;
  }

  async uploadFile(file: Express.Multer.File): Promise<any> {
    try {
      const id = makeId(10);
      const extension = mime.extension(file.mimetype) || '';
      const key = this._getKey(`${id}.${extension}`);

      const command = new PutObjectCommand({
        Bucket: this._bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      await this._client.send(command);

      const publicUrl = `${this._cdnUrl}/${key}`;

      return {
        filename: `${id}.${extension}`,
        mimetype: file.mimetype,
        size: file.size,
        buffer: file.buffer,
        originalname: `${id}.${extension}`,
        fieldname: 'file',
        path: publicUrl,
        destination: publicUrl,
        encoding: '7bit',
        stream: file.buffer as any,
      };
    } catch (err) {
      console.error('Error uploading file to S3:', err);
      throw err;
    }
  }

  async removeFile(filePath: string): Promise<void> {
    try {
      // Extract the key from the full URL
      const url = new URL(filePath);
      const key = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;

      const command = new DeleteObjectCommand({
        Bucket: this._bucketName,
        Key: key,
      });
      await this._client.send(command);
    } catch (err) {
      console.error('Error removing file from S3:', err);
      // Don't throw - file might already be deleted
    }
  }
}

export { S3Storage };
export default S3Storage;
