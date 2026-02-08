/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Static export so the Python server can serve the frontend directly
  output: "export",
  // Disable image optimization (not available in static export)
  images: { unoptimized: true },
};

module.exports = nextConfig;
