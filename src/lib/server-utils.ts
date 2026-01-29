import "server-only";
import fs from "fs";
import path from "path";

/**
 * Download an image from a URL and save it locally
 * Returns the local path (e.g., /storyboard/panel-1.png)
 *
 * This is a server-only utility - it cannot be imported in client components.
 */
export async function downloadAndSaveImage(
  imageUrl: string,
  filename: string,
  subfolder: string = "storyboard"
): Promise<string> {
  // Skip if already a local path
  if (!imageUrl.startsWith("http")) {
    return imageUrl;
  }

  const publicDir = path.join(process.cwd(), "public", subfolder);

  // Ensure directory exists
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const filePath = path.join(publicDir, filename);
  const localPath = `/${subfolder}/${filename}`;

  try {
    console.log(`Downloading image: ${imageUrl.slice(0, 50)}...`);
    const response = await fetch(imageUrl);

    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    fs.writeFileSync(filePath, buffer);
    console.log(`Saved image to: ${localPath}`);

    return localPath;
  } catch (error) {
    console.error(`Failed to download and save image:`, error);
    // Return original URL as fallback (may still work if not expired)
    return imageUrl;
  }
}
