package com.americann3rd.nazg;

import android.os.Bundle;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        hideSystemUi();
    }

    @Override
    public void onResume() {
        super.onResume();
        hideSystemUi();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemUi();
        }
    }

    /**
     * Gamepad and joystick events go to the WebView so the standard Gamepad API
     * (Xbox layout) keeps working. The Android back key is left to Capacitor,
     * which the web app treats as pause.
     */
    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (isGamepadSource(event) && getBridge() != null && getBridge().getWebView() != null) {
            return getBridge().getWebView().dispatchKeyEvent(event);
        }
        return super.dispatchKeyEvent(event);
    }

    private static boolean isGamepadSource(KeyEvent event) {
        int source = event.getSource();
        return (source & InputDevice.SOURCE_GAMEPAD) == InputDevice.SOURCE_GAMEPAD
                || (source & InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK
                || (source & InputDevice.SOURCE_DPAD) == InputDevice.SOURCE_DPAD;
    }

    private void hideSystemUi() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (controller == null) {
            return;
        }
        controller.hide(WindowInsetsCompat.Type.systemBars());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
}
