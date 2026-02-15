// packages/server/scripts/generate-pit-assets.ts
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUTPUT_DIR = join(__dirname, "../../web/public/sprites");
const API_KEY = process.env.GOOGLE_API_KEY;

if (!API_KEY) {
  console.error("Set GOOGLE_API_KEY env var");
  process.exit(1);
}

interface GenerationTask {
  name: string;
  filename: string;
  prompt: string;
}

const TASKS: GenerationTask[] = [
  {
    name: "Pit Background",
    filename: "pit-bg.png",
    prompt: `Digital painting of a massive underground fighting arena lobby, dark atmospheric scene.
Grand stone colosseum interior with tiered seating rising into darkness on both sides.
Wide open floor area in the center, worn stone tiles.
Neon green magical torches and braziers provide eerie lighting along the walls.
Gothic architecture with massive pillars, arched doorways, and chains hanging from ceiling.
Dark fantasy style. Moody, atmospheric. Green accent lighting.
The space feels grand and spacious, like a famous underground venue.
No characters or fighters in the scene. Empty but alive with ambient light.
Style: detailed painterly digital art, dark color palette with neon green highlights.
Resolution: 1920x1080. Landscape orientation.`,
  },
  {
    name: "Pit Floor Texture",
    filename: "pit-floor.png",
    prompt: `Seamless tileable stone floor texture for a dark fantasy fighting arena.
Worn cobblestone with subtle cracks, old bloodstains, moss in gaps.
Dark gray and charcoal tones with subtle green-tinted lighting highlights.
Top-down view. Seamless repeating pattern.
Style: detailed painterly digital art matching a gothic underground colosseum.
Resolution: 512x512. Must tile seamlessly.`,
  },
  {
    name: "Pit Crowd Silhouettes",
    filename: "pit-crowd.png",
    prompt: `Silhouette of spectator crowd for a dark fantasy underground fighting arena.
Dark shadowy figures sitting in tiered stone seating, barely visible.
Hints of neon green light reflecting off some figures.
Semi-transparent feel, atmospheric background element.
Wide panoramic format. Very dark with subtle figure outlines.
Style: painterly digital art, dark atmospheric.
Resolution: 1920x200. Wide banner format.`,
  },
];

async function generateImage(task: GenerationTask): Promise<Buffer> {
  console.log(`Generating: ${task.name}...`);

  // Use gemini-2.0-flash-exp-image-generation (dedicated image gen model)
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Generate an image: ${task.prompt}`,
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["IMAGE", "TEXT"],
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${err}`);
  }

  const data = await response.json();

  // Extract image from response
  for (const candidate of data.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      if (part.inlineData?.mimeType?.startsWith("image/")) {
        return Buffer.from(part.inlineData.data, "base64");
      }
    }
  }

  throw new Error("No image in Gemini response");
}

async function generateImageImagen(task: GenerationTask): Promise<Buffer> {
  console.log(`  Retrying with Imagen 4.0...`);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt: task.prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: task.filename.includes("crowd") ? "16:3" : task.filename.includes("floor") ? "1:1" : "16:9",
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Imagen API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const b64 = data.predictions?.[0]?.bytesBase64Encoded;
  if (!b64) throw new Error("No image in Imagen response");
  return Buffer.from(b64, "base64");
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const task of TASKS) {
    try {
      let imageBuffer: Buffer;
      try {
        imageBuffer = await generateImage(task);
      } catch (err) {
        console.log(`  Flash failed: ${err}`);
        imageBuffer = await generateImageImagen(task);
      }
      const outPath = join(OUTPUT_DIR, task.filename);
      writeFileSync(outPath, imageBuffer);
      console.log(`  Saved: ${outPath} (${(imageBuffer.length / 1024).toFixed(0)}KB)`);
    } catch (err) {
      console.error(`  FAILED: ${task.name}:`, err);
    }
  }

  console.log("\nDone! Assets saved to:", OUTPUT_DIR);
}

main();
