import React from 'react';
import {
  siGooglesheets,
  siGoogledrive,
  siGooglemaps,
  siGoogleappsscript,
  siGoogle,
  siLine,
  siShopee,
  siTiktok,
  siFacebook,
  siMake,
  siZapier,
  siDiscord,
  type SimpleIcon,
} from 'simple-icons';

export type BrandLogoName =
  | 'google-sheets'
  | 'google-drive'
  | 'google-maps'
  | 'google-apps-script'
  | 'google'
  | 'line'
  | 'shopee'
  | 'tiktok'
  | 'facebook'
  | 'make'
  | 'zapier'
  | 'discord';

const SIMPLE_ICON_MAP: Record<BrandLogoName, SimpleIcon> = {
  'google-sheets': siGooglesheets,
  'google-drive': siGoogledrive,
  'google-maps': siGooglemaps,
  'google-apps-script': siGoogleappsscript,
  google: siGoogle,
  line: siLine,
  shopee: siShopee,
  tiktok: siTiktok,
  facebook: siFacebook,
  make: siMake,
  zapier: siZapier,
  discord: siDiscord,
};

interface BrandLogoProps {
  brand: BrandLogoName;
  className?: string;
  useBrandColor?: boolean;
  title?: string;
}

/**
 * Renders official brand logos exclusively from Simple Icons (simple-icons).
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  brand,
  className = 'w-4 h-4',
  useBrandColor = false,
  title,
}) => {
  const icon = SIMPLE_ICON_MAP[brand];
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill={useBrandColor ? `#${icon.hex}` : 'currentColor'}
      aria-label={title || icon.title}
    >
      {title && <title>{title}</title>}
      <path d={icon.path} />
    </svg>
  );
};
