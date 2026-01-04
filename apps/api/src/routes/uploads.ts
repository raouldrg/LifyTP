import { FastifyInstance } from "fastify";
import path from "path";
import fs from "fs";
import { pipeline } from "stream/promises";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function uploadRoutes(app: FastifyInstance) {
  app.post("/upload", async (req, res) => {
    try {
      const data = await req.file();

      if (!data) {
        return res.status(400).send({ error: "No file uploaded" });
      }

      const ext = path.extname(data.filename) || ".bin";
      const filename = `${randomUUID()}${ext}`;
      const savePath = path.join(__dirname, "..", "..", "uploads", filename);

      await pipeline(data.file, fs.createWriteStream(savePath));

      const fileUrl = `/uploads/${filename}`;

      return res.send({
        url: fileUrl,
        filename: filename,
        mimetype: data.mimetype
      });
    } catch (err) {
      console.error("Upload error:", err);
      return res.status(500).send({ error: "Upload failed" });
    }
  });
}