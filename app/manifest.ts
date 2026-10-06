import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Who's Home",
    short_name: "Who's Home",
    description: 'Household home/away status at a glance.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f6f5f1',
    theme_color: '#f6f5f1',
  };
}
