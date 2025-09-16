import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request }) => {
  // Get basic info about the environment
  const userAgent = request.headers.get('user-agent') || 'Unknown';
  const timestamp = new Date().toISOString();
  
  // Environment info (useful for Cloudflare Workers)
  const envInfo = {
    timestamp,
    userAgent,
    environment: env.NODE_ENV || 'development',
    platform: 'cloudflare-worker',
    arch: 'wasm',
    nodeVersion: 'cloudflare-worker',
    // Cloudflare Worker specific info
    cf: {
      rayId: request.headers.get('cf-ray') || 'unknown',
      country: request.headers.get('cf-ipcountry') || 'unknown',
      city: request.headers.get('cf-ipcity') || 'unknown',
      timezone: request.headers.get('cf-timezone') || 'unknown'
    }
  };

  return json(envInfo);
};
