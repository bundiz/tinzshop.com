import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  experimental: {
    agentUpgrade: 'security',
    // The news editor posts two bodies and two excerpts of up to 200,000 characters each (4 bytes a character at most),
    // which is over the 1 MB default (D-252); a news image upload is up to 5 MB plus the form's overhead (D-278). The
    // limit is global: every Server Action, the public sign-in ones included, accepts a body this large.
    serverActions: { bodySizeLimit: '6mb' },
  },
};

export default withNextIntl(nextConfig);
