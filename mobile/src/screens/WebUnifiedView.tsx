import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  BackHandler,
  Platform,
  Vibration,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { WebView } from "react-native-webview";
import { QrCode, ScanLine } from "lucide-react-native";
import { UniversalScannerModal, type ScannedBarcodeResult } from "../components/UniversalScannerModal";
import { broadcastScannerResult } from "../services/products";

const AnyWebView = WebView as any;
const WEB_BASE = "https://expirygo.vercel.app";
const WEB_URL = `${WEB_BASE}?app=true`;

const INJECTED_SCANNER_BRIDGE = `
  (function() {
    // Intercept clicks on any scanner buttons or links
    document.addEventListener('click', function(e) {
      var el = e.target && e.target.closest('a[href*="/scanner"], [data-scan], button[class*="scan" i], button[aria-label*="scan" i], [title*="scan" i]');
      if (el) {
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'OPEN_CAMERA_SCANNER' }));
      }
    }, true);

    // Global helper for web app to request native camera
    window.openExpoGoScanner = function() {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'OPEN_CAMERA_SCANNER' }));
    };
  })();
  true;
`;

export const WebUnifiedView: React.FC = () => {
  const webViewRef = useRef<any>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(WEB_URL);

  // Hardware Android back button
  useEffect(() => {
    if (Platform.OS === "android") {
      const onBackPress = () => {
        if (scannerVisible) {
          setScannerVisible(false);
          return true;
        }
        if (canGoBack && webViewRef.current) {
          webViewRef.current.goBack();
          return true;
        }
        return false;
      };
      const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () => sub.remove();
    }
  }, [canGoBack, scannerVisible]);

  // Handle messages from web page
  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "OPEN_CAMERA_SCANNER") {
        setScannerVisible(true);
      }
    } catch {
      // not json
    }
  };

  const handleBarcodeScanned = (res: ScannedBarcodeResult) => {
    setScannerVisible(false);
    try {
      Vibration.vibrate(80);
    } catch {}

    const code = res.barcode || res.name || "";
    if (!code) return;

    // 1. Broadcast live to Vercel Companion Hub
    void broadcastScannerResult(res);

    if (webViewRef.current) {
      // 2. Inject live postMessage into current web page
      const payloadStr = JSON.stringify({
        type: "EXPIRYGO_SCANNER_EVENT",
        barcode: res.barcode,
        code: res.barcode,
        name: res.name,
        category: res.category,
        brand: res.brand,
        suggested_price: res.suggested_price,
        description: res.description,
      });

      const injectScript = `
        try {
          const detail = ${payloadStr};
          window.postMessage(detail, "*");
          window.dispatchEvent(new CustomEvent("EXPIRYGO_SCANNER_EVENT", { detail }));
        } catch(e) {}
        true;
      `;
      webViewRef.current.injectJavaScript(injectScript);

      // 3. If on default pages, navigate to search or deals
      if (
        !currentUrl.includes("/shop/products/add") &&
        !currentUrl.includes("/scanner") &&
        !currentUrl.includes("/reservations") &&
        !res.is_pickup_verification
      ) {
        const target = `${WEB_BASE}/deals?q=${encodeURIComponent(code)}&app=true`;
        webViewRef.current.injectJavaScript(`window.location.href = "${target}"; true;`);
      }
    }
  };

  const handleQrScanned = (qr: string) => {
    setScannerVisible(false);
    try {
      Vibration.vibrate(80);
    } catch {}

    void broadcastScannerResult({
      barcode: qr,
      name: qr.startsWith("http") ? "Web Link: " + qr : "QR Pass: " + qr,
      category: "OTHER",
    });

    if (webViewRef.current) {
      const payloadStr = JSON.stringify({
        type: "EXPIRYGO_SCANNER_EVENT",
        barcode: qr,
        code: qr,
        name: "QR Code: " + qr,
      });
      webViewRef.current.injectJavaScript(`
        try {
          const detail = ${payloadStr};
          window.postMessage(detail, "*");
          window.dispatchEvent(new CustomEvent("EXPIRYGO_SCANNER_EVENT", { detail }));
        } catch(e) {}
        true;
      `);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar style="dark" />

      {/* Main Full-Screen Web App (Hosted on Vercel) */}
      <View style={styles.webWrap}>
        <AnyWebView
          ref={webViewRef}
          source={{ uri: WEB_URL }}
          style={styles.webview}
          injectedJavaScript={INJECTED_SCANNER_BRIDGE}
          onMessage={handleMessage}
          onNavigationStateChange={(nav: any) => {
            setCanGoBack(Boolean(nav?.canGoBack));
            setCanGoForward(Boolean(nav?.canGoForward));
            if (nav?.url) {
              setCurrentUrl(nav.url);
              // If user navigated to /scanner on the web app, trigger the real hardware camera
              if (nav.url.includes("/scanner") && !scannerVisible) {
                setScannerVisible(true);
              }
            }
          }}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          scalesPageToFit={true}
          allowsBackForwardNavigationGestures={true}
          pullToRefreshEnabled={true}
          sharedCookiesEnabled={true}
          cacheEnabled={true}
          geolocationEnabled={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          renderLoading={() => (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#7c3aed" />
              <Text style={styles.loadingText}>Loading ExpiryGo...</Text>
            </View>
          )}
        />
      </View>

      {/* Floating Hardware Camera QR & Barcode Scanner Button */}
      <TouchableOpacity
        style={styles.floatingScannerFab}
        onPress={() => setScannerVisible(true)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Open Camera QR Scanner"
      >
        <View style={styles.fabIconWrap}>
          <QrCode color="#ffffff" size={18} strokeWidth={2.5} />
        </View>
        <Text style={styles.floatingScannerText}>QR Scanner</Text>
      </TouchableOpacity>

      {/* Hardware Camera / Barcode Modal */}
      <UniversalScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        initialMode="qr_pickup"
        onBarcodeDetected={handleBarcodeScanned}
        onQrScanned={handleQrScanned}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  webWrap: {
    flex: 1,
    backgroundColor: "#FAFAFE",
  },
  webview: {
    flex: 1,
    backgroundColor: "#FAFAFE",
  },
  floatingScannerFab: {
    position: "absolute",
    bottom: 24,
    right: 18,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#7c3aed",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 30,
    gap: 8,
    shadowColor: "#6d28d9",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 9,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.25)",
    zIndex: 9999,
  },
  fabIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  floatingScannerText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 13,
    letterSpacing: 0.2,
  },
  loadingOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    color: "#6D28D9",
    fontSize: 14,
    fontWeight: "700",
  },
});
