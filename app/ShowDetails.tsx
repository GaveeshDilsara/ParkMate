// ShowDetails.tsx
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React from "react";
import {
    Image,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

type RootStackParamList = {
  ShowDetails: { id: number } | undefined;
};
type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, "ShowDetails">;

const C = {
  bg: "#F5F7FB",
  card: "#FFFFFF",
  text: "#111827",
  sub: "#6B7280",
  bar: "#2F80ED",
};

export default function ShowDetails() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const spaceId = route.params?.id ?? 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      {/* App bar */}
      <View style={styles.appbar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.leftBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.title}>Space Details</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Image
            source={{ uri: "https://i.imgur.com/Mm1aVtP.png" }}
            style={{ width: "100%", height: 180, borderRadius: 12 }}
          />
          <Text style={styles.name}>Thummulla Parking • ID #{spaceId}</Text>

          <View style={styles.row}>
            <Ionicons name="location-sharp" size={18} color="#ef4444" />
            <Text style={styles.rowText}>Thummulla</Text>
          </View>
          <View style={styles.row}>
            <MaterialCommunityIcons name="parking" size={18} color={C.bar} />
            <Text style={styles.rowText}>Spaces Available: 10</Text>
          </View>
          <View style={styles.row}>
            <Ionicons name="cash-outline" size={18} color={C.text} />
            <Text style={styles.rowText}>Type: Paid Parking</Text>
          </View>
          <View style={styles.row}>
            <Ionicons name="time-outline" size={18} color={C.text} />
            <Text style={styles.rowText}>Open: 6:00 AM - 10:00 PM</Text>
          </View>

          <Pressable style={styles.cta} onPress={() => { /* navigate to booking or edit */ }}>
            <Text style={styles.ctaText}>Proceed</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  appbar: {
    height: 48,
    backgroundColor: C.bar,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  leftBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, textAlign: "center", color: "#fff", fontWeight: "800", fontSize: 18, marginRight: 36 },

  card: { backgroundColor: C.card, borderRadius: 16, padding: 12 },
  name: { marginTop: 10, fontSize: 18, fontWeight: "800", color: C.text },
  row: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 8 },
  rowText: { color: C.text },

  cta: {
    marginTop: 16,
    backgroundColor: C.bar,
    borderRadius: 22,
    paddingVertical: 12,
    alignItems: "center",
  },
  ctaText: { color: "#fff", fontWeight: "800" },
});
