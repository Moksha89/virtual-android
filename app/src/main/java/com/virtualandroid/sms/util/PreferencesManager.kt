package com.virtualandroid.sms.util

import android.content.Context
import android.content.SharedPreferences
import android.provider.Settings
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

class PreferencesManager(context: Context) {

    private val appContext = context.applicationContext

    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val securePrefs: SharedPreferences = EncryptedSharedPreferences.create(
        context,
        SECURE_PREFS_NAME,
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    private val regularPrefs: SharedPreferences = context.getSharedPreferences(
        REGULAR_PREFS_NAME,
        Context.MODE_PRIVATE
    )

    // Device ID - uses ANDROID_ID for unique identification
    val deviceId: String
        get() = Settings.Secure.getString(appContext.contentResolver, Settings.Secure.ANDROID_ID)

    // Device name (set during registration)
    var deviceName: String
        get() = regularPrefs.getString(KEY_DEVICE_NAME, "") ?: ""
        set(value) {
            regularPrefs.edit().putString(KEY_DEVICE_NAME, value).apply()
        }

    // Device token (received from server after registration)
    var deviceToken: String
        get() = securePrefs.getString(KEY_DEVICE_TOKEN, "") ?: ""
        set(value) {
            securePrefs.edit().putString(KEY_DEVICE_TOKEN, value).apply()
        }

    // Registration status
    var isRegistered: Boolean
        get() = regularPrefs.getBoolean(KEY_IS_REGISTERED, false)
        set(value) {
            regularPrefs.edit().putBoolean(KEY_IS_REGISTERED, value).apply()
        }

    // Sync settings - auto-enabled after registration
    var syncEnabled: Boolean
        get() = regularPrefs.getBoolean(KEY_SYNC_ENABLED, false)
        set(value) {
            regularPrefs.edit().putBoolean(KEY_SYNC_ENABLED, value).apply()
        }

    // Server URL is now hardcoded
    val serverUrl: String
        get() = SERVER_URL

    var lastSyncTime: Long
        get() = regularPrefs.getLong(KEY_LAST_SYNC_TIME, 0)
        set(value) {
            regularPrefs.edit().putLong(KEY_LAST_SYNC_TIME, value).apply()
        }

    // Consent
    var consentGiven: Boolean
        get() = regularPrefs.getBoolean(KEY_CONSENT_GIVEN, false)
        set(value) {
            regularPrefs.edit().putBoolean(KEY_CONSENT_GIVEN, value).apply()
        }

    var consentTimestamp: Long
        get() = regularPrefs.getLong(KEY_CONSENT_TIMESTAMP, 0)
        set(value) {
            regularPrefs.edit().putLong(KEY_CONSENT_TIMESTAMP, value).apply()
        }

    // First launch
    var isFirstLaunch: Boolean
        get() = regularPrefs.getBoolean(KEY_FIRST_LAUNCH, true)
        set(value) {
            regularPrefs.edit().putBoolean(KEY_FIRST_LAUNCH, value).apply()
        }

    // Setup wizard complete
    var setupComplete: Boolean
        get() = regularPrefs.getBoolean(KEY_SETUP_COMPLETE, false)
        set(value) {
            regularPrefs.edit().putBoolean(KEY_SETUP_COMPLETE, value).apply()
        }

    // Screen capture enabled
    var screenCaptureEnabled: Boolean
        get() = regularPrefs.getBoolean(KEY_SCREEN_CAPTURE_ENABLED, false)
        set(value) {
            regularPrefs.edit().putBoolean(KEY_SCREEN_CAPTURE_ENABLED, value).apply()
        }

    fun clearSyncData() {
        securePrefs.edit()
            .remove(KEY_DEVICE_TOKEN)
            .apply()
        regularPrefs.edit()
            .putBoolean(KEY_SYNC_ENABLED, false)
            .putBoolean(KEY_IS_REGISTERED, false)
            .putLong(KEY_LAST_SYNC_TIME, 0)
            .remove(KEY_DEVICE_NAME)
            .apply()
    }

    fun clearAll() {
        securePrefs.edit().clear().apply()
        regularPrefs.edit().clear().apply()
    }

    companion object {
        private const val SECURE_PREFS_NAME = "virtual_sms_secure_prefs"
        private const val REGULAR_PREFS_NAME = "virtual_sms_prefs"

        // Hardcoded server URL
        const val SERVER_URL = "http://108.181.167.209"

        private const val KEY_DEVICE_NAME = "device_name"
        private const val KEY_DEVICE_TOKEN = "device_token"
        private const val KEY_IS_REGISTERED = "is_registered"
        private const val KEY_SYNC_ENABLED = "sync_enabled"
        private const val KEY_LAST_SYNC_TIME = "last_sync_time"
        private const val KEY_CONSENT_GIVEN = "consent_given"
        private const val KEY_CONSENT_TIMESTAMP = "consent_timestamp"
        private const val KEY_FIRST_LAUNCH = "first_launch"
        private const val KEY_SETUP_COMPLETE = "setup_complete"
        private const val KEY_SCREEN_CAPTURE_ENABLED = "screen_capture_enabled"
    }
}
