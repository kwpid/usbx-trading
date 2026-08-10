import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/admin/*', '/account', '/account/*', '/*?timestamp=*'],
    },
    sitemap: 'https://usbx.trade/sitemap.xml',
  };
}
