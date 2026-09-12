"use client";

import NextImage, { type ImageProps } from "next/image";
import { useState } from "react";

// Assets are already compressed WebP, or uploaded to our own media endpoint.
// Serve them directly: this deployment has no Cloudflare Images binding.
export default function ShopImage({ src, onError, ...props }: ImageProps) {
  const [failedSource, setFailedSource] = useState<ImageProps["src"]>();
  return <NextImage {...props} src={failedSource === src ? "/product-placeholder.svg" : src}
    unoptimized onError={event => { setFailedSource(src); onError?.(event); }} />;
}
