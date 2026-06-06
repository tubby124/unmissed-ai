import type { NextConfig } from "next";

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ['twilio'],
  // Turbopack config: pin root to project dir to avoid workspace-root misdetection.
  // The _ssgManifest.js ENOENT error on clean builds is caused by Turbopack writing
  // to the wrong path when it misidentifies the workspace root (multiple lockfiles).
  turbopack: {
    root: __dirname,
  },
  async redirects() {
    return [
      // /admin/* consolidated into /dashboard/* (Mar 2026)
      { source: '/for-trades', destination: '/for-auto-glass', permanent: true },
      { source: '/demo', destination: '/try', permanent: true },
      { source: '/for-realtors', destination: '/', permanent: false },
      { source: '/for-hvac', destination: '/', permanent: false },
      { source: '/for-plumbing', destination: '/', permanent: false },
      { source: '/for-dental', destination: '/', permanent: false },
      { source: '/for-legal', destination: '/', permanent: false },
      { source: '/for-electricians', destination: '/', permanent: false },
      { source: '/for-vet', destination: '/', permanent: false },
      { source: '/for-salon', destination: '/', permanent: false },
      { source: '/for-clinics', destination: '/', permanent: false },
      { source: '/admin/costs', destination: '/dashboard/costs', permanent: true },
      { source: '/admin/numbers', destination: '/dashboard/numbers', permanent: true },
      { source: '/admin/prompt', destination: '/dashboard/prompt', permanent: true },
      { source: '/admin/calls', destination: '/dashboard/calls', permanent: true },
      { source: '/admin/clients', destination: '/dashboard/clients', permanent: true },
      { source: '/admin/insights', destination: '/dashboard/insights', permanent: true },
      { source: '/admin/calendar', destination: '/dashboard/calendar', permanent: true },
      { source: '/admin/test-lab', destination: '/dashboard/lab', permanent: true },
    ]
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
