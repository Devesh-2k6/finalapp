import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Platform,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { X, User, PlusCircle, CheckCircle, Shield } from "lucide-react-native";
import { googleAuth, GoogleAuthResponse } from "../services/auth";
import { Colors, Radius, Spacing, Typography } from "../theme";

export const GoogleLogoSvg = ({ size = 20 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <Path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <Path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <Path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </Svg>
);

interface GoogleSignInButtonProps {
  mode?: "signin" | "signup";
  role?: "customer" | "vendor";
  onSuccess: (response: GoogleAuthResponse) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  mode = "signin",
  role = "customer",
  onSuccess,
  onError,
  disabled = false,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [customEmail, setCustomEmail] = useState("");
  const [customName, setCustomName] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const presetAccounts = [
    {
      name: "Alex Turner",
      email: "alex.turner@gmail.com",
      avatarColor: "#4285F4",
      initial: "A",
    },
    {
      name: "Priya Patel",
      email: "priya.patel@gmail.com",
      avatarColor: "#34A853",
      initial: "P",
    },
    {
      name: "Sam Green",
      email: "sam.green@gmail.com",
      avatarColor: "#EA4335",
      initial: "S",
    },
  ];

  const handleAuthenticate = async (accountEmail: string, accountName: string) => {
    if (!accountEmail || !accountEmail.includes("@")) {
      setErrorMsg("Please enter a valid Google email address.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      // Generate standard Google mock ID token containing encoded header, payload and signature
      const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
      const payload = btoa(
        JSON.stringify({
          iss: "https://accounts.google.com",
          sub: "google_mobile_" + accountEmail.replace(/[^a-zA-Z0-9]/g, "_"),
          email: accountEmail,
          email_verified: true,
          name: accountName || accountEmail.split("@")[0],
          picture: "https://lh3.googleusercontent.com/a/default-user",
        })
      );
      const signature = "demo_signature";
      const idToken = `demo_google_${header}.${payload}.${signature}`;

      const res = await googleAuth({
        id_token: idToken,
        email: accountEmail,
        name: accountName,
        role: role === "vendor" ? "VENDOR" : "CUSTOMER",
      });

      setModalVisible(false);
      onSuccess(res);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "Google authentication failed";
      setErrorMsg(msg);
      if (onError) onError(msg);
    } finally {
      setLoading(false);
    }
  };

  const buttonLabel = mode === "signup" ? "Sign up with Google" : "Continue with Google";

  return (
    <>
      <TouchableOpacity
        style={[styles.googleButton, disabled && styles.buttonDisabled]}
        onPress={() => {
          setErrorMsg(null);
          setModalVisible(true);
        }}
        disabled={disabled || loading}
        activeOpacity={0.85}
      >
        <View style={styles.iconContainer}>
          <GoogleLogoSvg size={20} />
        </View>
        <Text style={styles.buttonText}>{buttonLabel}</Text>
      </TouchableOpacity>

      {/* Google Account Chooser Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          if (!loading) setModalVisible(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <GoogleLogoSvg size={22} />
                <Text style={styles.modalTitle}>Sign in with Google</Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                disabled={loading}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Choose an account to continue to{" "}
              <Text style={{ fontWeight: "700", color: Colors.textPrimary }}>ExpiryGo</Text>
            </Text>

            {errorMsg && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4285F4" />
                <Text style={styles.loadingText}>Verifying Google credentials...</Text>
              </View>
            ) : (
              <ScrollView style={styles.accountsList} bounces={false}>
                {presetAccounts.map((account) => (
                  <TouchableOpacity
                    key={account.email}
                    style={styles.accountRow}
                    onPress={() => handleAuthenticate(account.email, account.name)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.avatar, { backgroundColor: account.avatarColor }]}>
                      <Text style={styles.avatarInitial}>{account.initial}</Text>
                    </View>
                    <View style={styles.accountDetails}>
                      <Text style={styles.accountName}>{account.name}</Text>
                      <Text style={styles.accountEmail}>{account.email}</Text>
                    </View>
                  </TouchableOpacity>
                ))}

                {/* Custom Google Account Input */}
                <View style={styles.customSection}>
                  <Text style={styles.customSectionTitle}>Use another Google account</Text>
                  <TextInput
                    style={styles.customInput}
                    placeholder="name@gmail.com"
                    placeholderTextColor={Colors.textMuted}
                    value={customEmail}
                    onChangeText={setCustomEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <TextInput
                    style={[styles.customInput, { marginTop: 8 }]}
                    placeholder="Full Name (optional)"
                    placeholderTextColor={Colors.textMuted}
                    value={customName}
                    onChangeText={setCustomName}
                  />
                  <TouchableOpacity
                    style={[
                      styles.customSubmitBtn,
                      (!customEmail.trim() || !customEmail.includes("@")) && styles.buttonDisabled,
                    ]}
                    disabled={!customEmail.trim() || !customEmail.includes("@")}
                    onPress={() => handleAuthenticate(customEmail.trim(), customName.trim())}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.customSubmitBtnText}>Continue with this account</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}

            {/* Footer Trust Note */}
            <View style={styles.modalFooter}>
              <Shield size={14} color={Colors.textMuted} />
              <Text style={styles.footerText}>
                To continue, Google will share your name, email address, and profile picture with ExpiryGo.
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DADCE0",
    borderRadius: Radius.lg,
    paddingVertical: 13,
    paddingHorizontal: 16,
    marginVertical: 6,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  iconContainer: {
    marginRight: 12,
  },
  buttonText: {
    color: "#3C4043",
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.md,
  },
  modalCard: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#FFFFFF",
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  modalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#202124",
    marginLeft: 6,
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#5F6368",
    marginBottom: Spacing.md,
  },
  accountsList: {
    maxHeight: 340,
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E8EAED",
    borderRadius: Radius.md,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarInitial: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  accountDetails: {
    flex: 1,
  },
  accountName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#202124",
  },
  accountEmail: {
    fontSize: 12,
    color: "#5F6368",
  },
  customSection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "#E8EAED",
  },
  customSectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#5F6368",
    textTransform: "uppercase",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  customInput: {
    backgroundColor: "#F8F9FA",
    borderWidth: 1,
    borderColor: "#DADCE0",
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#202124",
  },
  customSubmitBtn: {
    backgroundColor: "#1A73E8",
    borderRadius: Radius.md,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 10,
  },
  customSubmitBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  modalFooter: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E8EAED",
    gap: 8,
  },
  footerText: {
    flex: 1,
    fontSize: 11,
    color: "#5F6368",
    lineHeight: 14,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 14,
    fontSize: 14,
    color: "#5F6368",
    fontWeight: "500",
  },
  errorBox: {
    backgroundColor: "#FCE8E6",
    borderRadius: Radius.md,
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    color: "#C5221F",
    fontSize: 13,
  },
});
