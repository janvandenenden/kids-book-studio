"use client";

import type { StoryPage } from "@/types";

interface PageSpreadProps {
  page: StoryPage;
  pageIndex: number;
  isRegenerating?: boolean;
}

export function PageSpread({ page, pageIndex, isRegenerating }: PageSpreadProps) {
  const renderLayout = () => {
    switch (page.layout) {
      case "left_text":
        return <LeftTextLayout page={page} isRegenerating={isRegenerating} />;
      case "right_text":
        return <RightTextLayout page={page} isRegenerating={isRegenerating} />;
      case "full_bleed":
        return <FullBleedLayout page={page} isRegenerating={isRegenerating} />;
      case "bottom_text":
      default:
        return <BottomTextLayout page={page} isRegenerating={isRegenerating} />;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden max-w-2xl mx-auto">
      <div className="p-6 md:p-8">
        {renderLayout()}

        {/* Page number */}
        <div className="text-center mt-4">
          <span className="text-sm text-muted-foreground">{pageIndex + 1}</span>
        </div>
      </div>
    </div>
  );
}

// Bottom text layout - illustration on top, text below
function BottomTextLayout({
  page,
  isRegenerating,
}: {
  page: StoryPage;
  isRegenerating?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-center mb-6">
        <ImageDisplay
          imageUrl={page.imageUrl}
          alt={`Illustration for page ${page.page}`}
          isRegenerating={isRegenerating}
          className="max-h-80 w-auto object-contain rounded-lg"
        />
      </div>
      <div>
        <p className="text-lg md:text-xl text-center leading-relaxed text-gray-800 font-serif">
          {page.text}
        </p>
      </div>
    </div>
  );
}

// Left text layout - text on left, illustration on right
function LeftTextLayout({
  page,
  isRegenerating,
}: {
  page: StoryPage;
  isRegenerating?: boolean;
}) {
  return (
    <div className="flex flex-col md:flex-row gap-6 items-center">
      <div className="md:w-2/5">
        <p className="text-lg leading-relaxed text-gray-800 font-serif">
          {page.text}
        </p>
      </div>
      <div className="md:w-3/5 flex items-center justify-center">
        <ImageDisplay
          imageUrl={page.imageUrl}
          alt={`Illustration for page ${page.page}`}
          isRegenerating={isRegenerating}
          className="max-h-72 w-auto object-contain rounded-lg"
        />
      </div>
    </div>
  );
}

// Right text layout - illustration on left, text on right
function RightTextLayout({
  page,
  isRegenerating,
}: {
  page: StoryPage;
  isRegenerating?: boolean;
}) {
  return (
    <div className="flex flex-col md:flex-row gap-6 items-center">
      <div className="md:w-3/5 flex items-center justify-center">
        <ImageDisplay
          imageUrl={page.imageUrl}
          alt={`Illustration for page ${page.page}`}
          isRegenerating={isRegenerating}
          className="max-h-72 w-auto object-contain rounded-lg"
        />
      </div>
      <div className="md:w-2/5">
        <p className="text-lg leading-relaxed text-gray-800 font-serif">
          {page.text}
        </p>
      </div>
    </div>
  );
}

// Full bleed layout - image fills, text overlaid at bottom
function FullBleedLayout({
  page,
  isRegenerating,
}: {
  page: StoryPage;
  isRegenerating?: boolean;
}) {
  return (
    <div className="relative">
      <ImageDisplay
        imageUrl={page.imageUrl}
        alt={`Illustration for page ${page.page}`}
        isRegenerating={isRegenerating}
        className="w-full h-80 object-cover rounded-lg"
      />
      <div className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm p-4 rounded-b-lg">
        <p className="text-lg text-center leading-relaxed text-gray-800 font-serif">
          {page.text}
        </p>
      </div>
    </div>
  );
}

// Reusable image display component
function ImageDisplay({
  imageUrl,
  alt,
  isRegenerating,
  className,
}: {
  imageUrl?: string;
  alt: string;
  isRegenerating?: boolean;
  className?: string;
}) {
  if (isRegenerating) {
    return (
      <div
        className={`bg-gradient-to-br from-blue-100 to-purple-100 rounded-lg flex items-center justify-center ${className || "w-full h-64"}`}
      >
        <div className="text-center">
          <div className="animate-spin text-3xl mb-2">🎨</div>
          <span className="text-sm text-gray-600">Regenerating...</span>
        </div>
      </div>
    );
  }

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={alt}
        className={className}
      />
    );
  }

  return (
    <div
      className={`bg-muted rounded-lg flex items-center justify-center ${className || "w-full h-64"}`}
    >
      <span className="text-muted-foreground">Image not available</span>
    </div>
  );
}
