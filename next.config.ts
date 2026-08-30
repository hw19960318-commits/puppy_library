import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // tesseract.js 含原生/wasm worker，避免被打包进服务端 bundle
  serverExternalPackages: ["tesseract.js", "tesseract.js-core", "sharp"],
};

export default nextConfig;
