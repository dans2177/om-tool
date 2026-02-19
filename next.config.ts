import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['sharp', 'pdf-parse', 'pdfjs-dist', '@napi-rs/canvas'],
  outputFileTracingIncludes: {
    '/api/phase1/extract': ['./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'],
    '/api/phase1/finalize': ['./public/logo.png', './public/rep-photo.png'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
    ],
  },
  turbopack: {},
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Prevent bundler from trying to resolve @napi-rs/canvas (native addon
      // that is not available in Vercel serverless).  Our instrumentation.ts
      // polyfills the globals that pdfjs-dist would normally get from it.
      config.externals = config.externals || [];
      config.externals.push({ '@napi-rs/canvas': 'commonjs @napi-rs/canvas' });
    }
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        canvas: false,
      };
    }
    config.module.rules.push({
      test: /\.mjs$/,
      type: 'javascript/auto',
    });
    return config;
  },
};

export default nextConfig;
