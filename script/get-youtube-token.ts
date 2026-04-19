/**
 * One-time script to obtain a YouTube OAuth2 refresh token.
 *
 * Usage:
 *   YOUTUBE_CLIENT_ID=xxx YOUTUBE_CLIENT_SECRET=yyy npx tsx script/get-youtube-token.ts
 *
 * It will print an authorization URL. Open it in a browser, sign in as
 * the Swing Studio YouTube account, then paste the code back here.
 * The refresh token will be printed — save it as YOUTUBE_REFRESH_TOKEN in Railway.
 */

import { google } from "googleapis";
import * as readline from "readline";

const clientId = process.env.YOUTUBE_CLIENT_ID;
const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error("Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET env vars first.");
  process.exit(1);
}

const auth = new google.auth.OAuth2(clientId, clientSecret, "urn:ietf:wg:oauth:2.0:oob");

const url = auth.generateAuthUrl({
  access_type: "offline",
  scope: ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube"],
  prompt: "consent",
});

console.log("\nOpen this URL in your browser (sign in as the Swing Studio YouTube account):\n");
console.log(url);
console.log();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question("Paste the authorization code here: ", async (code) => {
  rl.close();
  const { tokens } = await auth.getToken(code.trim());
  console.log("\n✅ Refresh token (save as YOUTUBE_REFRESH_TOKEN in Railway):\n");
  console.log(tokens.refresh_token);
  console.log();
});
