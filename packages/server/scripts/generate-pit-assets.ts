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
    prompt: `Pixel art background for a retro 2D fighting game. 16-bit SNES era graphics.
Scene: A grand underground colosseum pit where fighters gather. Gothic stone architecture.
Massive vaulted ceiling with chains hanging down. Tall stone pillars on both sides with arched doorways.
Bright neon green (#39ff14) glowing circuit-board patterns carved into the stone walls, like magical runes.
Green-glowing crystal chandeliers or braziers providing the main light source.
Dark navy blue and black color palette with vivid neon green as the only bright color.
Every element is constructed from visible square pixels. Blocky shapes. No smooth gradients.
The entire image looks like it belongs in a Super Nintendo or Game Boy Advance game.
No characters or people. Wide landscape panoramic format. The background should feel like a classic pixel art fighting game stage like Street Fighter II or King of Fighters.`,
  },
  {
    name: "Pit Floor Texture",
    filename: "pit-floor.png",
    prompt: `16-bit pixel art seamless tileable floor texture. Top-down view.
Dark hexagonal stone tiles with neon green glowing edges and cracks between tiles.
Some tiles slightly cracked or damaged. Occasional small green flame or ember between tiles.
Dark gray, charcoal and navy blue tones with bright neon green (#39ff14) highlights in the cracks.
Style: 16-bit pixel art, visible individual pixels, clean geometric shapes, retro game aesthetic.
Must be seamless and tileable. 512x512 pixels.`,
  },
  {
    name: "Pit Crowd",
    filename: "pit-crowd.png",
    prompt: `16-bit pixel art crowd of tiny spectators in tiered seating for a dark fantasy fighting arena.
Multiple rows of small pixel-art people sitting in stone bleachers. Each figure is only 8-12 pixels tall.
Variety of colors for their clothes — some have glowing items. Dark background behind them.
The crowd faces forward toward the viewer. Some figures have tiny glowing eyes or accessories.
Style: 16-bit pixel art like SNES/GBA games. Visible individual pixels. Dark palette with colorful tiny characters.
Wide panoramic banner format. Similar to retro fighting game audience sprites.`,
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
