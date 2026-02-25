declare module '@aws-sdk/client-s3' {
  export interface S3ClientConfig {
    region?: string;
    endpoint?: string;
    credentials?: { accessKeyId: string; secretAccessKey: string };
    forcePathStyle?: boolean;
  }
  export class S3Client {
    constructor(config?: S3ClientConfig);
    send(command: any): Promise<any>;
  }
  export interface GetObjectCommandInput {
    Bucket: string;
    Key: string;
  }
  export interface GetObjectCommandOutput {
    Body?: any;
  }
  export class GetObjectCommand {
    constructor(input: GetObjectCommandInput);
  }

  export interface PutObjectCommandInput {
    Bucket: string;
    Key: string;
    Body: any;
    ContentType?: string;
  }
  export class PutObjectCommand {
    constructor(input: PutObjectCommandInput);
  }
  export class GetObjectCommand {
    constructor(input: GetObjectCommandInput);
  }
}
