// Expo Go wrapper for the phone demo (#24): the /phone page (AIM inside a copy of the Freedom Broker app, #21)
// shown full screen in a native WebView, so the defense can show AIM "inside the app" on a real phone.
// All app logic lives in the web page; this file only hosts it.
import { useCallback, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';

// Production by default; point at a LAN dev server with EXPO_PUBLIC_DEMO_URL=http://192.168.x.x:3000/phone/
const DEMO_URL = process.env.EXPO_PUBLIC_DEMO_URL || 'https://freedom-cqa.vercel.app/phone/';
const ORIGIN = new URL(DEMO_URL).origin;
const NAVY = '#171D2D';
const BLUE = '#3B82F6';

function Demo() {
  const web = useRef<ComponentRef<typeof WebView>>(null); // React 19 types: derive the ref from the component
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);

  const retry = useCallback(() => { setFailed(null); setLoading(true); web.current?.reload(); }, []);

  // Stay inside the demo; anything else (e.g. a GitHub link) opens in the system browser.
  const onNavigate = useCallback((req: ShouldStartLoadRequest) => {
    if (req.url.startsWith(ORIGIN) || req.url.startsWith('about:') || req.url.startsWith('data:') || req.url.startsWith('blob:')) return true;
    Linking.openURL(req.url).catch(() => {});
    return false;
  }, []);

  return (
    // iOS: the page runs edge to edge and pads itself with CSS env(safe-area-inset-*), like Safari.
    // Android WebViews don't always report those insets, so pad natively there.
    <View style={[styles.root, Platform.OS === 'android' && { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />
      <WebView
        ref={web}
        source={{ uri: DEMO_URL }}
        style={styles.web}
        containerStyle={styles.web}
        originWhitelist={['*']}
        onShouldStartLoadWithRequest={onNavigate}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        bounces={false}
        overScrollMode="never"
        allowsBackForwardNavigationGestures={false}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mediaCapturePermissionGrantType="grant"
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        applicationNameForUserAgent="FreedomAIMDemo/1.0"
        onLoadEnd={() => setLoading(false)}
        onError={(e) => setFailed(e.nativeEvent.description || 'Нет соединения')}
        onHttpError={(e) => { if (e.nativeEvent.statusCode >= 500) setFailed(`Сервер ответил ${e.nativeEvent.statusCode}`); }}
        onContentProcessDidTerminate={() => web.current?.reload()}
        onRenderProcessGone={() => web.current?.reload()}
      />
      {(loading || failed) && (
        <View style={[StyleSheet.absoluteFill, styles.cover]}>
          <Text style={styles.brand}>Freedom <Text style={styles.brandBold}>Broker</Text></Text>
          <Text style={styles.sub}>демо · ассистент AIM</Text>
          {failed ? (
            <>
              <Text style={styles.err}>Не удалось открыть демо.{'\n'}{failed}</Text>
              <Pressable onPress={retry} style={({ pressed }) => [styles.btn, pressed && { opacity: 0.8 }]} accessibilityRole="button">
                <Text style={styles.btnText}>Повторить</Text>
              </Pressable>
            </>
          ) : (
            <ActivityIndicator color={BLUE} size="large" style={{ marginTop: 28 }} />
          )}
        </View>
      )}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Demo />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NAVY },
  web: { flex: 1, backgroundColor: NAVY },
  cover: { backgroundColor: NAVY, alignItems: 'center', justifyContent: 'center', padding: 32 },
  brand: { color: '#FFFFFF', fontSize: 28, fontWeight: '400' },
  brandBold: { fontWeight: '800' },
  sub: { color: '#9CA3AF', fontSize: 15, marginTop: 6 },
  err: { color: '#E5E7EB', fontSize: 15, textAlign: 'center', marginTop: 28, lineHeight: 21 },
  btn: { marginTop: 20, height: 46, paddingHorizontal: 28, borderRadius: 10, backgroundColor: BLUE, justifyContent: 'center' },
  btnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
