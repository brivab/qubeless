declare module '@aws-sdk/s3-request-presigner' {
  export function getSignedUrl(client: any, command: any, options?: { expiresIn?: number }): Promise<string>;
}
