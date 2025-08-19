// Owner_Home.tsx
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useMemo, useRef, useState } from "react";
import {
  Dimensions,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";

/* ---------- Route types (adjust names if needed) ---------- */
type RootStackParamList = {
  Owner_Home: undefined;
  AddSpaceDetails: undefined; // target when pressing +
  // Owner_AddSpace?: undefined; // keep if you have another create screen
};

/* ---------- Props ---------- */
type Banner = { id: string; image: string };

type Props = {
  userName?: string;
  onMenuPress?: () => void;
  onAvatarPress?: () => void;
  onAddPress?: () => void;
  banners?: Banner[];
};

const COLORS = {
  bg: "#F5F7FB",
  text: "#111827",
  sub: "#6B7280",
  card: "#FFFFFF",
  brand: "#2F80ED",
  shadow: "#000000",
};

const { width: W } = Dimensions.get("window");
const H_PADDING = 18;
const BANNER_W = W - H_PADDING * 2;
const BANNER_H = 140;

const DEFAULT_BANNERS: Banner[] = [
  {
    id: "1",
    image:
      "https://images.unsplash.com/photo-1549921296-3fd62a3d8d6a?q=80&w=1600&auto=format&fit=crop",
  },
  {
    id: "2",
    image:
      "https://images.unsplash.com/photo-1511919884226-fd3cad34687c?q=80&w=1600&auto=format&fit=crop",
  },
  {
    id: "3",
    image:
      "https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?q=80&w=1600&auto=format&fit=crop",
  },
];

export default function Owner_Home({
  userName = "User",
  onMenuPress,
  onAvatarPress,
  onAddPress,
  banners,
}: Props) {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const data = useMemo(() => banners ?? DEFAULT_BANNERS, [banners]);
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const next = Math.round(x / BANNER_W);
    setIndex(next);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={onMenuPress}
          hitSlop={8}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
          android_ripple={{ color: "#E5E7EB", borderless: true }}
        >
          <Ionicons name="menu-outline" size={24} color={COLORS.text} />
        </Pressable>

        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>Welcome Back,</Text>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={[styles.title, { marginRight: 6 }]}>{userName}</Text>
            <Text style={{ fontSize: 22 }}>👋</Text>
          </View>
        </View>

        <Pressable
          onPress={onAvatarPress}
          hitSlop={8}
          style={({ pressed }) => [
            styles.profileWrap,
            pressed && { opacity: 0.8 },
          ]}
        >
          <MaterialCommunityIcons
            name="account-circle"
            size={32}
            color={COLORS.text}
          />
        </Pressable>
      </View>

      {/* Content area */}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: H_PADDING, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner carousel */}
        <View style={styles.bannerCardShadow}>
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleMomentumEnd}
          >
            {data.map((b) => (
              <View key={b.id} style={styles.bannerCard}>
                <Image
                  source={{ uri: b.image }}
                  style={styles.bannerImage}
                  resizeMode="cover"
                />
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Dots */}
        <View style={styles.dotsRow}>
          {data.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === index && styles.dotActive,
              ]}
            />
          ))}
        </View>

        {/* Empty state card */}
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            You don't have any{"\n"}registered place yet
          </Text>
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      <Pressable
        onPress={() =>
          onAddPress ? onAddPress() : navigation.navigate("AddSpaceDetails")
        }
        style={({ pressed }) => [
          styles.fab,
          pressed && { transform: [{ scale: 0.98 }] },
        ]}
        android_ripple={{ color: "#1f6fd6", radius: 28 }}
        accessibilityLabel="Add new place"
        accessibilityRole="button"
      >
        <Ionicons name="add" size={26} color="white" />
      </Pressable>
    </SafeAreaView>
  );
}

/* ---------- Styles ---------- */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    paddingHorizontal: H_PADDING,
    paddingTop: 4,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextWrap: {
    flex: 1,
    marginLeft: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.text,
  },
  profileWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EFEFEF",
  },

  bannerCardShadow: {
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  bannerCard: {
    width: BANNER_W,
    height: BANNER_H,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    marginRight: 0,
    overflow: "hidden",
  },
  bannerImage: { width: "100%", height: "100%" },

  dotsRow: {
    alignSelf: "center",
    flexDirection: "row",
    marginTop: 10,
    marginBottom: 14,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#D1D5DB",
    marginHorizontal: 4,
  },
  dotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#111827",
    marginTop: -1,
  },

  emptyCard: {
    width: BANNER_W,
    alignSelf: "center",
    backgroundColor: COLORS.card,
    borderRadius: 14,
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  emptyText: {
    color: "#B8BDC7",
    fontSize: 16,
    textAlign: "center",
    lineHeight: 22,
  },

  fab: {
    position: "absolute",
    bottom: 26,
    alignSelf: "center",
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.brand,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.brand,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
});
