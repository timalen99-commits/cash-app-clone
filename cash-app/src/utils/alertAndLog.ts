import { Alert, Platform } from "react-native";

export function alertAndLog(title: string, message: any) {
  setTimeout(async () => {
    if (Platform.OS === "web") {
      // react-native-web's Alert.alert is a no-op.
      window.alert(`${title}\n\n${message ?? ""}`);
    } else {
      Alert.alert(title, message, [{ text: "Ok", style: "cancel" }]);
    }
  }, 100);
  console.log(message);
}
