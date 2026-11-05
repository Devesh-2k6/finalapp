import React, { useState, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { UniversalScannerModal, type UniversalScannerMode } from "../components/UniversalScannerModal";

export const ScannerScreen: React.FC<{ navigation: any; route?: any }> = ({
  navigation,
  route,
}) => {
  const isFocused = useIsFocused();
  const initialMode: UniversalScannerMode = route?.params?.mode || "barcode";
  const [modalVisible, setModalVisible] = useState(true);

  useEffect(() => {
    if (isFocused) {
      setModalVisible(true);
    }
  }, [isFocused]);

  const handleClose = () => {
    setModalVisible(false);
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate("DealsTab", { screen: "DealsFeed" });
    }
  };

  const handleNavigateToDeals = (query: string) => {
    navigation.navigate("DealsTab", {
      screen: "DealsFeed",
      params: { query },
    });
  };

  return (
    <View style={styles.container}>
      <UniversalScannerModal
        visible={modalVisible && isFocused}
        onClose={handleClose}
        initialMode={initialMode}
        onBarcodeDetected={(data) => {
          if (route?.params?.onBarcodeScanned) {
            route.params.onBarcodeScanned(data);
          }
        }}
        onDatesDetected={(dates) => {
          if (route?.params?.onDatesDetected) {
            route.params.onDatesDetected(dates);
          }
        }}
        onQrScanned={(data) => {
          if (route?.params?.onQrScanned) {
            route.params.onQrScanned(data);
          }
        }}
        onNavigateToDealsWithQuery={handleNavigateToDeals}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#070A10",
  },
});
