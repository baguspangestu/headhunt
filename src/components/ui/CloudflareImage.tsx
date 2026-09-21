import type { ImgHTMLAttributes } from 'react';

type CloudflareImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src: string;
};

export const CloudflareImage = ({
  src,
  alt,
  loading = 'lazy',
  decoding = 'async',
  ...props
}: CloudflareImageProps) => {
  const useCloudflareImageTransformations =
    process.env.NEXT_PUBLIC_CLOUDFLARE_IMAGE_TRANSFORMATIONS === 'true';
  const assetPath = `/assets/${src}.png`;
  const finalSrc = useCloudflareImageTransformations
    ? `/cdn-cgi/image/format=auto${assetPath}`
    : assetPath;

  return (
    // Asset images are optimized by Cloudflare at the edge, not Next.js.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...props}
      src={finalSrc}
      alt={alt}
      loading={loading}
      decoding={decoding}
    />
  );
};
