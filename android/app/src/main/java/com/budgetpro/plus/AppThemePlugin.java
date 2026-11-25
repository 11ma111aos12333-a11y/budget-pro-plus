package com.budgetpro.plus;

import android.graphics.Color;
import android.os.Build;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Small native helper used by the web app:
 *  - setBars: colors the area behind the status/navigation bars and picks light/dark icons
 *             (works on Android 15+ edge-to-edge where StatusBar.setBackgroundColor is a no-op)
 *  - setSecure: hides app content in "recent apps" and blocks screenshots (privacy mode)
 */
@CapacitorPlugin(name = "AppTheme")
public class AppThemePlugin extends Plugin {

    @PluginMethod
    public void setBars(PluginCall call) {
        final String color = call.getString("color", "#6366f1");
        final boolean darkContent = Boolean.TRUE.equals(call.getBoolean("darkIcons", false));
        getActivity().runOnUiThread(() -> {
            try {
                Window w = getActivity().getWindow();
                int c = Color.parseColor(color);
                View decor = w.getDecorView();
                decor.setBackgroundColor(c);
                if (Build.VERSION.SDK_INT < 35) {
                    w.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
                    w.setStatusBarColor(c);
                    w.setNavigationBarColor(c);
                }
                WindowInsetsControllerCompat ctl = WindowCompat.getInsetsController(w, decor);
                ctl.setAppearanceLightStatusBars(darkContent);
                ctl.setAppearanceLightNavigationBars(darkContent);
                call.resolve();
            } catch (Exception e) {
                call.reject("setBars failed: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void setSecure(PluginCall call) {
        final boolean on = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        getActivity().runOnUiThread(() -> {
            Window w = getActivity().getWindow();
            if (on) w.addFlags(WindowManager.LayoutParams.FLAG_SECURE);
            else w.clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
            JSObject r = new JSObject();
            r.put("enabled", on);
            call.resolve(r);
        });
    }
}
