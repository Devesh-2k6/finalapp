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
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { WebView } from "react-native-webview";
import { QrCode } from "lucide-react-native";
import { UniversalScannerModal, type ScannedBarcodeResult } from "../components/UniversalScannerModal";
import { broadcastScannerResult } from "../services/products";

const AnyWebView = WebView as any;
const WEB_BASE = "https://expirygo.vercel.app";
const WEB_URL = `${WEB_BASE}?app=true`;

// Constant source object defined OUTSIDE the component so its reference is 100% static.
// In react-native-webview, passing an inline { uri: ... } object on every render causes native
// Android WebView to compare props, detect difference with current URL, and forcibly reload the initial URL.
const INITIAL_SOURCE = { uri: WEB_URL };

const INJECTED_SCANNER_BRIDGE = `
  (function() {
    function notifyNav() {
      try {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'NAV_STATE_CHANGE',
            url: window.location.href,
            pathname: window.location.pathname,
            canGoBack: window.history.length > 1 && window.location.pathname !== '/'
          }));
        }
      } catch(e) {}
    }

    // Intercept Next.js SPA client-side history navigation
    var origPush = window.history.pushState;
    window.history.pushState = function() {
      var res = origPush.apply(this, arguments);
      setTimeout(notifyNav, 50);
      return res;
    };
    var origReplace = window.history.replaceState;
    window.history.replaceState = function() {
      var res = origReplace.apply(this, arguments);
      setTimeout(notifyNav, 50);
      return res;
    };
    window.addEventListener('popstate', function() {
      setTimeout(notifyNav, 50);
    });

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
  const canGoBackRef = useRef(false);
  const currentUrlRef = useRef(WEB_URL);
  const [scannerVisible, setScannerVisible] = useState(false);

  // Hardware Android back button
  useEffect(() => {
    if (Platform.OS === "android") {
      const onBackPress = () => {
        // 1. If scanner modal is visible, close it
        if (scannerVisible) {
          setScannerVisible(false);
          return true;
        }

        // 2. If webview can navigate back, do so in history
        if (webViewRef.current) {
          const url = currentUrlRef.current || "";
          const isRoot =
            !url ||
            url === WEB_URL ||
            url === WEB_BASE ||
            url.endsWith(".app/") ||
            url.endsWith(".app/?app=true") ||
            url.endsWith(".app");

          if (canGoBackRef.current || !isRoot) {
            webViewRef.current.goBack();
            return true;
          }
        }

        // 3. Otherwise on root, allow Android default behavior (exit/minimize app)
        return false;
      };

      const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () => sub.remove();
    }
  }, [scannerVisible]);

  // Handle messages from web page
  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "OPEN_CAMERA_SCANNER") {
        setScannerVisible(true);
      } else if (data.type === "NAV_STATE_CHANGE") {
        if (data.url) currentUrlRef.current = data.url;
        if (typeof data.canGoBack === "boolean") {
          canGoBackRef.current = data.canGoBack;
        }
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
      const curr = currentUrlRef.current || "";
      if (
        !curr.includes("/shop/products/add") &&
        !curr.includes("/scanner") &&
        !curr.includes("/reservations") &&
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
          source={INITIAL_SOURCE}
          style={styles.webview}
          injectedJavaScript={INJECTED_SCANNER_BRIDGE}
          onMessage={handleMessage}
          onNavigationStateChange={(nav: any) => {
            if (typeof nav?.canGoBack === "boolean") {
              canGoBackRef.current = nav.canGoBack;
            }
            if (nav?.url) {
              currentUrlRef.current = nav.url;
              // If user navigated to /scanner on the web app, trigger the real hardware camera
              if (nav.url.includes("/scanner") && !scannerVisible) {
                setScannerVisible(true);
              }
            }
          }}
          onShouldStartLoadWithRequest={(request: any) => {
            const url = request?.url || "";
            if (
              url.startsWith("tel:") ||
              url.startsWith("mailto:") ||
              url.startsWith("whatsapp:") ||
              url.startsWith("geo:") ||
              url.startsWith("intent:") ||
              url.startsWith("maps:")
            ) {
              Linking.openURL(url).catch(() => {});
              return false;
            }
            return true;
          }}
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

      {/* Floating Hardware Camera QR & Barcode Scanner Button - positioned right above bottom nav */}
      <TouchableOpacity
        style={styles.floatingScannerFab}
        onPress={() => setScannerVisible(true)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Open Camera QR Scanner"
      >
        <View style={styles.fabIconWrap}>
          <QrCode color="#ffffff" size={17} strokeWidth={2.5} />
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
    bottom: 88,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#7c3aed",
    paddingVertical: 9,
    paddingHorizontal: 15,
    borderRadius: 30,
    gap: 7,
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
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  floatingScannerText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 12,
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
