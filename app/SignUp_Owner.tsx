// app/SignUp_Owner.tsx
import { FontAwesome, Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import {
  Alert, ImageBackground, Keyboard, KeyboardAvoidingView, Platform,
  Pressable, SafeAreaView, StyleSheet, Text, TextInput, TouchableWithoutFeedback, View,
} from "react-native";
import { registerOwner } from "./api";

type RootStackParamList = { SignUp_Owner: undefined; Login_Owner: undefined; };
type SubmitPayload = { username: string; password: string; email: string; nic: string; phone: string; };
type Props = {
  onBack?: () => void;
  onGoogle?: () => void;
  onSubmit?: (payload: SubmitPayload) => void;
  headerImageUri?: string;
};

const BRAND = "#2F80ED"; const BG = "#F5F7FB"; const TEXT = "#111827"; const SUB = "#6B7280";
const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1550355291-bbee04a92027?q=80&w=1600&auto=format&fit=crop";

export default function SignUp_Owner({
  onBack, onGoogle, onSubmit, headerImageUri = DEFAULT_IMAGE,
}: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail]       = useState("");
  const [nic, setNic]           = useState("");
  const [phone, setPhone]       = useState("");
  const [hide, setHide]         = useState(true);
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async () => {
    const payload: SubmitPayload = {
      username: username.trim(),
      password,
      email: email.trim(),
      nic: nic.trim().toUpperCase(),
      phone: phone.trim(),
    };
    if (onSubmit) { onSubmit(payload); return; }

    if (loading) return;
    setLoading(true);
    try {
      await registerOwner(payload);
      Alert.alert("Success", "Account created. Please log in.", [
        { text: "OK", onPress: () => navigation.navigate("Login_Owner") },
      ]);
    } catch (e: any) {
      Alert.alert("Sign up failed", e?.message ?? "Server error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.select({ ios: "padding", android: undefined })} style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.container}>
            <View style={styles.headerWrap}>
              <ImageBackground source={{ uri: headerImageUri }} resizeMode="cover" style={StyleSheet.absoluteFill} />
              <LinearGradient colors={["rgba(255,255,255,0)", BG]} style={StyleSheet.absoluteFill} start={{ x: 0.5, y: 0.2 }} end={{ x: 0.5, y: 1 }} />
              <View style={styles.headerTopBar}>
                <Pressable
                  onPress={() => (onBack ? onBack() : navigation.goBack())}
                  hitSlop={12}
                  style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
                  android_ripple={{ color: "#E5E7EB", radius: 20 }}
                  accessibilityRole="button" accessibilityLabel="Go back"
                >
                  <Ionicons name="chevron-back" size={22} color={TEXT} />
                </Pressable>
              </View>
              <View style={styles.titleBlock}><Text style={styles.title}>Register Here</Text></View>
            </View>

            <View style={styles.form}>
              <TextInput placeholder="User Name" placeholderTextColor="#9CA3AF" style={styles.input}
                value={username} onChangeText={setUsername} autoCapitalize="none" returnKeyType="next" />

              <View style={styles.passwordWrap}>
                <TextInput placeholder="Password" placeholderTextColor="#9CA3AF"
                  style={[styles.input, { paddingRight: 44, marginTop: 12 }]}
                  value={password} onChangeText={setPassword} secureTextEntry={hide} autoCapitalize="none" />
                <Pressable onPress={() => setHide(v => !v)} style={styles.eyeBtn} hitSlop={8}>
                  <Ionicons name={hide ? "eye-off-outline" : "eye-outline"} size={20} color="#6B7280" />
                </Pressable>
              </View>

              <TextInput placeholder="Email" placeholderTextColor="#9CA3AF" style={[styles.input, { marginTop: 12 }]}
                value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />

              <TextInput placeholder="NIC" placeholderTextColor="#9CA3AF" style={[styles.input, { marginTop: 12 }]}
                value={nic} onChangeText={t => setNic(t.toUpperCase())} autoCapitalize="characters" />

              <TextInput placeholder="Phone number" placeholderTextColor="#9CA3AF" style={[styles.input, { marginTop: 12 }]}
                value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

              <Pressable onPress={handleSubmit}
                style={({ pressed }) => [styles.signupBtn, pressed && { transform: [{ scale: 0.997 }] }]}
                android_ripple={{ color: "#1f6fd6" }}>
                <Text style={styles.signupText}>{loading ? "Creating..." : "Sign up"}</Text>
              </Pressable>

              <Text style={styles.or}>Or</Text>

              <Pressable onPress={onGoogle} style={({ pressed }) => [styles.googleBtn, pressed && { opacity: 0.95 }]}
                android_ripple={{ color: "#E5E7EB" }}>
                <View style={styles.googleLeft}><FontAwesome name="google" size={18} color="#DB4437" /></View>
                <Text style={styles.googleText}>Log In with Google</Text>
              </Pressable>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  container: { flex: 1, backgroundColor: BG },
  headerWrap: { height: 280, overflow: "hidden", backgroundColor: "#ddd" },
  headerTopBar: { height: 44, paddingHorizontal: 16, justifyContent: "center", marginTop: 4 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.6)" },
  titleBlock: { position: "absolute", left: 24, right: 24, bottom: 16 },
  title: { fontSize: 26, fontWeight: "800", color: TEXT },
  form: { paddingHorizontal: 20, paddingTop: 10 },
  input: {
    backgroundColor: "#FFFFFF", borderRadius: 22, paddingHorizontal: 16,
    paddingVertical: Platform.select({ ios: 14, android: 12 }) as number,
    fontSize: 15, color: TEXT, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 }, elevation: 1,
  },
  passwordWrap: { position: "relative" },
  eyeBtn: { position: "absolute", right: 12, top: 12, width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  signupBtn: {
    backgroundColor: BRAND, borderRadius: 22, paddingVertical: 14, alignItems: "center", marginTop: 18,
    shadowColor: BRAND, shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  signupText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  or: { textAlign: "center", marginVertical: 12, color: SUB, fontSize: 13.5 },
  googleBtn: {
    backgroundColor: "#EFEFEF", borderRadius: 22, paddingVertical: 12, paddingHorizontal: 14,
    alignItems: "center", flexDirection: "row", justifyContent: "center",
  },
  googleLeft: { position: "absolute", left: 14, height: 20, width: 20, alignItems: "center", justifyContent: "center" },
  googleText: { fontSize: 15, fontWeight: "600", color: TEXT },
});
