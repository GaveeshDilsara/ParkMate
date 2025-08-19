// app/AddSpaceDetails.tsx — big map + no-typing price + reverse geocode pretty address
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { router } from "expo-router";
import * as Sharing from "expo-sharing";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useMemo, useState } from "react";
import {
  Alert, Image, KeyboardAvoidingView,
  Linking,
  Modal, Platform, Pressable,
  SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View
} from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT, Region } from "react-native-maps";

/* ---------- Types to match SetTimeSlots ---------- */
type DayKey =
  | "Sunday" | "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday";
type DayState = { enabled: boolean; slots: string[] };
type DayMap = Record<DayKey, DayState>;

type RootStackParamList = {
  AfterSubmitting: undefined;
  AddSpaceDetails: undefined;
  SetTimeSlots:
    | { onSave?: (summary: string, detail: DayMap) => void; initial?: DayMap }
    | undefined;
};
type Nav = NativeStackNavigationProp<RootStackParamList>;

/* ---- Day helpers for one-by-one chips ---- */
const DAY_ORDER: DayKey[] = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const SHORT: Record<DayKey, string> = {
  Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed",
  Thursday: "Thu", Friday: "Fri", Saturday: "Sat", Sunday: "Sun",
};
const to12h = (t: string) => {
  if (!t) return "--:--";
  const [h, m] = t.split(":").map(Number);
  const am = h < 12;
  const hr = ((h + 11) % 12) + 1;
  return `${hr}:${String(m).padStart(2, "0")} ${am ? "AM" : "PM"}`;
};

/* helpers */
const formatBytes = (bytes?: number) => {
  if (!bytes) return "";
  const units = ["B","KB","MB","GB"];
  let i = 0, v = bytes;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
};

const openPdf = async (uri?: string) => {
  if (!uri) return;
  try {
    // Web URL → open in browser tab
    if (/^https?:\/\//i.test(uri)) {
      await WebBrowser.openBrowserAsync(uri);
      return;
    }
    // Local URI → hand off via system share (lets user pick a PDF app)
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        UTI: "com.adobe.pdf",
        dialogTitle: "Open PDF",
      });
      return;
    }
    // Fallback
    await Linking.openURL(uri);
  } catch {
    Alert.alert("Can't open file", "No app found to preview this PDF. Try saving and opening with a PDF viewer.");
  }
};

/* ---------- Theme ---------- */
const COLORS = {
  bg: "#F6F7FB",
  card: "#FFFFFF",
  text: "#0F172A",
  sub: "#6B7280",
  brand: "#2F80ED",
  brand2: "#1E6AE6",
  shadow: "#000000",
  link: "#1D4ED8",
  grayLight: "#EEF1F6",
  grayMid: "#E5E7EB",
};

type CategoryKey = "Cars" | "Vans" | "Bikes" | "Buses";
type CategoryCounts = Record<CategoryKey, number>;
type PriceUnit = "hour" | "day";

/* ---- Shared storage keys with SetTimeSlots ---- */
const STORAGE_KEY = "pm_timeSlots";
const SUMMARY_KEY = "pm_timeSummary";

/* ---- Files state types ---- */
type PickedPdf = { uri: string; name: string; mime?: string; size?: number };
type PickedImg = { id: number; uri: string; name: string; mime?: string };
const MAX_IMAGES = 6;

export default function AddSpaceDetails() {
  const navigation = useNavigation<Nav>();

  // form state
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [location, setLocation] = useState(""); // pretty address after verify

  // verification + map
  const [verifying, setVerifying] = useState(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapOpen, setMapOpen] = useState(false);

  // ⏰ Time selection
  const [timeSummary, setTimeSummary] = useState<string>(""); // not displayed, still loaded
  const [timeDetail, setTimeDetail] = useState<DayMap | undefined>(undefined);

  // Pricing (no typing)
  const [price, setPrice] = useState<number>(0);
  const [priceUnit, setPriceUnit] = useState<PriceUnit>("hour");
  const PRICE_STEP = 50;
  const quickPrices = [100, 200, 300, 500, 1000, 1500];

  // Desc + terms
  const [desc, setDesc] = useState("");
  const [agreed, setAgreed] = useState(false);

  // category counts
  const [categoryCounts, setCategoryCounts] = useState<CategoryCounts>({
    Cars: 0, Vans: 0, Bikes: 0, Buses: 0,
  });
  const hasAnyCategory = Object.values(categoryCounts).some((v) => v > 0);

  const canSubmit = useMemo(
    () =>
      !!(name && address && location && price > 0 && hasAnyCategory && agreed),
    [name, address, location, price, hasAnyCategory, agreed]
  );

  /* ---------- Files (PDF + images) ---------- */
  const [pdf, setPdf] = useState<PickedPdf | null>(null);
  const [images, setImages] = useState<PickedImg[]>([]);

  const pickPdf = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (res.canceled) return;
      const f = res.assets?.[0];
      if (!f) return;
      setPdf({
        uri: f.uri,
        name: f.name ?? "document.pdf",
        mime: f.mimeType ?? "application/pdf",
        size: f.size,
      });
    } catch {
      Alert.alert("Error", "Could not pick PDF.");
    }
  };
  const clearPdf = () => setPdf(null);

  const pickImage = async () => {
    try {
      if (images.length >= MAX_IMAGES) {
        Alert.alert("Limit reached", `You can upload up to ${MAX_IMAGES} images.`);
        return;
      }
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission needed", "Please allow photo library access.");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });
      if (res.canceled) return;
      const a = res.assets?.[0];
      if (!a) return;
      const name = a.fileName || `img_${Date.now()}.jpg`;
      const mime = a.mimeType || "image/jpeg";
      setImages((prev) => [...prev, { id: Date.now(), uri: a.uri, name, mime }].slice(0, MAX_IMAGES));
    } catch {
      Alert.alert("Error", "Could not pick image.");
    }
  };
  const removeImg = (id: number) => setImages((prev) => prev.filter((i) => i.id !== id));

  /* ---------- Actions ---------- */
  const setCount = (key: CategoryKey, next: number) => {
    setCategoryCounts((prev) => ({
      ...prev,
      [key]: Math.max(0, Math.floor(Number.isFinite(next) ? next : 0)),
    }));
  };
  const inc = (key: CategoryKey) => setCount(key, categoryCounts[key] + 1);
  const dec = (key: CategoryKey) => setCount(key, categoryCounts[key] - 1);

  // Geocode → Reverse geocode to pretty address
  const verifyAddress = async () => {
    if (!address.trim()) {
      Alert.alert("Address required", "Please enter the exact address first.");
      return;
    }
    try {
      setVerifying(true);
      const results = await Location.geocodeAsync(address.trim());
      if (!results || results.length === 0) {
        Alert.alert("Not found", "Could not verify this address. Please refine it.");
        return;
      }
      const { latitude, longitude } = results[0];
      setCoords({ latitude, longitude });

      // 👉 Pretty address
      const rev = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (rev && rev[0]) {
        const r = rev[0];
        const formatted = [
          r.name, r.street, r.district || r.subregion || r.city,
          r.region, r.postalCode, r.country,
        ].filter(Boolean).join(", ");
        setLocation(formatted);
      } else {
        // Fallback to coords if reverse fails
        setLocation(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
      }
    } catch {
      Alert.alert("Verification failed", "Please check your connection and try again.");
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmit = () => {
    if (!canSubmit) return;

    console.log("Submitted:", {
      name, address, location, coords,
      timeSummary, timeDetail,
      price, priceUnit,
      categories: categoryCounts, desc,
      files: {
        pdf: pdf?.name,
        images: images.map(i => i.name),
      }
    });

    navigation.navigate("AfterSubmitting");
  };

  /* ---------- Load saved availability whenever screen is focused ---------- */
  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        try {
          const [raw, sum] = await Promise.all([
            AsyncStorage.getItem(STORAGE_KEY),
            AsyncStorage.getItem(SUMMARY_KEY),
          ]);

          if (!mounted) return;

          if (sum) setTimeSummary(sum);

          // Convert simple DaySlot[] into DayMap the page keeps (1 slot/day)
          if (raw) {
            type DaySlot = { day: string; enabled: boolean; startTime: string; endTime: string };
            const parsed = JSON.parse(raw) as DaySlot[];
            if (Array.isArray(parsed) && parsed.length === 7) {
              const map: Partial<DayMap> = {};
              parsed.forEach((r) => {
                const key = r.day as DayKey;
                const slot = r.enabled && r.startTime && r.endTime ? [`${r.startTime}-${r.endTime}`] : [];
                map[key] = { enabled: !!r.enabled, slots: slot };
              });
              (["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"] as DayKey[])
                .forEach(k => { if (!map[k]) map[k] = { enabled: false, slots: [] }; });
              setTimeDetail(map as DayMap);
            }
          }
        } catch {
          // ignore
        }
      })();
      return () => { mounted = false; };
    }, [])
  );

  /* ---------- Derived ---------- */
  const mapRegion: Region | undefined = coords
    ? { latitude: coords.latitude, longitude: coords.longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 }
    : undefined;

  return (
    <SafeAreaView style={styles.safe}>
      {/* AppBar with gradient */}
      <LinearGradient colors={[COLORS.brand, COLORS.brand2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.appbar}>
        <Pressable onPress={() => navigation.goBack()} style={styles.appbarBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.appbarTitle}>Parking Space Details</Text>
        <View style={styles.appbarBtn} />
      </LinearGradient>

      {/* Floating header card */}
      <View style={[styles.heroCard, styles.shadow]}>
        <Ionicons name="business-outline" size={18} color={COLORS.brand} />
        <Text style={styles.heroText}>Tell us about your space</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.select({ ios: "padding", android: undefined })} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: 32, paddingTop: 8 }}>
          
          {/* ===== Basic Info ===== */}
          <Section title="Basic info" icon="information-circle-outline">
            {/* Space name */}
            <IconField icon="pricetag-outline" placeholder="Parking Space Name" value={name} onChangeText={setName} />

            {/* Exact address + Verify */}
            <View style={{ marginTop: 12 }}>
              <View style={[styles.pill, { paddingRight: 94 }]}>
                <Ionicons name="location-outline" size={18} color={COLORS.sub} style={{ marginRight: 8, marginLeft: 2 }} />
                <TextInput
                  placeholder="Exact Address"
                  placeholderTextColor="#9CA3AF"
                  style={styles.input}
                  value={address}
                  onChangeText={setAddress}
                />
                <Pressable onPress={verifyAddress} style={[styles.verifyBtn, verifying && { opacity: 0.8 }]} disabled={verifying}>
                  <Text style={styles.verifyText}>{verifying ? "Verifying..." : "Verify"}</Text>
                </Pressable>
              </View>
              {!!location && (
                <Text style={styles.verifiedNote}>Verified ✓ {location}</Text>
              )}
            </View>

            {/* Location (filled after verify) + map button */}
            <View style={{ marginTop: 12 }}>
              <View style={[styles.pill, { paddingRight: 44 }]}>
                <Ionicons name="navigate-outline" size={18} color={COLORS.sub} style={{ marginRight: 8, marginLeft: 2 }} />
                <TextInput
                  placeholder="Location (auto-filled after Verify)"
                  placeholderTextColor="#9CA3AF"
                  style={styles.input}
                  value={location}
                  onChangeText={setLocation}
                  editable={false}
                />
                <Pressable onPress={() => coords && setMapOpen(true)} disabled={!coords} style={styles.trailingIcon} hitSlop={8}>
                  <Ionicons name="map-outline" size={20} color={coords ? COLORS.link : COLORS.sub} />
                </Pressable>
              </View>
              {!coords && <Text style={styles.hint}>Tap <Text style={{ fontWeight: "800" }}>Verify</Text> to resolve and preview on the map.</Text>}
            </View>
          </Section>

          {/* ===== Availability ===== */}
          <Section title="Availability" icon="calendar-outline" style={{ marginTop: 14 }}>
            <View style={[styles.pill, { paddingRight: 44 }]}>
              <TextInput
                placeholder="Available Time Slots"
                placeholderTextColor="#9CA3AF"
                style={styles.input}
                editable={false}
              />
              <Pressable
                onPress={() => router.push("/SetTimeSlots")}
                style={styles.trailingIcon}
                hitSlop={8}
              >
                <MaterialCommunityIcons name="pencil-outline" size={20} color={COLORS.sub} />
              </Pressable>
            </View>

            {timeDetail && (
              <View style={styles.chipsWrap}>
                {DAY_ORDER.flatMap((day) => {
                  const st = timeDetail[day];
                  if (!st || !st.enabled || st.slots.length === 0) return [];
                  return st.slots.map((slot, j) => {
                    const [start, end] = slot.split("-");
                    return (
                      <Chip
                        key={`${day}-${j}`}
                        text={`${SHORT[day]} ${to12h(start)} — ${to12h(end)}`}
                      />
                    );
                  });
                })}
              </View>
            )}
          </Section>

          {/* ===== Pricing (no typing) ===== */}
          <Section title="Pricing" icon="cash-outline" style={{ marginTop: 14 }}>
            <View style={styles.bigStepper}>
              <Pressable onPress={() => setPrice(Math.max(0, price - PRICE_STEP))} style={styles.stepperBtn} hitSlop={6}>
                <Ionicons name="remove" size={22} color="#fff" />
              </Pressable>

              <View style={styles.priceCenter}>
                <Text style={styles.priceCaption}>Amount</Text>
                <Text style={styles.priceValue}>LKR {price.toLocaleString()}</Text>
              </View>

              <Pressable onPress={() => setPrice(price + PRICE_STEP)} style={styles.stepperBtn} hitSlop={6}>
                <Ionicons name="add" size={22} color="#fff" />
              </Pressable>
            </View>

            <View style={styles.quickRow}>
              {quickPrices.map((p) => (
                <Pressable key={p} onPress={() => setPrice(p)} style={[styles.quickChip, price === p && styles.quickChipActive]}>
                  <Text style={[styles.quickChipText, price === p && { color: "#fff" }]}>
                    {p.toLocaleString()}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.unitGroup}>
              {(["hour", "day"] as PriceUnit[]).map((u) => {
                const active = priceUnit === u;
                return (
                  <Pressable key={u} onPress={() => setPriceUnit(u)} style={[styles.unitPill, active && styles.unitPillActive]}>
                    <Text style={[styles.unitText, active && styles.unitTextActive]}>
                      {u === "hour" ? "Per Hour" : "Per Day"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.hint}>No typing needed — use the +/– buttons or quick amounts.</Text>
          </Section>

          {/* ===== Categories (beautiful cards) ===== */}
          <Section title="Vehicle categories" icon="car-outline" style={{ marginTop: 14 }}>
            <View style={styles.prettyGrid}>
              {(["Cars", "Vans", "Bikes", "Buses"] as CategoryKey[]).map((key) => {
                const count = categoryCounts[key];
                const active = count > 0;
                const iconName =
                  key === "Cars" ? "car-outline" :
                  key === "Vans" ? "car-sport-outline" :
                  key === "Bikes" ? "bicycle-outline" : "bus-outline";
                return (
                  <LinearGradient
                    key={key}
                    colors={active ? [COLORS.brand, COLORS.brand2] : ["#EFF2F7", "#EFF2F7"]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={[styles.vehicleCard, styles.shadow, active && { elevation: 4 }]}
                  >
                    <View style={styles.vehicleHead}>
                      <Ionicons name={iconName as any} size={22} color={active ? "#fff" : COLORS.link} />
                      <Text style={[styles.vehicleTitle, active && { color: "#fff" }]}>{key}</Text>
                    </View>

                    <View style={styles.counterWrap}>
                      <Pressable onPress={() => dec(key)} style={[styles.stepBtn, active && styles.stepBtnActive]} hitSlop={6}>
                        <Ionicons name="remove" size={18} color={active ? "#fff" : COLORS.text} />
                      </Pressable>

                      <View style={styles.countBadge}><Text style={styles.countText}>{count}</Text></View>

                      <Pressable onPress={() => inc(key)} style={[styles.stepBtn, active && styles.stepBtnActive]} hitSlop={6}>
                        <Ionicons name="add" size={18} color={active ? "#fff" : COLORS.text} />
                      </Pressable>
                    </View>
                  </LinearGradient>
                );
              })}
            </View>

            {hasAnyCategory ? (
              <View style={[styles.chipsWrap, { marginTop: 10 }]}>
                {(Object.keys(categoryCounts) as CategoryKey[])
                  .filter((k) => categoryCounts[k] > 0)
                  .map((k) => <Chip key={k} text={`${k}: ${categoryCounts[k]}`} />)}
              </View>
            ) : (
              <Text style={styles.hint}>Pick at least one vehicle type and set how many slots you have.</Text>
            )}
          </Section>

          {/* ===== Description ===== */}
          <Section title="Description" icon="list-outline" style={{ marginTop: 14 }}>
            <View style={[styles.pill, { height: 110, alignItems: "flex-start" }]}>
              <TextInput
                placeholder="Describe special notes, entry instructions, CCTV, security, etc."
                placeholderTextColor="#9CA3AF"
                style={[styles.input, { height: "100%" }]}
                value={desc}
                onChangeText={setDesc}
                multiline
              />
            </View>
          </Section>

          {/* ===== Legal & Terms ===== */}
          <Section title="Legal & terms" icon="document-text-outline" style={{ marginTop: 14 }}>
            {/* Subheader strip */}
            <View style={styles.legalHeader}>
              <View style={styles.legalBadge}>
                <Ionicons name="shield-checkmark-outline" size={14} color="#fff" />
                <Text style={styles.legalBadgeText}>Required</Text>
              </View>
              <Text style={styles.legalHeaderText}>Attach your agreement and photos to speed up approval.</Text>
            </View>

            {/* Agreement (PDF) */}
            <View style={[styles.uploadCard, styles.shadow]}>
              <View style={styles.cardHeadRow}>
                <View style={styles.cardHeadLeft}>
                  <Ionicons name="document-text-outline" size={18} color={COLORS.brand} />
                  <Text style={styles.cardTitle}>Agreement (PDF)</Text>
                </View>
                {pdf ? (
                  <View style={[styles.statusPill, { backgroundColor: "#E7F5FF" }]}>
                    <Ionicons name="checkmark-circle" size={14} color={COLORS.brand} />
                    <Text style={[styles.statusPillText, { color: COLORS.brand }]}>Attached</Text>
                  </View>
                ) : (
                  <View style={[styles.statusPill, { backgroundColor: "#FEF3C7" }]}>
                    <Ionicons name="alert-circle-outline" size={14} color="#92400E" />
                    <Text style={[styles.statusPillText, { color: "#92400E" }]}>Missing</Text>
                  </View>
                )}
              </View>

              {!pdf ? (
                <Pressable onPress={pickPdf} style={[styles.dashedTile]} hitSlop={6}>
                  <Ionicons name="cloud-upload-outline" size={20} color={COLORS.brand} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dashedTitle}>Attach PDF agreement</Text>
                    <Text style={styles.dashedSub}>PDF only • up to 10 MB</Text>
                  </View>
                  <View style={styles.primaryPill}>
                    <Text style={styles.primaryPillText}>Select</Text>
                  </View>
                </Pressable>
              ) : (
                <View style={styles.pdfRow}>
                  <View style={styles.pdfLeft}>
                    <View style={styles.pdfIconStripe}>
                      <Ionicons name="document-attach-outline" size={18} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={styles.pdfName}>{pdf.name}</Text>
                      <Text style={styles.pdfMeta}>{formatBytes(pdf.size)}</Text>
                    </View>
                  </View>
                  <View style={styles.actionRow}>
                    
                    <Pressable onPress={clearPdf} style={styles.destructiveBtn} hitSlop={6}>
                      <Ionicons name="trash-outline" size={14} color="#fff" />
                      <Text style={styles.destructiveBtnText}>Remove</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>

            {/* Photos (up to 6) */}
            <View style={[styles.uploadCard, styles.shadow, { marginTop: 12 }]}>
              <View style={styles.cardHeadRow}>
                <View style={styles.cardHeadLeft}>
                  <Ionicons name="images-outline" size={18} color={COLORS.brand} />
                  <Text style={styles.cardTitle}>Photos</Text>
                </View>
                <Text style={styles.counterText}>{images.length}/{MAX_IMAGES}</Text>
              </View>

              <View style={styles.galleryGrid}>
                {/* Add tile */}
                <Pressable onPress={pickImage} style={[styles.addTile, images.length >= MAX_IMAGES && { opacity: 0.45 }]} disabled={images.length >= MAX_IMAGES}>
                  <Ionicons name="add" size={20} color={COLORS.brand} />
                  <Text style={styles.addTileText}>Add photo</Text>
                  <Text style={styles.addTileHint}>JPG / PNG</Text>
                </Pressable>

                {/* Thumbnails */}
                {images.map((img) => (
                  <View key={img.id} style={[styles.thumbWrap, styles.shadow]}>
                    <Image source={{ uri: img.uri }} style={styles.thumb} />
                    <Pressable onPress={() => removeImg(img.id)} style={styles.removeBadge} hitSlop={6}>
                      <Ionicons name="close" size={14} color="#fff" />
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>

            {/* Terms checkbox (pill) */}
            <Pressable onPress={() => setAgreed(v => !v)} style={[styles.agreePill, agreed && styles.agreePillOn]} hitSlop={6}>
              <Ionicons name={agreed ? "checkbox" : "square-outline"} size={18} color={agreed ? "#fff" : COLORS.brand} />
              <Text style={[styles.agreeText, agreed && { color: "#fff" }]}>
                I agree to the platform’s <Text style={[styles.link, agreed && { color: "#fff", textDecorationLine: "underline" }]} onPress={() => console.log("Terms clicked")}>Terms & Conditions</Text>.
              </Text>
            </Pressable>
          </Section>

          {/* ===== Submit ===== */}
          <LinearGradient colors={canSubmit ? [COLORS.brand, COLORS.brand2] : [COLORS.grayMid, COLORS.grayMid]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.submitBtn, styles.shadow, { marginTop: 18 }]}>
            <Pressable onPress={handleSubmit} disabled={!canSubmit}
              style={({ pressed }) => [styles.submitPressable, pressed && canSubmit && { transform: [{ scale: 0.997 }] }]}>
              <Ionicons name="paper-plane-outline" size={18} color="#fff" />
              <Text style={styles.submitText}>Submit for Approval{price > 0 ? ` — LKR ${price.toLocaleString()} / ${priceUnit}` : ""}</Text>
            </Pressable>
          </LinearGradient>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ===== Map modal (FULL SCREEN) ===== */}
      <Modal visible={mapOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setMapOpen(false)}>
        <View style={styles.mapFull}>
          <View style={styles.mapHeader}>
            <Pressable onPress={() => setMapOpen(false)} hitSlop={8} style={styles.headerBtn}>
              <Ionicons name="close" size={22} color="#0F172A" />
            </Pressable>
            <Text style={styles.mapTitle}>Verified Location</Text>
            <View style={styles.headerBtn} />
          </View>
          <View style={styles.mapBody}>
            {mapRegion ? (
              <MapView style={{ flex: 1 }} provider={PROVIDER_DEFAULT} initialRegion={mapRegion}>
                <Marker coordinate={coords!} title="Space location" />
              </MapView>
            ) : (
              <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
                <Text style={{ color: COLORS.sub }}>No location to show</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ---------- UI helpers ---------- */
function Section({
  title, icon, children, style,
}: { title: string; icon: keyof typeof Ionicons.glyphMap; children: React.ReactNode; style?: any; }) {
  return (
    <View style={[styles.card, styles.shadow, style]}>
      <View style={styles.sectionHead}>
        <View style={styles.sectionIcon}><Ionicons name={icon} size={16} color={COLORS.brand} /></View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function IconField({
  icon, placeholder, value, onChangeText, keyboardType = "default", style,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  placeholder: string; value: string;
  onChangeText: (t: string) => void;
  keyboardType?: "default" | "email-address" | "numeric" | "decimal-pad" | "phone-pad";
  style?: any;
}) {
  return (
    <View style={[styles.pill, style]}>
      <Ionicons name={icon} size={18} color={COLORS.sub} style={{ marginRight: 8, marginLeft: 2 }} />
      <TextInput placeholder={placeholder} placeholderTextColor="#9CA3AF" style={styles.input}
        value={value} onChangeText={onChangeText} keyboardType={keyboardType} />
    </View>
  );
}

function Chip({ text }: { text: string }) {
  return (
    <LinearGradient
      colors={[COLORS.brand, COLORS.brand2]}   // same colors for every chip
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={{
        borderRadius: 18,
        paddingVertical: 7,
        paddingHorizontal: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
      }}
    >
      <Ionicons name="calendar-outline" size={12} color="#fff" />
      <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12.5 }}>
        {text}
      </Text>
    </LinearGradient>
  );
}

/* ---------- Styles ---------- */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  appbar: { height: 56, flexDirection: "row", alignItems: "center", paddingHorizontal: 12 },
  appbarBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  appbarTitle: { flex: 1, textAlign: "left", color: "#fff", fontWeight: "800", fontSize: 18, marginLeft: 6 },

  heroCard: { marginHorizontal: 16, marginTop: -18, marginBottom: 8, backgroundColor: COLORS.card, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  heroText: { color: COLORS.text, fontWeight: "700" },

  card: { backgroundColor: COLORS.card, borderRadius: 16, padding: 14 },

  sectionHead: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  sectionIcon: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#E9F2FF", alignItems: "center", justifyContent: "center", marginRight: 8 },
  sectionTitle: { fontSize: 15.5, fontWeight: "800", color: COLORS.text },

  pill: { backgroundColor: COLORS.grayLight, borderRadius: 22, paddingHorizontal: 12, minHeight: 46, flexDirection: "row", alignItems: "center" },
  input: { flex: 1, color: COLORS.text, fontSize: 14.5 },
  trailingIcon: { position: "absolute", right: 6, height: 46, width: 38, alignItems: "center", justifyContent: "center" },

  // Verify
  verifyBtn: { position: "absolute", right: 6, top: 5, bottom: 5, backgroundColor: COLORS.brand, borderRadius: 14, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  verifyText: { color: "#fff", fontWeight: "800", fontSize: 12.5 },
  verifiedNote: { marginTop: 6, color: "#16A34A", fontWeight: "700", fontSize: 12.5 },

  dropdownText: { flex: 1, fontSize: 14.5, color: COLORS.text },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },

  hint: { marginTop: 8, color: COLORS.sub, fontSize: 12.5 },

  // Pricing (no-typing)
  bigStepper: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: COLORS.brand, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12, marginTop: 2 },
  stepperBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  priceCenter: { alignItems: "center", justifyContent: "center" },
  priceCaption: { color: "rgba(255,255,255,0.8)", fontWeight: "700", fontSize: 11 },
  priceValue: { color: "#fff", fontWeight: "900", fontSize: 20, marginTop: 2 },
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  quickChip: { backgroundColor: "#E9EDF5", borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12 },
  quickChipActive: { backgroundColor: COLORS.link },
  quickChipText: { color: COLORS.text, fontWeight: "800", fontSize: 12.5 },
  unitGroup: { flexDirection: "row", gap: 8, marginTop: 10 },
  unitPill: { paddingVertical: 9, paddingHorizontal: 12, borderRadius: 14, backgroundColor: "#E9EDF5" },
  unitPillActive: { backgroundColor: COLORS.link },
  unitText: { color: COLORS.text, fontWeight: "700", fontSize: 12.5 },
  unitTextActive: { color: "#fff" },

  // Vehicles
  prettyGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  vehicleCard: { width: "47.5%", borderRadius: 16, padding: 12 },
  vehicleHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  vehicleTitle: { color: COLORS.text, fontWeight: "800", fontSize: 14.5 },
  counterWrap: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stepBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: "#E9EDF5", alignItems: "center", justifyContent: "center" },
  stepBtnActive: { backgroundColor: "rgba(255,255,255,0.25)" },
  countBadge: { minWidth: 58, height: 38, borderRadius: 10, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  countText: { fontSize: 16, fontWeight: "800", color: COLORS.text },

  submitBtn: { borderRadius: 28, overflow: "hidden" },
  submitPressable: { minHeight: 50, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  submitText: { color: "#fff", fontWeight: "800", fontSize: 15 },

  // Map full-screen
  mapFull: { flex: 1, backgroundColor: "#fff" , marginTop:50 },
  mapHeader: { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E5E7EB" },
  mapTitle: { fontWeight: "800", fontSize: 16, color: COLORS.text },
  headerBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  mapBody: { flex: 1 },

  // Shadow
  shadow: Platform.select({
    ios: { shadowColor: COLORS.shadow, shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
    android: { elevation: 3 },
  }) as object,

  /* ---- Legal & terms polished UI ---- */
  legalHeader: {
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  legalBadge: {
    backgroundColor: COLORS.brand,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legalBadgeText: { color: "#fff", fontWeight: "800", fontSize: 11 },
  legalHeaderText: { flex: 1, color: COLORS.text, fontWeight: "700", fontSize: 12.5 },

  uploadCard: { backgroundColor: "#fff", borderRadius: 16, padding: 12 },
  cardHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  cardHeadLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { fontWeight: "800", color: COLORS.text },

  statusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, flexDirection: "row", alignItems: "center", gap: 6 },
  statusPillText: { fontWeight: "800", fontSize: 12 },

  dashedTile: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: COLORS.brand,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F8FBFF",
  },
  dashedTitle: { color: COLORS.text, fontWeight: "800" },
  dashedSub: { color: COLORS.sub, fontSize: 12 },

  primaryPill: { backgroundColor: COLORS.brand, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  primaryPillText: { color: "#fff", fontWeight: "800", fontSize: 12.5 },

  pdfRow: { marginTop: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  pdfLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  pdfIconStripe: { width: 36, height: 36, borderRadius: 8, backgroundColor: COLORS.brand, alignItems: "center", justifyContent: "center" },
  pdfName: { color: COLORS.text, fontWeight: "800" },
  pdfMeta: { color: COLORS.sub, fontSize: 12 },

  actionRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  ghostBtn: { backgroundColor: "#F3F4F6", borderRadius: 12, paddingVertical: 6, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 6 },
  ghostBtnText: { color: COLORS.text, fontWeight: "800", fontSize: 12.5 },
  destructiveBtn: { backgroundColor: "#EF4444", borderRadius: 12, paddingVertical: 6, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 6 },
  destructiveBtnText: { color: "#fff", fontWeight: "800", fontSize: 12.5 },

  galleryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  addTile: {
    width: 92, height: 92, borderRadius: 12,
    borderWidth: 1.5, borderStyle: "dashed", borderColor: COLORS.brand,
    backgroundColor: "#F8FBFF",
    alignItems: "center", justifyContent: "center",
    gap: 4,
  },
  addTileText: { color: COLORS.text, fontWeight: "800", fontSize: 12.5 },
  addTileHint: { color: COLORS.sub, fontSize: 11 },

  thumbWrap: { width: 92, height: 92, borderRadius: 12, overflow: "hidden", backgroundColor: "#E5E7EB", position: "relative" },
  thumb: { width: "100%", height: "100%" },
  removeBadge: {
    position: "absolute", top: 6, right: 6,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center", justifyContent: "center",
  },

  agreePill: {
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#E9F2FF",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  // Add these in your styles object
link: { color: COLORS.link, fontWeight: "800" },
counterText: { color: COLORS.sub, fontWeight: "700" },

  agreePillOn: { backgroundColor: COLORS.brand },
  agreeText: { flex: 1, color: COLORS.text, fontWeight: "700" },
});
