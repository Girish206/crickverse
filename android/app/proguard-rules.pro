# ---- RunMitra (release builds run R8: app/build.gradle) ----
# Capacitor's own consumer rules already keep every plugin class (anything
# extending com.getcapacitor.Plugin, so AppWindowPlugin too) and the methods
# the web page calls. What's kept here is what is still found by name.

# The web page talks to the app through these @JavascriptInterface methods.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Live updates (@capgo/capacitor-updater ships no R8 rules): its downloader
# runs as a background worker created by class name, and it reads its JSON
# by field name. Kept whole; it's small.
-keep class ee.forgr.capacitor_updater.** { *; }
-dontwarn ee.forgr.capacitor_updater.**

# Readable crash reports in the Play Console (the mapping file is uploaded
# with the bundle).
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile
