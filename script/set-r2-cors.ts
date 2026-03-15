import { S3Client, PutBucketCorsCommand } from "@aws-sdk/client-s3";

const accountId = process.env.R2_ACCOUNT_ID!;
const bucket = process.env.R2_BUCKET_NAME!;

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

await r2.send(
  new PutBucketCorsCommand({
    Bucket: bucket,
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedOrigins: [
            "https://swingstudio.ai",
            "https://www.swingstudio.ai",
            "http://localhost:5000",
            "http://localhost:3000",
          ],
          AllowedMethods: ["GET", "HEAD"],
          AllowedHeaders: ["*"],
          MaxAgeSeconds: 3600,
        },
      ],
    },
  })
);

console.log("CORS policy applied to R2 bucket:", bucket);
