import { NextResponse } from 'next/server';

export async function GET() {
  const robots = `User-agent: *
Allow: /

# Disallow admin and API routes
Disallow: /api/
Disallow: /admin/

# Sitemap location
Sitemap: ${process.env.NEXT_PUBLIC_APP_URL || 'https://mysetlist.app'}/sitemap.xml

# MySetlist - Concert Setlist Voting Platform
# Contact: support@mysetlist.app`;

  return new NextResponse(robots, {
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400'
    }
  });
} 