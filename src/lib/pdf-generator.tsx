import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { Storyboard, StoryPage } from "@/types";

// Register fonts
Font.register({
  family: "Georgia",
  fonts: [
    {
      src: "https://fonts.gstatic.com/s/merriweather/v30/u-440qyriQwlOrhSvowK_l5-fCZM.woff2",
      fontWeight: "normal",
    },
    {
      src: "https://fonts.gstatic.com/s/merriweather/v30/u-4n0qyriQwlOrhSvowK_l52xwNpX837pvjx.woff2",
      fontWeight: "bold",
    },
  ],
});

const PAGE_SIZE: [number, number] = [612, 612]; // 8.5" x 8.5" square format
const MARGIN = 40;

const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#FFFEF7",
    padding: MARGIN,
    fontFamily: "Georgia",
  },
  coverPage: {
    flexDirection: "column",
    backgroundColor: "#E8F4F8",
    padding: MARGIN,
    fontFamily: "Georgia",
    justifyContent: "center",
    alignItems: "center",
  },
  coverTitle: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#2D3748",
    textAlign: "center",
    marginBottom: 20,
  },
  coverSubtitle: {
    fontSize: 16,
    color: "#4A5568",
    textAlign: "center",
  },
  // Layout containers
  bottomTextLayout: {
    flex: 1,
    flexDirection: "column",
  },
  leftTextLayout: {
    flex: 1,
    flexDirection: "row",
  },
  rightTextLayout: {
    flex: 1,
    flexDirection: "row",
  },
  fullBleedLayout: {
    flex: 1,
    position: "relative",
  },
  // Illustration styles
  illustrationFull: {
    width: "100%",
    height: 350,
    objectFit: "contain",
    marginBottom: 20,
    borderRadius: 8,
  },
  illustrationSide: {
    width: "55%",
    height: "100%",
    objectFit: "contain",
    borderRadius: 8,
  },
  illustrationFullBleed: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    borderRadius: 8,
  },
  // Text styles
  textContainer: {
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  textContainerSide: {
    width: "45%",
    justifyContent: "center",
    paddingHorizontal: 15,
  },
  textContainerOverlay: {
    position: "absolute",
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: "rgba(255, 255, 254, 0.9)",
    padding: 15,
    borderRadius: 8,
  },
  text: {
    fontSize: 16,
    lineHeight: 1.6,
    color: "#2D3748",
    textAlign: "center",
  },
  textLeft: {
    fontSize: 16,
    lineHeight: 1.6,
    color: "#2D3748",
    textAlign: "left",
  },
  pageNumber: {
    position: "absolute",
    bottom: 15,
    right: MARGIN,
    fontSize: 10,
    color: "#A0AEC0",
  },
  endPage: {
    flexDirection: "column",
    backgroundColor: "#E8F4F8",
    padding: MARGIN,
    fontFamily: "Georgia",
    justifyContent: "center",
    alignItems: "center",
  },
  endText: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#2D3748",
    textAlign: "center",
  },
  endSubtext: {
    fontSize: 14,
    color: "#4A5568",
    textAlign: "center",
    marginTop: 20,
  },
});

// Layout components
function BottomTextLayout({ page }: { page: StoryPage }) {
  return (
    <View style={styles.bottomTextLayout}>
      {page.imageUrl && (
        <Image src={page.imageUrl} style={styles.illustrationFull} />
      )}
      <View style={styles.textContainer}>
        <Text style={styles.text}>{page.text}</Text>
      </View>
    </View>
  );
}

function LeftTextLayout({ page }: { page: StoryPage }) {
  return (
    <View style={styles.leftTextLayout}>
      <View style={styles.textContainerSide}>
        <Text style={styles.textLeft}>{page.text}</Text>
      </View>
      {page.imageUrl && (
        <Image src={page.imageUrl} style={styles.illustrationSide} />
      )}
    </View>
  );
}

function RightTextLayout({ page }: { page: StoryPage }) {
  return (
    <View style={styles.rightTextLayout}>
      {page.imageUrl && (
        <Image src={page.imageUrl} style={styles.illustrationSide} />
      )}
      <View style={styles.textContainerSide}>
        <Text style={styles.textLeft}>{page.text}</Text>
      </View>
    </View>
  );
}

function FullBleedLayout({ page }: { page: StoryPage }) {
  return (
    <View style={styles.fullBleedLayout}>
      {page.imageUrl && (
        <Image src={page.imageUrl} style={styles.illustrationFullBleed} />
      )}
      <View style={styles.textContainerOverlay}>
        <Text style={styles.text}>{page.text}</Text>
      </View>
    </View>
  );
}

function renderPageLayout(page: StoryPage) {
  switch (page.layout) {
    case "left_text":
      return <LeftTextLayout page={page} />;
    case "right_text":
      return <RightTextLayout page={page} />;
    case "full_bleed":
      return <FullBleedLayout page={page} />;
    case "bottom_text":
    default:
      return <BottomTextLayout page={page} />;
  }
}

interface BookPDFProps {
  story: Storyboard;
}

export function BookPDF({ story }: BookPDFProps) {
  return (
    <Document>
      {/* Cover Page */}
      <Page size={PAGE_SIZE} style={styles.coverPage}>
        <Text style={styles.coverTitle}>{story.title}</Text>
        <Text style={styles.coverSubtitle}>A Personalized Adventure</Text>
      </Page>

      {/* Story Pages */}
      {story.pages.map((page, index) => (
        <Page key={page.page} size={PAGE_SIZE} style={styles.page}>
          {renderPageLayout(page)}
          <Text style={styles.pageNumber}>{index + 1}</Text>
        </Page>
      ))}

      {/* End Page */}
      <Page size={PAGE_SIZE} style={styles.endPage}>
        <Text style={styles.endText}>The End</Text>
        <Text style={styles.endSubtext}>
          Made with love by Kids Book Studio
        </Text>
      </Page>
    </Document>
  );
}

// Legacy support - convert old Story format to Storyboard
interface LegacyStory {
  title: string;
  pages: Array<{
    pageNumber: number;
    text: string;
    hasIllustration: boolean;
    imageUrl?: string;
  }>;
}

export function LegacyBookPDF({ story }: { story: LegacyStory }) {
  // Convert legacy format to new format
  const storyboard: Storyboard = {
    id: "legacy",
    title: story.title,
    pages: story.pages.map((p) => ({
      page: p.pageNumber,
      scene: "",
      emotion: "",
      action: "",
      setting: "",
      composition_hint: "wide" as const,
      text: p.text,
      layout: "bottom_text" as const,
      imageUrl: p.imageUrl,
    })),
  };

  return <BookPDF story={storyboard} />;
}

export { Document, Page, Text, View, Image, StyleSheet };
