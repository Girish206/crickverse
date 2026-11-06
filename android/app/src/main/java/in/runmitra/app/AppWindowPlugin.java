package in.runmitra.app;

import android.graphics.Color;
import android.view.View;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// The colour behind the status bar and the navigation buttons: the web
// view's parent, which MainActivity pads by them. The page sets it from its
// theme-color (src/app-shell/nativeShell.ts). (The window's own background
// didn't always redraw when changed, so it's this view's.)
@CapacitorPlugin(name = "AppWindow")
public class AppWindowPlugin extends Plugin {

    @PluginMethod
    public void setBackgroundColor(PluginCall call) {
        String color = call.getString("color", "");
        int parsed;
        try {
            parsed = Color.parseColor(color);
        } catch (IllegalArgumentException e) {
            call.reject("Not a colour: " + color);
            return;
        }
        getActivity().runOnUiThread(() -> {
            View frame = (View) getBridge().getWebView().getParent();
            frame.setBackgroundColor(parsed);
            call.resolve();
        });
    }
}
