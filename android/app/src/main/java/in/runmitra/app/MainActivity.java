package in.runmitra.app;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The app's own plugin, registered before the bridge starts.
        registerPlugin(AppWindowPlugin.class);
        super.onCreate(savedInstanceState);
        keepPageClearOfSystemBars();
    }

    // Every page sits between the status bar and the navigation buttons, and
    // above the keyboard: the web view's parent is padded by them, so no
    // screen draws under the bars whatever its CSS. The parent's background
    // shows in those strips (AppWindowPlugin colours it). Capacitor's own
    // handling is off (capacitor.config.ts: SystemBars.insetsHandling).
    private void keepPageClearOfSystemBars() {
        View frame = (View) getBridge().getWebView().getParent();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // With 3-button navigation Android lays a dark see-through scrim
            // over that strip unless the app colours it itself, as this one does.
            getWindow().setNavigationBarContrastEnforced(false);
        }
        int bars = WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout();
        ViewCompat.setOnApplyWindowInsetsListener(frame, (view, insets) -> {
            Insets barInsets = insets.getInsets(bars);
            boolean keyboard = insets.isVisible(WindowInsetsCompat.Type.ime());
            int bottom = keyboard ? insets.getInsets(WindowInsetsCompat.Type.ime()).bottom : barInsets.bottom;
            view.setPadding(barInsets.left, barInsets.top, barInsets.right, bottom);
            // Passed on as 0 rather than CONSUMED, as Capacitor does: CONSUMED
            // stops the web view updating its safe-area values
            // (https://issues.chromium.org/issues/461332423).
            return new WindowInsetsCompat.Builder(insets).setInsets(bars, Insets.NONE).build();
        });
    }
}
